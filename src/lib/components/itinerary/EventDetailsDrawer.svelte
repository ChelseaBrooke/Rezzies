<script lang="ts">
	import { formatMinutes } from '$lib/itinerary/overlap.js';

	// ── Types ──────────────────────────────────────────────────────────────

	type RsvpStatus = 'going' | 'maybe' | 'skip';

	type DrawerParticipant = {
		id: string;
		name: string;
		rsvpStatus: RsvpStatus;
	};

	type DrawerAttendance = {
		userId: string;
		userName: string;
		optedOut: boolean;
		dietaryNote?: string | null;
	};

	export type DrawerEvent = {
		// Common
		id: string; // activityId or slotId
		type: 'activity' | 'meal';
		date: string; // "YYYY-MM-DD"
		time: string | null;
		durationMinutes: number;
		notes?: string | null;
		// Activity
		title?: string | null;
		location?: string | null;
		pricePerPerson?: number;
		totalCostToSplit?: number | null;
		participants?: DrawerParticipant[];
		currentUserRsvp?: RsvpStatus;
		// Meal
		mealType?: string;
		menuText?: string | null;
		assignedUser?: { id: string; name: string } | null;
		attendance?: DrawerAttendance[];
		currentUserOptedOut?: boolean;
	};

	// ── Props ──────────────────────────────────────────────────────────────

	let {
		event,
		currentUserId,
		isHost,
		tripId,
		onClose,
		onLocalRsvpUpdate
	}: {
		event: DrawerEvent;
		currentUserId: string;
		isHost: boolean;
		tripId: string;
		onClose: () => void;
		onLocalRsvpUpdate: (eventId: string, newStatus: RsvpStatus | 'meal-in' | 'meal-out') => void;
	} = $props();

	// ── Derived state ──────────────────────────────────────────────────────

	const isActivity = $derived(event.type === 'activity');
	const isMeal = $derived(event.type === 'meal');

	// Activity attendee groups
	const going = $derived(
		(event.participants ?? []).filter((p) => p.rsvpStatus === 'going')
	);
	const maybe = $derived(
		(event.participants ?? []).filter((p) => p.rsvpStatus === 'maybe')
	);
	const skipping = $derived(
		(event.participants ?? []).filter((p) => p.rsvpStatus === 'skip')
	);

	// Meal attendance groups
	const mealAttending = $derived(
		(event.attendance ?? []).filter((a) => !a.optedOut)
	);
	const mealOptedOut = $derived(
		(event.attendance ?? []).filter((a) => a.optedOut)
	);

	// Current user's meal attendance
	const myMealStatus = $derived(event.currentUserOptedOut === true ? 'out' : 'in');

	// Time display
	const timeDisplay = $derived(() => {
		if (!event.time) return 'Time TBD';
		const startMin = parseTimeStr(event.time);
		const endMin = startMin + event.durationMinutes;
		return `${formatMinutes(startMin)} – ${formatMinutes(endMin)}`;
	});

	const dateDisplay = $derived(
		new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		})
	);

	const titleDisplay = $derived(
		event.type === 'activity'
			? (event.title ?? 'Activity')
			: (event.mealType ?? 'meal').charAt(0).toUpperCase() +
				(event.mealType ?? 'meal').slice(1) +
				(event.title ? ` – ${event.title}` : '')
	);

	// ── Helpers ────────────────────────────────────────────────────────────

	function parseTimeStr(t: string): number {
		const m24 = /^(\d{1,2}):(\d{2})$/.exec(t);
		if (m24) return +m24[1] * 60 + +m24[2];
		const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t);
		if (m12) {
			let h = +m12[1];
			const min = +m12[2];
			if (/PM/i.test(m12[3]) && h !== 12) h += 12;
			if (/AM/i.test(m12[3]) && h === 12) h = 0;
			return h * 60 + min;
		}
		return 720;
	}

	function initial(name: string): string {
		return (name ?? '?').charAt(0).toUpperCase();
	}

	// ── RSVP actions ───────────────────────────────────────────────────────

	let rsvpPending = $state(false);

	async function setActivityRsvp(status: RsvpStatus) {
		if (rsvpPending) return;
		rsvpPending = true;
		// Optimistic update
		onLocalRsvpUpdate(event.id, status);
		try {
			const fd = new FormData();
			fd.set('activityId', event.id);
			fd.set('status', status);
			await fetch(`/trips/${tripId}/itinerary?/setActivityRsvp`, { method: 'POST', body: fd });
		} finally {
			rsvpPending = false;
		}
	}

	async function setMealAttendance(optedOut: boolean) {
		if (rsvpPending) return;
		rsvpPending = true;
		onLocalRsvpUpdate(event.id, optedOut ? 'meal-out' : 'meal-in');
		try {
			const fd = new FormData();
			fd.set('slotId', event.id);
			fd.set('optedOut', String(optedOut));
			await fetch(`/trips/${tripId}/itinerary?/setMealAttendance`, { method: 'POST', body: fd });
		} finally {
			rsvpPending = false;
		}
	}

	// ── Meal type badge colors ─────────────────────────────────────────────

	const mealBadgeStyle: Record<string, string> = {
		breakfast: 'background:rgba(249,115,22,.12);color:#9a3412;border-color:#f97316',
		lunch: 'background:rgba(245,158,11,.12);color:#78350f;border-color:#d97706',
		dinner: 'background:rgba(41,76,96,.12);color:#001B2E;border-color:#294C60',
		snack: 'background:rgba(253,186,116,.22);color:#9a3412;border-color:#fb923c'
	};
