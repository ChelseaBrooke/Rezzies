<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';

	/** Move this element to document.body so it's never clipped by overflow/transform. */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	let {
		tripId,
		inviteCode,
		onInvite,
		showToast,
		tripInfoContent = '',
		isHost = false
	}: {
		tripId: string;
		inviteCode?: string;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
		tripInfoContent?: string;
		isHost?: boolean;
	} = $props();

	let shareOpen = $state(false);
	let editOpen = $state(false);
	let infoOpen = $state(false);

	let shareTriggerEl: HTMLButtonElement | null = $state(null);
	let editTriggerEl: HTMLButtonElement | null = $state(null);
	let infoTriggerEl: HTMLButtonElement | null = $state(null);

	let shareMenuEl: HTMLDivElement | null = $state(null);
	let editMenuEl: HTMLDivElement | null = $state(null);
	let infoMenuEl: HTMLDivElement | null = $state(null);

	let shareMenuStyle = $state<{ top: string; left: string } | null>(null);
	let editMenuStyle = $state<{ top: string; left: string } | null>(null);
	let infoMenuStyle = $state<{ top: string; left: string } | null>(null);

	const CLOSE_DELAY_MS = 250;
	let closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

	function clearCloseSchedule() {
		if (closeTimeoutId != null) {
			clearTimeout(closeTimeoutId);
			closeTimeoutId = null;
		}
	}

	function scheduleClose() {
		clearCloseSchedule();
		closeTimeoutId = setTimeout(() => {
			closeAll();
			closeTimeoutId = null;
		}, CLOSE_DELAY_MS);
	}

	function handleDocumentClick(e: MouseEvent) {
		const target = e.target as Node;
		if (shareOpen && shareTriggerEl && !shareTriggerEl.contains(target) && shareMenuEl && !shareMenuEl.contains(target)) {
			shareOpen = false;
			shareMenuStyle = null;
		}
		if (editOpen && editTriggerEl && !editTriggerEl.contains(target) && editMenuEl && !editMenuEl.contains(target)) {
			editOpen = false;
			editMenuStyle = null;
		}
		if (infoOpen && infoTriggerEl && !infoTriggerEl.contains(target) && infoMenuEl && !infoMenuEl.contains(target)) {
			infoOpen = false;
			infoMenuStyle = null;
		}
	}

	let documentClickBound = false;
	function bindDocumentClick() {
		if (documentClickBound) return;
		documentClickBound = true;
		document.addEventListener('click', handleDocumentClick, true);
	}
	function unbindDocumentClick() {
		if (!documentClickBound) return;
		documentClickBound = false;
		document.removeEventListener('click', handleDocumentClick, true);
	}

	$effect(() => {
		if (shareOpen || editOpen || infoOpen) {
			bindDocumentClick();
		} else {
			unbindDocumentClick();
		}
	});

	onDestroy(unbindDocumentClick);

	function positionMenu(
		triggerEl: HTMLButtonElement | null,
		setStyle: (s: { top: string; left: string } | null) => void
	) {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		/* No gap so cursor never hits dead zone between trigger and menu */
		setStyle({
			top: `${rect.bottom}px`,
			left: `${rect.left}px`
		});
	}

	function getTripLink(): string {
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		return inviteCode ? `${origin}/trip/${inviteCode}` : `${origin}/trips/${tripId}`;
	}

	function handleCopyLink() {
		const link = getTripLink();
		if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(link).then(() => {
				showToast?.('Link copied to clipboard');
			});
		} else {
			showToast?.('Copy link: ' + link);
		}
		shareOpen = false;
	}

	function handleEmailLink() {
		const link = getTripLink();
		const subject = encodeURIComponent('Trip invite');
		const body = encodeURIComponent(`You're invited to view this trip:\n\n${link}`);
		window.location.href = `mailto:?subject=${subject}&body=${body}`;
		shareOpen = false;
	}

	function handleEdit() {
		goto(`/trips/${tripId}/settings`);
		editOpen = false;
	}

	function handleDelete() {
		showToast?.('Delete requires confirmation — coming soon');
		editOpen = false;
	}

	function closeAll() {
		shareOpen = false;
		editOpen = false;
		infoOpen = false;
		shareMenuStyle = null;
		editMenuStyle = null;
		infoMenuStyle = null;
	}

	function openShare() {
		clearCloseSchedule();
		editOpen = false;
		infoOpen = false;
		shareOpen = true;
		positionMenu(shareTriggerEl, (s) => (shareMenuStyle = s));
	}

	function openEdit() {
		clearCloseSchedule();
		shareOpen = false;
		infoOpen = false;
		editOpen = true;
		positionMenu(editTriggerEl, (s) => (editMenuStyle = s));
	}

	function openInfo() {
		clearCloseSchedule();
		shareOpen = false;
		editOpen = false;
		infoOpen = true;
		positionMenu(infoTriggerEl, (s) => (infoMenuStyle = s));
	}

	/** Hover opens share menu; click toggles. */
	function onShareMouseEnter() {
		clearCloseSchedule();
		openShare();
		requestAnimationFrame(() => {
			positionMenu(shareTriggerEl, (s) => (shareMenuStyle = s));
		});
	}

	function onShareClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (shareOpen) {
			shareOpen = false;
			shareMenuStyle = null;
			return;
		}
		openShare();
		requestAnimationFrame(() => {
			positionMenu(shareTriggerEl, (s) => (shareMenuStyle = s));
		});
	}

	function onEditClick() {
		if (!editOpen) openEdit();
	}

	function onInfoClick() {
		if (!infoOpen) openInfo();
	}
