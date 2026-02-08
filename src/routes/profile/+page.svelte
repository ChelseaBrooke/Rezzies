<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import MarketingShell from '$lib/components/MarketingShell.svelte';
	import { TRAVEL_STYLE_OPTIONS } from '$lib/travel-style.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Profile display state (own profile only for now)
	let profile = $state({
		avatarUrl: data.user?.avatarUrl ?? null,
		travelStyle: data.user?.travelStyle ?? null,
		homeCity: data.user?.homeCity ?? null,
		timezone: data.user?.timezone ?? null
	});

	/** 10 soft chat bubble colors (slightly less muted, not harsh) */
	const CHAT_BUBBLE_COLORS = [
		'#7a9a78', /* sage */
		'#6a8ea8', /* soft blue */
		'#5a9a8a', /* teal */
		'#9a8268', /* warm taupe */
		'#8870a0', /* dusty lavender */
		'#b07860', /* soft terracotta */
		'#9a8a58', /* muted gold */
		'#6080a0', /* slate blue */
		'#a88878', /* dusty peach */
		'#5a9a78'  /* soft mint */
	] as const;

	let toast = $state<{ message: string } | null>(null);
	let editModalOpen = $state(false);
	let deleteModalOpen = $state(false);
	let avatarUploading = $state(false);
	let travelStyleEditOpen = $state(false);
	let travelStyleFormEl = $state<HTMLFormElement | null>(null);
	let travelStyleDraft = $state('');
	let editForm = $state({
		displayName: data.user?.name ?? '',
		avatarUrl: data.user?.avatarUrl ?? '',
		chatBubbleColor: data.user?.chatBubbleColor ?? CHAT_BUBBLE_COLORS[0],
		travelStyle: profile.travelStyle ?? '',
		homeCity: profile.homeCity ?? '',
		timezone: profile.timezone ?? ''
	});

	const displayName = $derived(data.user?.name || 'Traveler');
	const stats = $derived(data.stats ?? {
		tripsHosted: 0,
		tripsJoined: 0,
		upcomingTrips: 0,
		pendingInvites: 0,
		pendingRsvps: 0,
		unreadNotifications: 0
	});

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2
			? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
			: name.slice(0, 2).toUpperCase();
	}

	function showToast(msg: string) {
		toast = { message: msg };
		setTimeout(() => (toast = null), 3000);
	}

	function copyShareLink() {
		const url = typeof window !== 'undefined' ? `${window.location.origin}/profile/${data.user?.id ?? 'me'}` : '';
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(url).then(() => showToast('Profile link copied!'));
		} else showToast('Link: ' + url);
	}

	function openEditModal() {
		editForm = {
			displayName: data.user?.name ?? '',
			avatarUrl: data.user?.avatarUrl ?? profile.avatarUrl ?? '',
			chatBubbleColor: data.user?.chatBubbleColor ?? CHAT_BUBBLE_COLORS[0],
			travelStyle: profile.travelStyle ?? '',
			homeCity: profile.homeCity ?? '',
			timezone: profile.timezone ?? ''
		};
		editModalOpen = true;
	}

	async function onAvatarFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		avatarUploading = true;
		try {
			const fd = new FormData();
			fd.set('file', file);
			const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
			const json = await res.json();
			if (!res.ok || json.error) {
				showToast(json.error ?? 'Upload failed');
				return;
			}
			const origin = typeof window !== 'undefined' ? window.location.origin : '';
			editForm.avatarUrl = json.url ? `${origin}${json.url}` : editForm.avatarUrl;
			showToast('Photo uploaded. Save profile to keep it.');
		} finally {
			avatarUploading = false;
			input.value = '';
		}
	}

	function saveEdit() {
		profile = {
			...profile,
			avatarUrl: editForm.avatarUrl?.trim() || null,
			travelStyle: editForm.travelStyle?.trim() || null,
			homeCity: editForm.homeCity?.trim() || null,
			timezone: editForm.timezone?.trim() || null
		};
		editModalOpen = false;
		showToast('Profile updated!');
	}

	function signOutAll() {
		deleteModalOpen = false;
		goto('/logout');
	}

	const isOwnProfile = $derived(true);
</script>

