<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';

	const INVITE_STORAGE_KEY = 'divvi_invite_token';

	let { data }: { data: PageData } = $props();

	const trip = data.trip;
	const formatDate = (d: Date | string) =>
		new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

	let resolvedToken = $state(data.inviteToken ?? '');

	onMount(() => {
		if (resolvedToken) return;
		try {
			const raw = sessionStorage.getItem(INVITE_STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as { tripId?: string; token?: string };
				if (parsed.tripId === trip.id && parsed.token) {
					resolvedToken = parsed.token;
				}
			}
		} catch { /* unavailable */ }
	});
</script>

<div class="join-shell">
	<div class="join-card">
		{#if trip.listingCoverPhoto}
			<div class="join-photo" style="background-image: url('{trip.listingCoverPhoto}')"></div>
		{/if}

		<div class="join-body">
			<div class="join-badge">Trip invitation</div>
			<h1 class="join-title">{trip.name}</h1>

			{#if trip.locationCity}
				<p class="join-meta">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					{trip.locationCity}
				</p>
			{/if}
			<p class="join-meta">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
				{formatDate(trip.checkInDate)} – {formatDate(trip.checkOutDate)}
			</p>

			<p class="join-desc">
				{#if trip.inviteMode === 'open'}
					You'll be added to the trip immediately.
				{:else}
					Once you request to join, the host will review your request. You'll be able to RSVP and participate once you're approved.
				{/if}
			</p>

			<form method="POST" action="?/join" use:enhance={() => {
				return async ({ update }) => {
					try { sessionStorage.removeItem(INVITE_STORAGE_KEY); } catch { /* */ }
					await update();
				};
			}}>
				{#if resolvedToken}
					<input type="hidden" name="inviteToken" value={resolvedToken} />
				{/if}
				<button type="submit" class="join-btn">
					{trip.inviteMode === 'open' ? 'Join Trip' : 'Request to Join'}
				</button>
			</form>
		</div>
	</div>
</div>

<style>
	.join-shell {
		min-height: 100vh;
		background: var(--bg, #faf9f7);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.join-card {
		background: var(--surface, #fff);
		border-radius: 20px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		max-width: 440px;
		width: 100%;
	}

	.join-photo {
		height: 200px;
		background-size: cover;
		background-position: center;
	}

	.join-body {
		padding: 2rem;
	}

	.join-badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--copper, #bf4e30);
		background: rgba(191, 78, 48, 0.08);
		border-radius: 100px;
		padding: 0.25rem 0.75rem;
		margin-bottom: 1rem;
	}

	.join-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text, #1a1a1a);
		margin-bottom: 0.75rem;
		letter-spacing: -0.02em;
	}

	.join-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
		color: var(--textMuted, #6b7280);
		margin-bottom: 0.35rem;
	}

	.join-desc {
		font-size: 0.9375rem;
		color: var(--textSecondary, #4b5563);
		line-height: 1.6;
		margin: 1.25rem 0 1.75rem;
	}

	.join-btn {
		width: 100%;
		padding: 0.875rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		font-family: inherit;
		color: #fff;
		background: var(--copper, #bf4e30);
		border: none;
		border-radius: 12px;
		cursor: pointer;
		transition: background 0.18s;
	}

	.join-btn:hover {
		background: var(--primaryHover, #a03d24);
	}
</style>
