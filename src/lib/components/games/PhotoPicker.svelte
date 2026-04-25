<script lang="ts">
	interface Props {
		open: boolean;
		/** Label shown in the sheet header describing what we're filling (e.g. cell label / letter) */
		label?: string;
		/** Emoji shown alongside the label */
		icon?: string;
		onSelect: (dataUrl: string, file: File) => void;
		onClose: () => void;
	}

	let { open, label = '', icon = '📸', onSelect, onClose }: Props = $props();

	let fileInputRef = $state<HTMLInputElement | null>(null);
	let cameraInputRef = $state<HTMLInputElement | null>(null);
	let previewUrl = $state<string | null>(null);
	let pendingFile = $state<File | null>(null);

	function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !file.type.startsWith('image/')) return;
		pendingFile = file;
		const reader = new FileReader();
		reader.onload = () => { previewUrl = reader.result as string; };
		reader.readAsDataURL(file);
	}

	function confirmPhoto() {
		if (!previewUrl || !pendingFile) return;
		onSelect(previewUrl, pendingFile);
		reset();
	}

	function retry() {
		previewUrl = null;
		pendingFile = null;
	}

	function reset() {
		previewUrl = null;
		pendingFile = null;
	}

	function handleBackdropClick() {
		reset();
		onClose();
	}

	$effect(() => {
		if (!open) reset();
	});
</script>

{#if open}
	<!-- Backdrop -->
	<div class="pp-backdrop" role="presentation" onclick={handleBackdropClick}></div>

	<!-- Hidden file inputs -->
	<input
		type="file"
		accept="image/*"
		capture="environment"
		class="pp-hidden-input"
		aria-hidden="true"
		tabindex="-1"
		bind:this={cameraInputRef}
		onchange={handleFileChange}
	/>
	<input
		type="file"
		accept="image/*"
		class="pp-hidden-input"
		aria-hidden="true"
		tabindex="-1"
		bind:this={fileInputRef}
		onchange={handleFileChange}
	/>

	<!-- Sheet -->
	<div class="pp-sheet" role="dialog" aria-modal="true" aria-label="Add a photo">
		<div class="pp-handle" aria-hidden="true"></div>

		{#if label}
			<div class="pp-header">
				<span class="pp-icon" aria-hidden="true">{icon}</span>
				<span class="pp-label">{label}</span>
			</div>
		{/if}

		{#if previewUrl}
			<div class="pp-preview-wrap">
				<img class="pp-preview-img" src={previewUrl} alt="Preview" />
			</div>
			<div class="pp-actions">
				<button type="button" class="pp-btn pp-btn-confirm" onclick={confirmPhoto}>
					Use this photo →
				</button>
				<button type="button" class="pp-btn pp-btn-retry" onclick={retry}>
					Try again
				</button>
			</div>
		{:else}
			<div class="pp-actions">
				<button type="button" class="pp-btn pp-btn-camera" onclick={() => cameraInputRef?.click()}>
					<span class="pp-btn-icon" aria-hidden="true">📷</span>
					<span class="pp-btn-label">Take a photo</span>
					<span class="pp-btn-hint">Use your camera</span>
				</button>
				<button type="button" class="pp-btn pp-btn-gallery" onclick={() => fileInputRef?.click()}>
					<span class="pp-btn-icon" aria-hidden="true">🖼</span>
					<span class="pp-btn-label">Choose from gallery</span>
					<span class="pp-btn-hint">Pick an existing photo</span>
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.pp-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.42);
		z-index: 200;
	}

	.pp-hidden-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.pp-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 201;
		background: white;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
		padding: 0 16px 32px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		animation: pp-slide-up 0.2s ease-out;
	}

	@keyframes pp-slide-up {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	.pp-handle {
		width: 32px;
		height: 4px;
		background: #d1d5db;
		border-radius: 999px;
		margin: 10px auto 2px;
		flex-shrink: 0;
	}

	.pp-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0 2px;
	}

	.pp-icon {
		font-size: 20px;
	}

	.pp-label {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1d4d4e;
	}

	.pp-preview-wrap {
		border-radius: 10px;
		overflow: hidden;
		max-height: 220px;
	}

	.pp-preview-img {
		width: 100%;
		height: 180px;
		object-fit: cover;
		display: block;
	}

	.pp-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.pp-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 52px;
		padding: 10px 16px;
		border-radius: 12px;
		border: 1.5px solid #e2e8f0;
		background: white;
		cursor: pointer;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		transition: background 0.12s, border-color 0.12s;
		text-align: left;
	}

	.pp-btn:hover {
		background: #f8fafc;
		border-color: #2f7778;
	}

	.pp-btn-icon {
		font-size: 22px;
		flex-shrink: 0;
	}

	.pp-btn-label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1d4d4e;
		flex: 1;
	}

	.pp-btn-hint {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.pp-btn-confirm {
		background: #2f7778;
		border-color: #2f7778;
		color: white;
		justify-content: center;
		font-weight: 700;
		font-size: 0.9375rem;
	}

	.pp-btn-confirm:hover {
		background: #1d6566;
		border-color: #1d6566;
		color: white;
	}

	.pp-btn-retry {
		justify-content: center;
		color: #64748b;
	}

	/* Desktop: small centered modal */
	@media (min-width: 640px) {
		.pp-backdrop {
			z-index: 200;
		}

		.pp-sheet {
			position: fixed;
			bottom: auto;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			right: auto;
			width: 360px;
			border-radius: 16px;
			box-shadow: 0 8px 40px rgba(0, 0, 0, 0.16);
			animation: pp-scale-in 0.18s ease-out;
		}

		@keyframes pp-scale-in {
			from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
			to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
		}
	}
</style>