<svelte:head>
	<title>Profile – Divvi</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<MarketingShell user={data?.user}>
	<div class="profile-page">
		<div class="profile-card" role="article" aria-labelledby="profile-name">
			<!-- Cover strip -->
			<div class="profile-cover"></div>

			<div class="profile-card-body">
				<!-- Avatar -->
				<div class="profile-avatar-wrap">
					{#if profile.avatarUrl}
						<img src={profile.avatarUrl} alt="" class="profile-avatar-img" />
					{:else}
						<span class="profile-avatar-initials">{initials(data.user?.name)}</span>
					{/if}
				</div>

				<!-- Display name -->
				<h1 id="profile-name" class="profile-display-name">{displayName}</h1>

				<!-- Trip archetype (travel style) with edit pencil when own -->
				<div class="profile-archetype-row">
					{#if travelStyleEditOpen}
						<form
							class="profile-archetype-form"
							method="POST"
							action="?/updateTravelStyle"
							bind:this={travelStyleFormEl}
							use:enhance={() => {
								return ({ result }) => {
									if (result.type === 'success' && result.data?.updateTravelStyleSuccess) {
										profile = { ...profile, travelStyle: travelStyleDraft?.trim() || null };
										travelStyleEditOpen = false;
										showToast('Travel style updated');
									}
								};
							}}
						>
							<select
								name="travelStyle"
								class="profile-archetype-select"
								value={travelStyleDraft}
								onchange={(e) => { travelStyleDraft = (e.currentTarget as HTMLSelectElement).value; travelStyleFormEl?.requestSubmit(); }}
							>
								<option value="">—</option>
								{#each TRAVEL_STYLE_OPTIONS as opt}
									<option value={opt}>{opt}</option>
								{/each}
							</select>
						</form>
					{:else}
						<span class="profile-archetype-pill">{profile.travelStyle || 'No travel style set'}</span>
						{#if isOwnProfile}
							<button
								type="button"
								class="profile-edit-pencil"
								aria-label="Edit travel style"
								onclick={() => { travelStyleDraft = profile.travelStyle ?? ''; travelStyleEditOpen = true; }}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
							</button>
						{/if}
					{/if}
				</div>

				<!-- Home city / time zone (optional) -->
				{#if profile.homeCity || profile.timezone}
					<p class="profile-location">
						{#if profile.homeCity}{profile.homeCity}{/if}
						{#if profile.homeCity && profile.timezone} · {/if}
						{#if profile.timezone}{profile.timezone}{/if}
					</p>
				{/if}

				<!-- Actions: own = Edit + Account settings; other = Add Friend, Report, Block -->
				<div class="profile-actions">
					{#if isOwnProfile}
						<button type="button" class="btn btn-primary" onclick={openEditModal}>Edit profile</button>
						<a href="/settings" class="btn btn-secondary">Account settings</a>
					{:else}
						<button type="button" class="btn btn-primary">Add Friend</button>
						<button type="button" class="btn btn-ghost">Report</button>
						<a href="/settings?tab=blocked" class="btn btn-ghost">Block</a>
					{/if}
				</div>

				<!-- Host/guest history: stats only -->
				<div class="profile-stats">
					<div class="profile-stat">
						<span class="profile-stat-value">{stats.tripsHosted}</span>
						<span class="profile-stat-label">Trips hosted</span>
					</div>
					<div class="profile-stat">
						<span class="profile-stat-value">{stats.tripsJoined}</span>
						<span class="profile-stat-label">Trips joined</span>
					</div>
					{#if !isOwnProfile}
						<div class="profile-stat">
							<span class="profile-stat-value">0</span>
							<span class="profile-stat-label">Trips together</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</MarketingShell>

<!-- Edit profile modal -->
{#if editModalOpen}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
		<div class="modal">
			<h2 id="edit-modal-title" class="modal-title">Edit profile</h2>
			<form method="POST" action="?/updateProfile" use:enhance={() => {
				return ({ result }) => {
					if (result.type === 'success' && result.data?.updateProfileSuccess) {
						profile = {
							...profile,
							avatarUrl: editForm.avatarUrl?.trim() || null,
							travelStyle: editForm.travelStyle?.trim() || null,
							homeCity: editForm.homeCity?.trim() || null,
							timezone: editForm.timezone?.trim() || null
						};
						editModalOpen = false;
						showToast('Profile updated!');
					}
					if (result.type === 'failure' && result.data?.updateProfileError) {
						showToast(result.data.updateProfileError as string);
					}
				};
			}}>
				<div class="form-group">
					<label for="edit-name">Display name</label>
					<input id="edit-name" type="text" name="name" bind:value={editForm.displayName} />
				</div>
				<div class="form-group">
					<label for="edit-avatar">Avatar image</label>
					<input id="edit-avatar" type="url" name="avatarUrl" bind:value={editForm.avatarUrl} placeholder="https://… or upload below" />
					<div class="avatar-upload-row">
						<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="avatar-file-input" onchange={onAvatarFileChange} />
						<button type="button" class="btn btn-secondary avatar-upload-btn" onclick={() => (document.querySelector('.avatar-file-input') as HTMLInputElement)?.click()} disabled={avatarUploading}>
							{avatarUploading ? 'Uploading…' : 'Upload from computer'}
						</button>
					</div>
					<small class="field-hint">Paste a link or upload a photo (JPEG, PNG, WebP, GIF; max 10MB).</small>
				</div>
				<div class="form-group">
					<label>Chat bubble color</label>
					<div class="color-picker-row">
						<input type="hidden" name="chatBubbleColor" value={editForm.chatBubbleColor} />
						{#each CHAT_BUBBLE_COLORS as color}
							<button
								type="button"
								class="color-swatch"
								class:selected={editForm.chatBubbleColor.toLowerCase() === color}
								style="background-color: {color}"
								title={color}
								aria-label="Select color {color}"
								onclick={() => (editForm.chatBubbleColor = color)}
							></button>
						{/each}
					</div>
					<small class="field-hint">Used as your message color in trip group chats.</small>
				</div>
				<div class="form-group">
					<label for="edit-travel-style">Travel style</label>
					<select id="edit-travel-style" name="travelStyle" bind:value={editForm.travelStyle}>
						<option value="">—</option>
						{#each TRAVEL_STYLE_OPTIONS as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				</div>
				<div class="form-group">
					<label for="edit-home-city">Home city (optional)</label>
					<input id="edit-home-city" type="text" name="homeCity" bind:value={editForm.homeCity} placeholder="e.g. Seattle, WA" />
				</div>
				<div class="form-group">
					<label for="edit-timezone">Time zone (optional)</label>
					<input id="edit-timezone" type="text" name="timezone" bind:value={editForm.timezone} placeholder="e.g. America/Los_Angeles" />
				</div>
				<p class="modal-hint">Dietary, allergies, and accessibility are in <a href="/settings">Account settings → Basics</a>.</p>
				<div class="modal-actions">
					<button type="button" class="btn btn-ghost" onclick={() => (editModalOpen = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary">Save</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete account modal -->
{#if deleteModalOpen}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
		<div class="modal">
			<h2 id="delete-modal-title" class="modal-title">Delete account?</h2>
			<p class="modal-text">This will permanently delete your account and all data. This cannot be undone.</p>
			<div class="modal-actions">
				<button type="button" class="btn btn-ghost" onclick={() => (deleteModalOpen = false)}>Cancel</button>
				<button type="button" class="btn btn-destructive" onclick={signOutAll}>Delete account</button>
			</div>
		</div>
	</div>
{/if}

{#if toast}
	<div class="toast" role="status">{toast.message}</div>
{/if}

<style>
	/* Minimal public profile card – Divvi */
	.profile-page {
		font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
		min-height: calc(100vh - 80px);
		width: 100%;
		max-width: 100vw;
		box-sizing: border-box;
		padding: 2rem 1.5rem;
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}
	.profile-card {
		width: 100%;
		max-width: 420px;
		background: var(--surfaceSolid, #fff);
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 27, 46, 0.08);
		border: 1px solid var(--border, #e2e8f0);
		overflow: hidden;
	}
	.profile-cover {
		height: 72px;
		background: linear-gradient(135deg, var(--navy, #001b2e) 0%, var(--slate, #294c60) 100%);
	}
	.profile-card-body {
		text-align: center;
		padding: 0 1.5rem 1.5rem;
		position: relative;
	}
	.profile-avatar-wrap {
		width: 96px;
		height: 96px;
		margin: -48px auto 1rem;
		border-radius: 50%;
		background: var(--bg, #f8fafc);
		border: 3px solid var(--surfaceSolid, #fff);
		box-shadow: 0 2px 12px rgba(0, 27, 46, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.profile-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.profile-avatar-initials {
		font-size: 2rem;
		font-weight: 600;
		color: var(--copper, #bf4e30);
		letter-spacing: -0.02em;
	}
	.profile-display-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--navy, #001b2e);
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}
	.profile-archetype-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}
	.profile-archetype-pill {
		display: inline-block;
		font-size: 0.8125rem;
		background: rgba(191, 78, 48, 0.1);
		color: var(--copper, #bf4e30);
		padding: 0.25rem 0.625rem;
		border-radius: 999px;
		font-weight: 500;
	}
	.profile-edit-pencil {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		border: none;
		background: transparent;
		color: var(--muted, #94a3b8);
		cursor: pointer;
		border-radius: 6px;
		transition: color 0.2s, background 0.2s;
	}
	.profile-edit-pencil:hover {
		color: var(--copper, #bf4e30);
		background: rgba(191, 78, 48, 0.08);
	}
	.profile-archetype-form {
		display: inline-block;
	}
	.profile-archetype-select {
		font-size: 0.8125rem;
		padding: 0.35rem 0.625rem;
		border-radius: 999px;
		border: 1px solid var(--border, #e2e8f0);
		background: var(--bg, #f8fafc);
		color: var(--text, #0f172a);
		min-width: 12rem;
	}
	.profile-location {
		font-size: 0.875rem;
		color: var(--muted, #64748b);
		margin: 0 0 1rem 0;
	}
	.profile-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}
	.profile-actions .btn {
		font-size: 0.875rem;
		padding: 0.5rem 1rem;
		text-decoration: none;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
		border: none;
	}
	.profile-actions .btn-primary {
		background: var(--copper);
		color: white;
	}
	.profile-actions .btn-primary:hover {
		background: var(--primaryHover);
	}
	.profile-actions .btn-secondary {
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border);
	}
	.profile-actions .btn-secondary:hover {
		background: var(--border-soft);
		border-color: var(--border-strong);
	}
	.profile-actions .btn-ghost {
		background: transparent;
		color: var(--muted);
	}
	.profile-actions .btn-ghost:hover {
		background: var(--border-soft);
		color: var(--text);
	}
	.profile-stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border, #e2e8f0);
	}
	.profile-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}
	.profile-stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--navy, #001b2e);
	}
	.profile-stat-label {
		font-size: 0.75rem;
		color: var(--muted, #64748b);
		font-weight: 500;
	}

	/* Legacy / modal (below) */
	.profile-center {
		min-width: 0;
	}
	.profile-hero-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.profile-display-name {
		font-size: clamp(1.5rem, 4vw, 2rem);
		font-weight: 700;
		color: var(--navy);
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.03em;
		line-height: 1.2;
	}
	.profile-hero-left .badges-row {
		justify-content: flex-start;
		margin-bottom: 0;
	}
	.btn-add {
		background: var(--copper);
		color: white;
		border: none;
		padding: 0.5rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 600;
		border-radius: var(--radius-lg);
		white-space: nowrap;
	}
	.btn-add:hover {
		background: var(--primaryHover);
	}
	.profile-about-block {
		background: var(--bg);
		border-radius: var(--radius-lg);
		padding: 1rem 1.25rem;
		margin-bottom: 1.25rem;
		border: 1px solid var(--border);
	}
	.profile-about-text {
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--text);
		margin: 0;
	}

	.card {
		background: var(--surfaceSolid);
		border-radius: var(--radius-xl);
		box-shadow: 0 2px 8px rgba(0, 27, 46, 0.06);
		border: 1px solid var(--border);
		overflow: hidden;
		min-width: 0;
	}
	.card-body {
		padding: clamp(1rem, 3vw, 1.25rem) clamp(1rem, 4vw, 1.5rem);
	}
	.card-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--navy);
		margin: 0 0 0.75rem 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		letter-spacing: -0.01em;
	}
	.card-title-tint {
		background: var(--bg);
		padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 3vw, 1.25rem);
		margin: -1px -1px 0 -1px;
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		border-bottom: 1px solid var(--border);
	}
	.icon-sm {
		font-size: 1.125rem;
		opacity: 0.85;
	}
	.badges-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--muted);
		letter-spacing: 0.02em;
	}
	.pill-role {
		background: rgba(191, 78, 48, 0.15);
		color: var(--copper);
	}
	.pill-verified {
		background: rgba(41, 76, 96, 0.12);
		color: var(--slate);
	}
	.pill-tag {
		background: rgba(191, 78, 48, 0.12);
		color: var(--copper);
	}
	.pill-select {
		border: none;
		cursor: pointer;
		font-family: inherit;
	}
	.pill-select.active {
		background: var(--copper);
		color: white;
	}
	.pill.connected {
		background: rgba(41, 76, 96, 0.12);
		color: var(--slate);
	}

	.profile-right {
		min-width: 0;
	}
	@media (min-width: 900px) {
		.profile-right {
			position: sticky;
			top: 6rem;
		}
	}
	.card-stats .card-title {
		margin-bottom: 0.5rem;
		padding: 0 0.25rem;
		color: var(--navy);
	}
	.stats-grid {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.stat-tile {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0;
		background: transparent;
		border: none;
		border-radius: 0;
		border-bottom: 1px solid var(--border);
		text-decoration: none;
		color: var(--text);
		transition: background 0.15s ease;
		min-width: 0;
	}
	.stat-tile:last-child {
		border-bottom: none;
	}
	.stat-tile:hover {
		background: var(--border-soft);
	}
	.stat-tile .stat-icon {
		font-size: 1.125rem;
		opacity: 0.85;
		flex-shrink: 0;
	}
	.stat-tile .stat-label {
		flex: 1;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted);
		text-transform: none;
		letter-spacing: 0;
	}
	.stat-tile .stat-value {
		font-size: 1rem;
		font-weight: 600;
		color: var(--navy);
		flex-shrink: 0;
	}
	.section-card {
		margin-bottom: 1rem;
	}
	.section-card .card-body {
		padding: clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.25rem);
	}
	.field-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		margin-bottom: 0.75rem;
	}
	.field-row:last-child {
		margin-bottom: 0;
	}
	.field-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted);
		min-width: 0;
		flex: 1 1 100%;
	}
	@media (min-width: 480px) {
		.field-label {
			flex: 0 0 auto;
			min-width: 7.5rem;
		}
	}
	.field-value {
		font-size: 0.875rem;
		color: var(--text);
		flex: 1;
		min-width: 0;
		overflow-wrap: break-word;
		word-break: break-word;
	}
	.switch-row .field-label {
		flex: 1;
	}
	.toggle {
		width: 44px;
		min-width: 44px;
		height: 24px;
		min-height: 24px;
		border-radius: 9999px;
		background: var(--border);
		border: 1px solid var(--border-strong);
		cursor: pointer;
		padding: 2px;
		flex-shrink: 0;
		transition: background 0.15s ease, border-color 0.15s ease;
		touch-action: manipulation;
	}
	.toggle.on {
		background: var(--copper);
		border-color: var(--copper);
	}
	.toggle-thumb {
		display: block;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		transition: transform 0.15s ease;
	}
	.toggle.on .toggle-thumb {
		transform: translateX(20px);
	}
	.radio-group, .pills-select, .pills-row, .tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.segmented {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}
	.seg {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		background: var(--bg);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		cursor: pointer;
		color: var(--muted);
		transition: all 0.15s ease;
	}
	.seg:hover {
		color: var(--text);
		background: var(--border-soft);
	}
	.seg.active {
		background: var(--copper);
		color: white;
		border-color: var(--copper);
	}
	.select {
		padding: 0.35rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surfaceSolid);
		color: var(--text);
		min-width: 0;
		max-width: 100%;
		width: 100%;
	}
	@media (min-width: 480px) {
		.select {
			width: auto;
			min-width: 10rem;
		}
	}
	.check-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.check-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.button-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.btn-sm {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}
	.card-divider {
		border: none;
		height: 1px;
		background: var(--border);
		margin: 1rem 0;
	}
	.sessions-list {
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}
	.session-item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
		font-size: 0.875rem;
	}
	.session-item:last-child {
		border-bottom: none;
	}
	.sub-tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
	}
	.sub-tab {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: var(--bg);
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		color: var(--muted);
	}
	.sub-tab.active {
		background: transparent;
		color: var(--copper);
		border: 1px solid var(--copper);
	}
	.empty-state {
		text-align: center;
		padding: 2rem 1rem;
	}
	.empty-state.small {
		padding: 1rem;
	}
	.empty-icon {
		font-size: 2rem;
		display: block;
		margin-bottom: 0.5rem;
		opacity: 0.6;
	}
	.empty-state p {
		margin: 0 0 0.25rem 0;
	}
	.empty-state .btn {
		margin-top: 1rem;
	}
	.timeline {
		margin-bottom: 1rem;
	}
	.timeline-year {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0.75rem 0 0.25rem 0;
	}
	.timeline-year:first-child {
		margin-top: 0;
	}
	.timeline-item {
		margin-bottom: 0.5rem;
	}
	.timeline-content {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.timeline-content strong {
		flex-shrink: 0;
	}
	.muted {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 27, 46, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: clamp(0.5rem, 5vw, 1rem);
		overflow-y: auto;
		box-sizing: border-box;
	}
	.modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-xl);
		box-shadow: 0 20px 25px -5px rgba(0, 27, 46, 0.1), 0 8px 10px -6px rgba(0, 27, 46, 0.08);
		border: 1px solid var(--border);
		max-width: min(440px, calc(100vw - 2rem));
		width: 100%;
		padding: clamp(1rem, 4vw, 1.5rem);
		max-height: min(90vh, calc(100dvh - 2rem));
		overflow-y: auto;
		margin: auto;
		flex-shrink: 0;
		box-sizing: border-box;
	}
	.modal-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--navy);
		margin: 0 0 1rem 0;
		letter-spacing: -0.02em;
	}
	.modal-text {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
	}
	.form-group {
		margin-bottom: 1rem;
	}
	.form-group label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted);
		margin-bottom: 0.25rem;
	}
	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surfaceSolid);
		color: var(--text);
	}
	.field-hint {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--muted);
	}
	.avatar-upload-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.avatar-file-input {
		position: absolute;
		width: 0.1px;
		height: 0.1px;
		opacity: 0;
		overflow: hidden;
		z-index: -1;
	}
	.avatar-upload-btn {
		flex-shrink: 0;
	}
	.color-picker-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.color-swatch {
		width: 1.75rem;
		height: 1.75rem;
		border: 2px solid transparent;
		border-radius: 50%;
		cursor: pointer;
		padding: 0;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.color-swatch:hover {
		transform: scale(1.1);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	.color-swatch.selected {
		border-color: var(--text);
		box-shadow: 0 0 0 1px var(--bg);
	}
	.color-hex {
		font-size: 0.875rem;
		font-family: ui-monospace, monospace;
		color: var(--muted);
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--copper);
		box-shadow: 0 0 0 2px var(--focusRing);
	}
	.modal-hint {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
	}
	.modal-hint a {
		color: var(--copper);
		text-decoration: underline;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}

	.profile-page .btn-primary {
		background: var(--copper);
		color: white;
		border: none;
	}
	.profile-page .btn-primary:hover {
		background: var(--primaryHover);
	}
	.profile-page .btn-ghost {
		background: transparent;
		color: var(--muted);
		border: none;
	}
	.profile-page .btn-ghost:hover {
		background: var(--border-soft);
		color: var(--text);
	}
	.profile-page .btn-secondary {
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border);
	}
	.profile-page .btn-secondary:hover {
		background: var(--border-soft);
		border-color: var(--border-strong);
	}
	.profile-page .btn-destructive {
		background: var(--danger);
		color: white;
		border: none;
	}
	.profile-page .btn-destructive:hover {
		background: var(--dangerHover);
	}
	.toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--navy);
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.15);
		z-index: 101;
		animation: toastIn 0.2s ease;
	}
	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