</script>

<!-- Backdrop (click outside to close) -->
<div
	class="drawer-backdrop"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
></div>

<!-- Drawer panel -->
<aside class="drawer" role="dialog" aria-modal="true" aria-label={titleDisplay}>
	<!-- Header -->
	<div class="drawer-header">
		<div class="drawer-header-left">
			{#if isMeal && event.mealType}
				<span
					class="type-badge"
					style={mealBadgeStyle[event.mealType] ?? mealBadgeStyle.dinner}
				>
					{event.mealType.charAt(0).toUpperCase() + event.mealType.slice(1)}
				</span>
			{:else}
				<span class="type-badge activity-badge">Activity</span>
			{/if}
			<h2 class="drawer-title">{titleDisplay}</h2>
		</div>
		<button class="drawer-close" onclick={onClose} aria-label="Close details">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<path d="M18 6 6 18M6 6l12 12"/>
			</svg>
		</button>
	</div>

	<!-- Body -->
	<div class="drawer-body">

		<!-- When -->
		<div class="detail-row">
			<span class="detail-icon">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
			</span>
			<div class="detail-content">
				<span class="detail-primary">{dateDisplay}</span>
				<span class="detail-secondary">{timeDisplay()}</span>
			</div>
		</div>

		<!-- Where (activity only) -->
		{#if isActivity && event.location}
			<div class="detail-row">
				<span class="detail-icon">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"/><circle cx="12" cy="9" r="2.5"/></svg>
				</span>
				<div class="detail-content">
					<span class="detail-primary">{event.location}</span>
				</div>
			</div>
		{/if}

		<!-- Menu / notes for meals -->
		{#if isMeal && (event.menuText || event.notes)}
			<div class="detail-row">
				<span class="detail-icon">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v21M3 9h18M3 15h18"/></svg>
				</span>
				<div class="detail-content">
					{#if event.menuText}<span class="detail-primary">{event.menuText}</span>{/if}
					{#if event.notes}<span class="detail-secondary">{event.notes}</span>{/if}
				</div>
			</div>
		{/if}

		<!-- Cook (meal only) -->
		{#if isMeal && event.assignedUser}
			<div class="detail-row">
				<span class="detail-icon">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
				</span>
				<div class="detail-content">
					<span class="detail-secondary">Cooking</span>
					<span class="detail-primary">{event.assignedUser.name}</span>
				</div>
			</div>
		{/if}

		<!-- Cost (activity only) -->
		{#if isActivity && event.pricePerPerson && event.pricePerPerson > 0}
			<div class="detail-row">
				<span class="detail-icon">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
				</span>
				<div class="detail-content">
					<span class="detail-primary">${event.pricePerPerson.toFixed(2)} / person</span>
					{#if event.totalCostToSplit}
						<span class="detail-secondary">Total: ${event.totalCostToSplit.toFixed(2)} split evenly</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Notes (activity) -->
		{#if isActivity && event.notes}
			<div class="detail-row">
				<span class="detail-icon">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
				</span>
				<div class="detail-content">
					<span class="detail-primary">{event.notes}</span>
				</div>
			</div>
		{/if}

		<div class="drawer-divider"></div>

		<!-- ── RSVP Controls ─────────────────────────────────────── -->
		{#if isActivity}
			<div class="rsvp-section">
				<p class="section-label">Your RSVP</p>
				<div class="rsvp-row">
					<button
						class="rsvp-btn going"
						class:active={event.currentUserRsvp === 'going'}
						onclick={() => setActivityRsvp('going')}
						disabled={rsvpPending}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
						Going
					</button>
					<button
						class="rsvp-btn maybe"
						class:active={event.currentUserRsvp === 'maybe'}
						onclick={() => setActivityRsvp('maybe')}
						disabled={rsvpPending}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
						Maybe
					</button>
					<button
						class="rsvp-btn skip"
						class:active={event.currentUserRsvp === 'skip'}
						onclick={() => setActivityRsvp('skip')}
						disabled={rsvpPending}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
						Skip
					</button>
				</div>
			</div>
		{/if}

		{#if isMeal}
			<div class="rsvp-section">
				<p class="section-label">Your attendance</p>
				<div class="rsvp-row">
					<button
						class="rsvp-btn going"
						class:active={myMealStatus === 'in'}
						onclick={() => setMealAttendance(false)}
						disabled={rsvpPending}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
						Eating
					</button>
					<button
						class="rsvp-btn skip"
						class:active={myMealStatus === 'out'}
						onclick={() => setMealAttendance(true)}
						disabled={rsvpPending}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
						Skipping
					</button>
				</div>
			</div>
		{/if}

		<div class="drawer-divider"></div>

		<!-- ── Who's coming (Activity) ──────────────────────────────── -->
		{#if isActivity}
			{#if going.length > 0}
				<div class="attendee-section">
					<p class="section-label going-label">
						<span class="label-dot going-dot"></span>Going · {going.length}
					</p>
					<ul class="attendee-list">
						{#each going as person (person.id)}
							<li class="attendee-row">
								<span class="attendee-avatar" class:is-me={person.id === currentUserId}>{initial(person.name)}</span>
								<span class="attendee-name">{person.name}{person.id === currentUserId ? ' (you)' : ''}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if maybe.length > 0}
				<div class="attendee-section">
					<p class="section-label maybe-label">
						<span class="label-dot maybe-dot"></span>Maybe · {maybe.length}
					</p>
					<ul class="attendee-list">
						{#each maybe as person (person.id)}
							<li class="attendee-row">
								<span class="attendee-avatar maybe-avatar">{initial(person.name)}</span>
								<span class="attendee-name">{person.name}{person.id === currentUserId ? ' (you)' : ''}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if skipping.length > 0}
				<div class="attendee-section">
					<p class="section-label skip-label">
						<span class="label-dot skip-dot"></span>Skipping · {skipping.length}
					</p>
					<ul class="attendee-list">
						{#each skipping as person (person.id)}
							<li class="attendee-row">
								<span class="attendee-avatar skip-avatar">{initial(person.name)}</span>
								<span class="attendee-name">{person.name}{person.id === currentUserId ? ' (you)' : ''}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if going.length === 0 && maybe.length === 0 && skipping.length === 0}
				<p class="no-attendees">No RSVPs yet — be the first!</p>
			{/if}
		{/if}

		<!-- ── Meal attendance ────────────────────────────────────────── -->
		{#if isMeal}
			{#if mealAttending.length > 0}
				<div class="attendee-section">
					<p class="section-label going-label">
						<span class="label-dot going-dot"></span>Eating · {mealAttending.length}
					</p>
					<ul class="attendee-list">
						{#each mealAttending as a (a.userId)}
							<li class="attendee-row">
								<span class="attendee-avatar" class:is-me={a.userId === currentUserId}>{initial(a.userName)}</span>
								<span class="attendee-name">
									{a.userName}{a.userId === currentUserId ? ' (you)' : ''}
									{#if a.dietaryNote}<em class="dietary-note"> · {a.dietaryNote}</em>{/if}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if mealOptedOut.length > 0}
				<div class="attendee-section">
					<p class="section-label skip-label">
						<span class="label-dot skip-dot"></span>Skipping · {mealOptedOut.length}
					</p>
					<ul class="attendee-list">
						{#each mealOptedOut as a (a.userId)}
							<li class="attendee-row">
								<span class="attendee-avatar skip-avatar">{initial(a.userName)}</span>
								<span class="attendee-name">{a.userName}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}

	</div>

	<!-- Footer actions (host only) -->
	{#if isHost}
		<div class="drawer-footer">
			{#if isActivity}
				<a href="/trips/{tripId}/activities" class="footer-edit-btn">Edit activity</a>
			{:else}
				<a href="/trips/{tripId}/meals" class="footer-edit-btn">Edit meal</a>
			{/if}
		</div>
	{/if}
</aside>

<style>
	/* ── Backdrop ── */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 27, 46, 0.18);
		z-index: 100;
		backdrop-filter: blur(1px);
	}

	/* ── Panel ── */
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 360px;
		max-width: 100vw;
		background: white;
		z-index: 101;
		display: flex;
		flex-direction: column;
		box-shadow: -8px 0 40px rgba(0, 27, 46, 0.12);
		animation: slideIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}
	@keyframes slideIn {
		from { transform: translateX(100%); opacity: 0; }
		to   { transform: translateX(0);    opacity: 1; }
	}

	/* ── Header ── */
	.drawer-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #f0f2f5;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
	}
	.drawer-header-left {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}
	.drawer-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #001B2E;
		margin: 0;
		line-height: 1.25;
	}
	.drawer-close {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: none;
		background: #f8fafc;
		color: #64748b;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}
	.drawer-close:hover { background: #e2e8f0; }

	/* ── Type badges ── */
	.type-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.6rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border: 1px solid transparent;
		width: fit-content;
	}
	.activity-badge {
		background: rgba(0, 27, 46, 0.07);
		color: #001B2E;
		border-color: #001B2E;
	}

	/* ── Body ── */
	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	/* ── Detail rows ── */
	.detail-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.detail-icon {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		background: #f8fafc;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748b;
		margin-top: 1px;
	}
	.detail-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.detail-primary {
		font-size: 0.9rem;
		font-weight: 600;
		color: #1e293b;
	}
	.detail-secondary {
		font-size: 0.8125rem;
		color: #64748b;
	}

	.drawer-divider {
		height: 1px;
		background: #f0f2f5;
		margin: 0.75rem 0 1rem;
	}

	/* ── RSVP section ── */
	.section-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #94a3b8;
		margin: 0 0 0.6rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.rsvp-section {
		margin-bottom: 1rem;
	}
	.rsvp-row {
		display: flex;
		gap: 0.5rem;
	}
	.rsvp-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 0.5rem 0.5rem;
		border-radius: 10px;
		border: 1.5px solid #e2e8f0;
		background: white;
		font-size: 0.8rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}
	.rsvp-btn:disabled { opacity: 0.6; cursor: default; }
	.rsvp-btn.going.active  { background: rgba(16,185,129,.1);  border-color: #10b981; color: #065f46; }
	.rsvp-btn.maybe.active  { background: rgba(245,158,11,.1);  border-color: #d97706; color: #78350f; }
	.rsvp-btn.skip.active   { background: rgba(239,68,68,.08);  border-color: #f87171; color: #991b1b; }
	.rsvp-btn.going:hover:not(.active):not(:disabled) { background: rgba(16,185,129,.06); }
	.rsvp-btn.maybe:hover:not(.active):not(:disabled) { background: rgba(245,158,11,.06); }
	.rsvp-btn.skip:hover:not(.active):not(:disabled)  { background: rgba(239,68,68,.06); }

	/* ── Attendee sections ── */
	.attendee-section {
		margin-bottom: 1rem;
	}
	.label-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.going-dot  { background: #10b981; }
	.maybe-dot  { background: #d97706; }
	.skip-dot   { background: #94a3b8; }
	.going-label { color: #065f46; }
	.maybe-label { color: #78350f; }
	.skip-label  { color: #64748b; }

	.attendee-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.attendee-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.attendee-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: linear-gradient(135deg, #294C60, #001B2E);
		color: white;
		font-size: 0.7rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.attendee-avatar.is-me {
		background: linear-gradient(135deg, #f97316, #ea580c);
	}
	.attendee-avatar.maybe-avatar { background: linear-gradient(135deg, #d97706, #92400e); }
	.attendee-avatar.skip-avatar  { background: #cbd5e1; color: #64748b; }
	.attendee-name {
		font-size: 0.875rem;
		color: #374151;
		font-weight: 500;
	}
	.dietary-note {
		font-size: 0.75rem;
		color: #94a3b8;
		font-style: normal;
	}
	.no-attendees {
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 0;
		font-style: italic;
	}

	/* ── Footer ── */
	.drawer-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid #f0f2f5;
		flex-shrink: 0;
	}
	.footer-edit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.625rem;
		border-radius: 10px;
		border: 1.5px solid #e2e8f0;
		background: white;
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
		text-decoration: none;
		transition: background 0.15s, border-color 0.15s;
	}
	.footer-edit-btn:hover { background: #f8fafc; border-color: #cbd5e1; }

	/* ── Mobile: bottom sheet ── */
	@media (max-width: 640px) {
		.drawer {
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			width: 100%;
			max-height: 85vh;
			border-radius: 20px 20px 0 0;
			animation: slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1);
		}
		@keyframes slideUp {
			from { transform: translateY(100%); }
			to   { transform: translateY(0); }
		}
	}
</style>