</script>

<div class="quick-actions">
	<!-- Share: single button is the only hit target; one child span so no internal boundaries -->
	<div class="dropdown-wrap">
		<button
			type="button"
			class="action-btn"
			title="Share trip"
			bind:this={shareTriggerEl}
			onmouseenter={onShareMouseEnter}
			onmouseleave={scheduleClose}
			onclick={onShareClick}
			aria-expanded={shareOpen}
			aria-haspopup="menu"
		>
			<span class="action-content" aria-hidden="true">
				<span class="action-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
				</span>
				<span class="action-label">Share</span>
			</span>
		</button>
		{#if shareOpen}
			<!-- Portal menu to body so it's never clipped; click-outside handled by document listener -->
			<div
				use:portal
				class="share-menu-portal"
				role="presentation"
			>
				<div
					class="dropdown-backdrop dropdown-backdrop-modal"
					aria-hidden="true"
					onclick={() => { shareOpen = false; shareMenuStyle = null; }}
					role="button"
					tabindex="-1"
				></div>
				<div
					bind:this={shareMenuEl}
					class="dropdown-menu dropdown-menu-fixed dropdown-menu-portaled"
					role="menu"
					style={shareMenuStyle ? `top: ${shareMenuStyle.top}; left: ${shareMenuStyle.left};` : ''}
					onmouseenter={clearCloseSchedule}
					onmouseleave={scheduleClose}
				>
					{#if onInvite}
						<button type="button" class="dropdown-item" role="menuitem" onclick={() => { onInvite?.(); shareOpen = false; shareMenuStyle = null; }}>Invite guests</button>
					{/if}
					<button type="button" class="dropdown-item" role="menuitem" onclick={handleEmailLink}>Email link</button>
					<button type="button" class="dropdown-item" role="menuitem" onclick={handleCopyLink}>Copy link</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Edit: single button, one content span -->
	{#if isHost}
		<div class="dropdown-wrap">
			<button
				type="button"
				class="action-btn"
				title="Edit trip"
				bind:this={editTriggerEl}
				onmouseenter={openEdit}
				onmouseleave={scheduleClose}
				onclick={onEditClick}
				aria-expanded={editOpen}
			>
				<span class="action-content" aria-hidden="true">
					<span class="action-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
					</span>
					<span class="action-label">Edit trip</span>
				</span>
			</button>
			{#if editOpen}
				<div class="dropdown-backdrop" aria-hidden="true"></div>
				<div
					bind:this={editMenuEl}
					class="dropdown-menu dropdown-menu-fixed"
					style={editMenuStyle ? `top: ${editMenuStyle.top}; left: ${editMenuStyle.left};` : ''}
					onmouseenter={clearCloseSchedule}
					onmouseleave={scheduleClose}
				>
					<button type="button" class="dropdown-item" onclick={handleEdit}>Edit trip</button>
					<button type="button" class="dropdown-item danger" onclick={handleDelete}>Delete trip</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Info: single button, one content span -->
	{#if tripInfoContent}
		<div class="dropdown-wrap">
			<button
				type="button"
				class="action-btn"
				title="Trip info"
				bind:this={infoTriggerEl}
				onmouseenter={openInfo}
				onmouseleave={scheduleClose}
				onclick={onInfoClick}
				aria-expanded={infoOpen}
			>
				<span class="action-content" aria-hidden="true">
					<span class="action-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
					</span>
					<span class="action-label">Info</span>
				</span>
			</button>
			{#if infoOpen}
				<div class="dropdown-backdrop" aria-hidden="true"></div>
				<div
					bind:this={infoMenuEl}
					class="dropdown-menu dropdown-menu-fixed trip-info-overlay"
					style={infoMenuStyle ? `top: ${infoMenuStyle.top}; left: ${infoMenuStyle.left};` : ''}
					onmouseenter={clearCloseSchedule}
					onmouseleave={scheduleClose}
				>
					<div class="trip-info-body">{tripInfoContent}</div>
					<div class="trip-info-actions">
						<a href="/trips/{tripId}/itinerary" class="trip-info-link">View all notes</a>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.quick-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}
	.quick-actions * {
		cursor: pointer;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.25rem;
		padding: 0.375rem 0.75rem;
		border: none;
		background: transparent;
		border-radius: var(--radius-md, 0.5rem);
		cursor: pointer;
		color: var(--muted);
		transition: all 0.2s;
		position: relative;
		white-space: nowrap;
	}

	/* Single content child with pointer-events: none = button is the only hit target (no flicker) */
	.action-content {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		pointer-events: none;
	}

	.action-btn:hover {
		background: var(--border);
		color: var(--text);
	}

	.action-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	.action-icon :global(svg) {
		width: 1.125rem;
		height: 1.125rem;
	}

	.action-label {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.dropdown-wrap {
		position: relative;
		display: inline-flex;
		cursor: pointer;
	}

	.dropdown-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9998;
		pointer-events: none; /* don't block hover on trigger or menu */
	}

	.share-menu-portal {
		position: fixed;
		inset: 0;
		z-index: 10000;
		pointer-events: none;
	}
	/* Backdrop must not capture pointer or it covers the trigger and causes hover flicker */
	.share-menu-portal .dropdown-backdrop-modal {
		pointer-events: none;
	}
	.share-menu-portal .dropdown-menu-portaled {
		pointer-events: auto;
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 0.25rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 0.5rem);
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1));
		min-width: 10rem;
		z-index: 20;
		overflow: hidden;
	}

	.dropdown-menu-fixed {
		position: fixed;
		top: 0;
		left: 0;
		margin-top: 0;
		z-index: 9999;
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: none;
		text-align: left;
		font-size: 0.875rem;
		color: var(--text);
		cursor: pointer;
		font-family: inherit;
	}

	.dropdown-item:hover {
		background: rgba(191, 78, 48, 0.1);
	}

	.dropdown-item.danger {
		color: var(--danger);
	}

	.dropdown-item.danger:hover {
		background: rgba(191, 78, 48, 0.12);
	}

	.trip-info-overlay {
		min-width: 16rem;
		max-width: 22rem;
		padding: 0;
	}

	.trip-info-body {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.trip-info-actions {
		padding: 0.5rem 1rem;
		border-top: 1px solid var(--border);
	}

	.trip-info-link {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}

	.trip-info-link:hover {
		text-decoration: underline;
	}
</style>
