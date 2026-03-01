<script lang="ts">
	import DashboardCard from './DashboardCard.svelte';
	import TripGoalsCombined from './TripGoalsCombined.svelte';
	import TripInfoCard from './TripInfoCard.svelte';
	import Checklist from './Checklist.svelte';
	import GuestRsvpSummaryCard from './GuestRsvpSummaryCard.svelte';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

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
		members: Array<{ user?: { id: string; name: string | null; email: string | null; avatarUrl?: string | null } | null }>;
		rsvps: Array<{ status: string; user?: { name: string | null } | null; arrivalDatetime?: string | null }>;
		guestPreviewList: Array<{ user?: { id: string; name: string | null; email: string | null; avatarUrl?: string | null } | null }>;
		pendingRsvpCount: number;
		userRsvp?: { status?: string; arrivalDatetime?: string | null } | null;
		userProfile?: { dietaryRestrictions?: string | null; allergies?: string | null } | null;
		myAssignment?: { room?: { name: string | null } | null } | null;
		/** Guest only: current reservation price (may change as more RSVP) */
		userReservationPrice?: number | null;
		/** Guest only: current user's room/bed assignments for RSVP summary */
		myAssignments?: Array<{ room?: { id: number; name: string | null; photoUrls?: string[] } | null; bed?: { id: string; bedType: string | null } | null; partySize?: number }>;
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
		roomsFilled?: number;
		roomsTotal?: number;
		roomsPct?: number;
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
		/** Trip info for TripInfoCard */
		tripDescription?: string | null;
		extraCostRules?: Array<{ label: string; amount: number; type: string }>;
		itineraryHref?: string;
		tripInfo?: {
			description?: string | null;
			checkInTime?: string | null;
			checkOutTime?: string | null;
			fullAddress?: string | null;
			parkingNotes?: string | null;
			houseRules?: string | null;
			tripInfoEditedAt?: Date | string | null;
		};
		tripInfoEdited?: boolean;
		/** ISO date string for check-in (drives countdown in progress/RSVP cards) */
		tripCheckInDate?: string;
	}

	let {
		isHost,
		tripId,
		currentUserId,
		members,
		rsvps,
		guestPreviewList,
		pendingRsvpCount,
		userRsvp,
		userProfile,
		myAssignment,
		userReservationPrice = null,
		myAssignments = [],
		myDueTotal,
		myPaidTotal,
		nextUpcomingItem,
		rsvpCurrent,
		rsvpTotal,
		rsvpPct,
		bedsCurrent,
		bedsTotal,
		bedsPct,
		roomsFilled = 0,
		roomsTotal = 0,
		roomsPct = 0,
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
		checklistStats,
		tripDescription = null,
		extraCostRules = [],
		itineraryHref = '',
		tripInfo = {},
		tripInfoEdited = false,
		tripCheckInDate = ''
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

	const acceptedRsvpCount = $derived(rsvps.filter((r) => r.status === 'yes').length);
	const declinedRsvpCount = $derived(rsvps.filter((r) => r.status === 'no').length);

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
	{#snippet progressViewDetailButton()}
		<a href={`/trips/${tripId}/guests`} class="view-detail-btn">View Detail</a>
	{/snippet}
	<!-- Layout: row1 = reminders | goals | recent, row2 = guests under reminders + goals only -->
	<div class="dashboard-layout">
		<div class="left-column">
			<div class="sticky-card-wrapper">
				{#if isHost}
					<DashboardCard
						variant="sticky"
						title="Progress"
						headerRight={progressViewDetailButton}
					>
						<TripGoalsCombined
							{rsvpCurrent}
							{rsvpTotal}
							{rsvpPct}
							{bedsCurrent}
							{bedsTotal}
							{bedsPct}
							{roomsFilled}
							{roomsTotal}
							{roomsPct}
							{fundingCurrent}
							{fundingTotal}
							{fundingPct}
							{fundingDisplay}
							{guestsHref}
							{roomsHref}
							{paymentsHref}
							{tripCheckInDate}
						/>
					</DashboardCard>
				{:else}
					<DashboardCard variant="sticky" title="Your RSVP">
						<GuestRsvpSummaryCard
							tripId={tripId}
							{userRsvp}
							myAssignments={myAssignments}
							userReservationPrice={userReservationPrice}
							{tripCheckInDate}
						/>
					</DashboardCard>
				{/if}
			</div>
		</div>

		<div class="goals-cell" id="trip-info">
			<div class="goals-card-wrap">
				<DashboardCard>
					<TripInfoCard
						isHost={isHost}
						tripId={tripId}
						description={tripInfo?.description ?? tripDescription}
						checkInTime={tripInfo?.checkInTime}
						checkOutTime={tripInfo?.checkOutTime}
						fullAddress={tripInfo?.fullAddress}
						parkingNotes={tripInfo?.parkingNotes}
						houseRules={tripInfo?.houseRules}
						{extraCostRules}
						itineraryHref={itineraryHref}
						showToast={showToast}
					/>
				</DashboardCard>
			</div>
		</div>

		<div class="recent-cell">
			<DashboardCard
				title="Reminders"
				headerLeft={stickyPinIcon}
			>
				<div class="sticky-content">
					<Checklist role={isHost ? 'host' : 'guest'} {tripId} {currentUserId} computedStats={checklistStats} />
				</div>
			</DashboardCard>
		</div>

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
							{#if member.user?.id}
								<ProfileTooltip userId={member.user.id}>
									<button type="button" class="avatar avatar-btn" title={member.user?.name ?? member.user?.email ?? ''} onclick={() => openProfileCard(member.user!.id)}>
										{#if member.user?.avatarUrl}
											<img src={member.user.avatarUrl} alt="" class="avatar-img" />
										{:else}
											{initials(member.user?.name, member.user?.email)}
										{/if}
									</button>
								</ProfileTooltip>
							{:else}
								<span class="avatar" title={member.user?.name ?? member.user?.email ?? ''}>
									{#if member.user?.avatarUrl}
										<img src={member.user.avatarUrl} alt="" class="avatar-img" />
									{:else}
										{initials(member.user?.name, member.user?.email)}
									{/if}
								</span>
							{/if}
						{/each}
					</div>
					<div class="guests-meta">
						{#if acceptedRsvpCount > 0}
							<span class="guests-stat">
								<span class="guests-stat-dot accepted"></span>
								{acceptedRsvpCount} going
							</span>
						{/if}
						{#if pendingRsvpCount > 0}
							<span class="guests-stat">
								<span class="guests-stat-dot pending"></span>
								{pendingRsvpCount} pending
							</span>
						{/if}
						{#if declinedRsvpCount > 0}
							<span class="guests-stat">
								<span class="guests-stat-dot declined"></span>
								{declinedRsvpCount} declined
							</span>
						{/if}
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
	 * LAYOUT: 3-column, full page width
	 *   Col 1 (narrow): Reminders — overlaps hero, row 1
	 *   Col 2 (wide):   Trip Info (row 1) + Guests (row 2)
	 *   Col 3 (narrow): Progress / RSVP — spans rows 1–2
	 */
	.dashboard-layout {
		display: grid;
		grid-template-columns: minmax(0, 370px) minmax(0, 1fr) minmax(0, 290px);
		grid-template-rows: auto auto;
		column-gap: 1.25rem;
		row-gap: 1rem;
		margin-top: 0.5rem;
		position: relative;
		z-index: 0;
		width: 100%;
		min-width: 0;
		align-items: start;
	}

	/* Col 1, Row 1 — Reminders (pulled up into hero) */
	.left-column {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
		z-index: 10;
	}

	/* Pull sticky up so it overlaps the hero photo */
	.sticky-card-wrapper {
		margin-top: -14rem;
		position: relative;
		width: 100%;
		z-index: 10;
	}

	/* Col 2, Row 1 — Trip Info: stretch to fill full row height */
	.goals-cell {
		grid-column: 2;
		grid-row: 1;
		min-width: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
	}

	/* Col 3, Rows 1–2 — Progress / RSVP sidebar, spans full height */
	.recent-cell {
		grid-column: 3;
		grid-row: 1 / 3;
		min-width: 0;
		align-self: start;
	}

	/* Cols 1–2, Row 2 — Guests, spans under Reminders + Trip Info */
	.guests-row {
		grid-column: 1 / 3;
		grid-row: 2;
		min-width: 0;
	}

	.goals-cell :global(.dashboard-card) {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.goals-cell :global(.card-body) {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Reminders card — plain white, same as Trip Info + Guests */
	.recent-cell :global(.dashboard-card) {
		min-height: 0;
	}

	.guests-card-wrapper {
		width: 100%;
	}

	/* Trip info card wrapper */
	.goals-card-wrap {
		min-width: 0;
	}

	/* Progress sticky: overlaps hero, orange-tinted at same opacity as old yellow */
	.sticky-card-wrapper :global(.dashboard-card.variant-sticky) {
		max-height: 580px;
		min-height: 440px;
		width: 100%;
		overflow-y: auto;
		padding: 1rem 1.125rem;
		background: linear-gradient(
			to bottom,
			rgba(191, 78, 48, 0.82) 0%,
			rgba(191, 78, 48, 0.92) 55%,
			rgba(172, 62, 35, 0.97) 100%
		);
	}

	.sticky-card-wrapper :global(.card-header) {
		gap: 0.375rem;
		justify-content: flex-start;
	}

	.sticky-card-wrapper :global(.card-header-left) {
		margin-right: 0.25rem;
	}

	/* No extra top padding needed — header sits above body naturally */
	.sticky-card-wrapper :global(.card-body) {
		padding-top: 0.25rem;
	}

	/* All Progress / RSVP content white on solid orange */
	.sticky-card-wrapper :global(.card-title) { color: white; }
	.sticky-card-wrapper :global(.view-detail-btn) {
		color: rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.25);
	}
	.sticky-card-wrapper :global(.view-detail-btn:hover) {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.4);
	}

	/* TripGoalsCombined on solid orange */
	.sticky-card-wrapper :global(.overall-label) { color: rgba(255, 255, 255, 0.72); }
	.sticky-card-wrapper :global(.overall-pct) { color: white; }
	.sticky-card-wrapper :global(.overall-track) { background: rgba(255, 255, 255, 0.22); }
	.sticky-card-wrapper :global(.overall-fill) { background: white; opacity: 0.85; }
	.sticky-card-wrapper :global(.overall-fill.complete) { opacity: 1; }
	.sticky-card-wrapper :global(.stat-icon) { color: rgba(255, 255, 255, 0.8); opacity: 1; }
	.sticky-card-wrapper :global(.stat-label) { color: rgba(255, 255, 255, 0.92); }
	.sticky-card-wrapper :global(.stat-value) { color: white; }
	.sticky-card-wrapper :global(.stat-value.done) { color: white; }
	.sticky-card-wrapper :global(.stat-check) { color: white; }
	.sticky-card-wrapper :global(.bar-track) { background: rgba(255, 255, 255, 0.22); }
	.sticky-card-wrapper :global(.bar-fill) { background: white; opacity: 0.65; }
	.sticky-card-wrapper :global(.bar-fill.done) { background: white; opacity: 1; }
	.sticky-card-wrapper :global(.stat-row:hover) { background: rgba(255, 255, 255, 0.1); }

	/* GuestRsvpSummaryCard on solid orange */
	.sticky-card-wrapper :global(.status-banner) { border-color: rgba(255, 255, 255, 0.2); color: white; }
	.sticky-card-wrapper :global(.status-icon) { color: white; }
	.sticky-card-wrapper :global(.status-text) { color: white; }
	.sticky-card-wrapper :global(.status-days) {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		color: white;
	}
	.sticky-card-wrapper :global(.pending-dot) { background: white; }
	.sticky-card-wrapper :global(.nudge-text) { color: rgba(255, 255, 255, 0.82); }
	.sticky-card-wrapper :global(.detail-block) { border-color: rgba(255, 255, 255, 0.18); }
	.sticky-card-wrapper :global(.detail-label) { color: rgba(255, 255, 255, 0.65); }
	.sticky-card-wrapper :global(.detail-price) { color: white; }
	.sticky-card-wrapper :global(.detail-value) { color: white; }
	.sticky-card-wrapper :global(.detail-note) { color: rgba(255, 255, 255, 0.65); }
	.sticky-card-wrapper :global(.detail-empty) { color: rgba(255, 255, 255, 0.55); }
	.sticky-card-wrapper :global(.cta-primary) { background: white; color: var(--warm); }
	.sticky-card-wrapper :global(.cta-primary:hover) { background: rgba(255, 255, 255, 0.9); }
	.sticky-card-wrapper :global(.cta-ghost) { color: white; border-color: rgba(255, 255, 255, 0.35); }
	.sticky-card-wrapper :global(.cta-ghost:hover) { background: rgba(255, 255, 255, 0.12); }

	@media (max-width: 1024px) {
		.dashboard-wrapper {
			padding-left: 0;
		}

		/* Single column: reminders → progress → trip info → guests */
		.dashboard-layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto auto;
			column-gap: 0;
			row-gap: 1rem;
			margin-top: 0;
			width: 100%;
			max-width: 100%;
		}

		.left-column {
			grid-column: 1;
			grid-row: 1;
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
			grid-row: 3;
		}

		.recent-cell {
			grid-column: 1;
			grid-row: 2;
		}

		.guests-row {
			grid-column: 1;
			grid-row: 4;
		}
	}

	.sticky-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		flex: 1;
		min-height: 0;
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

	.pill-btn-text {
		background: transparent;
		color: var(--primary);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}

	.pill-btn-text:hover {
		text-decoration: underline;
	}

	.view-detail-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.3rem 0.6rem;
		border-radius: var(--radius-md);
		font-size: 0.75rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
		background: rgba(0, 0, 0, 0.05);
		border: 1px solid var(--border-soft);
		transition: all var(--transition-fast);
	}

	.view-detail-btn:hover {
		background: rgba(0, 0, 0, 0.08);
		border-color: var(--muted);
	}

	.guests-preview {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.avatar-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.avatar {
		width: 36px;
		height: 36px;
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
		border: 2px solid var(--surfaceSolid);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.avatar-btn {
		padding: 0;
		border: 2px solid var(--surfaceSolid);
		cursor: pointer;
		background: linear-gradient(135deg, var(--slate) 0%, var(--primary) 100%);
		font: inherit;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.avatar-btn:hover {
		transform: scale(1.1);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
		z-index: 1;
		position: relative;
	}

	.avatar :global(.avatar-img),
	.avatar-btn :global(.avatar-img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.guests-meta {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.guests-stat {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
	}

	.guests-stat-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.guests-stat-dot.accepted { background: var(--warm); opacity: 0.8; }
	.guests-stat-dot.pending { background: var(--muted); }
	.guests-stat-dot.declined { background: rgba(0,0,0,0.2); }
</style>
