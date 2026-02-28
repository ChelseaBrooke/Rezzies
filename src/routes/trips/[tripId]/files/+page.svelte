<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ── State ─────────────────────────────────────────────────────────────
	type TripFile = {
		id: string;
		name: string;
		url: string;
		mimeType: string | null;
		sizeBytes: number | null;
		category: string | null;
		createdAt: string;
		uploadedBy: { id: string; name: string | null };
		mealSlot: { id: string; mealType: string; title: string | null; date: string } | null;
	};

	let dbFiles  = $state<TripFile[]>((data.tripFiles as TripFile[]) ?? []);
	let photos   = $state<{ id: string; url: string; name?: string }[]>([]);
	let searchQuery  = $state('');
	let uploadError  = $state<string | null>(null);
	let uploading    = $state(false);
	let fileInputEl: HTMLInputElement | null = $state(null);
	let photoInputEl: HTMLInputElement | null = $state(null);

	const tripId = $derived(data.trip?.id ?? '');

	// Filter non-photo files (receipts, documents)
	const filteredFiles = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const docs = dbFiles.filter(f => !f.mimeType?.startsWith('image/'));
		if (!q) return docs;
		return docs.filter(f => f.name.toLowerCase().includes(q) || (f.category ?? '').toLowerCase().includes(q));
	});

	// Photo files — from DB (images that are not receipts attached to meals)
	const dbPhotos = $derived(
		dbFiles.filter(f => f.mimeType?.startsWith('image/') && f.category !== 'receipt')
	);

	function formatSize(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function fileIcon(f: TripFile): string {
		if (f.mimeType === 'application/pdf') return '📄';
		if (f.mimeType?.startsWith('image/')) return '🖼';
		return '📎';
	}

	function categoryLabel(f: TripFile): string {
		if (f.category === 'receipt') return 'Receipt';
		if (f.mealSlot) return `${f.mealSlot.mealType} receipt`;
		return f.category ?? 'File';
	}

	async function uploadFile(file: File, category = 'document', isPhoto = false) {
		uploading = true; uploadError = null;
		const fd = new FormData();
		fd.append('file', file);
		fd.append('category', isPhoto ? 'photo' : category);
		const res = await fetch(`/api/trips/${tripId}/files`, { method: 'POST', body: fd });
		const json = await res.json();
		uploading = false;
		if (!res.ok) { uploadError = json.error ?? 'Upload failed'; return; }
		dbFiles = [json.file, ...dbFiles];
	}

	function handleFilesSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		Array.from(input.files ?? []).forEach(f => uploadFile(f, 'document'));
		input.value = '';
	}

	function handlePhotosSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		Array.from(input.files ?? []).forEach(f => {
			photos = [...photos, { id: crypto.randomUUID(), url: URL.createObjectURL(f), name: f.name }];
			uploadFile(f, 'photo', true);
		});
		input.value = '';
	}

	function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		Array.from(e.dataTransfer?.files ?? []).forEach(f => uploadFile(f, 'document'));
	}

	function handlePhotoDrop(e: DragEvent) {
		e.preventDefault();
		Array.from(e.dataTransfer?.files ?? [])
			.filter(f => f.type.startsWith('image/'))
			.forEach(f => {
				photos = [...photos, { id: crypto.randomUUID(), url: URL.createObjectURL(f), name: f.name }];
				uploadFile(f, 'photo', true);
			});
	}

	const preventDefault = (e: DragEvent) => e.preventDefault();
</script>

