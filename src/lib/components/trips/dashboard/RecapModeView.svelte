<script lang="ts">
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

	interface Activity {
		id: string;
		title: string;
		date: Date | string;
		participants?: Array<{ user?: { id: string; name: string | null } | null }>;
	}
	interface MealSlot {
		id: string;
		date: Date | string;
		mealType: string;
		assignedUserId?: string | null;
		assignedUser?: { id: string; name: string | null } | null;
	}

	let {
		tripId,
		isHost = false,
		trip = {},
		activities = [],
		mealSlots = [],
		members = [],
		userInvoices = [],
		totalCost = 0,
		rsvps = []
	}: {
		tripId: string;
		isHost?: boolean;
		trip?: { name?: string | null; checkInDate?: Date | string | null; checkOutDate?: Date | string | null };
		activities?: Activity[];
		mealSlots?: MealSlot[];
		members?: Array<{ user?: { id: string; name: string | null; avatarUrl?: string | null } | null }>;
		userInvoices?: Array<{ status: string; totalAmount: number }>;
		totalCost?: number;
		rsvps?: Array<{ status: string; user?: { id: string; name: string | null; avatarUrl?: string | null } | null }>;
	} = $props();

	const nightsStayed = $derived.by(() => {
		if (!trip?.checkInDate || !trip?.checkOutDate) return 0;
		const start = new Date(trip.checkInDate);
		const end = new Date(trip.checkOutDate);
		return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
	});
	const activitiesCount = $derived(activities.length);
	const mealsCookedCount = $derived(mealSlots.filter((m) => m.assignedUserId).length);
	const finalAttendees = $derived(rsvps.filter((r) => r.status === 'yes'));

	const myPaid = $derived(userInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0));
	const myOwed = $derived(userInvoices.filter((i) => i.status === 'due').reduce((s, i) => s + i.totalAmount, 0));

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}

	const statCards = $derived([
		{ label: 'Nights', value: nightsStayed, icon: 'moon', color: '#6366f1' },
		{ label: 'Activities', value: activitiesCount, icon: 'activity', color: '#f97316' },
		{ label: 'Meals cooked', value: mealsCookedCount, icon: 'chef', color: '#14b8a6' }
	]);

	const badges = $derived([
		{ title: 'Most photos uploaded', emoji: '📸', detail: 'Coming soon' },
		{ title: 'Most activities planned', emoji: '🏅', detail: 'Coming soon' },
		{ title: 'Most meals cooked', emoji: '👨‍🍳', detail: 'Coming soon' }
	]);
</script>

