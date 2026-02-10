<script lang="ts">
	let {
		open = false,
		items = [],
		onClose
	}: {
		open?: boolean;
		items?: Array<{ text: string; at: string }>;
		onClose?: () => void;
	} = $props();

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose?.();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const sortedItems = $derived(
		[...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
	);

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

{#if open}
	<div
		class="activity-modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="activity-log-title"
		onclick={onClose}
	>
		<div class="activity-modal" onclick={(e) => e.stopPropagation()}>
			<div class="activity-modal-header">
				<h2 id="activity-log-title" class="activity-modal-title">Activity log</h2>
				<button type="button" class="activity-modal-close" onclick={onClose} aria-label="Close">×</button>
			</div>
			<div class="activity-modal-body">
				{#if sortedItems.length > 0}
					<ul class="activity-log-list">
						{#each sortedItems as item}
							<li class="activity-log-item">
								<span class="activity-log-date">{formatDate(item.at)}</span>
								<span class="activity-log-text">{item.text}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">No activity yet</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.activity-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.activity-modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border-soft);
		max-width: 480px;
		width: 100%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.activity-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-soft);
		flex-shrink: 0;
	}

	.activity-modal-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
	}

	.activity-modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-md);
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.activity-modal-close:hover {
		color: var(--text);
		background: var(--surface2);
	}

	.activity-modal-body {
		padding: 1rem 1.25rem;
		overflow-y: auto;
		min-height: 0;
	}

	.activity-log-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.activity-log-item {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--border-soft);
		font-size: 0.875rem;
	}

	.activity-log-item:last-child {
		border-bottom: none;
	}

	.activity-log-date {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.activity-log-text {
		color: var(--text);
	}

	.muted {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
	}
</style>