<div class="page">
	<div class="page-header">
		<h1>Files</h1>
		<p class="subtitle">Upload and share trip-related files and receipts</p>
	</div>

	<!-- Documents & receipts -->
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
					<label class="btn-primary">
						{#if uploading}<span class="spinner"></span>{:else}+ Upload file{/if}
						<input
							type="file"
							bind:this={fileInputEl}
							accept=".pdf,image/*,.doc,.docx,.txt"
							multiple
							style="display:none"
							onchange={handleFilesSelected}
						/>
					</label>
				</div>

				{#if uploadError}
					<p class="error-note">{uploadError}</p>
				{/if}

				<label
					class="upload-zone"
					ondragover={preventDefault}
					ondragenter={preventDefault}
					ondrop={handleFileDrop}
				>
					<p>Drop files here or click to upload</p>
					<span class="upload-hint">PDF, images, documents — up to 20 MB</span>
					<input
						type="file"
						accept=".pdf,image/*,.doc,.docx,.txt"
						multiple
						style="display:none"
						onchange={handleFilesSelected}
					/>
				</label>

				{#if filteredFiles.length > 0}
					<ul class="file-list" role="list">
						{#each filteredFiles as f (f.id)}
							<li class="file-item">
								<span class="file-icon">{fileIcon(f)}</span>
								<div class="file-info">
									<a class="file-name" href={f.url} target="_blank" rel="noopener noreferrer">{f.name}</a>
									{#if f.mealSlot}
										<span class="file-tag receipt-tag">🧾 {categoryLabel(f)}</span>
									{:else if f.category}
										<span class="file-tag">{categoryLabel(f)}</span>
									{/if}
								</div>
								<span class="file-meta">
									{#if f.sizeBytes}{formatSize(f.sizeBytes)} · {/if}{f.uploadedBy.name ?? 'Guest'}
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">No documents yet.</p>
				{/if}
			</div>
		</div>
	</section>

	<!-- Receipts section (quick view) -->
	{@const receipts = dbFiles.filter(f => f.category === 'receipt')}
	{#if receipts.length > 0}
		<section class="section">
			<h2 class="section-title">Meal receipts</h2>
			<div class="card">
				<div class="card-body">
					<ul class="file-list" role="list">
						{#each receipts as f (f.id)}
							<li class="file-item">
								<span class="file-icon">{fileIcon(f)}</span>
								<div class="file-info">
									<a class="file-name" href={f.url} target="_blank" rel="noopener noreferrer">{f.name}</a>
									{#if f.mealSlot}
										<span class="file-tag receipt-tag">
											{f.mealSlot.mealType.charAt(0).toUpperCase() + f.mealSlot.mealType.slice(1)}
											· {new Date(f.mealSlot.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
										</span>
									{/if}
								</div>
								<span class="file-meta">{formatSize(f.sizeBytes)}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>
	{/if}

	<!-- Trip photo gallery -->
	<section class="section">
		<h2 class="section-title">Trip photo gallery</h2>
		<p class="section-subtitle">Everyone can contribute — share your favourite moments.</p>
		<div class="card">
			<div class="card-body">
				<label
					class="gallery-upload-zone"
					ondragover={preventDefault}
					ondragenter={preventDefault}
					ondrop={handlePhotoDrop}
				>
					<p>Drop photos here or click to add</p>
					<span class="upload-hint">JPG, PNG, WebP • Everyone on the trip can upload</span>
					<input
						type="file"
						bind:this={photoInputEl}
						accept="image/jpeg,image/png,image/webp,image/gif"
						multiple
						style="display:none"
						onchange={handlePhotosSelected}
					/>
				</label>

				{@const allPhotos = [...dbPhotos.map(f => ({ id: f.id, url: f.url, name: f.name })), ...photos]}
				{#if allPhotos.length > 0}
					<div class="photo-grid" role="list">
						{#each allPhotos as photo (photo.id)}
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
	.page { padding: 0; width: 100%; max-width: 80rem; margin: 0 auto; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 .25rem; }
	.subtitle { font-size: .875rem; color: var(--muted); margin: 0; }
	.section { margin-bottom: 2rem; }
	.section-title { font-size: 1.125rem; font-weight: 600; margin: 0 0 .5rem; color: var(--text); }
	.section-subtitle { font-size: .875rem; color: var(--muted); margin: 0 0 1rem; }
	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.search-row { display: flex; gap: .75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
	.search-input {
		flex: 1; min-width: 12rem;
		padding: .5rem .75rem; font-size: .9375rem;
		border: 1px solid var(--border); border-radius: var(--radius-md);
		background: var(--bg); color: var(--text);
	}
	.search-input:focus { outline: none; border-color: var(--primary, #e85d04); }
	.btn-primary {
		display: inline-flex; align-items: center; gap: .35rem;
		padding: .5rem 1rem;
		background: var(--primary, #e85d04); color: white;
		border: none; border-radius: var(--radius-md);
		font-weight: 500; font-size: .875rem; cursor: pointer;
	}
	.btn-primary:hover { opacity: .9; }
	.upload-zone, .gallery-upload-zone {
		display: block; width: 100%;
		border: 2px dashed var(--border); border-radius: var(--radius-md);
		padding: 2rem; text-align: center; color: var(--muted);
		margin-bottom: 1.25rem; cursor: pointer;
		transition: border-color .15s, background .15s;
		background: transparent; font: inherit;
	}
	.upload-zone:hover, .gallery-upload-zone:hover {
		border-color: var(--primary, #e85d04);
		background: rgba(232,93,4,.04);
	}
	.upload-zone p, .gallery-upload-zone p { margin: 0 0 .25rem; font-size: .9375rem; }
	.upload-hint { font-size: .75rem; opacity: .9; }
	.file-list { list-style: none; margin: 0; padding: 0; }
	.file-item {
		display: flex; align-items: center; gap: .75rem;
		padding: .6rem 0; border-bottom: 1px solid var(--border);
	}
	.file-item:last-child { border-bottom: none; }
	.file-icon { font-size: 1.125rem; flex-shrink: 0; }
	.file-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
	.file-name {
		font-size: .875rem; color: var(--text);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	.file-name:hover { text-decoration: underline; }
	.file-tag {
		font-size: .72rem; color: var(--muted);
		background: var(--surface2); border-radius: 99px;
		padding: .1rem .5rem; width: fit-content;
	}
	.receipt-tag { background: rgba(232,93,38,.1); color: #c04a1a; }
	.file-meta { flex-shrink: 0; font-size: .8rem; color: var(--muted); white-space: nowrap; }
	.error-note { font-size: .875rem; color: #ef4444; margin: 0 0 .75rem; }
	.empty { color: var(--muted); margin: 0; font-size: .875rem; }
	.empty-gallery { text-align: center; padding: 2.5rem 1.5rem; color: var(--muted); }
	.empty-gallery .empty-icon { font-size: 2.5rem; display: block; margin-bottom: .5rem; opacity: .7; }
	.empty-gallery p { margin: 0; font-size: .9375rem; }
	.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: .75rem; }
	.photo-cell { aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; background: var(--surface2); }
	.photo-cell img { width: 100%; height: 100%; object-fit: cover; }
	.spinner {
		display: inline-block; width: 12px; height: 12px;
		border: 2px solid rgba(255,255,255,.5); border-top-color: white;
		border-radius: 50%; animation: spin .6s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
