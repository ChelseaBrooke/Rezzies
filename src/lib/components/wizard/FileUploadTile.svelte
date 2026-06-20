<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	let { label = 'Upload', accept = 'image/*', multiple = false }: {
		label?: string;
		accept?: string;
		multiple?: boolean;
	} = $props();
	
	const dispatch = createEventDispatcher<{ files: FileList }>();
	
	let files = $state<File[]>([]);
	
	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files) {
			files = Array.from(target.files);
			dispatch('files', { files: target.files });
		}
	}
	
	function removeFile(index: number) {
		files = files.filter((_, i) => i !== index);
	}
</script>

<div class="upload-tile">
	<input
		type="file"
		{accept}
		{multiple}
		onchange={handleFileSelect}
		class="file-input"
		id="file-input-{Math.random()}"
	/>
	
	{#if files.length === 0}
		<label for="file-input-{Math.random()}" class="upload-area">
			<span class="upload-icon">☁️</span>
			<span class="upload-text">{label}</span>
			<span class="upload-hint">Max 2MB, PDF or Image</span>
		</label>
	{:else}
		<div class="files-list">
			{#each files as file, index}
				<div class="file-item">
					<span class="file-name">{file.name}</span>
					<button type="button" class="remove-btn" onclick={() => removeFile(index)}>×</button>
				</div>
			{/each}
			{#if multiple}
				<label for="file-input-{Math.random()}" class="add-more-btn">
					<span>+</span>
				</label>
			{/if}
		</div>
	{/if}
</div>

<style>
	.upload-tile {
		border: 2px dashed var(--border);
		border-radius: 0.75rem;
		padding: 2rem;
		text-align: center;
		transition: all 0.2s ease;
		cursor: pointer;
		background: white;
	}
	
	.upload-tile:hover {
		border-color: var(--primary);
		background: rgba(47, 119, 120, 0.02);
	}
	
	.file-input {
		position: absolute;
		width: 0.1px;
		height: 0.1px;
		opacity: 0;
		overflow: hidden;
		z-index: -1;
	}
	
	.upload-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}
	
	.upload-icon {
		font-size: 2rem;
		color: var(--primary);
		margin-bottom: 0.5rem;
	}
	
	.upload-text {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text);
	}
	
	.upload-hint {
		font-size: 0.75rem;
		color: var(--muted);
	}
	
	.files-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}
	
	.file-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(47, 119, 120, 0.1);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: var(--text);
	}
	
	.file-name {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.remove-btn {
		width: 1.25rem;
		height: 1.25rem;
		border: none;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: all 0.2s ease;
	}
	
	.remove-btn:hover {
		background: rgba(0, 0, 0, 0.1);
		color: var(--text);
	}
	
	.add-more-btn {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: var(--primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 1.5rem;
		font-weight: 300;
		transition: all 0.2s ease;
		border: none;
	}
	
	.add-more-btn:hover {
		background: var(--primary-dark);
		transform: scale(1.05);
	}
</style>
