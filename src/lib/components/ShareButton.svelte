<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import HouseholdShareModal from '$lib/components/HouseholdShareModal.svelte';

	/** Move menu to body so it isn't clipped. */
	function portal(node: HTMLElement) {
		if (!browser || typeof document === 'undefined') {
			return { destroy() {} };
		}
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	let {
		tripId,
		canHostShare = false,
		householdShare = null,
		onInvite,
		showToast
	}: {
		tripId: string;
		canHostShare?: boolean;
		householdShare?: {
			householdId: string;
			hasUnclaimedProxyMembers: boolean;
			unclaimedFirstNames: string[];
			primaryFirstName: string;
		} | null;
		onInvite: () => void;
		showToast: (msg: string) => void;
	} = $props();

	let open = $state(false);
	let householdModalOpen = $state(false);
	let triggerEl: HTMLButtonElement | null = $state(null);
	let menuEl: HTMLDivElement | null = $state(null);
	let menuStyle = $state<{ top: string; left: string } | null>(null);

	const showShare = $derived(
		canHostShare || !!(householdShare?.hasUnclaimedProxyMembers && householdShare.unclaimedFirstNames.length)
	);

	function positionMenu() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		menuStyle = { top: `${rect.bottom + 4}px`, left: `${rect.left}px` };
	}

	function closeMenu() {
		open = false;
		menuStyle = null;
	}

	function onDocClick(e: MouseEvent) {
		const t = e.target as Node;
		if (open && triggerEl && !triggerEl.contains(t) && menuEl && !menuEl.contains(t)) {
			closeMenu();
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeMenu();
			householdModalOpen = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		if (open) {
			document.addEventListener('click', onDocClick, true);
			document.addEventListener('keydown', onKeydown);
		} else {
			document.removeEventListener('click', onDocClick, true);
			document.removeEventListener('keydown', onKeydown);
		}
	});

	onDestroy(() => {
		if (!browser) return;
		document.removeEventListener('click', onDocClick, true);
		document.removeEventListener('keydown', onKeydown);
	});

	function toggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (open) {
			closeMenu();
		} else {
			open = true;
			positionMenu();
			requestAnimationFrame(() => positionMenu());
		}
	}

	function getTripLink(): string {
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		return `${origin}/trips/${tripId}`;
	}

	function handleHostShareLink() {
		const link = getTripLink();
		navigator.clipboard.writeText(link).then(
			() => showToast?.('Link copied to clipboard'),
			() => showToast?.(link)
		);
		closeMenu();
	}

	function handleHostInvite() {
		onInvite?.();
		closeMenu();
	}

	function openHouseholdModal() {
		householdModalOpen = true;
		closeMenu();
	}
</script>

{#if showShare}
	<div class="sh-wrap">
		<button
			type="button"
			class="sh-btn"
			bind:this={triggerEl}
			onclick={toggle}
			aria-expanded={open}
			aria-haspopup="menu"
			title="Share"
		>
			<span class="sh-content">
				<span class="sh-ic" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line
							x1="8.59"
							y1="13.51"
							x2="15.42"
							y2="17.49"
						/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg
					>
				</span>
				<span>Share</span>
			</span>
		</button>
		{#if open}
			<div use:portal class="sh-portal" role="presentation">
				<div
					bind:this={menuEl}
					class="sh-menu"
					role="menu"
					style={menuStyle ? `position: fixed; z-index: 20010; top: ${menuStyle.top}; left: ${menuStyle.left};` : ''}
				>
					{#if canHostShare}
						<button type="button" class="sh-opt" role="menuitem" onclick={handleHostInvite}>
							<span class="sh-lab">Invite Guests</span>
						</button>
						<div class="sh-div" role="separator"></div>
						<button type="button" class="sh-opt" role="menuitem" onclick={handleHostShareLink}>
							<span class="sh-lab">Share Link</span>
						</button>
					{:else if householdShare?.hasUnclaimedProxyMembers}
						<button type="button" class="sh-opt sh-opt--plus" role="menuitem" onclick={openHouseholdModal}>
							<span class="sh-lab sh-lab--row">
								<span class="sh-person-ic" aria-hidden="true">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
										><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line
											x1="19"
											y1="8"
											x2="19"
											y2="14"
										/><line x1="16" y1="11" x2="22" y2="11" /></svg
									>
								</span>
								<span>
									<span class="sh-lab">Invite my Plus Ones</span>
									<span class="sh-sub">Send a link so they can join the trip portal</span>
								</span>
							</span>
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if householdShare?.householdId && !canHostShare}
		<HouseholdShareModal
			bind:open={householdModalOpen}
			{tripId}
			householdId={householdShare.householdId}
			unclaimedFirstNames={householdShare.unclaimedFirstNames}
			primaryLabel={householdShare.unclaimedFirstNames.length
				? householdShare.unclaimedFirstNames.join(', ')
				: 'your plus ones'}
		/>
	{/if}
{/if}

<style>
	.sh-wrap {
		position: relative;
		display: inline-flex;
	}
	.sh-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.25rem;
		padding: 0.375rem 0.75rem;
		border: none;
		background: transparent;
		border-radius: var(--radius-md, 0.5rem);
		color: var(--muted);
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}
	.sh-btn:hover {
		background: var(--border);
		color: var(--text);
	}
	.sh-content {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		pointer-events: none;
	}
	.sh-ic :global(svg) {
		width: 1.125rem;
		height: 1.125rem;
	}
	.sh-portal {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 20000;
	}
	.sh-menu {
		pointer-events: auto;
		min-width: 15rem;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
		padding: 8px;
		border: 1px solid var(--border-soft, #e2e8f0);
	}
	.sh-opt {
		display: block;
		width: 100%;
		margin: 0;
		padding: 12px 16px;
		text-align: left;
		border: none;
		border-radius: 8px;
		background: none;
		cursor: pointer;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
	}
	.sh-opt:hover {
		background: rgba(47, 119, 120, 0.1);
	}
	.sh-lab {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text, #1e293b);
	}
	.sh-sub {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted, #94a3b8);
		line-height: 1.3;
	}
	.sh-lab--row {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
	}
	.sh-person-ic {
		flex-shrink: 0;
		color: #2f7778;
		margin-top: 0.05rem;
	}
	.sh-div {
		height: 1px;
		background: var(--border-soft, #e2e8f0);
		margin: 4px 0;
	}
</style>
