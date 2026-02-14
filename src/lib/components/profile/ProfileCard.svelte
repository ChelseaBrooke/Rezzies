<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { profileCardUserId, closeProfileCard, openEditProfileModal, profileCardRefreshRequested } from '$lib/stores/profileOverlay.js';

	type ProfileCardData = {
		displayName: string;
		avatarUrl: string | null;
		travelStyle: string | null;
		homeCity: string | null;
		isSelf: boolean;
		tripsHosted: number;
		tripsJoined: number;
		sharedTrips: { tripId: string; name: string; checkInDate: string; checkOutDate: string }[];
		friendshipStatus: 'self' | 'none' | 'friends';
	};

	let currentUserId = $state<string | null>(null);
	let currentUserIdForFetch = $derived($profileCardUserId);
	let profile = $state<ProfileCardData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let overlayEl: HTMLDivElement;
	let focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}

	function formatDateRange(start: string, end: string): string {
		try {
			const s = new Date(start);
			const e = new Date(end);
			return s.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' – ' + e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return '';
		}
	}

	async function fetchCard() {
		const userId = $profileCardUserId;
		if (!userId) {
			profile = null;
			loading = false;
			currentUserId = null;
			return;
		}
		currentUserId = userId;
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/users/${userId}/profile-card`);
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				error = data.error || 'Failed to load profile';
				profile = null;
				return;
			}
			profile = await res.json();
		} catch (e) {
			error = 'Failed to load profile';
			profile = null;
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		closeProfileCard();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === overlayEl) closeProfileCard();
	}

	function trapFocus() {
		if (!overlayEl) return;
		const focusable = overlayEl.querySelectorAll<HTMLElement>(focusableSelector);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const handleKey = (e: KeyboardEvent) => {
			if (e.key !== 'Tab') return;
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last?.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first?.focus();
				}
			}
		};
		overlayEl.addEventListener('keydown', handleKey);
		first?.focus();
		return () => overlayEl.removeEventListener('keydown', handleKey);
	}

	$effect(() => {
		if (currentUserIdForFetch !== currentUserId) fetchCard();
	});

	$effect(() => {
		if ($profileCardRefreshRequested && $profileCardUserId && currentUserId === $profileCardUserId) {
			profileCardRefreshRequested.set(false);
			fetchCard();
		}
	});

	$effect(() => {
		if ($profileCardUserId && overlayEl) {
			let trapCleanup: (() => void) | undefined;
			const t = setTimeout(() => {
				trapCleanup = trapFocus();
			}, 50);
			return () => {
				clearTimeout(t);
				trapCleanup?.();
			};
		}
	});

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if $profileCardUserId}
	<div
		class="profile-card-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="profile-card-name"
		bind:this={overlayEl}
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="profile-card-panel" onclick={(e) => e.stopPropagation()}>
			<button type="button" class="profile-card-close" aria-label="Close" onclick={closeProfileCard}>×</button>
			{#if loading}
				<p class="profile-card-loading">Loading…</p>
			{:else if error}
				<p class="profile-card-error">{error}</p>
			{:else if profile}
				<div class="profile-card-content">
					<div class="profile-card-avatar-wrap">
						{#if profile.avatarUrl}
							<img src={profile.avatarUrl} alt="" />
						{:else}
							<span class="profile-card-initials">{initials(profile.displayName)}</span>
						{/if}
					</div>
					<h2 id="profile-card-name" class="profile-card-name">{profile.displayName}</h2>
					{#if profile.travelStyle}
						<span class="profile-card-tag">{profile.travelStyle}</span>
					{/if}
					{#if profile.homeCity}
						<p class="profile-card-location">{profile.homeCity}</p>
					{/if}
					<div class="profile-card-stats">
						<span class="profile-card-stat"><strong>{profile.tripsHosted}</strong> trips hosted</span>
						<span class="profile-card-stat"><strong>{profile.tripsJoined}</strong> trips joined</span>
					</div>
					{#if !profile.isSelf && profile.sharedTrips.length > 0}
						<div class="profile-card-shared">
							<h3>Trips you've been on together</h3>
							<ul>
								{#each profile.sharedTrips as trip}
									<li>
										<span class="trip-name">{trip.name}</span>
										<span class="trip-dates">{formatDateRange(trip.checkInDate, trip.checkOutDate)}</span>
									</li>
								{/each}
							</ul>
						</div>
					{:else if !profile.isSelf}
						<div class="profile-card-shared">
							<h3>Trips you've been on together</h3>
							<p class="muted">No trips together yet</p>
						</div>
					{/if}
					<div class="profile-card-actions">
						{#if profile.isSelf}
							<button type="button" class="btn btn-primary" onclick={() => { openEditProfileModal(); }}>Edit profile</button>
						{:else}
							{#if profile.friendshipStatus === 'none' || profile.friendshipStatus === 'friends'}
								<button type="button" class="btn btn-primary">
									{profile.friendshipStatus === 'friends' ? 'Unfriend' : 'Add Friend'}
								</button>
							{/if}
							<button type="button" class="btn btn-ghost">Block</button>
							<button type="button" class="btn btn-ghost">Report</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.profile-card-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 27, 46, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 99999;
		padding: 1rem;
		box-sizing: border-box;
	}
	.profile-card-panel {
		position: relative;
		width: 100%;
		max-width: 400px;
		max-height: 90vh;
		overflow-y: auto;
		background: var(--surfaceSolid, #fff);
		border-radius: 16px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--border, #e2e8f0);
	}
	.profile-card-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 2rem;
		height: 2rem;
		border: none;
		background: transparent;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.profile-card-close:hover {
		background: var(--border-soft);
		color: var(--text);
	}
	.profile-card-content {
		padding: 1.5rem;
		text-align: center;
	}
	.profile-card-avatar-wrap {
		width: 80px;
		height: 80px;
		margin: 0 auto 0.75rem;
		border-radius: 50%;
		overflow: hidden;
		background: var(--bg, #f1f5f9);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.profile-card-avatar-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.profile-card-initials {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--copper, #bf4e30);
	}
	.profile-card-name {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0 0 0.35rem 0;
		color: var(--text, #0f172a);
	}
	.profile-card-tag {
		display: inline-block;
		font-size: 0.8125rem;
		color: var(--copper);
		background: rgba(191, 78, 48, 0.1);
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		margin-bottom: 0.5rem;
	}
	.profile-card-location {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 0.75rem 0;
	}
	.profile-card-stats {
		display: flex;
		justify-content: center;
		gap: 1.25rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
	.profile-card-stats strong {
		color: var(--text);
		display: block;
		font-size: 1.125rem;
	}
	.profile-card-shared {
		text-align: left;
		margin-bottom: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.profile-card-shared h3 {
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}
	.profile-card-shared ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.profile-card-shared li {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.35rem 0;
		font-size: 0.875rem;
	}
	.profile-card-shared .trip-name {
		font-weight: 500;
		color: var(--text);
	}
	.profile-card-shared .trip-dates {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.profile-card-shared .muted {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	.profile-card-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
	}
	.profile-card-actions .btn {
		font-size: 0.875rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-weight: 500;
	}
	.profile-card-actions .btn-primary {
		background: var(--copper);
		color: white;
	}
	.profile-card-actions .btn-ghost {
		background: transparent;
		color: var(--muted);
	}
	.profile-card-actions .btn-ghost:hover {
		background: var(--border-soft);
		color: var(--text);
	}
	.profile-card-loading,
	.profile-card-error {
		padding: 2rem;
		text-align: center;
		color: var(--muted);
	}
	.profile-card-error {
		color: var(--danger, #b91c1c);
	}
</style>
