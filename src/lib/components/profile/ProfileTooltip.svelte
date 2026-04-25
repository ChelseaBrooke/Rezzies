<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

	interface ProfileData {
		displayName: string;
		avatarUrl: string | null;
		travelStyle: string | null;
		homeCity: string | null;
		isSelf?: boolean;
		friendshipStatus?: 'self' | 'none' | 'friends' | 'pending_sent' | 'pending_received';
	}

	let {
		userId,
		profile: initialProfile = null,
		children
	}: {
		userId: string;
		profile?: ProfileData | null;
		children?: Snippet;
	} = $props();

	let show = $state(false);
	let profile = $state<ProfileData | null>(initialProfile);
	let loading = $state(false);
	let actionLoading = $state(false);
	let actionMessage = $state<string | null>(null);
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
	let tooltipEl: HTMLDivElement;

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}

	async function fetchProfile() {
		if (profile && !loading) return;
		loading = true;
		try {
			const res = await fetch(`/api/users/${userId}/profile`);
			if (res.ok) {
				const data = await res.json();
				profile = {
					displayName: data.displayName,
					avatarUrl: data.avatarUrl,
					travelStyle: data.travelStyle,
					homeCity: data.homeCity,
					isSelf: data.isSelf,
					friendshipStatus: data.friendshipStatus
				};
			}
		} finally {
			loading = false;
		}
	}

	function onEnter() {
		hoverTimeout = setTimeout(() => {
			hoverTimeout = null;
			if (!profile && !initialProfile) fetchProfile();
			else if (initialProfile) profile = initialProfile;
			else if (profile) show = true;
			show = true;
		}, 300);
	}

	function onLeave() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		show = false;
		actionMessage = null;
		actionLoading = false;
	}

	async function addFriend() {
		if (actionLoading) return;
		actionLoading = true;
		actionMessage = null;
		try {
			const res = await fetch('/api/friends/request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ toUserId: userId })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				actionMessage = data?.error || 'Could not send request';
				return;
			}
			if (profile) profile = { ...profile, friendshipStatus: 'pending_sent' };
			actionMessage = 'Friend request sent';
		} finally {
			actionLoading = false;
		}
	}

	function openDirectMessage() {
		goto(`/messages?with=${userId}`);
	}

	function openBlockAction() {
		// Blocking flow currently lives in profile actions.
		openProfileCard(userId);
	}

	$effect(() => {
		if (initialProfile) profile = initialProfile;
	});
</script>

<div
	class="profile-tooltip-wrap"
	class:profile-tooltip-open={show}
	onmouseenter={onEnter}
	onmouseleave={onLeave}
	role="presentation"
>
	{#if children != null && typeof children === 'function'}
		{@render children()}
	{/if}
	{#if show}
		<div
			class="profile-tooltip"
			bind:this={tooltipEl}
			role="tooltip"
		>
			{#if loading}
				<p class="profile-tooltip-loading">Loading…</p>
			{:else if profile}
				<div class="profile-tooltip-avatar-wrap">
					{#if profile.avatarUrl}
						<img src={profile.avatarUrl} alt="" />
					{:else}
						<span class="profile-tooltip-initials">{initials(profile.displayName)}</span>
					{/if}
				</div>
				<p class="profile-tooltip-name">{profile.displayName}</p>
				{#if profile.travelStyle}
					<p class="profile-tooltip-tag">{profile.travelStyle}</p>
				{/if}
				{#if profile.homeCity}
					<p class="profile-tooltip-city">{profile.homeCity}</p>
				{/if}
				{#if !profile.isSelf}
					<div class="profile-tooltip-actions">
						<button type="button" class="profile-tooltip-btn profile-tooltip-btn--primary" onclick={openDirectMessage}>
							Direct message
						</button>
						{#if profile.friendshipStatus === 'friends'}
							<span class="profile-tooltip-pill">Friends</span>
						{:else if profile.friendshipStatus === 'pending_sent'}
							<span class="profile-tooltip-pill">Request sent</span>
						{:else if profile.friendshipStatus === 'pending_received'}
							<span class="profile-tooltip-pill">Pending request</span>
						{:else}
							<button
								type="button"
								class="profile-tooltip-btn profile-tooltip-btn--ghost"
								onclick={addFriend}
								disabled={actionLoading}
							>
								{actionLoading ? 'Adding...' : 'Add friend'}
							</button>
						{/if}
						<button type="button" class="profile-tooltip-btn profile-tooltip-btn--ghost" onclick={openBlockAction}>
							Block
						</button>
					</div>
					{#if actionMessage}
						<p class="profile-tooltip-note">{actionMessage}</p>
					{/if}
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.profile-tooltip-wrap {
		position: relative;
		display: inline-flex;
	}
	/* When tooltip is open, raise wrap so tray appears above sibling containers (e.g. room cards) */
	.profile-tooltip-wrap.profile-tooltip-open {
		z-index: 100000;
	}
	.profile-tooltip {
		position: absolute;
		left: 50%;
		top: 100%;
		transform: translateX(-50%) translateY(0.35rem);
		min-width: 160px;
		max-width: 220px;
		padding: 0.75rem;
		background: var(--surfaceSolid, #fff);
		border-radius: 10px;
		box-shadow: 0 4px 12px rgba(0, 27, 46, 0.15);
		border: 1px solid var(--border, #e2e8f0);
		z-index: 100001;
		pointer-events: auto;
		text-align: center;
	}
	.profile-tooltip-avatar-wrap {
		width: 48px;
		height: 48px;
		margin: 0 auto 0.5rem;
		border-radius: 50%;
		overflow: hidden;
		background: var(--bg, #f1f5f9);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.profile-tooltip-avatar-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.profile-tooltip-initials {
		font-size: 1rem;
		font-weight: 600;
		color: var(--copper, #bf4e30);
	}
	.profile-tooltip-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text, #0f172a);
		margin: 0 0 0.25rem 0;
	}
	.profile-tooltip-tag {
		font-size: 0.75rem;
		color: var(--copper, #bf4e30);
		margin: 0 0 0.15rem 0;
	}
	.profile-tooltip-city {
		font-size: 0.75rem;
		color: var(--muted, #64748b);
		margin: 0;
	}
	.profile-tooltip-loading {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	.profile-tooltip-actions {
		margin-top: 0.55rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
	}
	.profile-tooltip-btn,
	.profile-tooltip-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.22rem 0.5rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 600;
		line-height: 1.2;
	}
	.profile-tooltip-btn {
		border: 1px solid transparent;
		cursor: pointer;
		font: inherit;
	}
	.profile-tooltip-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.profile-tooltip-btn--primary {
		background: var(--primary, #2f7778);
		color: #fff;
	}
	.profile-tooltip-btn--ghost {
		background: rgba(15, 23, 42, 0.06);
		border-color: rgba(15, 23, 42, 0.14);
		color: var(--text, #0f172a);
	}
	.profile-tooltip-pill {
		background: rgba(15, 23, 42, 0.08);
		color: var(--muted, #64748b);
	}
	.profile-tooltip-note {
		margin: 0.35rem 0 0;
		font-size: 0.66rem;
		color: var(--muted, #64748b);
	}
</style>
