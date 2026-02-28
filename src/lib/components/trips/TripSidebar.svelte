<script lang="ts">
	import { getTripBadges } from '$lib/trips/selectors.js';
	import TripNavItem from './TripNavItem.svelte';
	import RezziesLogo from '$lib/components/RezziesLogo.svelte';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
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
		user?: { id: string; name: string | null; email: string; avatarUrl?: string | null } | null;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
	} = $props();

	const badges = $derived(getTripBadges(trip));

	function initials(name: string | null | undefined, email?: string): string {
		if (name?.trim()) {
			const parts = name.trim().split(/\s+/);
			return parts.length >= 2
				? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
				: name.slice(0, 2).toUpperCase();
		}
		if (email) return email.slice(0, 2).toUpperCase();
		return '?';
	}

</script>

<aside class="sidebar">
	<div class="sidebar-overlay" aria-hidden="true"></div>
	<RezziesLogo href="/trips" class="sidebar-brand" />

	<div class="sidebar-content">
	<!-- Nav Items -->
	<nav class="nav">
		<TripNavItem href="/trips/{trip.id}" iconName="overview" label="Dashboard" />
		<TripNavItem href="/trips/{trip.id}/guests" iconName="guests" label="Guests" badge={badges.guests} />
		<TripNavItem href="/trips/{trip.id}/rooms" iconName="rooms" label="Rooms" badge={badges.rooms} />
		<TripNavItem href="/trips/{trip.id}/itinerary" iconName="itinerary" label="Itinerary" badge={badges.itinerary} />
		<TripNavItem href="/trips/{trip.id}/activities" iconName="activities" label="Activities" />
		<TripNavItem href="/trips/{trip.id}/polls" iconName="polls" label="Polls" />
		<TripNavItem href="/trips/{trip.id}/games" iconName="games" label="Games" />
		<TripNavItem href="/trips/{trip.id}/files" iconName="files" label="Files" badge={badges.files} />
	</nav>

	<!-- Footer: avatar above settings -->
	<div class="footer">
		{#if user}
			<ProfileTooltip userId={user.id}>
				<button type="button" class="user-row" aria-label="My profile" title="My profile" onclick={() => openProfileCard(user.id)}>
					<span class="user-avatar">
						{#if user.avatarUrl}
							<img src={user.avatarUrl} alt="" class="user-avatar-img" />
						{:else}
							{initials(user.name, user.email)}
						{/if}
					</span>
					<span class="user-name">{user.name || user.email || 'Profile'}</span>
				</button>
			</ProfileTooltip>
		{/if}
		<TripNavItem href="/trips/{trip.id}/settings" iconName="settings" label="Trip Settings" />
	</div>
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 100%;
		background: transparent;
		overflow: hidden;
		padding: 1.25rem;
		padding-top: 1rem;
		color: white;
	}

	.sidebar-brand {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
		color: white;
		flex-shrink: 0;
	}

	.sidebar-content {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		margin-top: 2rem;
		padding-top: 1rem;
	}

	.sidebar-brand:focus-visible {
		outline: 2px solid white;
		outline-offset: 2px;
	}

	.sidebar :global(.nav) {
		color: rgba(255, 255, 255, 0.95);
	}

	.sidebar .footer {
		border-top-color: rgba(255, 255, 255, 0.25);
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
		background: var(--surface2);
		border-radius: var(--radius-lg);
		padding: 1rem;
		margin: 0.5rem 0;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--border);
	}

	.extension-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.25rem 0;
	}

	.extension-subtitle {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0 0 0.75rem 0;
		line-height: 1.35;
	}

	.extension-cta {
		display: inline-block;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		background: var(--primary);
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: background var(--transition-fast);
	}

	.extension-cta:hover {
		background: var(--primaryHover);
	}

	.footer {
		padding: 0.75rem 0 0 0;
		border-top: 1px solid var(--border);
		margin-top: auto;
	}

	.user-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		margin-top: 0.5rem;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		text-decoration: none;
	}
	.user-row:hover {
		opacity: 0.9;
	}

	.user-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--surface2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--muted);
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--border);
		overflow: hidden;
		flex-shrink: 0;
	}

	.user-avatar :global(.user-avatar-img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.user-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
