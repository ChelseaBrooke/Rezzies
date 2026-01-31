<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Client-side packing list; you can replace with server/DB later
	type ChecklistItem = { id: string; label: string; checked: boolean };
	let items = $state<ChecklistItem[]>([]);

	function toggle(id: string) {
		items = items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
	}

	function addItem() {
		const label = prompt('Add item');
		if (label?.trim()) {
			items = [...items, { id: crypto.randomUUID(), label: label.trim(), checked: false }];
		}
	}

	function removeItem(id: string) {
		items = items.filter((i) => i.id !== id);
	}
</script>

<div class="page">
	<div class="page-header">
		<h1>Packing list</h1>
		<p class="subtitle">Check off items as you pack. You can add your own items later.</p>
		<button type="button" class="btn btn-primary" onclick={addItem}>Add item</button>
	</div>

	<div class="card">
		<div class="card-body">
			{#if items.length === 0}
				<p class="empty">No items yet. Click “Add item” to start your packing list.</p>
			{:else}
				<ul class="checklist">
					{#each items as item (item.id)}
						<li class="checklist-item" class:checked={item.checked}>
							<label class="check-label">
								<input type="checkbox" checked={item.checked} onchange={() => toggle(item.id)} />
								<span class="check-text">{item.label}</span>
							</label>
							<button
								type="button"
								class="remove-btn"
								onclick={() => removeItem(item.id)}
								aria-label="Remove"
							>
								×
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0 0 1rem 0; }
	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.empty { color: var(--muted); margin: 0; }
	.checklist { list-style: none; margin: 0; padding: 0; }
	.checklist-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
	.checklist-item:last-child { border-bottom: none; }
	.checklist-item.checked .check-text { text-decoration: line-through; color: var(--muted); }
	.check-label { display: flex; align-items: center; gap: 0.5rem; flex: 1; cursor: pointer; }
	.check-label input[type="checkbox"] { width: 1.25rem; height: 1.25rem; accent-color: var(--primary); cursor: pointer; }
	.check-text { font-size: 0.9375rem; }
	.remove-btn { width: 1.75rem; height: 1.75rem; border: none; background: transparent; color: var(--muted); font-size: 1.25rem; line-height: 1; cursor: pointer; border-radius: var(--radius-sm); flex-shrink: 0; }
	.remove-btn:hover { background: var(--surface2); color: var(--danger); }
</style>
