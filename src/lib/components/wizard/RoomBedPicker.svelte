<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import kingBedIconUrl from '$lib/assets/images/beds/king.svg.svg?url';
	import queenBedIconUrl from '$lib/assets/images/beds/queen.svg.svg?url';
	import twinBedIconUrl from '$lib/assets/images/beds/twin.svg.svg?url';
	import bunkBedIconUrl from '$lib/assets/images/beds/bunk.svg.svg?url';
	import sofaBedIconUrl from '$lib/assets/images/beds/sofabed.svg.svg?url';

	let { draft = $bindable(), autosave }: { draft: TripDraft; autosave: () => void } = $props();

	const bedTypeOptions = [
		{ value: 'king',  label: 'King',     iconUrl: kingBedIconUrl,  fallbackIcon: '🛏️' },
		{ value: 'queen', label: 'Queen',    iconUrl: queenBedIconUrl, fallbackIcon: '🛏️' },
		{ value: 'full',  label: 'Full',     iconUrl: queenBedIconUrl, fallbackIcon: '🛏️' },
		{ value: 'twin',  label: 'Twin',     iconUrl: twinBedIconUrl,  fallbackIcon: '🛏️' },
		{ value: 'bunk',  label: 'Bunk',     iconUrl: bunkBedIconUrl,  fallbackIcon: '🛏️' },
		{ value: 'sofa',  label: 'Sofa Bed', iconUrl: sofaBedIconUrl,  fallbackIcon: '🛋️' }
	];

	/* ── Bed helpers ──────────────────────────────────────── */
	type BedTypeQty = { bedType: string; quantity: number };

	function bedsAsQtyMap(beds: TripDraft['rooms'][number]['beds']): BedTypeQty[] {
		const map: Record<string, number> = {};
		for (const b of beds) map[b.bedType] = (map[b.bedType] || 0) + 1;
		return Object.entries(map).map(([bedType, quantity]) => ({ bedType, quantity }));
	}

	function qtyMapToBeds(map: BedTypeQty[]): TripDraft['rooms'][number]['beds'] {
		return map.flatMap(({ bedType, quantity }) =>
			Array.from({ length: quantity }, () => ({
				id: crypto.randomUUID(),
				bedType,
				count: 1,
				shared: false,
				notes: ''
			}))
		);
	}

	function getBedQuantity(roomId: string, bedType: string): number {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return 0;
		return bedsAsQtyMap(room.beds).find((b) => b.bedType === bedType)?.quantity || 0;
	}

	function setBedsForRoom(roomId: string, qtyMap: BedTypeQty[]) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		room.beds = qtyMapToBeds(qtyMap);
		const totalSlots = room.beds.reduce((s, b) => s + (b.count || 1), 0);
		room.type = totalSlots === 1 ? 'private' : 'shared';
	}

	function incrementBed(roomId: string, bedType: string) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		const qty = bedsAsQtyMap(room.beds);
		const existing = qty.find((b) => b.bedType === bedType);
		if (existing) existing.quantity += 1;
		else qty.push({ bedType, quantity: 1 });
		setBedsForRoom(roomId, qty);
		autosave();
	}

	function decrementBed(roomId: string, bedType: string) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		const qty = bedsAsQtyMap(room.beds);
		const existing = qty.find((b) => b.bedType === bedType);
		if (!existing) return;
		if (existing.quantity <= 1) {
			setBedsForRoom(roomId, qty.filter((b) => b.bedType !== bedType));
		} else {
			existing.quantity -= 1;
			setBedsForRoom(roomId, qty);
		}
		autosave();
	}

	function getRoomDisplayName(room: TripDraft['rooms'][number], idx: number): string {
		return room.name?.trim() || `Room ${idx + 1}`;
	}

	function addRoom() {
		draft.rooms = [
			...draft.rooms,
			{
				id: crypto.randomUUID(),
				name: '',
				roomType: 'bedroom',
				customRoomDescription: '',
				type: 'shared',
				maxOccupants: 2,
				notes: '',
				photos: [],
				beds: []
			}
		];
		autosave();
	}

	function removeRoom(roomId: string) {
		draft.rooms = draft.rooms.filter((r) => r.id !== roomId);
		autosave();
	}

	function getBedIconMeta(bedType: string): { url?: string; alt: string; fallback: string } {
		const option = bedTypeOptions.find((opt) => opt.value === bedType);
		if (!option) return { alt: bedType, fallback: '🛏️' };
		return { url: option.iconUrl, alt: option.label, fallback: option.fallbackIcon };
	}

	const totalBedsByRoom = $derived(
		new Map(
			(draft.rooms ?? []).map((r) => [
				r.id,
				(r.beds ?? []).reduce((s, b) => s + (b.count || 1), 0)
			])
		)
	);

	/* ── Photo upload ─────────────────────────────────────── */
	let uploadingByRoom: Record<string, boolean> = $state({});
	let uploadErrorByRoom: Record<string, string | null> = $state({});

	async function uploadRoomPhotos(roomId: string, files: FileList | null) {
		if (!files || files.length === 0) return;
		uploadingByRoom = { ...uploadingByRoom, [roomId]: true };
		uploadErrorByRoom = { ...uploadErrorByRoom, [roomId]: null };
		try {
			const uploaded: string[] = [];
			for (const file of Array.from(files)) {
				const fd = new FormData();
				fd.set('file', file);
				const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json.url) {
					uploadErrorByRoom = { ...uploadErrorByRoom, [roomId]: json?.error || 'Upload failed' };
					continue;
				}
				const origin = typeof window !== 'undefined' ? window.location.origin : '';
				const finalUrl = /^https?:\/\//i.test(json.url) ? json.url : `${origin}${json.url}`;
				uploaded.push(finalUrl);
			}
			if (uploaded.length > 0) {
				const room = draft.rooms.find((r) => r.id === roomId);
				if (room) {
					room.photos = [...room.photos, ...uploaded];
					autosave();
				}
			}
		} finally {
			uploadingByRoom = { ...uploadingByRoom, [roomId]: false };
		}
	}

	function onPhotoInputChange(roomId: string, ev: Event) {
		const input = ev.target as HTMLInputElement;
		uploadRoomPhotos(roomId, input.files);
		input.value = '';
	}

	function removeRoomPhoto(roomId: string, photoIndex: number) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		room.photos = room.photos.filter((_, i) => i !== photoIndex);
		autosave();
	}

	/* ── Cover photo upload ───────────────────────────────── */
	let uploadingCover = $state(false);
	let coverError = $state<string | null>(null);

	async function uploadCoverPhoto(files: FileList | null) {
		if (!files || files.length === 0) return;
		uploadingCover = true;
		coverError = null;
		try {
			const fd = new FormData();
			fd.set('file', files[0]);
			const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json.url) {
				coverError = json?.error || 'Upload failed';
				return;
			}
			const origin = typeof window !== 'undefined' ? window.location.origin : '';
			draft.coverPhoto = /^https?:\/\//i.test(json.url) ? json.url : `${origin}${json.url}`;
			autosave();
		} finally {
			uploadingCover = false;
		}
	}

	function onCoverInputChange(ev: Event) {
		const input = ev.target as HTMLInputElement;
		uploadCoverPhoto(input.files);
		input.value = '';
	}

	/* ── UI state ─────────────────────────────────────────── */
	let expandedBedConfig = $state(new Set<string>());
	let editingRoomName = $state(new Set<string>());
	let moreOptionsOpen = $state(false);

	function toggleBedConfig(roomId: string) {
		expandedBedConfig = new Set(expandedBedConfig);
		if (expandedBedConfig.has(roomId)) expandedBedConfig.delete(roomId);
		else expandedBedConfig.add(roomId);
	}

	function startEditName(roomId: string) {
		editingRoomName = new Set(editingRoomName);
		editingRoomName.add(roomId);
	}

	function finishEditName(roomId: string) {
		editingRoomName = new Set(editingRoomName);
		editingRoomName.delete(roomId);
		autosave();
	}

	function getRoomTypeBadge(room: TripDraft['rooms'][number]): string {
		const total = (room.beds ?? []).reduce((s, b) => s + (b.count || 1), 0);
		if (total === 0) return 'New room';
		return total === 1 ? 'Private' : 'Shared';
	}

	function getRoomCapacity(room: TripDraft['rooms'][number]): number {
		const BED_SPOT_COUNTS: Record<string, number> = {
			twin: 1, single: 1, bunk: 2, full: 2, double: 2,
			queen: 2, king: 2, sofa: 2, sofa_bed: 2, air_mattress: 2, other: 1
		};
		return (room.beds ?? []).reduce((s, b) => {
			const key = b.bedType.toLowerCase().replace(/\s+/g, '_');
			return s + (BED_SPOT_COUNTS[key] ?? 1) * (b.count || 1);
		}, 0);
	}
