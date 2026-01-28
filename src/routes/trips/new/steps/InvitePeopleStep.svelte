<script lang="ts">
	interface Props {
		formData: any;
		nextStep: () => void;
		prevStep: () => void;
	}
	
	let { formData, nextStep, prevStep }: Props = $props();
	
	let newEmail = $state('');
	
	if (!formData.inviteEmails) {
		formData.inviteEmails = [];
	}
	
	function addEmail() {
		const email = newEmail.trim();
		if (email && !formData.inviteEmails.includes(email)) {
			formData.inviteEmails = [...formData.inviteEmails, email];
			newEmail = '';
		}
	}
	
	function removeEmail(email: string) {
		formData.inviteEmails = formData.inviteEmails.filter((e: string) => e !== email);
	}
	
	function handleEmailKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addEmail();
		}
	}
</script>

<div class="step-content">
	<h1 class="step-title">Invite People</h1>
	<p class="step-subtitle">You can skip this step and invite people later</p>
	
	<div class="invites-form">
		<!-- Email Input -->
		<div class="form-section">
			<label class="section-label">Guest Email Addresses</label>
			<div class="email-input-group">
				<input
					type="email"
					bind:value={newEmail}
					onkeydown={handleEmailKeydown}
					placeholder="Enter email address and press Enter"
					class="form-input"
				/>
				<button
					type="button"
					class="add-email-btn"
					onclick={addEmail}
					disabled={!newEmail.trim()}
				>
					Add
				</button>
			</div>
			
			{#if formData.inviteEmails.length > 0}
				<div class="emails-list">
					{#each formData.inviteEmails as email}
						<div class="email-tag">
							<span>{email}</span>
							<button
								type="button"
								class="remove-email-btn"
								onclick={() => removeEmail(email)}
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		
		<!-- Optional Message -->
		<div class="form-section">
			<label class="section-label">Invite Message (Optional)</label>
			<textarea
				bind:value={formData.inviteMessage}
				rows="4"
				placeholder="Add a personal message to your invites..."
				class="form-textarea"
			></textarea>
		</div>
		
		<div class="info-text">
			<p>You can always add more guests later from the trip management page.</p>
		</div>
	</div>
	
	<div class="step-actions">
		<button type="button" class="btn-secondary" onclick={prevStep}>
			Back
		</button>
		<div>
			<button type="button" class="btn-secondary" onclick={nextStep}>
				Skip
			</button>
			<button type="button" class="btn-primary" onclick={nextStep}>
				Continue
			</button>
		</div>
	</div>
</div>

<style>
	.step-title {
		font-size: 3rem;
		font-weight: 700;
		margin-bottom: 1rem;
		color: #000;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	
	.step-subtitle {
		font-size: 1rem;
		color: rgba(0, 0, 0, 0.5);
		margin-bottom: 3rem;
	}
	
	.form-section {
		margin-bottom: 2.5rem;
	}
	
	.section-label {
		font-size: 0.875rem;
		color: rgba(0, 0, 0, 0.5);
		font-weight: 400;
		margin-bottom: 0.75rem;
		display: block;
	}
	
	.email-input-group {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.form-input {
		flex: 1;
		padding: 1rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-size: 1.125rem;
		font-family: inherit;
		background: transparent;
		color: #000;
		transition: border-color 0.2s ease;
	}
	
	.form-input:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.form-input::placeholder {
		color: rgba(0, 0, 0, 0.3);
		font-weight: 400;
	}
	
	.add-email-btn {
		padding: 0.75rem 1.5rem;
		background: #000;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.2s ease;
	}
	
	.add-email-btn:hover:not(:disabled) {
		background: #333;
	}
	
	.add-email-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	
	.emails-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	
	.email-tag {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(0, 0, 0, 0.05);
		color: rgba(0, 0, 0, 0.8);
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.95rem;
	}
	
	.remove-email-btn {
		background: rgba(0, 0, 0, 0.1);
		border: none;
		color: rgba(0, 0, 0, 0.6);
		width: 20px;
		height: 20px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	
	.remove-email-btn:hover {
		background: rgba(0, 0, 0, 0.2);
		color: rgba(0, 0, 0, 0.8);
	}
	
	.form-textarea {
		width: 100%;
		padding: 1rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-size: 1rem;
		font-family: inherit;
		background: transparent;
		color: #000;
		resize: none;
		transition: border-color 0.2s ease;
		line-height: 1.6;
	}
	
	.form-textarea:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.form-textarea::placeholder {
		color: rgba(0, 0, 0, 0.3);
	}
	
	.info-text {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.info-text p {
		color: rgba(0, 0, 0, 0.5);
		font-size: 0.95rem;
		margin: 0;
	}
	
	.step-actions {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 4rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.step-actions > div {
		display: flex;
		gap: 1rem;
	}
	
	.btn-primary,
	.btn-secondary {
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.2s ease;
		border: none;
	}
	
	.btn-primary {
		background: #000;
		color: white;
	}
	
	.btn-primary:hover {
		background: #333;
	}
	
	.btn-secondary {
		background: transparent;
		color: rgba(0, 0, 0, 0.6);
	}
	
	.btn-secondary:hover {
		color: rgba(0, 0, 0, 0.8);
	}
</style>
