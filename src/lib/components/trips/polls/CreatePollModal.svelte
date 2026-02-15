<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PollCategory } from './types.js';
	import { POLL_CATEGORIES } from './types.js';

	interface Props {
		open: boolean;
		onClose: () => void;
		/** Form action URL to POST to (e.g. /trips/xxx/polls?/create) */
		formAction: string;
		onSuccess?: () => void;
		error?: string | null;
	}

	export interface CreatePollFormData {
		title: string;
		description: string;
		category: PollCategory;
		pollType: 'single' | 'multi';
		options: string[];
		durationHours: number;
		showResultsLive: boolean;
	}

	let {
		open,
		onClose,
		formAction,
		onSuccess,
		error = null
	}: Props = $props();

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	let title = $state('');
	let description = $state('');
	let category = $state<PollCategory>('Other');
	let pollType = $state<'single' | 'multi'>('single');
	let options = $state<string[]>(['', '']);
	let durationHours = $state(48);
	let showResultsLive = $state(true);
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			title = '';
			description = '';
			category = 'Other';
			pollType = 'single';
			options = ['', ''];
			durationHours = 48;
			showResultsLive = true;
		}
	});

	const categoriesForSelect = $derived(POLL_CATEGORIES.filter((c) => c !== 'All'));

	function addOption() {
		options = [...options, ''];
	}

	function removeOption(i: number) {
		if (options.length <= 2) return;
		options = options.filter((_, idx) => idx !== i);
	}

	function updateOption(i: number, v: string) {
		options = options.map((o, idx) => (idx === i ? v : o));
	}
</script>

{#if open}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-poll-title"
		onclick={onClose}
	>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2 id="create-poll-title" class="modal-title">Create Poll</h2>
				<button type="button" class="modal-close" onclick={onClose} aria-label="Close">×</button>
			</div>
			<div class="modal-body">
				{#if error}
					<p class="form-error" role="alert">{error}</p>
				{/if}
				<form
					class="create-form"
					method="POST"
					action={formAction}
					use:enhance={() => {
						submitting = true;
						return async ({ result, update }) => {
							await update();
							submitting = false;
							if (result.type === 'success' && result.data?.createSuccess) {
								onSuccess?.();
								onClose();
							}
						};
					}}
				>
					<div class="form-group">
						<label for="poll-title">Title <span class="required">*</span></label>
						<input
							id="poll-title"
							name="title"
							type="text"
							bind:value={title}
							placeholder="e.g. Where should we have dinner Friday?"
							maxlength="500"
							required
						/>
					</div>
					<div class="form-group">
						<label for="poll-desc">Description (optional)</label>
						<textarea
							id="poll-desc"
							name="description"
							bind:value={description}
							rows="2"
							placeholder="Add more context..."
						></textarea>
					</div>
					<div class="form-group">
						<label for="poll-category">Category <span class="required">*</span></label>
						<select id="poll-category" name="category" bind:value={category}>
							{#each categoriesForSelect as c}
								<option value={c}>{c}</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label>Poll Type</label>
						<div class="radio-group">
							<label class="radio-label">
								<input type="radio" name="pollType" bind:group={pollType} value="single" />
								Single choice
							</label>
							<label class="radio-label">
								<input type="radio" name="pollType" bind:group={pollType} value="multi" />
								Multiple choice
							</label>
						</div>
					</div>
					<input type="hidden" name="options" value={options.map((o) => o.trim()).filter(Boolean).join('\n')} />
					<div class="form-group">
						<label>Options <span class="required">*</span> (min 2)</label>
						{#each options as opt, i}
							<div class="option-row">
								<input
									type="text"
									value={opt}
									oninput={(e) => updateOption(i, (e.target as HTMLInputElement).value)}
									placeholder="Option {i + 1}"
									class="option-input"
								/>
								<button
									type="button"
									class="btn-remove-opt"
									onclick={() => removeOption(i)}
									disabled={options.length <= 2}
									aria-label="Remove option"
								>
									×
								</button>
							</div>
						{/each}
						<button type="button" class="btn-add-opt" onclick={addOption}>
							+ Add option
						</button>
					</div>
					<div class="form-group">
						<label for="poll-duration">Duration</label>
						<select id="poll-duration" name="durationHours" bind:value={durationHours}>
							<option value={24}>24 hours</option>
							<option value={48}>48 hours</option>
							<option value={72}>72 hours</option>
						</select>
					</div>
					<div class="form-group checkbox-group">
						<label class="checkbox-label">
							<input type="checkbox" name="showResultsLive" value="1" bind:checked={showResultsLive} />
							Show results live (guests see counts as they vote)
						</label>
					</div>
					<div class="form-actions">
						<button type="submit" class="btn-primary" disabled={submitting}>
							{submitting ? 'Creating…' : 'Create poll'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}
	.modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border-soft);
		max-width: 480px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-soft);
		flex-shrink: 0;
	}
	.modal-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
	}
	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-md);
	}
	.modal-close:hover {
		color: var(--text);
		background: var(--surface2);
	}
	.modal-body {
		padding: 1rem 1.25rem;
		overflow-y: auto;
		min-height: 0;
	}
	.form-error {
		font-size: 0.875rem;
		color: var(--danger);
		margin: 0 0 1rem 0;
	}
	.create-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.35rem;
	}
	.required {
		color: var(--danger);
	}
	.form-group input[type='text'],
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-strong);
		font-size: 0.9375rem;
	}
	.radio-group {
		display: flex;
		gap: 1rem;
	}
	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 400;
		cursor: pointer;
	}
	.option-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.option-input {
		flex: 1;
	}
	.btn-remove-opt {
		width: 2.5rem;
		flex-shrink: 0;
		background: var(--surface2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--muted);
		cursor: pointer;
		font-size: 1.25rem;
	}
	.btn-remove-opt:hover:not(:disabled) {
		color: var(--danger);
	}
	.btn-remove-opt:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-add-opt {
		padding: 0.35rem 0.5rem;
		font-size: 0.875rem;
		background: none;
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		color: var(--muted);
		cursor: pointer;
	}
	.btn-add-opt:hover {
		color: var(--primary);
		border-color: var(--primary);
	}
	.checkbox-group label {
		font-weight: 400;
	}
	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		cursor: pointer;
	}
	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-soft);
	}
	.btn-primary {
		padding: 0.5rem 1.25rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		cursor: pointer;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--primaryHover);
	}
	.btn-primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.btn-secondary {
		padding: 0.5rem 1rem;
		background: var(--surface2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
	}
	.btn-secondary:hover:not(:disabled) {
		background: var(--surface);
	}
</style>
