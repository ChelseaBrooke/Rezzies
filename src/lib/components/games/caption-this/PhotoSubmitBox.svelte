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

	function triggerUpload() {
		if (disabled || uploading) return;
		inputEl?.click();
	}

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

<input
	type="file"
	accept="image/*"
	class="hidden"
	aria-hidden="true"
	bind:this={inputEl}
	onchange={handleFile}
/>

{#if photoUrl}
	<div class="polaroid">
		<div class="polaroid-inner">
			<img src={photoUrl} alt="Round photo" class="photo-img" />
		</div>
	</div>
{:else}
	<button
		type="button"
		class="empty-state"
		class:disabled
		class:uploading
		onclick={triggerUpload}
		disabled={disabled || uploading}
	>
		<span class="empty-state-icon" aria-hidden="true">📷</span>
		<span class="empty-state-text">
			{uploading ? 'Uploading…' : 'Click to submit the first photo'}
		</span>
	</button>
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
	.hidden {
		position: absolute;
		width: 0.1px;
		height: 0.1px;
		opacity: 0;
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
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 200px;
		width: 100%;
		padding: 2rem;
		background: var(--surface2, #f5f5f5);
		border: 2px dashed var(--border, #ccc);
		border-radius: 12px;
		cursor: pointer;
		transition: border-color 0.2s, background 0.2s;
		font: inherit;
		color: var(--text, #1a1a1a);
	}
	.empty-state:hover:not(:disabled):not(.uploading) {
		border-color: var(--primary, #e85d04);
		background: rgba(232, 93, 4, 0.06);
	}
	.empty-state.disabled,
	.empty-state:disabled {
		cursor: not-allowed;
		opacity: 0.7;
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
