<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let files = $state<{ name: string; size: string }[]>([]);
</script>

<div class="page">
	<div class="page-header">
		<h1>Files</h1>
		<p class="subtitle">Upload and share trip-related files</p>
		<button type="button" class="btn-primary">Upload (placeholder)</button>
	</div>

	<div class="card">
		<div class="card-body">
			<div class="upload-zone">
				<p>Drop files here or click to upload (placeholder)</p>
			</div>
			{#if files.length > 0}
				<ul class="file-list">
					{#each files as f}
						<li>{f.name} – {f.size}</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No files yet.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0 0 1rem 0; }
	.btn-primary { padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 0.5rem; font-weight: 500; cursor: pointer; }
	.card { background: white; border-radius: 1rem; border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.upload-zone { border: 2px dashed var(--border); border-radius: 0.5rem; padding: 2rem; text-align: center; color: var(--muted); margin-bottom: 1rem; }
	.file-list { list-style: none; margin: 0; padding: 0; font-size: 0.875rem; }
	.empty { color: var(--muted); margin: 0; }
</style>