</script>

<div class="rbp">
	<!-- ── Room grid ── -->
	{#if draft.rooms.length > 0}
		<ul class="rbp-grid" aria-label="Rooms">
			{#each draft.rooms as room, idx (room.id)}
				{@const bedQty = bedsAsQtyMap(room.beds)}
				{@const capacity = getRoomCapacity(room)}
				{@const isBedOpen = expandedBedConfig.has(room.id)}
				{@const isNameEditing = editingRoomName.has(room.id)}
				<li class="rbp-card">
					<!-- Photo zone -->
					<div class="rbp-photo-zone" class:rbp-photo-zone--empty={room.photos.length === 0}>
						{#if room.photos.length > 0}
							<img
								src={room.photos[0]}
								alt={getRoomDisplayName(room, idx)}
								class="rbp-photo-cover"
							/>
							<span class="rbp-type-badge">{getRoomTypeBadge(room)}</span>
							<label class="rbp-photo-add-more" title="Add another photo">
								<input
									type="file"
									accept="image/*"
									class="visually-hidden"
									onchange={(e) => onPhotoInputChange(room.id, e)}
									multiple
								/>
								{#if uploadingByRoom[room.id]}
									<span class="rbp-uploading-indicator" aria-label="Uploading..."></span>
								{:else}
									<span aria-hidden="true">+</span>
								{/if}
							</label>
						{:else}
							<label class="rbp-upload-zone" title="Add a photo for this room">
								<input
									type="file"
									accept="image/*"
									class="visually-hidden"
									onchange={(e) => onPhotoInputChange(room.id, e)}
								/>
								{#if uploadingByRoom[room.id]}
									<span class="rbp-upload-spinner" aria-label="Uploading..."></span>
								{:else}
									<svg
										class="rbp-upload-icon"
										width="22" height="22"
										viewBox="0 0 24 24" fill="none"
										stroke="currentColor" stroke-width="1.5"
										stroke-linecap="round" stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
										<circle cx="12" cy="13" r="4"/>
									</svg>
									<span class="rbp-upload-label">Add a photo</span>
								{/if}
							</label>
						{/if}
						{#if uploadErrorByRoom[room.id]}
							<p class="rbp-upload-error">{uploadErrorByRoom[room.id]}</p>
						{/if}
					</div>

					<!-- Room info -->
					<div class="rbp-info">
						<!-- Inline-editable room name -->
						{#if isNameEditing}
							<input
								type="text"
								class="rbp-name-input"
								bind:value={room.name}
								onblur={() => finishEditName(room.id)}
								onkeydown={(e) => e.key === 'Enter' && finishEditName(room.id)}
								placeholder="e.g. Master suite"
								autofocus
							/>
						{:else}
							<button
								type="button"
								class="rbp-name-display"
								onclick={() => startEditName(room.id)}
								title="Click to rename"
							>
								{getRoomDisplayName(room, idx)}
							</button>
						{/if}

						<!-- Bed chips row -->
						<div class="rbp-chips-row">
							{#if bedQty.length > 0}
								{#each bedQty as { bedType, quantity }}
									<span class="rbp-chip">{quantity} {bedType.charAt(0).toUpperCase() + bedType.slice(1)}</span>
								{/each}
								<button
									type="button"
									class="rbp-chip rbp-chip--edit"
									onclick={() => toggleBedConfig(room.id)}
									aria-expanded={isBedOpen}
									title={isBedOpen ? 'Done editing beds' : 'Edit beds'}
								>
									{isBedOpen ? 'Done' : 'Edit'}
								</button>
							{:else}
								<button
									type="button"
									class="rbp-chip rbp-chip--add"
									onclick={() => toggleBedConfig(room.id)}
									aria-expanded={isBedOpen}
								>
									+ Add beds
								</button>
							{/if}
						</div>

						<!-- Expandable bed configuration -->
						{#if isBedOpen}
							<div class="rbp-bed-config" role="group" aria-label="Bed configuration">
								{#each bedTypeOptions as opt}
									{@const qty = getBedQuantity(room.id, opt.value)}
									<div class="rbp-bed-row">
										<span class="rbp-bed-icon" aria-hidden="true">
											{#if opt.iconUrl}
												<img src={opt.iconUrl} alt={opt.label} width="16" height="16" />
											{:else}
												{opt.fallbackIcon}
											{/if}
										</span>
										<span class="rbp-bed-type">{opt.label}</span>
										<div class="rbp-stepper">
											<button
												type="button"
												class="rbp-stepper-btn"
												onclick={() => decrementBed(room.id, opt.value)}
												disabled={qty === 0}
												aria-label={`Remove ${opt.label}`}
											>-</button>
											<span class="rbp-stepper-val">{qty}</span>
											<button
												type="button"
												class="rbp-stepper-btn"
												onclick={() => incrementBed(room.id, opt.value)}
												aria-label={`Add ${opt.label}`}
											>+</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Capacity badge -->
						{#if capacity > 0}
							<p class="rbp-capacity">{capacity} {capacity === 1 ? 'person' : 'people'}</p>
						{/if}
					</div>

					<!-- Card footer -->
					<footer class="rbp-card-footer">
						<button
							type="button"
							class="rbp-remove"
							onclick={() => removeRoom(room.id)}
							aria-label={`Remove ${getRoomDisplayName(room, idx)}`}
						>
							Remove room
						</button>
					</footer>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Add room button -->
	<button type="button" class="rbp-add" onclick={addRoom} aria-label="Add another room">
		<span class="rbp-add-plus" aria-hidden="true">+</span>
		<span class="rbp-add-label">Add room</span>
	</button>

	<!-- More options expander -->
	<div class="rbp-more">
		<button
			type="button"
			class="rbp-more-toggle"
			onclick={() => (moreOptionsOpen = !moreOptionsOpen)}
			aria-expanded={moreOptionsOpen}
		>
			<span class="rbp-more-icon" aria-hidden="true">{moreOptionsOpen ? '−' : '+'}</span>
			More options (cover photo, gallery)
		</button>

		{#if moreOptionsOpen}
			<div class="rbp-more-body">
				<!-- Cover photo -->
				<div class="rbp-more-section">
					<p class="rbp-more-label">Cover photo</p>
					{#if draft.coverPhoto}
						<div class="rbp-cover-preview">
							<img src={draft.coverPhoto} alt="Trip cover" class="rbp-cover-img" />
							<button
								type="button"
								class="rbp-cover-remove"
								onclick={() => { draft.coverPhoto = ''; autosave(); }}
								aria-label="Remove cover photo"
							>Remove</button>
						</div>
					{:else}
						<label class="rbp-cover-zone">
							<input
								type="file"
								accept="image/*"
								class="visually-hidden"
								onchange={onCoverInputChange}
							/>
							{#if uploadingCover}
								<span class="rbp-upload-spinner" aria-label="Uploading..."></span>
							{:else}
								<span class="rbp-cover-zone-text">Upload cover photo</span>
							{/if}
						</label>
					{/if}
					{#if coverError}
						<p class="rbp-upload-error">{coverError}</p>
					{/if}
				</div>

				<!-- Gallery photos placeholder -->
				<div class="rbp-more-section">
					<p class="rbp-more-label">Gallery photos</p>
					<p class="rbp-more-hint">
						Gallery photos can be added after the trip is created, from the trip settings.
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* ── Grid ─────────────────────────────────────────────── */
	.rbp {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.rbp-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	/* ── Card ─────────────────────────────────────────────── */
	.rbp-card {
		border-radius: 14px;
		border: 1px solid var(--border-paper);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		background: white;
		transition: box-shadow 200ms ease;
	}

	.rbp-card:hover {
		box-shadow: 0 4px 16px rgba(29, 77, 78, 0.08);
	}

	/* ── Photo zone ───────────────────────────────────────── */
	.rbp-photo-zone {
		position: relative;
		height: 160px;
		flex-shrink: 0;
		background: var(--surface-faint);
		overflow: hidden;
	}

	.rbp-photo-cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.rbp-type-badge {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background: white;
		color: var(--navy);
		font-size: 0.5625rem;
		font-weight: 600;
		padding: 3px 7px;
		border-radius: 4px;
		pointer-events: none;
	}

	.rbp-photo-add-more {
		position: absolute;
		bottom: 8px;
		right: 8px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		font-weight: 700;
		color: var(--navy);
		cursor: pointer;
		line-height: 1;
	}

	.rbp-photo-add-more input {
		display: none;
	}

	.rbp-upload-zone {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		border: 1.5px dashed var(--border-paper);
		background: var(--surface-faint);
		transition: background 150ms ease;
	}

	.rbp-upload-zone:hover {
		background: var(--border-paper);
	}

	.rbp-upload-icon {
		color: var(--muted);
	}

	.rbp-upload-label {
		font-size: 0.6875rem;
		color: var(--muted);
	}

	.rbp-upload-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--border);
		border-top-color: var(--slate);
		border-radius: 50%;
		animation: rbpSpin 600ms linear infinite;
		display: inline-block;
	}

	@keyframes rbpSpin {
		to { transform: rotate(360deg); }
	}

	.rbp-uploading-indicator {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: white;
		border-radius: 50%;
		animation: rbpSpin 600ms linear infinite;
		display: inline-block;
	}

	.rbp-upload-error {
		position: absolute;
		bottom: 4px;
		left: 6px;
		right: 6px;
		font-size: 0.625rem;
		color: var(--warm);
		background: white;
		padding: 2px 5px;
		border-radius: 4px;
		margin: 0;
	}

	/* ── Room info ────────────────────────────────────────── */
	.rbp-info {
		padding: 12px 14px 4px;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Inline editable name */
	.rbp-name-display {
		background: none;
		border: none;
		border-bottom: 1.5px solid transparent;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		cursor: pointer;
		padding: 2px 0;
		text-align: left;
		transition: border-color 150ms;
		width: 100%;
		min-width: 0;
	}

	.rbp-name-display:hover {
		border-bottom-color: var(--border);
	}

	.rbp-name-input {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		background: none;
		border: none;
		border-bottom: 1.5px solid var(--navy);
		outline: none;
		padding: 2px 0;
		width: 100%;
		font-family: inherit;
	}

	/* Bed chips */
	.rbp-chips-row {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.rbp-chip {
		display: inline-flex;
		align-items: center;
		background: rgba(29, 77, 78, 0.07);
		color: var(--navy);
		border-radius: 999px;
		padding: 3px 10px;
		font-size: 0.6875rem;
		font-family: inherit;
		font-weight: 500;
		border: none;
		cursor: default;
		line-height: 1.4;
	}

	.rbp-chip--edit,
	.rbp-chip--add {
		cursor: pointer;
		background: none;
		border: 1.5px dashed var(--border);
		color: var(--muted);
		font-weight: 500;
	}

	.rbp-chip--edit:hover,
	.rbp-chip--add:hover {
		border-color: var(--navy);
		color: var(--navy);
	}

	/* Bed config expander */
	.rbp-bed-config {
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: var(--surface-faint);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.rbp-bed-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.rbp-bed-icon {
		width: 18px;
		text-align: center;
		flex-shrink: 0;
		line-height: 1;
	}

	.rbp-bed-icon img {
		display: block;
	}

	.rbp-bed-type {
		flex: 1;
		font-size: 0.75rem;
		color: var(--text);
	}

	.rbp-stepper {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.rbp-stepper-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: white;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--navy);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		transition: background 150ms, border-color 150ms;
	}

	.rbp-stepper-btn:hover:not(:disabled) {
		background: var(--navy);
		border-color: var(--navy);
		color: white;
	}

	.rbp-stepper-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.rbp-stepper-val {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
		min-width: 14px;
		text-align: center;
	}

	.rbp-capacity {
		font-size: 0.6875rem;
		color: var(--muted);
		margin: 0;
	}

	/* ── Card footer ──────────────────────────────────────── */
	.rbp-card-footer {
		padding: 8px 14px 12px;
		border-top: 0.5px solid var(--surface-faint);
		display: flex;
		justify-content: flex-end;
		margin-top: auto;
	}

	.rbp-remove {
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.6875rem;
		color: var(--muted);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		padding: 0;
	}

	.rbp-remove:hover {
		color: var(--warm);
	}

	/* ── Add room button ──────────────────────────────────── */
	.rbp-add {
		width: 100%;
		height: 64px;
		border: 1.5px dashed var(--border-paper);
		border-radius: 14px;
		background: none;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		transition: border-color 150ms, background 150ms;
	}

	.rbp-add:hover {
		border-color: var(--warm);
		background: rgba(206, 86, 18, 0.03);
	}

	.rbp-add-plus {
		font-size: 1.375rem;
		color: var(--warm);
		line-height: 1;
	}

	.rbp-add-label {
		font-size: 0.6875rem;
		color: var(--muted);
	}

	/* ── More options expander ────────────────────────────── */
	.rbp-more {
		border-top: 1px solid var(--border-paper);
		padding-top: 12px;
	}

	.rbp-more-toggle {
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.75rem;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 0;
		width: 100%;
		min-height: 44px;
		text-align: left;
	}

	.rbp-more-toggle:hover {
		color: var(--text);
	}

	.rbp-more-icon {
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.rbp-more-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 12px 0 4px;
	}

	.rbp-more-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.rbp-more-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.rbp-more-hint {
		font-size: 0.6875rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}

	.rbp-cover-zone {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		padding: 0 16px;
		border: 1.5px dashed var(--border);
		border-radius: 8px;
		background: var(--surface-faint);
		cursor: pointer;
		font-size: 0.75rem;
		color: var(--muted);
		transition: background 150ms, border-color 150ms;
	}

	.rbp-cover-zone:hover {
		background: var(--border-paper);
		border-color: var(--navy);
	}

	.rbp-cover-zone-text {
		pointer-events: none;
	}

	.rbp-cover-preview {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.rbp-cover-img {
		width: 60px;
		height: 40px;
		object-fit: cover;
		border-radius: 4px;
	}

	.rbp-cover-remove {
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.6875rem;
		color: var(--muted);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		padding: 0;
	}

	.rbp-cover-remove:hover {
		color: var(--warm);
	}

	/* ── Utility ──────────────────────────────────────────── */
	.visually-hidden {
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

	/* ── Mobile ───────────────────────────────────────────── */
	@media (max-width: 580px) {
		.rbp-grid {
			grid-template-columns: 1fr;
		}

		.rbp-photo-zone {
			height: 140px;
		}
	}
</style>
