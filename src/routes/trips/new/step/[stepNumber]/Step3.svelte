<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	// Initialize invites if they don't exist
	if (!draft.invites) {
		draft.invites = [];
	}
	
	function addInvite() {
		if (!draft.invites) draft.invites = [];
		draft.invites = [
			...draft.invites,
			{ id: crypto.randomUUID(), email: '', name: '', role: 'guest' }
		];
		autosave();
	}
	
	function removeInvite(index: number) {
		if (!draft.invites) return;
		draft.invites = draft.invites.filter((_, i) => i !== index);
		autosave();
	}
</script>

<div class="step-content">
	<div class="section-header">
		<h2>Invite People</h2>
		<p class="section-description">Add guests and co-hosts to your trip</p>
	</div>
	
	<div class="invites-list">
		{#if draft.guests && draft.guests.length > 0}
			{#each draft.guests as invite, index}
				<div class="invite-card">
					<div class="invite-header">
						<span class="invite-number">Person {index + 1}</span>
						<button type="button" class="btn-remove" onclick={() => removeInvite(index)}>
							×
						</button>
					</div>
					<div class="invite-form">
						<div class="form-row">
							<div class="form-group">
								<label>Name</label>
								<input
									type="text"
									bind:value={invite.name}
									oninput={autosave}
									placeholder="Full name"
								/>
							</div>
							<div class="form-group">
								<label>Email *</label>
								<input
									type="email"
									bind:value={invite.email}
									oninput={autosave}
									placeholder="email@example.com"
									required
								/>
							</div>
						</div>
						<div class="form-group">
							<label>Role</label>
							<select bind:value={invite.role} onchange={autosave}>
								<option value="guest">Guest</option>
								<option value="co-host">Co-Host</option>
							</select>
						</div>
					</div>
				</div>
			{/each}
		{/if}
		<button type="button" class="btn-add-item" onclick={addInvite}>
			+ Add Person
		</button>
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	
	.section-header {
		margin-bottom: 1rem;
	}
	
	.section-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.5rem 0;
	}
	
	.section-description {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	
	.invites-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.invite-card {
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 1.5rem;
		background: #fafafa;
	}
	
	.invite-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.invite-number {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}
	
	.btn-remove {
		width: 1.75rem;
		height: 1.75rem;
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 0;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	
	.btn-remove:hover {
		background: #ef4444;
		color: white;
		border-color: #ef4444;
	}
	
	.invite-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
	}
	
	.form-group input,
	.form-group select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		transition: all 0.2s ease;
		width: 100%;
	}
	
	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.btn-add-item {
		padding: 0.75rem 1.5rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.9375rem;
		font-weight: 500;
		transition: background 0.2s ease;
		width: 100%;
		margin-top: 0.5rem;
	}
	
	.btn-add-item:hover {
		background: var(--primary-dark);
	}
	
	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
