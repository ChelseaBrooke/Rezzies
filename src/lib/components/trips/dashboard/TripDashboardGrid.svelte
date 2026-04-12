<script lang="ts">
	import DashboardCard from './DashboardCard.svelte';
	import TripGoalsCombined from './TripGoalsCombined.svelte';
	import TripInfoCard from './TripInfoCard.svelte';
	import CapacityGuestsCard from './CapacityGuestsCard.svelte';
	import GuestRsvpSummaryCard from './GuestRsvpSummaryCard.svelte';
	import OnboardingTooltip from '$lib/components/ui/OnboardingTooltip.svelte';
	import { getTooltip } from '$lib/config/onboardingTooltips.js';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import type { CostAtMaxParticipation } from '$lib/server/pricing-canonical.js';

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

	interface RecentActivity {
		type: 'rsvp' | 'itinerary' | 'poll' | 'game' | 'meal';
		label: string;
		action: string;
		at: Date;
	}

	interface Props {
		isHost: boolean;
		tripId: string;
		currentUserId: string;
		members: Array<{ user?: { id: string; name: string | null; email: string | null; avatarUrl?: string | null } | null }>;
		rsvps: Array<{
			status: string;
			userId?: string;
			user?: { id?: string; name: string | null; email?: string | null; avatarUrl?: string | null } | null;
			arrivalDatetime?: string | null;
			createdAt?: string | null;
			updatedAt?: string | null;
		}>;
		guestPreviewList: Array<{ user?: { id: string; name: string | null; email: string | null; avatarUrl?: string | null } | null }>;
		pendingRsvpCount: number;
		userRsvp?: { status?: string; arrivalDatetime?: string | null } | null;
		myAssignment?: { room?: { name: string | null } | null } | null;
		/** Guest only: current reservation price (may change as more RSVP) */
		userReservationPrice?: number | null;
	/** Guest only: per-person share of the Divvi platform fee (0 when host didn't split it) */
		platformFeePerPerson?: number;
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
	showToast?: (msg: string) => void;
		/** Host: invite action for capacity card */
		onInvite?: () => void;
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
		/** Host only: cost when all spots fill (incentive to drive RSVPs) */
	costAtMaxParticipation?: CostAtMaxParticipation | null;
	/** Whether cost-sharing features are enabled for this trip */
	costSharingEnabled?: boolean;
	/** Host planning card: expected guest count from trip (for “expected headcount” pricing column). */
	expectedPeopleCount?: number | null;
	/** Host planning card: max headcount when `costAtMaxParticipation` is null (must match trip capacity rules). */
	planningMaxHeadcount?: number;
	/** Recent activity feed sources */
		recentActivities?: Array<{ title: string; createdAt: string }>;
		recentMealSlots?: Array<{ mealType: string; title: string | null; createdAt: string }>;
		recentGames?: Array<{ name: string; addedByUserId: string; addedAt: string }>;
		recentPolls?: Array<{ title: string; createdAt: string | Date; createdBy: { id: string; name: string | null } | null }>;
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
		myAssignment,
		userReservationPrice = null,
	platformFeePerPerson = 0,
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
		showToast,
		onInvite = undefined,
		checklistStats,
		tripDescription = null,
		extraCostRules = [],
		itineraryHref = '',
		tripInfo = {},
		tripInfoEdited = false,
		tripCheckInDate = '',
		costAtMaxParticipation = null,
	costSharingEnabled = true,
	expectedPeopleCount = null,
	planningMaxHeadcount = 1,
	recentActivities = [],
		recentMealSlots = [],
		recentGames = [],
		recentPolls = []
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

	function memberName(userId: string): string {
		const m = members.find((m) => m.user?.id === userId);
		return m?.user?.name?.split(' ')[0] ?? 'Someone';
	}

	function rsvpActionLabel(status: string): string {
		if (status === 'yes') return 'joined the trip';
		if (status === 'no') return 'declined';
		return 'responded maybe';
	}

	function mealLabel(mealType: string): string {
		return mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
	}

	/** Trip info progress: check-in time, check-out time, parking (3 things) */
	const TRIP_INFO_TOTAL = 3;
	const tripInfoFilled = $derived(
		(tripInfo?.checkInTime?.trim() ? 1 : 0) +
		(tripInfo?.checkOutTime?.trim() ? 1 : 0) +
		(tripInfo?.parkingNotes?.trim() ? 1 : 0)
	);

	const activityFeed = $derived.by((): RecentActivity[] => {
		const items: RecentActivity[] = [];

		// RSVPs
		for (const r of rsvps) {
			if (!r.user?.name) continue;
			const at = r.updatedAt ? new Date(r.updatedAt) : r.createdAt ? new Date(r.createdAt) : new Date(0);
			items.push({
				type: 'rsvp',
				label: r.user.name.split(' ')[0],
				action: rsvpActionLabel(r.status),
				at
			});
		}

		// Itinerary activities
		for (const a of recentActivities) {
			items.push({
				type: 'itinerary',
				label: 'Itinerary',
				action: `"${a.title}" added`,
				at: new Date(a.createdAt)
			});
		}

		// Polls
		for (const p of recentPolls) {
			const name = p.createdBy?.name?.split(' ')[0] ?? 'Someone';
			items.push({
				type: 'poll',
				label: name,
				action: `created a poll: "${p.title}"`,
				at: new Date(p.createdAt)
			});
		}

		// Games
		for (const g of recentGames) {
			const name = memberName(g.addedByUserId);
			items.push({
				type: 'game',
				label: name,
				action: `added ${g.name}`,
				at: new Date(g.addedAt)
			});
		}

		// Meals
		for (const m of recentMealSlots) {
			items.push({
				type: 'meal',
				label: 'Meal',
				action: `${mealLabel(m.mealType)}${m.title ? `: "${m.title}"` : ''} added`,
				at: new Date(m.createdAt)
			});
		}

		return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 4);
	});

	const acceptedRsvpCount = $derived(rsvps.filter((r) => r.status === 'yes').length);
	const declinedRsvpCount = $derived(rsvps.filter((r) => r.status === 'no').length);

	const rsvpStatusByUserId = $derived.by(() => {
		const m = new Map<string, string>();
		for (const r of rsvps) {
			const uid = r.userId ?? r.user?.id;
			if (uid) m.set(uid, r.status);
		}
		return m;
	});

	function guestPreviewTip(
		name: string | null | undefined,
		email: string | null | undefined,
		status: string | undefined
	): string {
		const who = name?.trim() || email || 'Guest';
		if (status === 'yes') return `${who} · Going`;
		if (status === 'no') return `${who} · Declined`;
		return `${who} · Pending`;
	}

	/** Host: planning card replaces trip info in goals cell (cost-sharing on/off). */
	const showHostPlanningCard = $derived(isHost);

	const progressTip = $derived(isHost ? getTooltip('host_progress') : null);
	const tripInfoTip = $derived(getTooltip(isHost ? 'host_trip_info' : 'guest_trip_info'));
	const capacityTip = $derived(isHost ? getTooltip('host_capacity_card') : null);
	const recentTip = $derived(getTooltip(isHost ? 'host_recent_activity' : 'guest_recent_activity'));
	const guestsTip = $derived(isHost ? getTooltip('host_guests_preview') : null);
	const guestRsvpTip = $derived(!isHost ? getTooltip('guest_rsvp_card') : null);

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
	{#snippet activityIcon()}
		<span class="activity-icon" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
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
	<div class="dashboard-layout" class:dashboard-layout--no-guests-row={showHostPlanningCard}>
		<div class="left-column">
		<div class="sticky-card-wrapper" class:host-mode={isHost}>
			{#if isHost}
				<DashboardCard
						variant="sticky"
						title="Progress"
						headerLeft={stickyPinIcon}
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
						tripInfoFilled={tripInfoFilled}
						tripInfoTotal={TRIP_INFO_TOTAL}
						{costSharingEnabled}
					/>
					</DashboardCard>
				{:else}
					<DashboardCard variant="sticky" title="Your RSVP" headerLeft={stickyPinIcon}>
				<GuestRsvpSummaryCard
						tripId={tripId}
						{userRsvp}
						myAssignments={myAssignments}
						userReservationPrice={userReservationPrice}
						{platformFeePerPerson}
						{tripCheckInDate}
						{costSharingEnabled}
					/>
					</DashboardCard>
				{/if}
				{#if progressTip}
					<OnboardingTooltip
						key={progressTip.key}
						title={progressTip.title}
						body={progressTip.body}
						position={progressTip.position}
						align={progressTip.align}
					/>
				{/if}
				{#if guestRsvpTip}
					<OnboardingTooltip
						key={guestRsvpTip.key}
						title={guestRsvpTip.title}
						body={guestRsvpTip.body}
						position={guestRsvpTip.position}
						align={guestRsvpTip.align}
					/>
				{/if}
			</div>
		</div>

		<div class="goals-cell" id="trip-info" style="position:relative;">
			<div class="goals-card-wrap">
				<DashboardCard>
					{#if showHostPlanningCard}
						<CapacityGuestsCard
							{tripId}
							{members}
							{rsvps}
							data={costAtMaxParticipation}
							{costSharingEnabled}
							{expectedPeopleCount}
							{planningMaxHeadcount}
							roomsFilled={roomsFilled}
							roomsTotal={roomsTotal}
							bedsCurrent={bedsCurrent}
							bedsTotal={bedsTotal}
							onInvite={onInvite}
						/>
					{:else}
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
					{/if}
				</DashboardCard>
			</div>
			{#if showHostPlanningCard && capacityTip}
				<OnboardingTooltip
					key={capacityTip.key}
					title={capacityTip.title}
					body={capacityTip.body}
					position={capacityTip.position}
					align={capacityTip.align}
				/>
			{:else if !showHostPlanningCard && tripInfoTip}
				<OnboardingTooltip
					key={tripInfoTip.key}
					title={tripInfoTip.title}
					body={tripInfoTip.body}
					position={tripInfoTip.position}
					align={tripInfoTip.align}
				/>
			{/if}
		</div>

		<div class="recent-cell" style="position:relative;">
			<DashboardCard
				title="Recent Activity"
				headerLeft={activityIcon}
			>
				<div class="activity-feed">
					{#each activityFeed as item (item.type + item.label + item.at.getTime())}
						<div class="activity-item">
							<span class="activity-type-icon activity-type-{item.type}" aria-hidden="true">
								{#if item.type === 'rsvp'}
									<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
								{:else if item.type === 'itinerary'}
									<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
								{:else if item.type === 'poll'}
									<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
								{:else if item.type === 'game'}
									<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-4m2-2v4"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/></svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6h3.5"/><path d="M19.5 13V22"/></svg>
								{/if}
							</span>
							<div class="activity-text">
								<span class="activity-name">{item.label}</span>
								<span class="activity-action">{item.action}</span>
							</div>
						</div>
					{/each}
					{#if activityFeed.length === 0}
						<p class="activity-empty">Activity will appear here as guests join and contribute.</p>
					{/if}
				</div>
			</DashboardCard>
			{#if recentTip}
				<OnboardingTooltip
					key={recentTip.key}
					title={recentTip.title}
					body={recentTip.body}
					position={recentTip.position}
					align={recentTip.align}
				/>
			{/if}
		</div>

		{#if !showHostPlanningCard}
			<div class="guests-row" style="position:relative;">
				<div class="guests-card-wrapper">
					<DashboardCard
						title="Guests"
						titleHref={`/trips/${tripId}/guests`}
						headerRight={isHost && nudgePending ? guestsNudgeButton : undefined}
					>
					<div class="guests-preview">
						<div class="guest-avatar-scroll" aria-label="Trip members">
							{#each guestPreviewList as member}
								{@const uid = member.user?.id ?? ''}
								{@const rsvpStatus = rsvpStatusByUserId.get(uid)}
								{@const tip = guestPreviewTip(member.user?.name, member.user?.email, rsvpStatus)}
								<div
									class="guest-avatar-chip"
									class:guest-avatar-chip--going={rsvpStatus === 'yes'}
									class:guest-avatar-chip--declined={rsvpStatus === 'no'}
								>
									{#if member.user?.id}
										<ProfileTooltip userId={member.user.id}>
											<button
												type="button"
												class="guest-avatar-btn"
												title={tip}
												aria-label={tip}
												onclick={() => openProfileCard(member.user!.id)}
											>
												{#if member.user?.avatarUrl}
													<img src={member.user.avatarUrl} alt="" class="guest-avatar-img" />
												{:else}
													<span class="guest-avatar-initials">{initials(member.user?.name, member.user?.email)}</span>
												{/if}
												<span
													class="guest-avatar-dot"
													class:guest-avatar-dot--yes={rsvpStatus === 'yes'}
													class:guest-avatar-dot--no={rsvpStatus === 'no'}
													class:guest-avatar-dot--pending={rsvpStatus !== 'yes' && rsvpStatus !== 'no'}
													aria-hidden="true"
												></span>
											</button>
										</ProfileTooltip>
									{:else}
										<span class="guest-avatar-btn guest-avatar-btn--static" title={tip}>
											{#if member.user?.avatarUrl}
												<img src={member.user.avatarUrl} alt="" class="guest-avatar-img" />
											{:else}
												<span class="guest-avatar-initials">{initials(member.user?.name, member.user?.email)}</span>
											{/if}
											<span
												class="guest-avatar-dot"
												class:guest-avatar-dot--yes={rsvpStatus === 'yes'}
												class:guest-avatar-dot--no={rsvpStatus === 'no'}
												class:guest-avatar-dot--pending={rsvpStatus !== 'yes' && rsvpStatus !== 'no'}
												aria-hidden="true"
											></span>
										</span>
									{/if}
								</div>
							{/each}
						</div>
						<div class="guests-meta">
							{#if acceptedRsvpCount > 0}
								<span class="guests-stat">
									<span class="guests-stat-dot accepted"></span>
									{acceptedRsvpCount} going
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
				{#if guestsTip}
					<OnboardingTooltip
						key={guestsTip.key}
						title={guestsTip.title}
						body={guestsTip.body}
						position={guestsTip.position}
						align={guestsTip.align}
					/>
				{/if}
			</div>
		{/if}
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
	 *   Col 1 (narrow): Reminders, overlaps hero, row 1
	 *   Col 2 (wide):   Trip Info (row 1) + Guests (row 2)
	 *   Col 3 (narrow): Progress / RSVP, spans rows 1–2
	 */
	/*
	 * Uniform spacing: same gap (1rem) between main photo and grid, between columns, and between rows.
	 * Progress box stays anchored: grid height reduced by the extra margin so the bottom doesn’t move.
	 */
	.dashboard-layout {
		display: grid;
		grid-template-columns: minmax(0, 370px) minmax(0, 1fr) minmax(0, 290px);
		grid-template-rows: 1fr auto;
		gap: 1rem;
		height: calc(100vh - 588px);
		min-height: 260px;
		margin-top: 1rem;
		position: relative;
		z-index: 0;
		width: 100%;
		min-width: 0;
		align-items: stretch;
	}

	/* Host capacity card replaces bottom guests row — single tall row */
	.dashboard-layout--no-guests-row {
		grid-template-rows: 1fr;
	}

	.dashboard-layout--no-guests-row .recent-cell {
		grid-row: 1;
	}

	/*
	 * Col 1, Row 1, positioning context for the sticky card.
	 * Has NO flow content; its height is driven by the grid row (= Trip Info height).
	 * overflow: visible lets the sticky card extend upward into the hero.
	 */
	.left-column {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
		z-index: 10;
		position: relative;
		overflow: visible;
	}

	/*
	 * Sticky card: absolutely anchored to the BOTTOM of the left column.
	 * min-height: calc(100% + 14rem) → always overlaps the hero by 14rem.
	 * If content is taller than that, the card grows further UPWARD (bottom stays fixed).
	 * Never pushes Trip Info, Guests, or Recent Activity.
	 */
	.sticky-card-wrapper {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 10;
		min-height: calc(100% + 22rem);
		display: flex;
		flex-direction: column;
	}

	/* Col 2, Row 1, Trip Info */
	.goals-cell {
		grid-column: 2;
		grid-row: 1;
		min-width: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
	}

	/* Col 3, Rows 1–2, Recent Activity spans both rows */
	.recent-cell {
		grid-column: 3;
		grid-row: 1 / 3;
		min-width: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
	}

	/* Cols 1–2, Row 2, Guests; uniform gap comes from grid, no extra margin */
	.guests-row {
		grid-column: 1 / 3;
		grid-row: 2;
		min-width: 0;
	}

	.goals-cell :global(.dashboard-card) {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: visible;
	}

	.goals-cell :global(.card-body) {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: visible;
	}

	/* Recent Activity card, limited height so it doesn’t collide with Chat */
	.recent-cell :global(.dashboard-card) {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		max-height: 320px;
		overflow: hidden;
	}

	.recent-cell :global(.card-body) {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.recent-cell .activity-feed {
		flex: 1;
		overflow: auto;
		min-height: 0;
	}

	.guests-card-wrapper {
		width: 100%;
		overflow: hidden;
		max-height: 140px;
	}

	.guests-card-wrapper :global(.dashboard-card) {
		max-height: 140px;
		overflow: hidden;
	}

	.guests-card-wrapper :global(.card-body) {
		overflow: hidden;
		min-height: 0;
	}

	/* Trip info card wrapper, fills goals-cell so card stretches to row 1 height */
	.goals-card-wrap {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	/* ── Shared sticky card shell ── */
	.sticky-card-wrapper :global(.dashboard-card.variant-sticky) {
		flex: 1;
		width: 100%;
		overflow: visible;
		padding: 1rem 1.125rem;
	}

	.sticky-card-wrapper :global(.card-header) {
		gap: 0.375rem;
		justify-content: flex-start;
	}

	.sticky-card-wrapper :global(.card-header-left) {
		margin-right: 0.25rem;
	}

	.sticky-card-wrapper :global(.card-body) {
		padding-top: 0.25rem;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: visible;
	}

	/* ── Host progress card: white with dark gauge section inside ── */
	.sticky-card-wrapper.host-mode :global(.dashboard-card.variant-sticky) {
		background: white;
		box-shadow: 0 4px 28px rgba(29, 77, 78, 0.12), 0 1px 4px rgba(0, 0, 0, 0.05);
	}
	.sticky-card-wrapper.host-mode :global(.card-title) { color: var(--navy, #1d4d4e); }
	.sticky-card-wrapper.host-mode :global(.pin-circle) { background: rgba(47, 119, 120, 0.1); }
	.sticky-card-wrapper.host-mode :global(.pin-svg) { color: var(--slate, #2f7778); stroke: var(--slate, #2f7778); }
	.sticky-card-wrapper.host-mode :global(.view-detail-btn) {
		color: var(--slate, #2f7778);
		background: rgba(47, 119, 120, 0.07);
		border-color: rgba(47, 119, 120, 0.18);
	}
	.sticky-card-wrapper.host-mode :global(.view-detail-btn:hover) {
		background: rgba(47, 119, 120, 0.13);
		border-color: rgba(47, 119, 120, 0.3);
	}

	/* TripGoalsCombined fills the card body */
	.sticky-card-wrapper :global(.readiness) { flex: 1; }

	/* ── Non-host RSVP card: dark teal ── */
	.sticky-card-wrapper:not(.host-mode) :global(.dashboard-card.variant-sticky) {
		background:
			radial-gradient(ellipse at 20% 0%, rgba(122, 206, 211, 0.18) 0%, transparent 55%),
			linear-gradient(155deg, #1d4d4e 0%, #2a6263 55%, #1a4041 100%);
		box-shadow: 0 8px 32px rgba(29, 77, 78, 0.35);
	}
	.sticky-card-wrapper:not(.host-mode) :global(.card-title) { color: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.pin-circle) { background: rgba(255, 255, 255, 0.22); }
	.sticky-card-wrapper:not(.host-mode) :global(.pin-svg) { color: white; stroke: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.view-detail-btn) {
		color: rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.25);
	}
	.sticky-card-wrapper:not(.host-mode) :global(.view-detail-btn:hover) {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.4);
	}

	/* GuestRsvpSummaryCard — scoped to non-host (dark teal) card */
	.sticky-card-wrapper:not(.host-mode) :global(.status-banner) { border-color: rgba(255, 255, 255, 0.2); color: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.status-icon) { color: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.status-text) { color: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.status-days) {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		color: white;
	}
	.sticky-card-wrapper:not(.host-mode) :global(.pending-dot) { background: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.nudge-text) { color: rgba(255, 255, 255, 0.82); }
	.sticky-card-wrapper:not(.host-mode) :global(.detail-block) { border-color: rgba(255, 255, 255, 0.18); }
	.sticky-card-wrapper:not(.host-mode) :global(.detail-label) { color: rgba(255, 255, 255, 0.65); }
	.sticky-card-wrapper:not(.host-mode) :global(.detail-price) { color: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.detail-value) { color: white; }
	.sticky-card-wrapper:not(.host-mode) :global(.detail-note) { color: rgba(255, 255, 255, 0.65); }
	.sticky-card-wrapper:not(.host-mode) :global(.detail-empty) { color: rgba(255, 255, 255, 0.55); }
	.sticky-card-wrapper:not(.host-mode) :global(.cta-primary) { background: white; color: var(--warm); }
	.sticky-card-wrapper:not(.host-mode) :global(.cta-primary:hover) { background: rgba(255, 255, 255, 0.9); }
	.sticky-card-wrapper:not(.host-mode) :global(.cta-ghost) { color: white; border-color: rgba(255, 255, 255, 0.35); }
	.sticky-card-wrapper:not(.host-mode) :global(.cta-ghost:hover) { background: rgba(255, 255, 255, 0.12); }

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
			/* on mobile, left-column has auto height (flow, not grid-stretch) */
			position: static;
		}

		.sticky-card-wrapper {
			position: static;
			min-height: 0;
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

		.dashboard-layout--no-guests-row {
			grid-template-rows: auto auto auto;
		}

		.dashboard-layout--no-guests-row .goals-cell {
			grid-column: 1;
			grid-row: 3;
		}

		.dashboard-layout--no-guests-row .recent-cell {
			grid-column: 1;
			grid-row: 2;
		}
	}

	.sticky-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		flex: 1;
		min-height: 0;
	}

	/* ── Recent Activity feed ── */
	.activity-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--slate);
		color: white;
		flex-shrink: 0;
	}

	.activity-icon svg {
		display: block;
	}

	.activity-feed {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.activity-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-soft);
	}

	.activity-item:last-child {
		border-bottom: none;
	}

	/* Per-type icon pill */
	.activity-type-icon {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: 1.5px solid transparent;
	}

	/* RSVP, teal/slate */
	.activity-type-rsvp {
		background: rgba(47, 119, 120, 0.12);
		border-color: rgba(47, 119, 120, 0.2);
		color: var(--slate);
	}

	/* Itinerary, muted gold */
	.activity-type-itinerary {
		background: rgba(247, 170, 41, 0.13);
		border-color: rgba(247, 170, 41, 0.25);
		color: #9a6c10;
	}

	/* Poll, soft purple */
	.activity-type-poll {
		background: rgba(120, 80, 180, 0.1);
		border-color: rgba(120, 80, 180, 0.2);
		color: #7850b4;
	}

	/* Game, warm orange */
	.activity-type-game {
		background: rgba(206, 86, 18, 0.1);
		border-color: rgba(206, 86, 18, 0.2);
		color: var(--warm);
	}

	/* Meal, earthy green */
	.activity-type-meal {
		background: rgba(47, 119, 120, 0.08);
		border-color: rgba(47, 119, 120, 0.18);
		color: var(--navy);
	}

	.activity-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}

	.activity-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.activity-action {
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.activity-empty {
		font-size: 0.8125rem;
		color: var(--muted);
		text-align: center;
		padding: 1.5rem 0;
		margin: 0;
		opacity: 0.7;
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
		gap: 0.35rem;
	}

	/* Match CapacityGuestsCard `.cg-guest-scroll` + `.cg-chip*` (no overlap, 5px gap) */
	.guest-avatar-scroll {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 5px;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
		padding: 1px 0 0;
	}

	.guest-avatar-chip {
		flex-shrink: 0;
	}

	.guest-avatar-chip--declined {
		opacity: 0.5;
	}

	.guest-avatar-btn {
		position: relative;
		display: block;
		width: 30px;
		height: 30px;
		padding: 0;
		margin: 0;
		border-radius: 50%;
		border: 2px solid var(--border-soft);
		background: linear-gradient(135deg, var(--slate, #2f7778) 0%, var(--navy, #1d4d4e) 100%);
		overflow: visible;
		cursor: pointer;
		font: inherit;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}

	.guest-avatar-btn--static {
		cursor: default;
	}

	.guest-avatar-chip--going .guest-avatar-btn {
		border-color: rgba(47, 119, 120, 0.4);
	}

	.guest-avatar-btn:hover:not(.guest-avatar-btn--static) {
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	}

	.guest-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
		display: block;
	}

	.guest-avatar-initials {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: 0.625rem;
		font-weight: 700;
		color: white;
		border-radius: 50%;
	}

	.guest-avatar-dot {
		position: absolute;
		right: -1px;
		bottom: -1px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.guest-avatar-dot--yes {
		background: var(--slate, #2f7778);
	}

	.guest-avatar-dot--no {
		background: #dc2626;
	}

	.guest-avatar-dot--pending {
		background: var(--warm, #ce5612);
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
