<script lang="ts">
	import DashboardCard from './DashboardCard.svelte';
	import TripGoals from '$lib/components/trips/TripGoals.svelte';
	import Checklist from './Checklist.svelte';

	interface ChecklistStats {
		rsvp_pending?: number;
		payment_pending?: number;
		trip_meals_total?: number;
		trip_activities_total?: number;
		missing_trip_details_count?: number;
		missing_trip_details_summary?: string;
		current_user_rsvp_status?: string | null;
		guest_meals_contributed?: number;
		guest_activities_contributed?: number;
	}

	interface Props {
		isHost: boolean;
		tripId: string;
		currentUserId: string;
		members: Array<{ user?: { name: string | null; email: string | null; avatarUrl?: string | null } | null }>;
		rsvps: Array<{ status: string; user?: { name: string | null } | null; arrivalDatetime?: string | null }>;
		guestPreviewList: Array<{ user?: { name: string | null; email: string | null; avatarUrl?: string | null } | null }>;
		pendingRsvpCount: number;
		recentActivityItems: Array<{ text: string }>;
		/** Full list for "View activity log" modal (date desc) */
		allActivityItems?: Array<{ text: string; at: string }>;
		userRsvp?: { status?: string; arrivalDatetime?: string | null } | null;
		userProfile?: { dietaryRestrictions?: string | null; allergies?: string | null } | null;
		myAssignment?: { room?: { name: string | null } | null } | null;
		myDueTotal: number;
		myPaidTotal: number;
		nextUpcomingItem?: { title: string; date?: string | null } | null;
		// TripGoalCircle props
		rsvpCurrent: number;
		rsvpTotal: number;
		rsvpPct: number;
		bedsCurrent: number;
		bedsTotal: number;
		bedsPct: number;
		fundingCurrent: number;
		fundingTotal: number;
		fundingPct: number;
		fundingDisplay: string;
		guestsHref: string;
		roomsHref: string;
		paymentsHref: string;
		nudgePending?: () => void;
		inviteCode?: string;
		showToast?: (msg: string) => void;
		/** Checklist stats for role-based checklists */
		checklistStats: ChecklistStats;
	}

	let {
		isHost,
		tripId,
		currentUserId,
		members,
		rsvps,
		guestPreviewList,
		pendingRsvpCount,
		recentActivityItems,
		allActivityItems = [],
		userRsvp,
		userProfile,
		myAssignment,
		myDueTotal,
		myPaidTotal,
		nextUpcomingItem,
		rsvpCurrent,
		rsvpTotal,
		rsvpPct,
		bedsCurrent,
		bedsTotal,
		bedsPct,
		fundingCurrent,
		fundingTotal,
		fundingPct,
		fundingDisplay,
		guestsHref,
		roomsHref,
		paymentsHref,
		nudgePending,
		inviteCode,
		showToast,
		checklistStats
	}: Props = $props();

	function initials(name: string | null | undefined, email?: string | null): string {
		if (name?.trim()) {
			const parts = name.trim().split(/\s+/);
			return parts.length >= 2
				? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
				: name.slice(0, 2).toUpperCase();
		}
		if (email) return email.slice(0, 2).toUpperCase();
		return '?';
	}

	const hasMissingDietary = $derived(!userProfile?.dietaryRestrictions && !userProfile?.allergies);
	const hasMissingArrival = $derived(!userRsvp?.arrivalDatetime && userRsvp?.status === 'yes');

	let showActivityLogModal = $state(false);
	function openActivityLog() {
		showActivityLogModal = true;
	}
	function closeActivityLog() {
		showActivityLogModal = false;
	}
	/** Sorted date desc (newest first) for display */
	const sortedActivityForModal = $derived(
		[...allActivityItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
	);
	function formatActivityDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	$effect(() => {
		if (!showActivityLogModal) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeActivityLog();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<div class="dashboard-wrapper">
	{#snippet stickyPinIcon()}
		<span class="sticky-card-icon sticky-pin-icon" aria-hidden="true">
			<span class="pin-circle"></span>
			<svg class="pin-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="7" r="4"/>
				<path d="M12 11v11"/>
			</svg>
		</span>
	{/snippet}
	{#snippet guestsNudgeButton()}
		<button type="button" class="pill-btn pill-btn-text" onclick={nudgePending}>
			Nudge pending
		</button>
	{/snippet}
	<!-- Layout: row1 = reminders | goals | recent, row2 = guests under reminders + goals only -->
	<div class="dashboard-layout">
		<div class="left-column">
			<div class="sticky-card-wrapper">
				<DashboardCard
					variant="sticky"
					title="Reminders"
					headerLeft={stickyPinIcon}
				>
					<div class="sticky-content">
						<Checklist role={isHost ? 'host' : 'guest'} {tripId} {currentUserId} computedStats={checklistStats} />
					</div>
				</DashboardCard>
			</div>
		</div>

		<div class="goals-cell">
			<div class="goals-card-wrap">
				<DashboardCard>
					<TripGoals
						{rsvpCurrent}
						{rsvpTotal}
						{rsvpPct}
						{bedsCurrent}
						{bedsTotal}
						{bedsPct}
						{fundingCurrent}
						{fundingTotal}
						{fundingPct}
						{fundingDisplay}
						{guestsHref}
						{roomsHref}
						{paymentsHref}
					/>
				</DashboardCard>
			</div>
		</div>

		<div class="recent-cell">
			<DashboardCard title="Recent activity" cta={{ label: 'View activity log', onClick: openActivityLog }}>
				{#if recentActivityItems.length > 0}
					<ul class="activity-list">
						{#each recentActivityItems as item}
							<li class="activity-item">{item.text}</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">No recent activity</p>
				{/if}
			</DashboardCard>
		</div>

		<!-- Activity log modal -->
		{#if showActivityLogModal}
			<div class="activity-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="activity-log-title" onclick={closeActivityLog}>
				<div class="activity-modal" onclick={(e) => e.stopPropagation()}>
					<div class="activity-modal-header">
						<h2 id="activity-log-title" class="activity-modal-title">Activity log</h2>
						<button type="button" class="activity-modal-close" onclick={closeActivityLog} aria-label="Close">×</button>
					</div>
					<div class="activity-modal-body">
						{#if sortedActivityForModal.length > 0}
							<ul class="activity-log-list">
								{#each sortedActivityForModal as item}
									<li class="activity-log-item">
										<span class="activity-log-date">{formatActivityDate(item.at)}</span>
										<span class="activity-log-text">{item.text}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="muted">No activity yet</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<div class="guests-row">
			<div class="guests-card-wrapper">
				<DashboardCard
					title="Guests"
					titleHref={`/trips/${tripId}/guests`}
					headerRight={isHost && nudgePending ? guestsNudgeButton : undefined}
				>
					<div class="guests-preview">
						<div class="avatar-row">
							{#each guestPreviewList as member}
								<span class="avatar" title={member.user?.name ?? member.user?.email ?? ''}>
									{#if member.user?.avatarUrl}
										<img src={member.user.avatarUrl} alt="" class="avatar-img" />
									{:else}
										{initials(member.user?.name, member.user?.email)}
									{/if}
								</span>
							{/each}
						</div>
						<div class="guests-meta">
							<span class="pending-badge">{pendingRsvpCount} pending RSVP</span>
						</div>
					</div>
				</DashboardCard>
			</div>
		</div>
	</div>
</div>

<style>
	.dashboard-wrapper {
		position: relative;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		padding-left: 2.5rem;
	}

	/*
	 * LAYOUT RULES (keep when changing styles):
	 * - Row 1: Reminders (col 1) | Trip goals (col 3) | Recent activity (col 5). Reminders and goals MUST line up: row height = sticky card height, goals cell stretches to match.
	 * - Row 2: Guests ONLY under Reminders + Goals (grid-column 1/4). Guests sit directly underneath with a small gap (margin-top). Do not span guests under Recent.
	 * - Recent activity stays in its own column, row 1–3; it does not affect reminders/goals/guests alignment.
	 */
	.dashboard-layout {
		display: grid;
		grid-template-columns: minmax(0, 392px) 1.5rem minmax(0, 2fr) 1.25rem minmax(0, 1fr);
		grid-template-rows: auto auto;
		gap: 0;
		margin-top: 1.5rem;
		position: relative;
		z-index: 0;
		width: 100%;
		min-width: 0;
		align-items: stretch;
	}

	.left-column {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
		z-index: 10;
	}

	/* Pull sticky up so it overlaps the hero */
	.sticky-card-wrapper {
		margin-top: -10rem;
		position: relative;
		width: 100%;
		z-index: 10;
	}

	/* Rule: same height as row 1 (sticky); goals end where sticky ends */
	.goals-cell {
		grid-column: 3;
		grid-row: 1;
		min-width: 0;
		margin-top: -1rem;
	}

	/* Recent activity: 50% of full span height (320px) */
	.recent-cell {
		grid-column: 5;
		grid-row: 1 / 3;
		min-width: 0;
		align-self: start;
		height: 320px;
		min-height: 320px;
	}

	.goals-cell :global(.dashboard-card),
	.recent-cell :global(.dashboard-card) {
		min-height: 0;
		height: 100%;
	}

	/* Rule: guests directly below reminders + goals; column 1–4 only (not under recent) */
	.guests-row {
		grid-column: 1 / 4;
		grid-row: 2;
		margin-top: 0.5rem;
		min-width: 0;
	}

	.guests-card-wrapper {
		width: 100%;
		min-height: 0;
	}

	.guests-card-wrapper :global(.dashboard-card) {
		min-height: 56px;
		max-height: 88px;
	}

	/* Trip goals: no background */
	.goals-card-wrap {
		min-width: 0;
	}

	.goals-card-wrap :global(.dashboard-card) {
		background: transparent;
		border: none;
		box-shadow: none;
	}

	.goals-card-wrap :global(.dashboard-card:hover) {
		transform: none;
		box-shadow: none;
	}

	.goals-card-wrap :global(.goal-card) {
		background: transparent;
		box-shadow: none;
	}

	/* Trip goals: fill cell height (same as sticky); boxes end where sticky ends */
	.goals-cell :global(.dashboard-card) {
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.goals-cell :global(.dashboard-card .card-body) {
		flex: 1;
		min-height: 0;
		min-width: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
	}
	.goals-cell :global(.viz) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.goals-cell :global(.viz-grid) {
		flex: 1;
		gap: 1rem;
		align-items: stretch;
		min-height: 0;
	}
	.goals-cell :global(.viz-card) {
		padding: 1.8rem 0.75rem;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.goals-cell :global(.viz-title) {
		margin-bottom: 1.1rem;
		flex-shrink: 0;
	}
	.goals-cell :global(.card-gauge) {
		margin-bottom: 0.95rem;
		width: 87px;
		height: 64px;
		flex-shrink: 0;
	}
	.goals-cell :global(.card-gauge .gauge-svg) {
		width: 87px;
		height: 64px;
	}
	.goals-cell :global(.card-metric) {
		font-size: 1rem;
	}
	.goals-cell :global(.card-label),
	.goals-cell :global(.card-cta),
	.goals-cell :global(.card-done) {
		font-size: 0.6875rem;
	}

	/* Recent activity card: fill cell (320px); more space below title, subtle list */
	.recent-cell :global(.dashboard-card) {
		height: 100%;
		min-height: 320px;
		display: flex;
		flex-direction: column;
	}
	.recent-cell :global(.dashboard-card .card-body) {
		flex: 1;
		min-height: 0;
		padding-top: 0.875rem;
	}
	.recent-cell :global(.card-cta .cta-link) {
		font-size: 0.7rem;
	}

	/* Reminders tall: fills row and overlaps hero (400px visible + 10rem overlap) */
	.sticky-card-wrapper :global(.dashboard-card.variant-sticky) {
		max-height: 560px;
		min-height: 400px;
		width: 100%;
		overflow-y: auto;
		/* Equal inset so icon is equidistant from top and left edges */
		padding: 1rem 0.625rem 0.5rem 1rem;
	}

	.sticky-card-wrapper :global(.card-header) {
		gap: 0.375rem;
		justify-content: flex-start;
	}

	.sticky-card-wrapper :global(.card-header-left) {
		margin-right: 0.25rem;
	}

	@media (max-width: 1024px) {
		.dashboard-wrapper {
			padding-left: 0;
		}

		.left-column {
			position: relative;
			top: 0;
			width: 100%;
			max-width: 100%;
			margin-bottom: 1.5rem;
		}

		/* Stacked: reminders → goals → recent → guests (guests still "under" reminders+goals) */
		.dashboard-layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto auto;
			margin-top: 0;
			margin-left: 0;
			width: 100%;
			max-width: 100%;
		}

		.sticky-card-wrapper {
			margin-top: 0;
			width: 100%;
			max-width: 100%;
		}

		.goals-cell {
			grid-column: 1;
			grid-row: 2;
		}

		.recent-cell {
			grid-column: 1;
			grid-row: 3;
		}

		.guests-row {
			grid-column: 1;
			grid-row: 4;
			margin-top: 1rem;
		}

		.goals-cell :global(.dashboard-card),
		.recent-cell :global(.dashboard-card) {
			min-height: 320px;
		}
	}

	.sticky-card-wrapper :global(.card-body) {
		padding-top: 2.5rem;
	}

	.sticky-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		flex: 1;
		min-height: 0;
	}

	.sticky-task-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sticky-task-list li {
		margin: 0;
		padding: 0;
	}

	.sticky-task-link {
		font-size: 0.8125rem;
		color: var(--text);
		text-decoration: none;
		line-height: 1.4;
		display: block;
		transition: color var(--transition-fast);
	}

	.sticky-task-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}

	.sticky-no-tasks {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
	}

	.sticky-card-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--text);
	}

	.sticky-card-icon svg {
		display: block;
	}

	.sticky-pin-icon {
		position: relative;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
	}

	.pin-circle {
		position: absolute;
		inset: 0;
		background: #111827;
		border-radius: 50%;
	}

	.sticky-pin-icon .pin-svg {
		position: relative;
		z-index: 1;
		color: rgba(255, 255, 255, 0.95);
		stroke: rgba(255, 255, 255, 0.95);
	}

	.sticky-reminder {
		font-size: 0.8125rem;
		color: var(--text);
		line-height: 1.4;
	}

	.sticky-reminder strong {
		font-weight: 700;
		font-size: 1rem;
	}

	.sticky-list {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.75rem;
		color: var(--text);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		line-height: 1.4;
	}

	.sticky-list li {
		padding-left: 1rem;
		position: relative;
	}

	.sticky-list li::before {
		content: '•';
		position: absolute;
		left: 0;
		color: var(--muted);
	}

	.sticky-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 0.5rem;
	}

	.pill-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.875rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		border: none;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.pill-btn-primary {
		background: var(--primary);
		color: white;
	}

	.pill-btn-primary:hover {
		background: var(--primaryHover);
	}

	.pill-btn-secondary {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-soft);
	}

	.pill-btn-secondary:hover {
		background: var(--text);
		color: white;
	}

	.pill-btn-text {
		background: transparent;
		color: var(--primary);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}

	.pill-btn-text:hover {
		text-decoration: underline;
	}

	.for-you-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.for-you-label {
		font-size: 0.8125rem;
		color: var(--muted);
		flex-shrink: 0;
	}

	.for-you-right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.for-you-value {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text);
	}

	.for-you-value.ok {
		color: var(--primary);
	}

	.missing-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.missing-chip {
		font-size: 0.75rem;
		color: var(--muted);
		background: rgba(255, 255, 255, 0.7);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
	}

	.for-you-next {
		margin-top: 0.25rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-soft);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.activity-list {
		list-style: none;
		margin: 0;
		padding: 0 0 0 0.5rem;
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.45;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-weight: 400;
		border-left: 2px solid var(--border-soft);
	}

	.activity-item {
		padding: 0.125rem 0;
	}

	/* Activity log modal */
	.activity-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.activity-modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border-soft);
		max-width: 480px;
		width: 100%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.activity-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-soft);
		flex-shrink: 0;
	}

	.activity-modal-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
	}

	.activity-modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-md);
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.activity-modal-close:hover {
		color: var(--text);
		background: var(--surface2);
	}

	.activity-modal-body {
		padding: 1rem 1.25rem;
		overflow-y: auto;
		min-height: 0;
	}

	.activity-log-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.activity-log-item {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--border-soft);
		font-size: 0.875rem;
	}

	.activity-log-item:last-child {
		border-bottom: none;
	}

	.activity-log-date {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.activity-log-text {
		color: var(--text);
	}

	.muted {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
	}

	.guests-preview {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.avatar-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.35rem;
		margin-left: 0.5rem;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--slate) 0%, var(--primary) 100%);
		color: white;
		font-size: 0.6875rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.avatar :global(.avatar-img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.guests-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.pending-badge {
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
