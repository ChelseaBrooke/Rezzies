<script lang="ts">
	import type { Snippet } from 'svelte';

	interface ProfileData {
		displayName: string;
		avatarUrl: string | null;
		travelStyle: string | null;
		homeCity: string | null;
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
					homeCity: data.homeCity
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
		pointer-events: none;
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
</style>
