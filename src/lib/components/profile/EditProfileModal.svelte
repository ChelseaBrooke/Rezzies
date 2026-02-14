<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { editProfileModalOpen, closeEditProfileModal, requestProfileCardRefresh } from '$lib/stores/profileOverlay.js';
	import { TRAVEL_STYLE_OPTIONS } from '$lib/travel-style.js';

	const CHAT_BUBBLE_COLORS = [
		'#7a9a78', '#6a8ea8', '#5a9a8a', '#9a8268', '#8870a0', '#b07860', '#9a8a58', '#6080a0', '#a88878', '#5a9a78'
	] as const;

	let form = $state({
		displayName: '',
		avatarUrl: '',
		chatBubbleColor: CHAT_BUBBLE_COLORS[0],
		travelStyle: '',
		homeCity: '',
		timezone: ''
	});
	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let avatarUploading = $state(false);
	let modalEl: HTMLDivElement;
	let focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

	async function loadUser() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/api/users/me');
			if (!res.ok) {
				error = 'Could not load profile';
				return;
			}
			const data = await res.json();
			form = {
				displayName: data.name ?? '',
				avatarUrl: data.avatarUrl ?? '',
				chatBubbleColor: data.chatBubbleColor ?? CHAT_BUBBLE_COLORS[0],
				travelStyle: data.travelStyle ?? '',
				homeCity: data.homeCity ?? '',
				timezone: data.timezone ?? ''
			};
		} finally {
			loading = false;
		}
	}

	async function save() {
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/users/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: form.displayName?.trim() || null,
					avatarUrl: form.avatarUrl?.trim() || null,
					chatBubbleColor: form.chatBubbleColor || null,
					travelStyle: form.travelStyle?.trim() || null,
					homeCity: form.homeCity?.trim() || null,
					timezone: form.timezone?.trim() || null
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				error = data.error || 'Failed to save';
				return;
			}
			requestProfileCardRefresh();
			closeEditProfileModal();
		} finally {
			saving = false;
		}
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
				error = json.error ?? 'Upload failed';
				return;
			}
			const origin = typeof window !== 'undefined' ? window.location.origin : '';
			form.avatarUrl = json.url ? `${origin}${json.url}` : form.avatarUrl;
		} finally {
			avatarUploading = false;
			input.value = '';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeEditProfileModal();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === modalEl) closeEditProfileModal();
	}

	function trapFocus() {
		if (!modalEl) return;
		const focusable = modalEl.querySelectorAll<HTMLElement>(focusableSelector);
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
		modalEl.addEventListener('keydown', handleKey);
		first?.focus();
		return () => modalEl.removeEventListener('keydown', handleKey);
	}

	$effect(() => {
		if ($editProfileModalOpen) {
			loadUser();
		}
	});

	$effect(() => {
		if (!$editProfileModalOpen || !modalEl || loading) return;
		let trapCleanup: (() => void) | undefined;
		const t = setTimeout(() => {
			trapCleanup = trapFocus();
		}, 50);
		return () => {
			clearTimeout(t);
			trapCleanup?.();
		};
	});

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if $editProfileModalOpen}
	<div
		class="edit-profile-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-profile-title"
		bind:this={modalEl}
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="edit-profile-modal" onclick={(e) => e.stopPropagation()}>
			<h2 id="edit-profile-title" class="edit-profile-title">Edit profile</h2>
			{#if loading}
				<p class="edit-profile-loading">Loading…</p>
			{:else}
				<form
					class="edit-profile-form"
					onsubmit={(e) => {
						e.preventDefault();
						save();
					}}
				>
					{#if error}
						<p class="edit-profile-error" role="alert">{error}</p>
					{/if}
					<div class="form-group">
						<label for="edit-name">Display name</label>
						<input id="edit-name" type="text" bind:value={form.displayName} />
					</div>
					<div class="form-group">
						<label for="edit-avatar">Avatar image</label>
						<input id="edit-avatar" type="url" bind:value={form.avatarUrl} placeholder="https://… or upload below" />
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
							{#each CHAT_BUBBLE_COLORS as color}
								<button
									type="button"
									class="color-swatch"
									class:selected={form.chatBubbleColor.toLowerCase() === color}
									style="background-color: {color}"
									title={color}
									aria-label="Select color {color}"
									onclick={() => (form.chatBubbleColor = color)}
								></button>
							{/each}
						</div>
						<small class="field-hint">Used as your message color in trip group chats.</small>
					</div>
					<div class="form-group">
						<label for="edit-travel-style">Travel style</label>
						<select id="edit-travel-style" bind:value={form.travelStyle}>
							<option value="">—</option>
							{#each TRAVEL_STYLE_OPTIONS as opt}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="edit-home-city">Home city (optional)</label>
						<input id="edit-home-city" type="text" bind:value={form.homeCity} placeholder="e.g. Seattle, WA" />
					</div>
					<div class="form-group">
						<label for="edit-timezone">Time zone (optional)</label>
						<input id="edit-timezone" type="text" bind:value={form.timezone} placeholder="e.g. America/Los_Angeles" />
					</div>
					<p class="modal-hint">Dietary, allergies, and accessibility are in <a href="/settings">Account settings → Basics</a>.</p>
					<div class="modal-actions">
						<button type="button" class="btn btn-ghost" onclick={closeEditProfileModal}>Cancel</button>
						<button type="submit" class="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.edit-profile-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 27, 46, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 99998;
		padding: 1rem;
		box-sizing: border-box;
		overflow-y: auto;
	}
	.edit-profile-modal {
		background: var(--surfaceSolid, #fff);
		border-radius: var(--radius-xl, 12px);
		box-shadow: 0 20px 25px -5px rgba(0, 27, 46, 0.1);
		border: 1px solid var(--border, #e2e8f0);
		max-width: min(440px, calc(100vw - 2rem));
		width: 100%;
		padding: clamp(1rem, 4vw, 1.5rem);
		max-height: min(90vh, calc(100dvh - 2rem));
		overflow-y: auto;
		margin: auto;
		box-sizing: border-box;
	}
	.edit-profile-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--navy, #001b2e);
		margin: 0 0 1rem 0;
	}
	.edit-profile-form .form-group {
		margin-bottom: 1rem;
	}
	.edit-profile-form .form-group label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted, #64748b);
		margin-bottom: 0.25rem;
	}
	.edit-profile-form .form-group input,
	.edit-profile-form .form-group select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 8px);
		background: var(--surfaceSolid);
		color: var(--text, #0f172a);
	}
	.edit-profile-form .form-group input:focus,
	.edit-profile-form .form-group select:focus {
		outline: none;
		border-color: var(--copper, #bf4e30);
		box-shadow: 0 0 0 2px rgba(191, 78, 48, 0.2);
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
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.color-swatch:hover {
		transform: scale(1.1);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	.color-swatch.selected {
		border-color: var(--text);
		box-shadow: 0 0 0 1px var(--bg);
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
	.modal-actions .btn {
		font-size: 0.875rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-weight: 500;
	}
	.modal-actions .btn-primary {
		background: var(--copper);
		color: white;
	}
	.modal-actions .btn-primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.modal-actions .btn-ghost {
		background: transparent;
		color: var(--muted);
	}
	.modal-actions .btn-ghost:hover {
		background: var(--border-soft);
		color: var(--text);
	}
	.modal-actions .btn-secondary {
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border);
	}
	.edit-profile-loading,
	.edit-profile-error {
		padding: 0.5rem 0;
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
	}
	.edit-profile-error {
		color: var(--danger, #b91c1c);
	}
</style>
