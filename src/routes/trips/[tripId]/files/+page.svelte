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
		canDelete?: boolean;
	};

	let dbFiles = $state<TripFile[]>((data.tripFiles as TripFile[]) ?? []);
	let photos   = $state<{ id: string; url: string; name?: string; mimeType?: string | null }[]>([]);
	let searchQuery  = $state('');
	let uploadError  = $state<string | null>(null);
	let uploading    = $state(false);
	let fileInputEl: HTMLInputElement | null = $state(null);
	let photoInputEl: HTMLInputElement | null = $state(null);
	type MediaItem = { id: string; url: string; name?: string; mimeType?: string | null };
	let lightboxMedia = $state<MediaItem | null>(null);
	let deletingFileId = $state<string | null>(null);

	const tripId = $derived(data.trip?.id ?? '');

	function canDeleteFile(fileId: string): boolean {
		const f = dbFiles.find((file) => file.id === fileId);
		return !!f?.canDelete;
	}

	async function deleteFile(fileId: string) {
		if (!canDeleteFile(fileId)) return;
		deletingFileId = fileId;
		const res = await fetch(`/api/trips/${tripId}/files/${fileId}`, { method: 'DELETE' });
		deletingFileId = null;
		if (!res.ok) return;
		dbFiles = dbFiles.filter((f) => f.id !== fileId);
		photos = photos.filter((p) => p.id !== fileId);
		if (lightboxMedia?.id === fileId) lightboxMedia = null;
	}
	const canDeleteSelected = $derived(
		lightboxMedia != null && canDeleteFile(lightboxMedia.id)
	);
	const lightboxDeleting = $derived(lightboxMedia != null && deletingFileId === lightboxMedia.id);

	$effect(() => {
		if (!lightboxMedia) return;
		const fn = (e: KeyboardEvent) => {
			if (e.key === 'Escape') lightboxMedia = null;
		};
		window.addEventListener('keydown', fn);
		return () => window.removeEventListener('keydown', fn);
	});

	// Filter non-gallery files (receipts, documents, exclude images and videos)
	const filteredFiles = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const docs = dbFiles.filter(
			f => !f.mimeType?.startsWith('image/') && !f.mimeType?.startsWith('video/')
		);
		if (!q) return docs;
		return docs.filter(f => f.name.toLowerCase().includes(q) || (f.category ?? '').toLowerCase().includes(q));
	});

	// Gallery media, from DB (images and videos that are not receipts)
	const dbPhotos = $derived(
		dbFiles.filter(
			f =>
				f.category !== 'receipt' &&
				(f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/'))
		)
	);

	// Receipts for quick-view section
	const receipts = $derived(dbFiles.filter(f => f.category === 'receipt'));

	// All gallery media (DB + optimistic uploads) for gallery grid
	const allPhotos = $derived([
		...dbPhotos.map(f => ({ id: f.id, url: f.url, name: f.name, mimeType: f.mimeType })),
		...photos
	]);

	const BROKEN_IMAGE_PLACEHOLDER =
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";

	function onImageError(e: Event) {
		const el = e.currentTarget as HTMLImageElement;
		if (el) {
			el.onerror = null;
			el.src = BROKEN_IMAGE_PLACEHOLDER;
			el.alt = 'Image failed to load';
		}
	}

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

	async function uploadFile(file: File, category = 'document', isPhoto = false, optimisticPhotoId?: string) {
		uploading = true; uploadError = null;
		const fd = new FormData();
		fd.append('file', file);
		fd.append('category', isPhoto ? 'photo' : category);
		const res = await fetch(`/api/trips/${tripId}/files`, { method: 'POST', body: fd });
		const json = await res.json();
		uploading = false;
		if (!res.ok) { uploadError = json.error ?? 'Upload failed'; return; }
		// Add to list immediately so it appears without refresh (same as photos)
		const newFile: TripFile = {
			...json.file,
			uploadedBy: { id: data.user?.id ?? '', name: data.user?.name ?? null },
			mealSlot: null,
			canDelete: true
		};
		dbFiles = [newFile, ...dbFiles];
		if (isPhoto && optimisticPhotoId) {
			const entry = photos.find((p) => p.id === optimisticPhotoId);
			if (entry) URL.revokeObjectURL(entry.url);
			photos = photos.filter((p) => p.id !== optimisticPhotoId);
		}
	}

	function handleFilesSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		Array.from(input.files ?? []).forEach(f => uploadFile(f, 'document'));
		input.value = '';
	}

	function handlePhotosSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		Array.from(input.files ?? []).forEach(f => {
			const optimisticId = crypto.randomUUID();
			photos = [...photos, { id: optimisticId, url: URL.createObjectURL(f), name: f.name, mimeType: f.type }];
			uploadFile(f, 'photo', true, optimisticId);
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
			.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
			.forEach(f => {
				const optimisticId = crypto.randomUUID();
				photos = [...photos, { id: optimisticId, url: URL.createObjectURL(f), name: f.name, mimeType: f.type }];
				uploadFile(f, 'photo', true, optimisticId);
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
					<p><span class="upload-hint">PDF | Images | Documents</p>
					<p>(up to 20 MB)</p>
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
								{#if f.canDelete}
									<button
										type="button"
										class="file-delete-btn"
										title="Delete file"
										disabled={deletingFileId === f.id}
										onclick={() => deleteFile(f.id)}
									>
										{#if deletingFileId === f.id}
											<span class="spinner"></span>
										{:else}
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
										{/if}
									</button>
								{/if}
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
								{#if f.canDelete}
									<button
										type="button"
										class="file-delete-btn"
										title="Delete file"
										disabled={deletingFileId === f.id}
										onclick={() => deleteFile(f.id)}
									>
										{#if deletingFileId === f.id}
											<span class="spinner"></span>
										{:else}
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
										{/if}
									</button>
								{/if}
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
		<p class="section-subtitle">Everyone can contribute. Share your favourite moments.</p>
		<div class="card">
			<div class="card-body">
				<label
					class="gallery-upload-zone"
					ondragover={preventDefault}
					ondragenter={preventDefault}
					ondrop={handlePhotoDrop}
				>
					<p>Drop photos or videos here or click to add</p>
					<span class="upload-hint">JPG · PNG · WebP · MP4 · WebM</span>
					<input
						type="file"
						bind:this={photoInputEl}
						accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
						multiple
						style="display:none"
						onchange={handlePhotosSelected}
					/>
				</label>

				{#if allPhotos.length > 0}
					<div class="photo-grid" role="list">
						{#each allPhotos as photo (photo.id)}
							<button
								type="button"
								class="photo-cell photo-cell-btn"
								onclick={() => (lightboxMedia = { id: photo.id, url: photo.url, name: photo.name, mimeType: photo.mimeType })}
							>
								{#if photo.mimeType?.startsWith('video/')}
									<video src={photo.url} muted playsinline title={photo.name ?? 'Video'}></video>
								{:else}
									<img src={photo.url} alt={photo.name ?? 'Trip photo'} onerror={onImageError} />
								{/if}
							</button>
						{/each}
					</div>
				{:else}
					<div class="empty-gallery">
						<span class="empty-icon">📷</span>
						<p>No photos yet. Be the first to add memories from the trip!</p>
					</div>
				{/if}
				{#if lightboxMedia}
					<div
						class="lightbox-backdrop"
						role="dialog"
						aria-modal="true"
						aria-label="Media full size"
						onclick={(e) => e.target === e.currentTarget && (lightboxMedia = null)}
					>
						<div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
							<div class="lightbox-toolbar">
								<span class="lightbox-name">{lightboxMedia.name ?? 'Photo'}</span>
								<div class="lightbox-actions">
									{#if canDeleteSelected}
										<button
											type="button"
											class="lightbox-btn lightbox-btn-delete"
											disabled={lightboxDeleting}
											onclick={() => deleteFile(lightboxMedia!.id)}
										>
											{lightboxDeleting ? 'Deleting…' : 'Delete'}
										</button>
									{/if}
									<button type="button" class="lightbox-btn lightbox-btn-close" onclick={() => (lightboxMedia = null)}>
										Close
									</button>
								</div>
							</div>
							<div class="lightbox-media">
								{#if lightboxMedia.mimeType?.startsWith('video/')}
									<video src={lightboxMedia.url} controls autoplay muted loop playsinline title={lightboxMedia.name ?? 'Video'}></video>
								{:else}
									<img src={lightboxMedia.url} alt={lightboxMedia.name ?? 'Trip photo'} onerror={onImageError} />
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
	:global(.main-content-inner) {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	:global(.main-content-inner::-webkit-scrollbar) {
		width: 0;
		height: 0;
	}
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
	.file-delete-btn {
		flex-shrink: 0;
		width: 1.75rem; height: 1.75rem;
		display: inline-flex; align-items: center; justify-content: center;
		padding: 0; border: none; border-radius: 4px;
		background: transparent; color: #dc2626;
		cursor: pointer;
		transition: opacity .15s, background .15s;
	}
	.file-delete-btn:hover:not(:disabled) {
		background: rgba(220,38,38,.12);
		opacity: 1;
	}
	.file-delete-btn:disabled { cursor: not-allowed; opacity: .6; color: #dc2626; }
	.file-delete-btn .spinner { border-color: rgba(220,38,38,.3); border-top-color: #dc2626; }
	.error-note { font-size: .875rem; color: #ef4444; margin: 0 0 .75rem; }
	.empty { color: var(--muted); margin: 0; font-size: .875rem; }
	.empty-gallery { text-align: center; padding: 2.5rem 1.5rem; color: var(--muted); }
	.empty-gallery .empty-icon { font-size: 2.5rem; display: block; margin-bottom: .5rem; opacity: .7; }
	.empty-gallery p { margin: 0; font-size: .9375rem; }
	.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: .75rem; }
	.photo-cell { aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; background: var(--surface2); }
	.photo-cell-btn {
		border: none; padding: 0; cursor: pointer; display: block; width: 100%; height: 100%;
		text-align: left;
	}
	.photo-cell-btn:hover { opacity: .92; }
	.photo-cell img,
	.photo-cell video { width: 100%; height: 100%; object-fit: cover; display: block; }
	/* Lightbox */
	.lightbox-backdrop {
		position: fixed; inset: 0;
		background: rgba(0,0,0,.88);
		display: flex; align-items: center; justify-content: center;
		z-index: 1000; padding: 1rem;
	}
	.lightbox-content {
		display: flex; flex-direction: column;
		max-width: 95vw; max-height: 95vh;
		background: var(--surface); border-radius: var(--radius-lg);
		overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.4);
	}
	.lightbox-toolbar {
		display: flex; align-items: center; justify-content: space-between;
		gap: 1rem; padding: .75rem 1rem;
		background: var(--surface2); border-bottom: 1px solid var(--border);
	}
	.lightbox-name {
		font-size: .875rem; font-weight: 500; color: var(--text);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	.lightbox-actions { display: flex; gap: .5rem; flex-shrink: 0; }
	.lightbox-btn {
		padding: .4rem .75rem; font-size: .8125rem; font-weight: 600;
		border-radius: var(--radius-md); border: 1px solid var(--border);
		background: var(--bg); color: var(--text); cursor: pointer;
	}
	.lightbox-btn:hover:not(:disabled) { background: var(--surface2); }
	.lightbox-btn-close { border-color: var(--slate); color: var(--slate); }
	.lightbox-btn-delete { border-color: #dc2626; color: #dc2626; }
	.lightbox-btn-delete:hover:not(:disabled) { background: rgba(220,38,38,.1); }
	.lightbox-media {
		flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
		padding: .5rem;
	}
	.lightbox-media img,
	.lightbox-media video { max-width: 100%; max-height: 80vh; object-fit: contain; display: block; }
	.spinner {
		display: inline-block; width: 12px; height: 12px;
		border: 2px solid rgba(255,255,255,.5); border-top-color: white;
		border-radius: 50%; animation: spin .6s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
