<script lang="ts">
	import { getContext } from 'svelte';
	import type { PageData } from './$types';
	import TripCalendarWidget from '$lib/components/trips/TripCalendarWidget.svelte';
	import TripGoalCircle from '$lib/components/trips/TripGoalCircle.svelte';
	import TripQuickActions from '$lib/components/trips/TripQuickActions.svelte';

	let { data }: { data: PageData } = $props();

	const quickActions = getContext<{ onInvite: () => void; showToast: (msg: string) => void }>('tripQuickActions');

	const trip = $derived(data.trip);
	const user = $derived(data.user);
	const isHost = $derived(data.isHost ?? false);
	const userRsvp = $derived(data.userRsvp);
	const userProfile = $derived(data.userProfile);
	const userInvoices = $derived(data.userInvoices ?? []);

	const members = $derived(trip?.members ?? []);
	const rsvps = $derived(trip?.rsvps ?? []);
	const roomAssignments = $derived(trip?.roomAssignments ?? []);
	const rooms = $derived(trip?.rooms ?? []);
	const activities = $derived(trip?.activities ?? []);
	const mealSlots = $derived(trip?.mealSlots ?? []);
	const totalCost = $derived(trip?.totalCost ?? 0);

	const acceptedCount = $derived(rsvps.filter((r) => r.status === 'yes').length);
	const declinedCount = $derived(rsvps.filter((r) => r.status === 'no').length);
	const pendingRsvpCount = $derived(members.length - acceptedCount - declinedCount);
	const rsvpPct = $derived(members.length > 0 ? Math.round((acceptedCount / members.length) * 100) : 0);

	const totalBedSlots = $derived(
		rooms.reduce((sum, r) => sum + (r.beds?.reduce((s, b) => s + (b.capacitySlots ?? 1), 0) ?? 0), 0)
	);
	const claimedSlots = $derived(roomAssignments.reduce((sum, a) => sum + (a.partySize ?? 1), 0));
	const bedsPct = $derived(totalBedSlots > 0 ? Math.round((claimedSlots / totalBedSlots) * 100) : 0);

	const committedFunds = $derived(
		(trip?.invoices ?? []).reduce((s, i) => s + (i.status === 'paid' ? i.totalAmount : 0), 0)
	);
	const fundingPct = $derived(totalCost > 0 ? Math.round((committedFunds / totalCost) * 100) : 0);

	const guestPreviewList = $derived(members.slice(0, 8));

	const myAssignment = $derived(user ? roomAssignments.find((a) => a.userId === user.id) : null);
	const myPaidTotal = $derived(
		userInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0)
	);
	const myDueTotal = $derived(
		userInvoices.filter((i) => i.status === 'due').reduce((s, i) => s + i.totalAmount, 0)
	);

	type ActivityItem = { type: 'room' | 'rsvp'; text: string; at: Date };
	const recentActivityItems = $derived(
		(() => {
			const items: ActivityItem[] = [];
			roomAssignments.forEach((a) => {
				items.push({
					type: 'room',
					text: `${a.user?.name ?? 'Someone'} claimed ${a.room?.name ?? 'room'}`,
					at: new Date(a.updatedAt)
				});
			});
			rsvps.forEach((r) => {
				if (r.status === 'yes')
					items.push({ type: 'rsvp', text: `${r.user?.name ?? 'Someone'} accepted`, at: new Date(r.updatedAt) });
			});
			items.sort((a, b) => b.at.getTime() - a.at.getTime());
			return items.slice(0, 5);
		})()
	);

	const nextUpcomingItem = $derived(
		activities.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
	);

	function formatTripDateRange(start: Date | string, end: Date | string): string {
		const s = typeof start === 'string' ? new Date(start) : start;
		const e = typeof end === 'string' ? new Date(end) : end;
		return `${s.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}, ${e.getFullYear()}`;
	}

	const dateRange = $derived(
		trip?.checkInDate && trip?.checkOutDate
			? formatTripDateRange(trip.checkInDate, trip.checkOutDate)
			: trip?.checkInDate
				? new Date(trip.checkInDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
				: '—'
	);

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}

	function nudgePending() {
		quickActions?.showToast?.('Nudge sent to pending guests');
	}

	function addToCalendar() {
		quickActions?.showToast?.('Add to calendar — coming soon');
	}
