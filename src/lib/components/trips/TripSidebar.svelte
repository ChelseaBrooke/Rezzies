<script lang="ts">
	import { getTripBadges } from '$lib/trips/selectors.js';
	import TripSwitcher from './TripSwitcher.svelte';
	import TripQuickActions from './TripQuickActions.svelte';
	import TripNavItem from './TripNavItem.svelte';
	import RezziesLogo from '$lib/components/RezziesLogo.svelte';
	import type { TripForSidebar } from '$lib/trips/types.js';

	let {
		trip,
		allTrips,
		user = null,
		onInvite,
		showToast
	}: {
		trip: TripForSidebar & { inviteCode?: string };
		allTrips: { id: string; name: string; checkInDate: Date; checkOutDate: Date; isPublished?: boolean }[];
		user?: { id: string; name: string | null; email: string } | null;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
	} = $props();

	const badges = $derived(getTripBadges(trip));
	const mealsEnabled = $derived(!!trip.mealPlan);

	const tripOptions = $derived(
		allTrips.map((t) => ({
			id: t.id,
			name: t.name,
			checkInDate: t.checkInDate,
			checkOutDate: t.checkOutDate,
			isPublished: t.isPublished ?? false
		}))
	);

</script>

<aside class="sidebar">
	<div class="sidebar-overlay" aria-hidden="true"></div>
	<RezziesLogo href="/trips" class="sidebar-brand" />
	<!-- Trip card: switcher only -->
	<div class="trip-profile-card">
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
		width: 100%;
		min-height: 100%;
		/* Blends into shell background; no soft edges */
		background: transparent;
		overflow: hidden;
		padding: 1.25rem;
	}

	.sidebar-brand {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.4);
	}

	.header-block {
		padding: 0 0 1rem 0;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.4);
	}

	.switcher-wrap {
		margin-top: 0;
	}

	.actions-row {
		padding: 0.5rem 0;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.4);
	}

	.nav {
		flex: 1;
		padding: 0.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow-y: auto;
	}

	.extension-card {
		background: rgba(255, 255, 255, 0.7);
		border-radius: 1rem;
		padding: 1rem;
		margin: 0.5rem 0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.extension-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #0f172a;
		margin: 0 0 0.25rem 0;
	}

	.extension-subtitle {
		font-size: 0.8125rem;
		color: #64748b;
		margin: 0 0 0.75rem 0;
		line-height: 1.35;
	}

	.extension-cta {
		display: inline-block;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
		border-radius: 0.5rem;
		text-decoration: none;
		transition: opacity 0.2s ease;
	}

	.extension-cta:hover {
		opacity: 0.95;
	}

	.footer {
		padding: 0.75rem 0 0 0;
		border-top: 1px solid rgba(255, 255, 255, 0.4);
		margin-top: auto;
	}

	.user-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		margin-top: 0.5rem;
	}

	.user-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		color: #334155;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}

	.user-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
