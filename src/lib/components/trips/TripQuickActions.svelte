<script lang="ts">
	import { onDestroy } from 'svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';

	let {
		tripId,
		onInvite,
		showToast,
		isHost = false,
		canHostShare = false,
		householdShare = null
	}: {
		tripId: string;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
		/** @deprecated use canHostShare from layout; kept for My RSVP / Edit */
		isHost?: boolean;
		canHostShare?: boolean;
		householdShare?: {
			householdId: string;
			hasUnclaimedProxyMembers: boolean;
			unclaimedFirstNames: string[];
			primaryFirstName: string;
		} | null;
	} = $props();

	let editOpen = $state(false);

	let editTriggerEl: HTMLButtonElement | null = $state(null);

	let editMenuEl: HTMLDivElement | null = $state(null);

	let editMenuStyle = $state<{ top: string; left: string } | null>(null);

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
		if (editOpen && editTriggerEl && !editTriggerEl.contains(target) && editMenuEl && !editMenuEl.contains(target)) {
			editOpen = false;
			editMenuStyle = null;
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
		if (editOpen) {
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

	function handleDelete() {
		showToast?.('Delete requires confirmation, coming soon');
		editOpen = false;
	}

	function closeAll() {
		editOpen = false;
		editMenuStyle = null;
	}

	function openEdit() {
		clearCloseSchedule();
		editOpen = true;
		positionMenu(editTriggerEl, (s) => (editMenuStyle = s));
	}

	function onEditClick() {
		if (!editOpen) openEdit();
	}
</script>

<div class="quick-actions">
	<ShareButton
		{tripId}
		{canHostShare}
		{householdShare}
		onInvite={onInvite ?? (() => {})}
		showToast={showToast ?? (() => {})}
	/>

	<!-- My RSVP: for hosts/co-hosts to set their own RSVP, party size, room, etc. -->
	{#if isHost}
		<a
			href="/trips/{tripId}/rsvp"
			class="action-btn"
			title="My RSVP"
		>
			<span class="action-content" aria-hidden="true">
				<span class="action-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
				</span>
				<span class="action-label">My RSVP</span>
			</span>
		</a>
	{/if}

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
				<a
					href="/trips/{tripId}/settings"
					class="dropdown-item"
					data-sveltekit-preload-data="hover"
					onclick={closeAll}
				>
					Edit trip
				</a>
				<button type="button" class="dropdown-item danger" onclick={handleDelete}>Delete trip</button>
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
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	a.action-btn {
		text-decoration: none;
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
		font-size: inherit;
		font-weight: inherit;
		font-family: inherit;
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
		text-decoration: none;
		box-sizing: border-box;
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
</style>
