<script lang="ts">
	import DashboardCard from './DashboardCard.svelte';
	import TripGoalCircle from '$lib/components/trips/TripGoalCircle.svelte';

	interface Props {
		isHost: boolean;
		tripId: string;
		members: Array<{ user?: { name: string | null; email: string | null } | null }>;
		rsvps: Array<{ status: string; user?: { name: string | null } | null; arrivalDatetime?: string | null }>;
		guestPreviewList: Array<{ user?: { name: string | null; email: string | null } | null }>;
		pendingRsvpCount: number;
		recentActivityItems: Array<{ text: string }>;
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
	}

	let {
		isHost,
		tripId,
		members,
		rsvps,
		guestPreviewList,
		pendingRsvpCount,
		recentActivityItems,
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
		nudgePending
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
</script>

<div class="dashboard-wrapper">
	<!-- Sticky Note Card - positioned separately, overlaps hero -->
	<div class="sticky-card-wrapper">
		<DashboardCard variant="sticky" title={isHost ? 'Host reminders' : 'For you'}>
			{#if isHost}
				<div class="sticky-content">
					<div class="sticky-reminder">
						<strong>{pendingRsvpCount}</strong> pending RSVP{pendingRsvpCount !== 1 ? 's' : ''}
					</div>
					<ul class="sticky-list">
						{#if pendingRsvpCount > 0}
							<li>Send reminders to guests who haven't responded</li>
						{/if}
						<li>Review room assignments</li>
						<li>Check payment status</li>
					</ul>
					<div class="sticky-actions">
						{#if nudgePending}
							<button type="button" class="pill-btn pill-btn-primary" onclick={nudgePending}>
								Nudge pending
							</button>
						{/if}
						<a href="/trips/{tripId}/polls" class="pill-btn pill-btn-secondary">Polls</a>
						<a href="/trips/{tripId}/checklist" class="pill-btn pill-btn-secondary">Checklist</a>
					</div>
				</div>
			{:else}
				<div class="sticky-content">
					<div class="for-you-row">
						<span class="for-you-label">Your RSVP</span>
						<div class="for-you-right">
							{#if userRsvp?.status === 'yes'}
								<span class="for-you-value ok">Accepted</span>
							{:else if userRsvp?.status === 'no'}
								<span class="for-you-value">Declined</span>
							{:else}
								<a href="/trips/{tripId}/rsvp" class="pill-btn pill-btn-primary">RSVP</a>
							{/if}
						</div>
					</div>
					<div class="for-you-row">
						<span class="for-you-label">Room / bed</span>
						<div class="for-you-right">
							{#if myAssignment}
								<span class="for-you-value ok">{myAssignment.room?.name ?? 'Assigned'}</span>
							{:else}
								<a href="/trips/{tripId}/rooms" class="pill-btn pill-btn-primary">Choose bed</a>
							{/if}
						</div>
					</div>
					<div class="for-you-row">
						<span class="for-you-label">Your cost</span>
						<div class="for-you-right">
							{#if myDueTotal > 0}
								<a href="/trips/{tripId}/payments" class="pill-btn pill-btn-primary">Settle</a>
							{:else if myPaidTotal > 0}
								<span class="for-you-value ok">Settled</span>
							{:else}
								<span class="for-you-value">—</span>
							{/if}
						</div>
					</div>
					{#if hasMissingDietary || hasMissingArrival}
						<div class="missing-items">
							{#if hasMissingDietary}
								<span class="missing-chip">Dietary / allergies</span>
							{/if}
							{#if hasMissingArrival}
								<span class="missing-chip">Arrival time</span>
							{/if}
						</div>
					{/if}
					{#if nextUpcomingItem}
						<div class="for-you-next">
							<span class="for-you-label">Next up</span>
							<span class="for-you-value">
								{nextUpcomingItem.title}
								{#if nextUpcomingItem.date}
									— {new Date(nextUpcomingItem.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
								{/if}
							</span>
						</div>
					{/if}
					<div class="sticky-actions">
						{#if !userRsvp?.status || userRsvp.status !== 'yes'}
							<a href="/trips/{tripId}/rsvp" class="pill-btn pill-btn-secondary">RSVP</a>
						{/if}
						{#if !myAssignment}
							<a href="/trips/{tripId}/rooms" class="pill-btn pill-btn-secondary">Choose bed</a>
						{/if}
						{#if hasMissingArrival}
							<a href="/trips/{tripId}/rsvp" class="pill-btn pill-btn-secondary">Add arrival time</a>
						{/if}
					</div>
				</div>
			{/if}
		</DashboardCard>
	</div>

	<!-- Quick actions (Poll, Checklist, etc.) - bottom center of main photo -->
	<div class="quick-actions-hero-wrapper">
		<div class="quick-actions-grid quick-actions-hero-pills">
			<a href="/trips/{tripId}/polls" class="action-pill" title="Create poll">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
				</svg>
				<span>Poll</span>
			</a>
			<a href="/trips/{tripId}/checklist" class="action-pill" title="Checklist">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="9 11 12 14 22 4"/>
					<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
				</svg>
				<span>Checklist</span>
			</a>
			<a href="/trips/{tripId}/files" class="action-pill" title="Upload">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
					<polyline points="17 8 12 3 7 8"/>
					<line x1="12" y1="3" x2="12" y2="15"/>
				</svg>
				<span>Upload</span>
			</a>
			<a href="/trips/{tripId}/itinerary" class="action-pill" title="Suggestion">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="16" x2="12" y2="12"/>
					<line x1="12" y1="8" x2="12.01" y2="8"/>
				</svg>
				<span>Suggestion</span>
			</a>
		</div>
	</div>

	<!-- Main grid - equal-sized boxes, ~sticky note size -->
	<div class="dashboard-grid">
		<DashboardCard title="Recent activity" cta={{ label: 'View activity log', href: `/trips/${tripId}/itinerary` }}>
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

		<DashboardCard title="Guests" cta={{ label: 'View guests', href: `/trips/${tripId}/guests` }}>
			<div class="guests-preview">
				<div class="avatar-row">
					{#each guestPreviewList as member}
						<span class="avatar" title={member.user?.name ?? member.user?.email ?? ''}>
							{initials(member.user?.name, member.user?.email)}
						</span>
					{/each}
				</div>
				<div class="guests-meta">
					<span class="pending-badge">{pendingRsvpCount} pending RSVP</span>
					{#if isHost && nudgePending}
						<button type="button" class="pill-btn pill-btn-text" onclick={nudgePending}>
							Nudge pending
						</button>
					{/if}
				</div>
			</div>
		</DashboardCard>

		<DashboardCard>
			<TripGoalCircle
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

<style>
	.dashboard-wrapper {
		position: relative;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
	}

	/* Sticky card wrapper - positioned separately, overlaps hero */
	.sticky-card-wrapper {
		position: absolute;
		left: 2.5rem;
		top: -14rem;
		width: 420px;
		max-width: 36%;
		z-index: 10;
	}

	.sticky-card-wrapper :global(.dashboard-card.variant-sticky) {
		max-height: none;
		min-height: 390px;
		width: 100%;
	}

	/* Quick actions (Poll, Checklist, etc.) - bottom center of main photo */
	.quick-actions-hero-wrapper {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: -7rem;
		z-index: 2;
		width: 100%;
		max-width: 420px;
	}

	.quick-actions-hero-wrapper .action-pill {
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
	}

	.quick-actions-hero-wrapper .action-pill:hover {
		background: rgba(255, 255, 255, 0.25);
		color: white;
		border-color: rgba(255, 255, 255, 0.35);
	}

	.quick-actions-hero-wrapper .action-pill svg {
		color: inherit;
	}

	/* Main grid - vertical and horizontal spacing both 1.5rem for consistency */
	.dashboard-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.25rem;
		width: 100%;
		margin-top: 1.5rem;
		position: relative;
		z-index: 0;
		margin-left: 0;
		min-width: 0;
	}

	.dashboard-grid > :global(article) {
		min-height: 300px;
		min-width: 0;
	}

	@media (min-width: 1025px) {
		.dashboard-grid {
			/* Sticky ends at 2.5rem + 420px = 460px; 1.5rem (24px) gap = 484px */
			margin-left: 484px;
			width: calc(100% - 484px);
			max-width: calc(100% - 484px);
		}
	}

	@media (max-width: 1024px) {
		.sticky-card-wrapper {
			position: relative;
			top: 0;
			width: 100%;
			max-width: 100%;
			margin-bottom: 2rem;
		}

		.quick-actions-hero-wrapper {
			position: relative;
			top: 0;
			left: auto;
			transform: none;
			max-width: 100%;
			margin-bottom: 2rem;
		}

		.dashboard-grid {
			margin-left: 0;
			margin-top: 2rem;
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.dashboard-grid > :global(article) {
			min-height: 280px;
		}
	}

	.sticky-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
		padding: 0;
		font-size: 0.8125rem;
		color: var(--text);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.activity-item {
		padding: 0.2rem 0;
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

	.quick-actions-grid {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
		align-items: center;
		justify-content: center;
	}

	.action-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.8125rem;
		font-weight: 500;
		padding: 0.625rem 0.875rem;
		background: var(--surface);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-md);
		color: var(--text);
		text-decoration: none;
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.action-pill:hover {
		background: var(--text);
		color: white;
		border-color: var(--text);
	}

	.action-pill svg {
		flex-shrink: 0;
	}

	@media (max-width: 1024px) {
		.dashboard-grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.grid-left,
		.grid-right {
			grid-column: span 1;
		}

		.quick-actions-grid {
			flex-wrap: wrap;
			justify-content: center;
		}
	}
</style>
