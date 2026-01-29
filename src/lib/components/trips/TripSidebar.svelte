<script lang="ts">
	import { getTripStatus } from '$lib/trips/types.js';
	import { getTripBadges } from '$lib/trips/selectors.js';
	import TripSwitcher from './TripSwitcher.svelte';
	import TripQuickActions from './TripQuickActions.svelte';
	import TripNavItem from './TripNavItem.svelte';
	import type { TripForSidebar } from '$lib/trips/types.js';

	let {
		trip,
		allTrips,
		onInvite,
		showToast
	}: {
		trip: TripForSidebar & { inviteCode?: string };
		allTrips: { id: string; name: string; checkInDate: Date; checkOutDate: Date }[];
		onInvite?: () => void;
		showToast?: (msg: string) => void;
	} = $props();

	const status = $derived(getTripStatus(trip));
	const badges = $derived(getTripBadges(trip));
	const mealsEnabled = $derived(!!trip.mealPlan);

	const tripOptions = $derived(
		allTrips.map((t) => ({
			id: t.id,
			name: t.name,
			checkInDate: t.checkInDate,
			checkOutDate: t.checkOutDate
		}))
	);

	const dateRange =
		trip.checkInDate && trip.checkOutDate
			? `${new Date(trip.checkInDate).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})} – ${new Date(trip.checkOutDate).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})}`
			: '';
</script>

<aside class="sidebar">
	<!-- Trip Header Block -->
	<div class="header-block">
		<div class="cover-wrap">
			{#if trip.listingCoverPhoto}
				<img src={trip.listingCoverPhoto} alt="" class="cover-img" />
			{:else}
				<div class="cover-fallback"></div>
			{/if}
		</div>
		<h1 class="trip-name">{trip.name}</h1>
		{#if dateRange}
			<p class="trip-meta">{dateRange}</p>
		{/if}
		{#if trip.location}
			<p class="trip-meta destination">{trip.location}</p>
		{/if}
		<span class="status-pill" data-status={status}>
			{status === 'draft' ? 'Draft' : status === 'live' ? 'Live' : 'Locked'}
		</span>
		<div class="switcher-wrap">
			<TripSwitcher
				currentTripId={trip.id}
				currentTripName={trip.name}
				trips={tripOptions}
				tripsListHref="/trips"
			/>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="actions-row">
		<TripQuickActions
			tripId={trip.id}
			inviteCode={trip.inviteCode}
			onInvite={onInvite}
			showToast={showToast}
		/>
	</div>

	<!-- Nav Items -->
	<nav class="nav">
		<TripNavItem href="/trips/{trip.id}" icon="📊" label="Overview" />
		<TripNavItem href="/trips/{trip.id}/guests" icon="👥" label="Guests" badge={badges.guests} />
		<TripNavItem href="/trips/{trip.id}/rooms" icon="🛏️" label="Rooms & Beds" badge={badges.rooms} />
		<TripNavItem href="/trips/{trip.id}/payments" icon="💳" label="Payments" badge={badges.payments} />
		<TripNavItem href="/trips/{trip.id}/itinerary" icon="📋" label="Itinerary" badge={badges.itinerary} />
		{#if mealsEnabled}
			<TripNavItem href="/trips/{trip.id}/meals" icon="🍽️" label="Meals" badge={badges.meals} />
		{/if}
		<TripNavItem href="/trips/{trip.id}/files" icon="📁" label="Files" badge={badges.files} />
	</nav>

	<!-- Footer -->
	<div class="footer">
		<TripNavItem href="/trips/{trip.id}/settings" icon="⚙️" label="Trip Settings" />
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 280px;
		min-height: 100%;
		background: white;
		border-radius: var(--radius-2xl, 1rem);
		border: 1px solid var(--border);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
		overflow: hidden;
	}

	.header-block {
		padding: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.cover-wrap {
		width: 100%;
		aspect-ratio: 16 / 10;
		border-radius: var(--radius-md, 0.5rem);
		overflow: hidden;
		margin-bottom: 0.75rem;
	}

	.cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, rgba(30, 58, 138, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%);
	}

	.trip-name {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.25rem 0;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.trip-meta {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0 0 0.25rem 0;
	}

	.trip-meta.destination {
		margin-bottom: 0.5rem;
	}

	.status-pill {
		display: inline-block;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		margin-bottom: 0.75rem;
	}

	.status-pill[data-status='draft'] {
		background: var(--border);
		color: var(--muted);
	}

	.status-pill[data-status='live'] {
		background: rgba(34, 197, 94, 0.15);
		color: #15803d;
	}

	.status-pill[data-status='locked'] {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
	}

	.switcher-wrap {
		margin-top: 0.5rem;
	}

	.actions-row {
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.nav {
		flex: 1;
		padding: 0.75rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		overflow-y: auto;
	}

	.footer {
		padding: 0.75rem 0.5rem;
		border-top: 1px solid var(--border);
	}
</style>
