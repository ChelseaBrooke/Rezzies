<script lang="ts">
	import { goto } from '$app/navigation';

	let {
		tripId,
		inviteCode,
		onInvite,
		onCopyLink,
		showToast
	}: {
		tripId: string;
		inviteCode?: string;
		onInvite?: () => void;
		onCopyLink?: () => void;
		showToast?: (msg: string) => void;
	} = $props();

	let moreOpen = $state(false);

	function handleShare() {
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		const link = inviteCode ? `${origin}/trip/${inviteCode}` : `${origin}/trips/${tripId}`;
		if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(link).then(() => {
				showToast?.('Link copied to clipboard');
			});
		} else {
			showToast?.('Copy link: ' + link);
		}
		onCopyLink?.();
	}

	function handlePreviewNewTrip() {
		goto(`/trips/${tripId}/preview-new`);
		moreOpen = false;
	}

	function handleDuplicate() {
		showToast?.('Duplicate trip — coming soon');
		moreOpen = false;
	}

	function handleArchive() {
		showToast?.('Archive — coming soon');
		moreOpen = false;
	}

	function handleDelete() {
		showToast?.('Delete requires confirmation — coming soon');
		moreOpen = false;
	}
</script>

<div class="quick-actions">
	<button type="button" class="action-btn" title="Invite" onclick={() => onInvite?.()}>
		<span class="action-icon">✉️</span>
	</button>
	<button type="button" class="action-btn" title="Copy link" onclick={handleShare}>
		<span class="action-icon">🔗</span>
	</button>
	<button type="button" class="action-btn" title="Preview new trip form" onclick={handlePreviewNewTrip}>
		<span class="action-icon">✏️</span>
	</button>
	<div class="more-wrap">
		<button
			type="button"
			class="action-btn"
			title="More"
			onclick={() => (moreOpen = !moreOpen)}
			aria-expanded={moreOpen}
		>
			<span class="action-icon">⋯</span>
		</button>
		{#if moreOpen}
			<div class="more-backdrop" onclick={() => (moreOpen = false)} role="presentation"></div>
			<div class="more-menu">
				<button type="button" class="more-item" onclick={handleDuplicate}>Duplicate trip</button>
				<button type="button" class="more-item" onclick={handleArchive}>Archive</button>
				<button type="button" class="more-item danger" onclick={handleDelete}>Delete</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.quick-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.action-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		border-radius: var(--radius-sm, 0.5rem);
		cursor: pointer;
		color: var(--muted);
		transition: all 0.2s;
	}

	.action-btn:hover {
		background: var(--border);
		color: var(--text);
	}

	.action-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.more-wrap {
		position: relative;
	}

	.more-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
	}

	.more-menu {
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

	.more-item {
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

	.more-item:hover {
		background: var(--bg);
	}

	.more-item.danger {
		color: var(--danger);
	}

	.more-item.danger:hover {
		background: rgba(115, 44, 44, 0.08);
	}
</style>
