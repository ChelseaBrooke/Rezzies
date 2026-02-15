<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Mock data until backend exists
	const COMMON_FILES_NOTE = 'Common files include packing lists, property maps, event booking confirmations, house rules & WiFi info, restaurant reservations, and arrival instructions.';

	let files = $state<{ id: string; name: string; size: string; category?: string }[]>([]);
	let searchQuery = $state('');
	let photos = $state<{ id: string; url: string; name?: string }[]>([]);

	const filteredFiles = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return files;
		return files.filter((f) => f.name.toLowerCase().includes(q) || (f.category ?? '').toLowerCase().includes(q));
	});

	let fileInputEl: HTMLInputElement | null = $state(null);
	let photoInputEl: HTMLInputElement | null = $state(null);

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function handleFilesSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const selected = input.files;
		if (!selected?.length) return;
		const newFiles = Array.from(selected).map((f) => ({
			id: crypto.randomUUID(),
			name: f.name,
			size: formatFileSize(f.size),
			category: undefined
		}));
		files = [...files, ...newFiles];
		input.value = '';
	}

	function handlePhotosSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const selected = input.files;
		if (!selected?.length) return;
		const newPhotos = Array.from(selected).map((f) => ({
			id: crypto.randomUUID(),
			url: URL.createObjectURL(f),
			name: f.name
		}));
		photos = [...photos, ...newPhotos];
		input.value = '';
	}

	function triggerFileInput() {
		fileInputEl?.click();
	}

	function triggerPhotoInput() {
		photoInputEl?.click();
	}

	function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		const items = e.dataTransfer?.files;
		if (!items?.length) return;
		const newFiles = Array.from(items).map((f) => ({
			id: crypto.randomUUID(),
			name: f.name,
			size: formatFileSize(f.size),
			category: undefined
		}));
		files = [...files, ...newFiles];
	}

	function handlePhotoDrop(e: DragEvent) {
		e.preventDefault();
		const items = e.dataTransfer?.files;
		if (!items?.length) return;
		const imageFiles = Array.from(items).filter((f) => f.type.startsWith('image/'));
		const newPhotos = imageFiles.map((f) => ({
			id: crypto.randomUUID(),
			url: URL.createObjectURL(f),
			name: f.name
		}));
		photos = [...photos, ...newPhotos];
	}

	function preventDefault(e: DragEvent) {
		e.preventDefault();
	}
</script>

<div class="page">
	<div class="page-header">
		<h1>Files</h1>
		<p class="subtitle">Upload and share trip-related files</p>
	</div>

	<!-- Files section -->
	<section class="section">
		<div class="card">
			<div class="card-body">
				<div class="search-row">
					<input
						type="search"
						class="search-input"
						placeholder="Search files…"
						aria-label="Search files"
						bind:value={searchQuery}
					/>
					<button type="button" class="btn-primary" disabled>Upload file</button>
				</div>

				<p class="common-note">{COMMON_FILES_NOTE}</p>

				<input
					type="file"
					bind:this={fileInputEl}
					accept=".pdf,image/*,.doc,.docx,.txt"
					multiple
					class="sr-only"
					aria-hidden="true"
					onchange={handleFilesSelected}
				/>
				<button type="button" class="upload-zone" onclick={triggerFileInput} ondragover={preventDefault} ondragenter={preventDefault} ondrop={handleFileDrop}>
					<p>Drop files here or click to upload</p>
					<span class="upload-hint">PDF, images, documents</span>
				</button>

				{#if filteredFiles.length > 0}
					<ul class="file-list" role="list">
						{#each filteredFiles as f}
							<li class="file-item">
								<span class="file-name">{f.name}</span>
								<span class="file-size">{f.size}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">No files yet.</p>
				{/if}
			</div>
		</div>
	</section>

	<!-- Trip photo gallery -->
	<section class="section">
		<h2 class="section-title">Trip photo gallery</h2>
		<p class="section-subtitle">Everyone can contribute — share your favorite moments from the trip.</p>
		<div class="card">
			<div class="card-body">
				<input
					type="file"
					bind:this={photoInputEl}
					accept="image/jpeg,image/png,image/webp,image/gif"
					multiple
					class="sr-only"
					aria-hidden="true"
					onchange={handlePhotosSelected}
				/>
				<button type="button" class="gallery-upload-zone" onclick={triggerPhotoInput} ondragover={preventDefault} ondragenter={preventDefault} ondrop={handlePhotoDrop}>
					<p>Drop photos here or click to add</p>
					<span class="upload-hint">JPG, PNG, WebP • Everyone on the trip can upload</span>
				</button>

				{#if photos.length > 0}
					<div class="photo-grid" role="list">
						{#each photos as photo}
							<div class="photo-cell">
								<img src={photo.url} alt={photo.name ?? 'Trip photo'} />
							</div>
						{/each}
					</div>
				{:else}
					<div class="empty-gallery">
						<span class="empty-icon">📷</span>
						<p>No photos yet. Be the first to add memories from the trip!</p>
					</div>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
	.page {
		padding: 0;
		width: 100%;
		max-width: 80rem;
		margin: 0 auto;
	}
	.page-header {
		margin-bottom: 1.5rem;
	}
	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
	}
	.subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}

	.section {
		margin-bottom: 2rem;
	}
	.section-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}
	.section-subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
	}

	.card {
		background: var(--surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		overflow: hidden;
	}
	.card-body {
		padding: 1.5rem;
	}

	.search-row {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}
	.search-input {
		flex: 1;
		min-width: 12rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.9375rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--text);
	}
	.search-input::placeholder {
		color: var(--muted);
	}
	.search-input:focus {
		outline: none;
		border-color: var(--primary, #e85d04);
		box-shadow: 0 0 0 2px rgba(232, 93, 4, 0.15);
	}

	.btn-primary {
		padding: 0.5rem 1rem;
		background: var(--primary, #e85d04);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.common-note {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1.25rem 0;
		line-height: 1.5;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.upload-zone,
	.gallery-upload-zone {
		display: block;
		width: 100%;
		border: 2px dashed var(--border);
		border-radius: var(--radius-md);
		padding: 2rem;
		text-align: center;
		color: var(--muted);
		margin-bottom: 1.25rem;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		background: transparent;
		font: inherit;
	}
	.upload-zone:hover,
	.gallery-upload-zone:hover {
		border-color: var(--primary, #e85d04);
		background: rgba(232, 93, 4, 0.04);
	}
	.upload-zone p,
	.gallery-upload-zone p {
		margin: 0 0 0.25rem 0;
		font-size: 0.9375rem;
	}
	.upload-hint {
		font-size: 0.75rem;
		opacity: 0.9;
	}

	.file-list {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.875rem;
	}
	.file-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
		gap: 1rem;
	}
	.file-item:last-child {
		border-bottom: none;
	}
	.file-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-size {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.8125rem;
	}

	.empty {
		color: var(--muted);
		margin: 0;
		font-size: 0.875rem;
	}

	.empty-gallery {
		text-align: center;
		padding: 2.5rem 1.5rem;
		color: var(--muted);
	}
	.empty-gallery .empty-icon {
		font-size: 2.5rem;
		display: block;
		margin-bottom: 0.5rem;
		opacity: 0.7;
	}
	.empty-gallery p {
		margin: 0;
		font-size: 0.9375rem;
	}

	.photo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.75rem;
	}
	.photo-cell {
		aspect-ratio: 1;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface2);
	}
	.photo-cell img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