</script>

<div class="overview-page">
	<!-- Left: photo, then Trip info + Recent activity + Alerts, then Guests. Right: stats, buttons, calendar, For you -->
	<div class="hero-and-calendar">
		<div class="overview-left-column">
			<div class="hero-photo-box" aria-label="Trip photo">
				<div class="hero-image-wrap">
					{#if trip?.listingCoverPhoto}
						<img src={trip.listingCoverPhoto} alt="" class="hero-image" />
					{:else}
						<div class="hero-placeholder"></div>
					{/if}
					<div class="hero-overlay">
						<h1 class="hero-name">{trip?.name ?? 'Trip'}</h1>
						<p class="hero-dates">
							<span class="hero-date">{dateRange}</span>
							{#if trip?.location?.trim()}
								<span class="hero-sep"> · </span>
								<span class="hero-destination">{trip.location}</span>
							{/if}
						</p>
						<div class="hero-cta-cluster">
							{#if quickActions && trip}
								<TripQuickActions
									tripId={trip.id}
									inviteCode={trip.inviteCode}
									onInvite={quickActions.onInvite}
									showToast={quickActions.showToast}
								/>
							{/if}
							<button type="button" class="hero-cta-btn" onclick={addToCalendar} title="Add to calendar">
								Add to calendar
							</button>
						</div>
					</div>
				</div>
			</div>
			<!-- Trip info, Recent activity, Alerts — just below the main photo -->
			<div class="overview-below-photo">
				<section class="trip-info-note overview-card" aria-labelledby="trip-info-title">
					<h2 id="trip-info-title" class="section-title">Trip info</h2>
					<p class="trip-info-text">Check-in is 4pm. Keys at the lockbox — code in your confirmation.</p>
					<div class="trip-info-links">
						<a href="/trips/{trip?.id}/itinerary">Wi‑Fi</a>
						<a href="/trips/{trip?.id}/itinerary">Check-in</a>
						<a href="/trips/{trip?.id}/itinerary">Rules</a>
					</div>
					<a href="/trips/{trip?.id}/itinerary" class="link-view">View all notes</a>
				</section>
				<section class="recent-activity-compact overview-card" aria-labelledby="activity-title">
					<h2 id="activity-title" class="section-title">Recent activity</h2>
					{#if recentActivityItems.length > 0}
						<ul class="activity-list">
							{#each recentActivityItems as item}
								<li class="activity-item">{item.text}</li>
							{/each}
						</ul>
					{:else}
						<p class="muted">No recent activity</p>
					{/if}
					<a href="/trips/{trip?.id}/itinerary" class="link-view">View activity log</a>
				</section>
				<section class="alerts-compact overview-card" aria-labelledby="alerts-title">
					<h2 id="alerts-title" class="section-title">Alerts</h2>
					<p class="muted">No conflict warnings or expiring items.</p>
				</section>
			</div>
			<div class="overview-main">
				<section class="guests-preview-section" aria-labelledby="guests-title">
					<h2 id="guests-title" class="section-title">Guests</h2>
					<div class="guests-preview">
						<div class="avatar-row">
							{#each guestPreviewList as member}
								<span class="avatar" title={member.user?.name ?? member.user?.email ?? ''}>{initials(member.user?.name ?? member.user?.email)}</span>
							{/each}
						</div>
						<div class="guests-meta">
							<span class="pending-badge">{pendingRsvpCount} pending RSVP</span>
							{#if isHost}
								<button type="button" class="btn-nudge" onclick={nudgePending}>Nudge pending</button>
							{/if}
						</div>
						<a href="/trips/{trip?.id}/guests" class="link-view">View guests</a>
					</div>
				</section>
			</div>
		</div>
		<div class="hero-right-column">
			<div class="goal-circle-wrap">
				<TripGoalCircle
					rsvpCurrent={acceptedCount}
					rsvpTotal={members.length}
					rsvpPct={rsvpPct}
					bedsCurrent={claimedSlots}
					bedsTotal={totalBedSlots}
					bedsPct={bedsPct}
					fundingCurrent={Math.round(committedFunds)}
					fundingTotal={Math.round(totalCost)}
					fundingPct={fundingPct}
					fundingDisplay={totalCost > 0 ? `$${committedFunds.toFixed(0)} / $${totalCost.toFixed(0)}` : 'Not set'}
					guestsHref="/trips/{trip?.id}/guests"
					roomsHref="/trips/{trip?.id}/rooms"
					paymentsHref="/trips/{trip?.id}/payments"
				/>
			</div>
			<div class="quick-actions-box" aria-label="Quick actions">
				<nav class="quick-actions-section quick-actions-under-stats">
					<a href="/trips/{trip?.id}/polls" class="chip-orange" title="Create poll">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
						<span>Poll</span>
					</a>
					<a href="/trips/{trip?.id}/checklist" class="chip-orange" title="Checklist"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>Checklist</span></a>
					<a href="/trips/{trip?.id}/files" class="chip-orange" title="Upload"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload</span></a>
					<a href="/trips/{trip?.id}/itinerary" class="chip-orange" title="Suggestion"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>Suggestion</span></a>
				</nav>
			</div>
			<div class="calendar-box" aria-label="Trip calendar">
				<TripCalendarWidget
					tripId={trip?.id}
					placement="sidebar"
					checkInDate={trip?.checkInDate ?? ''}
					checkOutDate={trip?.checkOutDate ?? ''}
					activities={activities}
					mealSlots={mealSlots}
				/>
			</div>
			<section class="for-you-panel for-you-compact" aria-labelledby="for-you-title">
				<h2 id="for-you-title" class="section-title">For you</h2>
				<div class="for-you-body">
					<div class="for-you-row">
						<span class="for-you-label">Your RSVP</span>
						<div class="for-you-right">
							{#if userRsvp?.status === 'yes'}
								<span class="for-you-value ok">Accepted</span>
							{:else if userRsvp?.status === 'no'}
								<span class="for-you-value">Declined</span>
							{:else}
								<a href="/trips/{trip?.id}/rsvp" class="btn-for-you">Respond</a>
							{/if}
						</div>
					</div>
					<div class="for-you-row">
						<span class="for-you-label">Room / bed</span>
						<div class="for-you-right">
							{#if myAssignment}
								<span class="for-you-value ok">{myAssignment.room?.name ?? 'Assigned'}</span>
							{:else}
								<a href="/trips/{trip?.id}/rooms" class="btn-for-you">Choose</a>
							{/if}
						</div>
					</div>
					<div class="for-you-row">
						<span class="for-you-label">Your cost</span>
						<div class="for-you-right">
							{#if myDueTotal > 0}
								<a href="/trips/{trip?.id}/payments" class="btn-for-you">Settle</a>
							{:else if myPaidTotal > 0}
								<span class="for-you-value ok">Settled</span>
							{:else}
								<span class="for-you-value">—</span>
							{/if}
						</div>
					</div>
					<div class="for-you-missing">
						{#if !userProfile?.dietaryRestrictions && !userProfile?.allergies}
							<span class="missing-item">Dietary / allergies</span>
						{/if}
						{#if !userRsvp?.arrivalDatetime && userRsvp?.status === 'yes'}
							<span class="missing-item">Arrival time</span>
						{/if}
					</div>
					{#if nextUpcomingItem}
						<div class="for-you-next">
							<span class="for-you-label">Next up</span>
							<span class="for-you-value">{nextUpcomingItem.title} — {nextUpcomingItem.date ? new Date(nextUpcomingItem.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.overview-page {
		background: #faf9f7;
		min-height: 100%;
		padding: 0.5rem 1rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Trip info, Recent activity, Alerts — just below the main photo (left column) */
	.overview-below-photo {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.overview-card {
		background: white;
		border-radius: var(--radius-xl);
		padding: 1rem 1.25rem;
		box-shadow: 0 1px 2px rgba(0, 27, 46, 0.06);
	}

	.overview-below-photo .section-title {
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.overview-below-photo .trip-info-note {
		background: white;
	}

	/* Photo (left) | Right column: stats + buttons + calendar — row grows so calendar not clipped */
	.hero-and-calendar {
		display: grid;
		grid-template-columns: 2fr 1fr;
		grid-template-rows: auto;
		align-items: start;
		gap: 1rem;
		flex-shrink: 0;
	}

	.overview-left-column {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.hero-photo-box {
		border-radius: var(--radius-2xl);
		overflow: hidden;
		box-shadow: var(--shadow-lg);
		height: 420px;
		min-height: 420px;
		background: var(--surface2);
	}

	.hero-right-column {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 280px;
		max-height: calc(100vh - 6rem);
		min-width: 0;
	}

	.hero-photo-box .hero-image-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 400px;
		background: var(--surface2);
		overflow: hidden;
	}

	.hero-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.hero-placeholder {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, var(--slate) 0%, var(--muted) 100%);
	}

	.hero-overlay {
		position: absolute;
		left: 0; right: 0; bottom: 0;
		padding: 1.25rem 1.5rem;
		background: linear-gradient(to top, rgba(0, 27, 46, 0.9) 0%, rgba(0, 27, 46, 0.4) 55%, transparent 100%);
		color: white;
	}

	.hero-name {
		margin: 0 0 0.25rem 0;
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.2;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.hero-dates {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
		opacity: 0.95;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.hero-sep { opacity: 0.85; }
	.hero-date, .hero-destination { display: inline-block; }

	.hero-cta-cluster {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.hero-cta-cluster :global(.quick-actions) { gap: 0.35rem; }
	.hero-cta-cluster :global(.action-btn) {
		width: 2rem;
		height: 2rem;
		color: white;
		background: rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-md);
		border: none;
	}

	.hero-cta-btn {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.35rem 0.65rem;
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}

	.hero-cta-btn:hover {
		background: rgba(255, 255, 255, 0.3);
		border-color: rgba(255, 255, 255, 0.5);
	}

	.progress-strip-in-column {
		flex-shrink: 0;
		padding: 0;
		background: transparent;
	}

	.quick-actions-section {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.quick-actions-under-stats {
		width: 100%;
	}

	.quick-actions-box {
		flex-shrink: 0;
		background: transparent;
		border: none;
		border-radius: 0;
		box-shadow: none;
		padding: 0.5rem 0.75rem;
		min-width: 0;
	}

	.chip-orange {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0.5rem 0.875rem;
		background: var(--primary);
		color: white;
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: background var(--transition-fast), color var(--transition-fast);
		border: none;
	}
	.chip-orange:hover {
		background: var(--primaryHover);
		color: white;
	}
	.chip-orange svg {
		flex-shrink: 0;
	}

	.calendar-box {
		border-radius: var(--radius-xl);
		overflow: auto;
		box-shadow: var(--shadow-lg);
		background: white;
		flex: 1;
		min-height: 260px;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.calendar-box :global(.calendar-sidebar) {
		background: transparent;
		box-shadow: none;
		border: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		height: 100%;
		overflow: auto;
	}

	.calendar-box :global(.calendar-sidebar .month-calendar.sidebar-style),
	.calendar-box :global(.calendar-sidebar .day-detail-view) {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.calendar-box :global(.calendar-sidebar .days-grid) {
		flex: 1;
		align-content: start;
		grid-auto-rows: minmax(26px, 1fr);
		min-height: 0;
	}

	/* Main content (Guests, Trip info) — under photo in left column */
	.overview-main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		flex-shrink: 0;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.75rem 0;
	}

	/* For You: tinted, primary CTAs as buttons */
	.for-you-panel {
		background: rgba(191, 78, 48, 0.07);
		border-radius: var(--radius-2xl);
		padding: 1.5rem;
		min-height: 200px;
	}

	/* For You compact: under calendar in right column */
	.for-you-compact {
		flex-shrink: 0;
		min-height: 0;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-xl);
	}
	.for-you-compact .section-title { margin-bottom: 0.5rem; font-size: 0.875rem; }
	.for-you-compact .for-you-body { gap: 0.5rem; }
	.for-you-compact .for-you-row { gap: 0.5rem; }
	.for-you-compact .for-you-label { font-size: 0.8125rem; }
	.for-you-compact .for-you-value { font-size: 0.8125rem; }
	.for-you-compact .btn-for-you { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
	.for-you-compact .for-you-missing { margin-top: 0.125rem; }
	.for-you-compact .missing-item { font-size: 0.6875rem; padding: 0.2rem 0.4rem; }
	.for-you-compact .for-you-next { margin-top: 0.375rem; padding-top: 0.5rem; }
	.for-you-compact .for-you-next .for-you-value { font-size: 0.75rem; }

	.for-you-body { display: flex; flex-direction: column; gap: 0.875rem; }

	.for-you-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.for-you-label {
		font-size: 0.875rem;
		color: var(--muted);
		flex-shrink: 0;
	}

	.for-you-right { margin-left: auto; }

	.for-you-value {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
	}
	.for-you-value.ok { color: var(--primary); }

	.btn-for-you {
		display: inline-flex;
		align-items: center;
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0.4rem 0.85rem;
		background: var(--primary);
		color: white;
		border-radius: var(--radius-md);
		text-decoration: none;
		border: none;
		cursor: pointer;
		transition: background var(--transition-fast);
	}
	.btn-for-you:hover { background: var(--primaryHover); }

	.for-you-missing { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
	.missing-item {
		font-size: 0.75rem;
		color: var(--muted);
		background: rgba(255, 255, 255, 0.7);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
	}
	.for-you-next {
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(191, 78, 48, 0.15);
	}

	/* Guests: white, compact */
	.guests-preview-section {
		background: white;
		border-radius: var(--radius-2xl);
		padding: 1.25rem;
	}

	.guests-preview { display: flex; flex-direction: column; gap: 0.75rem; }
	.avatar-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
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
	.guests-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.pending-badge { font-size: 0.75rem; color: var(--muted); }
	.btn-nudge {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--primary);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}
	.btn-nudge:hover { text-decoration: underline; }

	/* Trip info: note-style, light tint; own box, no overlap */
	.trip-info-note {
		background: rgba(0, 27, 46, 0.04);
		border-radius: var(--radius-2xl);
		padding: 1.25rem;
		position: relative;
		z-index: 0;
	}

	.trip-info-text { font-size: 0.875rem; color: var(--text); margin: 0 0 0.75rem 0; line-height: 1.5; }
	.trip-info-links { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
	.trip-info-links a {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--primary);
		text-decoration: none;
	}
	.trip-info-links a:hover { text-decoration: underline; }

	.link-view {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}
	.link-view:hover { text-decoration: underline; }

	.quick-action-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8125rem;
		font-weight: 500;
		padding: 0.5rem 0.875rem;
		background: white;
		border-radius: 9999px;
		color: var(--text);
		text-decoration: none;
		transition: background var(--transition-fast), color var(--transition-fast);
		box-shadow: 0 1px 2px rgba(0, 27, 46, 0.04);
	}
	.chip:hover { background: var(--primary); color: white; }
	.chip svg { flex-shrink: 0; }

	.recent-activity-compact,
	.alerts-compact {
		background: white;
		border-radius: var(--radius-xl);
		padding: 1rem 1.25rem;
	}

	.recent-activity-compact .section-title,
	.alerts-compact .section-title { margin-bottom: 0.5rem; }
	.activity-list { list-style: none; margin: 0; padding: 0; font-size: 0.8125rem; color: var(--text); }
	.activity-item { padding: 0.2rem 0; }
	.muted { font-size: 0.8125rem; color: var(--muted); margin: 0; }

	/* Responsive */
	@media (max-width: 1024px) {
		.overview-below-photo { grid-template-columns: 1fr; }
		.hero-and-calendar { grid-template-columns: 1fr; grid-template-rows: auto; }
		.hero-photo-box { height: 320px; min-height: 320px; }
		.hero-photo-box .hero-image-wrap { min-height: 280px; }
		.hero-right-column { gap: 1rem; }
		.calendar-box { flex: 1 1 280px; min-height: 280px; }
		.calendar-box :global(.calendar-sidebar) { min-height: 320px; }
		.overview-main { flex-direction: column; }
	}

	@media (max-width: 640px) {
		.overview-page { padding: 1rem 1rem 1.5rem; gap: 1.25rem; }
		.hero-overlay { padding: 1rem 1.25rem; }
		.hero-name { font-size: 1.5rem; }
	}
</style>
