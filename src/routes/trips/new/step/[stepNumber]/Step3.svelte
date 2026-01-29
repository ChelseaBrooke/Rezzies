<script lang="ts">
	import SectionCard from '$lib/components/wizard/SectionCard.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';

	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();

	// Ensure guests array exists (TripDraft uses `guests`, not `invites`)
	$effect(() => {
		if (!Array.isArray(draft.guests)) {
			draft.guests = [];
		}
	});

	let newEmail = $state('');
	let editingIndex = $state<number | null>(null);
	let editingName = $state('');

	const guests = $derived(draft.guests ?? []);

	function addByEmail() {
		const email = newEmail.trim().toLowerCase();
		if (!email) return;
		const exists = (draft.guests ?? []).some((g) => g.email.toLowerCase() === email);
		if (exists) {
			newEmail = '';
			return;
		}
		if (!draft.guests) draft.guests = [];
		draft.guests = [
			...draft.guests,
			{ email, name: '', role: 'guest' as const }
		];
		newEmail = '';
		autosave();
	}

	function removeGuest(index: number) {
		if (!draft.guests) return;
		draft.guests = draft.guests.filter((_, i) => i !== index);
		editingIndex = null;
		autosave();
	}

	function setRole(index: number, role: 'guest' | 'co-host') {
		if (!draft.guests || !draft.guests[index]) return;
		draft.guests = draft.guests.map((g, i) => (i === index ? { ...g, role } : g));
		autosave();
	}

	function startEditName(index: number) {
		editingIndex = index;
		editingName = draft.guests?.[index]?.name ?? '';
	}

	function saveEditName() {
		if (editingIndex !== null && draft.guests?.[editingIndex] !== undefined) {
			draft.guests = draft.guests.map((g, i) =>
				i === editingIndex ? { ...g, name: editingName.trim() } : g
			);
			autosave();
		}
		editingIndex = null;
		editingName = '';
	}

	function handleEmailKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addByEmail();
		}
	}

	// Placeholder: Rezzies friends list (no backend yet)
	function pickFromRezzies() {
		// TODO: open modal or navigate to contacts when backend exists
		alert('Import from Rezzies friends list is coming soon. Add people by email above for now.');
	}
</script>

<div class="step-content">
	<p class="step-subtitle">Add guests and co-hosts now, or skip and invite people later from the trip page.</p>

	<SectionCard title="Add by email" icon="✉️">
		<div class="add-email-row">
			<input
				type="email"
				bind:value={newEmail}
				onkeydown={handleEmailKeydown}
				placeholder="Enter email address…"
				class="email-input"
			/>
			<button
				type="button"
				class="btn-add"
				onclick={addByEmail}
				disabled={!newEmail.trim()}
			>
				Add
			</button>
		</div>
		<p class="hint">Press Enter or click Add to invite. You can add a name and role for each person below.</p>

		{#if guests.length > 0}
			<div class="guests-list">
				{#each guests as guest, index (guest.email)}
					<div class="guest-chip">
						{#if editingIndex === index}
							<div class="chip-edit">
								<input
									type="text"
									bind:value={editingName}
									placeholder="Name (optional)"
									class="name-input"
									onkeydown={(e) => e.key === 'Enter' && saveEditName()}
									onblur={saveEditName}
								/>
								<button type="button" class="btn-save-name" onclick={saveEditName}>Save</button>
							</div>
						{:else}
							<span class="chip-main">
								{#if guest.name}
									<span class="chip-name">{guest.name}</span>
									<span class="chip-email">{guest.email}</span>
								{:else}
									<span class="chip-email-only">{guest.email}</span>
								{/if}
							</span>
							<button
								type="button"
								class="chip-edit-btn"
								onclick={() => startEditName(index)}
								title="Add or edit name"
							>
								{guest.name ? 'Edit name' : 'Add name'}
							</button>
							<div class="chip-role">
								<button
									type="button"
									class="role-pill"
									class:active={guest.role === 'guest'}
									onclick={() => setRole(index, 'guest')}
								>
									Guest
								</button>
								<button
									type="button"
									class="role-pill"
									class:active={guest.role === 'co-host'}
									onclick={() => setRole(index, 'co-host')}
								>
									Co-host
								</button>
							</div>
							<button
								type="button"
								class="chip-remove"
								onclick={() => removeGuest(index)}
								title="Remove"
							>
								×
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</SectionCard>

	<SectionCard title="From Rezzies" icon="👋">
		<p class="rezzies-desc">Import people you’ve traveled with before from your Rezzies friends list.</p>
		<button type="button" class="btn-rezzies" onclick={pickFromRezzies}>
			Pick from contacts
		</button>
		<p class="rezzies-note">Coming soon. Use the email field above to add guests for now.</p>
	</SectionCard>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.step-subtitle {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0 0 0.25rem 0;
		line-height: 1.5;
	}

	.add-email-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.email-input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-family: inherit;
		background: white;
		color: var(--text);
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.email-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}

	.email-input::placeholder {
		color: var(--muted);
	}

	.btn-add {
		padding: 0.75rem 1.25rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.2s;
	}

	.btn-add:hover:not(:disabled) {
		background: var(--primary-dark);
	}

	.btn-add:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hint {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
	}

	.guests-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.guest-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0.5rem 0.75rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.chip-main {
		display: inline-flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.chip-name {
		font-weight: 500;
		color: var(--text);
	}

	.chip-email,
	.chip-email-only {
		color: var(--muted);
		font-size: 0.8125rem;
	}

	.chip-email-only {
		color: var(--text);
		font-size: 0.875rem;
	}

	.chip-edit {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.name-input {
		width: 10rem;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.btn-save-name {
		padding: 0.375rem 0.75rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.chip-edit-btn {
		padding: 0.25rem 0.5rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.75rem;
		color: var(--muted);
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s;
	}

	.chip-edit-btn:hover {
		color: var(--primary);
		border-color: var(--primary);
	}

	.chip-role {
		display: flex;
		gap: 0.25rem;
	}

	.role-pill {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 9999px;
		font-size: 0.75rem;
		background: white;
		color: var(--muted);
		cursor: pointer;
		transition: all 0.2s;
	}

	.role-pill:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.role-pill.active {
		background: rgba(30, 58, 138, 0.1);
		border-color: var(--primary);
		color: var(--primary);
	}

	.chip-remove {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--muted);
		font-size: 1.125rem;
		line-height: 1;
		cursor: pointer;
		border-radius: 0.25rem;
		margin-left: 0.25rem;
		transition: color 0.2s, background 0.2s;
	}

	.chip-remove:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}

	/* Rezzies section */
	.rezzies-desc {
		font-size: 0.9375rem;
		color: var(--text);
		margin: 0 0 1rem 0;
		line-height: 1.5;
	}

	.btn-rezzies {
		padding: 0.75rem 1.25rem;
		background: white;
		color: var(--primary);
		border: 1px solid var(--primary);
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s, color 0.2s;
	}

	.btn-rezzies:hover {
		background: rgba(30, 58, 138, 0.08);
	}

	.rezzies-note {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 1rem 0 0 0;
	}

	@media (max-width: 768px) {
		.add-email-row {
			flex-direction: column;
			align-items: stretch;
		}

		.btn-add {
			width: 100%;
		}

		.guest-chip {
			width: 100%;
		}
	}
</style>
