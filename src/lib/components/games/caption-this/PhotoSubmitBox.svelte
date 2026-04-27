<script lang="ts">
	type Props = {
		photoUrl: string | null;
		roundId: string;
		disabled?: boolean;
		onPhotoSubmitted?: () => void;
		activeTabId?: string | null;
	};
	let { photoUrl = null, roundId, disabled = false, onPhotoSubmitted, activeTabId = null }: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);
	let uploading = $state(false);
	let error = $state<string | null>(null);
	let pendingDataUrl = $state<string | null>(null);

	function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !file.type.startsWith('image/')) return;
		error = null;
		const reader = new FileReader();
		reader.onload = () => {
			pendingDataUrl = reader.result as string;
			uploading = true;
			setTimeout(() => {
				formEl?.requestSubmit();
			}, 0);
		};
		reader.readAsDataURL(file);
	}

	function handleFormSubmit() {
		uploading = false;
		pendingDataUrl = null;
		onPhotoSubmitted?.();
	}
</script>

<form
	method="POST"
	action="?/submitPhoto"
	bind:this={formEl}
	onsubmit={handleFormSubmit}
	class="hidden-form"
>
	<input type="hidden" name="roundId" value={roundId} />
	<input type="hidden" name="photoUrl" value={pendingDataUrl ?? ''} />
	{#if activeTabId}
		<input type="hidden" name="activeTab" value={activeTabId} />
	{/if}
</form>

{#if photoUrl}
	<div class="polaroid">
		<div class="polaroid-inner">
			<img src={photoUrl} alt="Round photo" class="photo-img" />
		</div>
	</div>
{:else}
	<!-- Full card is the hit target: invisible file input covers the label surface -->
	<label
		class="empty-state"
		class:state-disabled={disabled}
		class:state-uploading={uploading}
	>
		<input
			type="file"
			accept="image/*"
			class="empty-file-overlay"
			bind:this={inputEl}
			onchange={handleFile}
			disabled={disabled || uploading}
			aria-label="Add a picture to start the round"
		/>
		<span class="empty-state-content">
			<span class="empty-state-icon" aria-hidden="true">📷</span>
			<span class="empty-state-text">
				{uploading ? 'Uploading…' : 'Click or tap anywhere in this area to add a picture'}
			</span>
		</span>
	</label>
{/if}
{#if error}
	<p class="error">{error}</p>
{/if}

<style>
	.hidden-form {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
	}
	.polaroid {
		display: inline-block;
		padding: 0.75rem 0.75rem 2.5rem 0.75rem;
		background: #fff;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.08),
			0 8px 24px rgba(0, 0, 0, 0.06);
		border-radius: 2px;
		max-width: 100%;
	}
	.polaroid-inner {
		overflow: hidden;
		border-radius: 1px;
		line-height: 0;
	}
	.photo-img {
		width: 100%;
		height: auto;
		display: block;
		max-height: 40vh;
		object-fit: contain;
		vertical-align: middle;
	}
	.empty-state {
		--_pad: 2rem;
		display: block;
		position: relative;
		box-sizing: border-box;
		min-height: 200px;
		width: 100%;
		padding: var(--_pad);
		background: var(--surface2, #f5f5f5);
		border: 2px dashed var(--border, #ccc);
		border-radius: 12px;
		cursor: pointer;
		transition: border-color 0.2s, background 0.2s, opacity 0.2s;
		font: inherit;
		color: var(--text, #1a1a1a);
	}
	.empty-file-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0.001;
		cursor: pointer;
		z-index: 2;
	}
	.empty-state-content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		text-align: center;
		pointer-events: none;
		min-height: calc(200px - 2 * var(--_pad));
	}
	.empty-state:not(:has(.empty-file-overlay:disabled)):hover,
	.empty-state:has(.empty-file-overlay:hover:not(:disabled)) {
		border-color: var(--primary, #e85d04);
		background: rgba(232, 93, 4, 0.06);
	}
	.empty-state:has(.empty-file-overlay:disabled) {
		cursor: not-allowed;
	}
	.state-disabled,
	.state-uploading,
	.empty-state:has(.empty-file-overlay:disabled) {
		opacity: 0.7;
	}
	.state-disabled .empty-file-overlay,
	.state-uploading .empty-file-overlay {
		cursor: not-allowed;
	}
	.empty-state-icon {
		font-size: 2.5rem;
		opacity: 0.8;
	}
	.empty-state-text {
		font-size: 0.9375rem;
		color: var(--muted, #666);
		text-align: center;
	}
	.error {
		font-size: 0.875rem;
		color: var(--error, #c00);
		margin: 0.5rem 0 0 0;
	}
</style>