<div class="recap-wrapper">
	<!-- Celebration banner -->
	<div class="recap-banner">
		<div class="recap-banner-inner">
			<span class="recap-trophy" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
			</span>
			<div class="recap-banner-text">
				<h2 class="recap-banner-heading">Trip complete!</h2>
				<p class="recap-banner-sub">This trip is now read-only. Here's the recap.</p>
			</div>
			<div class="recap-confetti" aria-hidden="true">
				<span class="c-dot c1"></span>
				<span class="c-dot c2"></span>
				<span class="c-dot c3"></span>
				<span class="c-dot c4"></span>
				<span class="c-dot c5"></span>
				<span class="c-dot c6"></span>
			</div>
		</div>
	</div>

	<div class="recap-layout">
		<!-- PHOTO GALLERY (full width, hero-like) -->
		<div class="recap-gallery">
			<div class="recap-gallery-card">
				<div class="recap-gallery-header">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
					<h3>Photo & video gallery</h3>
					<span class="recap-gallery-badge">Export</span>
				</div>
				<div class="recap-gallery-grid">
					{#each Array(6) as _, i}
						<div class="recap-photo-slot" style="animation-delay: {i * 0.08}s">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.25"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
						</div>
					{/each}
				</div>
				<p class="recap-gallery-note">Upload and view trip photos here. Gallery coming soon.</p>
			</div>
		</div>

		<!-- TRIP STATS (3 metric cards, like Planning's metric-card row) -->
		<div class="recap-stats-row">
			{#each statCards as s}
				<div class="recap-stat-card" style="--stat-color: {s.color}">
					<div class="recap-stat-icon">
						{#if s.icon === 'moon'}
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
						{:else if s.icon === 'activity'}
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-5.5 0-10-3.5-10-8V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4c0 4.5-4.5 8-10 8z"/><path d="M9 5v1M12 4v2M15 5v1"/></svg>
						{/if}
					</div>
					<span class="recap-stat-value">{s.value}</span>
					<span class="recap-stat-label">{s.label}</span>
				</div>
			{/each}
		</div>

		<!-- ATTENDEES + COST (side by side) -->
		<div class="recap-attendees">
			<div class="recap-section-header">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
				<h3>Final attendees</h3>
				<span class="recap-count-badge">{finalAttendees.length}</span>
			</div>
			<div class="recap-attendee-grid">
				{#each finalAttendees as r}
					{#if r.user?.id}
						<ProfileTooltip userId={r.user.id}>
							<button type="button" class="recap-att" onclick={() => openProfileCard(r.user!.id)}>
								<span class="recap-att-avatar">
									{#if r.user.avatarUrl}
										<img src={r.user.avatarUrl} alt="" class="recap-att-img" />
									{:else}
										{initials(r.user.name)}
									{/if}
								</span>
								<span class="recap-att-name">{r.user.name ?? 'Guest'}</span>
							</button>
						</ProfileTooltip>
					{:else}
						<span class="recap-att">
							<span class="recap-att-avatar">{initials(r.user?.name)}</span>
							<span class="recap-att-name">{r.user?.name ?? 'Guest'}</span>
						</span>
					{/if}
				{/each}
				{#if finalAttendees.length === 0}
					<p class="recap-empty">No attendees recorded.</p>
				{/if}
			</div>
		</div>

		<div class="recap-cost">
			<div class="recap-receipt">
				<div class="recap-receipt-header">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v.5"/><path d="M12 6v.5"/></svg>
					<h3>Cost summary</h3>
				</div>
				<div class="recap-receipt-body">
					<div class="recap-receipt-row">
						<span>What you owed</span>
						<span class="recap-receipt-val">{myOwed > 0 ? `$${myOwed.toFixed(2)}` : '—'}</span>
					</div>
					<div class="recap-receipt-divider"></div>
					<div class="recap-receipt-row">
						<span>What you paid</span>
						<span class="recap-receipt-val recap-receipt-paid">${myPaid.toFixed(2)}</span>
					</div>
					{#if isHost}
						<div class="recap-receipt-divider thick"></div>
						<div class="recap-receipt-row total">
							<span>Total trip cost</span>
							<span class="recap-receipt-val">{totalCost > 0 ? `$${totalCost.toFixed(2)}` : '—'}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- BADGES (fun, colorful medal cards) -->
		<div class="recap-badges-row">
			<div class="recap-section-header full">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>
				<h3>Badges & fun stats</h3>
			</div>
			<div class="recap-badge-cards">
				{#each badges as b}
					<div class="recap-badge-card">
						<span class="recap-badge-emoji">{b.emoji}</span>
						<span class="recap-badge-title">{b.title}</span>
						<span class="recap-badge-detail">{b.detail}</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- GAMES + MEMORIES (side by side) -->
		<div class="recap-games">
			<div class="recap-card-inner">
				<div class="recap-section-header">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="12" height="12" x="2" y="10" rx="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/></svg>
					<h3>Game results</h3>
				</div>
				<a href="/trips/{tripId}/games" class="recap-card-link">View final results</a>
			</div>
		</div>

		<div class="recap-memories">
			<div class="recap-memories-inner">
				<div class="recap-section-header">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
					<h3>Shared memories</h3>
				</div>
				<div class="recap-quotes">
					<div class="recap-quote-card">
						<p>"Notes, quotes, inside jokes from the trip."</p>
						<span class="recap-quote-attr">— Coming soon</span>
					</div>
				</div>
			</div>
		</div>

		<!-- WHAT'S NEXT (full width CTA row) -->
		<div class="recap-cta-row">
			<a href="/trips/new" class="recap-cta-btn primary">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
				Start another trip with this group
			</a>
			<a href="/trips/new" class="recap-cta-btn secondary">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
				Duplicate trip to plan again
			</a>
		</div>

		<!-- POLLS -->
		<div class="recap-polls">
			<div class="recap-polls-inner">
				<div class="recap-polls-icon" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
				</div>
				<div class="recap-polls-text">
					<h3>Post-trip polls</h3>
					<p>Favorite moment? Would you do this trip again?</p>
				</div>
				<a href="/trips/{tripId}/polls" class="recap-polls-link">View polls</a>
			</div>
		</div>
	</div>
</div>

<style>
	.recap-wrapper {
		position: relative;
		width: 100%;
		padding-left: 2.5rem;
	}

	/* ── Celebration banner ── */
	.recap-banner {
		margin-top: 1.5rem;
		position: relative;
		margin-bottom: 1.5rem;
	}
	.recap-banner-inner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(191, 78, 48, 0.1) 100%);
		border: 1px solid rgba(191, 78, 48, 0.15);
		border-radius: var(--radius-2xl);
		padding: 1rem 1.25rem;
		position: relative;
		overflow: hidden;
	}
	.recap-trophy {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: linear-gradient(135deg, #f59e0b, #f97316);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
	}
	.recap-banner-heading {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.02em;
	}
	.recap-banner-sub {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
	.recap-confetti {
		position: absolute;
		top: 0;
		right: 0;
		width: 120px;
		height: 100%;
		pointer-events: none;
	}
	.c-dot {
		position: absolute;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		opacity: 0.5;
	}
	.c1 { background: #f59e0b; top: 15%; right: 20%; }
	.c2 { background: #6366f1; top: 60%; right: 10%; }
	.c3 { background: #14b8a6; top: 30%; right: 40%; }
	.c4 { background: var(--copper); top: 70%; right: 55%; }
	.c5 { background: #f97316; top: 10%; right: 65%; }
	.c6 { background: #22c55e; top: 80%; right: 30%; }

	/* ── Layout ── */
	.recap-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1.25rem minmax(0, 1fr);
		row-gap: 1.25rem;
	}

	.recap-gallery { grid-column: 1 / 4; }
	.recap-stats-row { grid-column: 1 / 4; }
	.recap-attendees { grid-column: 1; }
	.recap-cost { grid-column: 3; }
	.recap-badges-row { grid-column: 1 / 4; }
	.recap-games { grid-column: 1; }
	.recap-memories { grid-column: 3; }
	.recap-cta-row { grid-column: 1 / 4; }
	.recap-polls { grid-column: 1 / 4; }

	/* ── Gallery ── */
	.recap-gallery-card {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
		padding: 1.25rem;
	}
	.recap-gallery-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: var(--text);
	}
	.recap-gallery-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.recap-gallery-badge {
		margin-left: auto;
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--primary);
		background: rgba(191, 78, 48, 0.1);
		padding: 0.2rem 0.5rem;
		border-radius: 9999px;
	}
	.recap-gallery-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.625rem;
	}
	.recap-photo-slot {
		aspect-ratio: 1;
		border-radius: var(--radius-lg);
		background: var(--surface2);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeSlotIn 0.3s ease both;
	}
	@keyframes fadeSlotIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}
	.recap-gallery-note {
		margin: 0.75rem 0 0;
		text-align: center;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	/* ── Stat cards ── */
	.recap-stats-row {
		display: flex;
		gap: 0.75rem;
	}
	.recap-stat-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 1.25rem 0.75rem;
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}
	.recap-stat-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-soft-hover);
	}
	.recap-stat-icon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--stat-color) 12%, transparent);
		color: var(--stat-color);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.recap-stat-value {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text);
		line-height: 1.1;
		letter-spacing: -0.03em;
	}
	.recap-stat-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	/* ── Attendees ── */
	.recap-attendees {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
		padding: 1rem 1.125rem;
	}
	.recap-section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		color: var(--text);
	}
	.recap-section-header.full { grid-column: 1 / 4; }
	.recap-section-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.recap-count-badge {
		font-size: 0.6875rem;
		font-weight: 700;
		background: var(--surface2);
		color: var(--muted);
		padding: 0.15rem 0.4rem;
		border-radius: 9999px;
	}
	.recap-attendee-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.recap-att {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 56px;
		border: none;
		padding: 0;
		background: none;
		cursor: pointer;
		font: inherit;
	}
	.recap-att-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--primary));
		color: white;
		font-size: 0.6875rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.recap-att-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.recap-att-name {
		font-size: 0.625rem;
		color: var(--muted);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 56px;
	}

	/* ── Cost receipt ── */
	.recap-receipt {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
		padding: 1rem 1.125rem;
		height: 100%;
	}
	.recap-receipt-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		color: var(--text);
	}
	.recap-receipt-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.recap-receipt-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.recap-receipt-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text);
	}
	.recap-receipt-row.total {
		font-weight: 700;
	}
	.recap-receipt-val {
		font-weight: 600;
	}
	.recap-receipt-paid {
		color: #22c55e;
	}
	.recap-receipt-divider {
		border: none;
		border-top: 1px dashed var(--border);
		margin: 0.25rem 0;
	}
	.recap-receipt-divider.thick {
		border-top: 2px dashed var(--border);
	}

	/* ── Badges ── */
	.recap-badge-cards {
		grid-column: 1 / 4;
		display: flex;
		gap: 0.75rem;
	}
	.recap-badge-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 1rem 0.75rem;
		background: linear-gradient(135deg, rgba(248, 244, 221, 0.5) 0%, rgba(252, 248, 200, 0.4) 100%);
		border: 1px solid rgba(191, 78, 48, 0.12);
		border-radius: var(--radius-2xl);
		text-align: center;
		transition: transform var(--transition-fast);
	}
	.recap-badge-card:hover { transform: translateY(-2px); }
	.recap-badge-emoji {
		font-size: 1.75rem;
		line-height: 1;
	}
	.recap-badge-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}
	.recap-badge-detail {
		font-size: 0.75rem;
		color: var(--muted);
	}

	/* ── Games & Memories ── */
	.recap-games, .recap-memories {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
	}
	.recap-card-inner, .recap-memories-inner {
		padding: 1rem 1.125rem;
	}
	.recap-card-link {
		display: inline-block;
		margin-top: 0.25rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}
	.recap-card-link:hover { text-decoration: underline; }

	.recap-quotes {
		margin-top: 0.5rem;
	}
	.recap-quote-card {
		background: linear-gradient(135deg, rgba(248, 244, 221, 0.4), rgba(252, 248, 200, 0.3));
		border-radius: var(--radius-lg);
		padding: 0.875rem 1rem;
		border-left: 3px solid var(--copper);
	}
	.recap-quote-card p {
		margin: 0;
		font-size: 0.875rem;
		font-style: italic;
		color: var(--text);
		line-height: 1.5;
	}
	.recap-quote-attr {
		display: block;
		margin-top: 0.375rem;
		font-size: 0.75rem;
		color: var(--muted);
		font-style: normal;
	}

	/* ── CTAs ── */
	.recap-cta-row {
		display: flex;
		gap: 0.75rem;
	}
	.recap-cta-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.25rem;
		border-radius: var(--radius-2xl);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}
	.recap-cta-btn.primary {
		background: var(--primary);
		color: white;
		box-shadow: 0 4px 14px rgba(191, 78, 48, 0.2);
	}
	.recap-cta-btn.primary:hover {
		background: var(--primaryHover);
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(191, 78, 48, 0.3);
	}
	.recap-cta-btn.secondary {
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border-soft);
		box-shadow: var(--shadow-sm);
	}
	.recap-cta-btn.secondary:hover {
		background: var(--surface2);
		transform: translateY(-1px);
	}

	/* ── Polls ── */
	.recap-polls-inner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(99, 102, 241, 0.12));
		border: 1px solid rgba(99, 102, 241, 0.15);
		border-radius: var(--radius-2xl);
		padding: 1rem 1.25rem;
	}
	.recap-polls-icon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #6366f1;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.recap-polls-text h3 {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}
	.recap-polls-text p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.recap-polls-link {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 600;
		background: #6366f1;
		color: white;
		text-decoration: none;
		transition: background var(--transition-fast), transform var(--transition-fast);
	}
	.recap-polls-link:hover {
		background: #4f46e5;
		transform: translateY(-1px);
	}

	/* ── Shared ── */
	.recap-empty {
		color: var(--muted);
		font-size: 0.8125rem;
		margin: 0;
	}

	/* ── Responsive ── */
	@media (max-width: 1024px) {
		.recap-wrapper { padding-left: 0; }
		.recap-banner { margin-top: 0; }
		.recap-layout {
			grid-template-columns: 1fr;
			row-gap: 1rem;
		}
		.recap-gallery,
		.recap-stats-row,
		.recap-attendees,
		.recap-cost,
		.recap-badges-row,
		.recap-games,
		.recap-memories,
		.recap-cta-row,
		.recap-polls {
			grid-column: 1;
		}
		.recap-section-header.full { grid-column: 1; }
		.recap-badge-cards { grid-column: 1; flex-wrap: wrap; }
		.recap-gallery-grid { grid-template-columns: repeat(3, 1fr); }
		.recap-stats-row { flex-wrap: wrap; }
		.recap-stat-card { min-width: 100px; }
		.recap-cta-row { flex-direction: column; }
	}
</style>
