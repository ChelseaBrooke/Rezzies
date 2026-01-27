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
	<h1 class="step-title">Invites</h1>
	<p class="step-subtitle">Invite guests now or send invites later from the trip management page</p>
	
	<div class="invites-form">
		<!-- Invite Now or Later -->
		<div class="form-section">
			<label class="section-label">When to send invites?</label>
			<div class="invite-options">
				<label class="invite-option">
					<input
						type="radio"
						name="inviteNow"
						value="true"
						bind:group={formData.inviteNow}
					/>
					<span class="option-content">
						<span class="option-label">Invite Now</span>
						<span class="option-description">Send invites immediately after creating the trip</span>
					</span>
				</label>
				<label class="invite-option">
					<input
						type="radio"
						name="inviteNow"
						value="false"
						bind:group={formData.inviteNow}
					/>
					<span class="option-content">
						<span class="option-label">Invite Later</span>
						<span class="option-description">I'll send invites from the trip management page</span>
					</span>
				</label>
			</div>
		</div>
		
		{#if formData.inviteNow === 'true' || formData.inviteNow === true}
			<!-- Email Input -->
			<div class="form-section">
				<label for="emailInput" class="section-label">Guest Email Addresses</label>
				<div class="email-input-group">
					<input
						type="email"
						id="emailInput"
						bind:value={newEmail}
						onkeydown={handleEmailKeydown}
						placeholder="Enter email address and press Enter"
						class="email-input"
					/>
					<button
						type="button"
						class="btn btn-secondary"
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
				<label for="inviteMessage" class="section-label">Invite Message (Optional)</label>
				<textarea
					id="inviteMessage"
					bind:value={formData.inviteMessage}
					rows="4"
					placeholder="Add a personal message to your invites..."
					class="message-textarea"
				></textarea>
			</div>
		{/if}
		
		<div class="info-box">
			<p>
				<strong>Note:</strong> You can always add more guests later from the trip management page.
				Each guest will receive a unique invite link to access their trip details.
			</p>
		</div>
	</div>
	
	<div class="step-actions">
		<button type="button" class="btn btn-secondary" onclick={prevStep}>
			← Back
		</button>
		<button type="button" class="btn btn-primary" onclick={nextStep}>
			Review & Create →
		</button>
	</div>
</div>

<style>
	.invites-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}
	
	.section-label {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}
	
	.invite-options {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}
	
	.invite-option {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: all var(--transition-base);
		background: white;
	}
	
	.invite-option:hover {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.02);
	}
	
	.invite-option input[type="radio"] {
		margin-top: 2px;
		accent-color: var(--color-primary);
	}
	
	.option-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}
	
	.option-label {
		font-weight: 600;
		font-size: 1.125rem;
		color: var(--color-text);
	}
	
	.option-description {
		font-size: 0.95rem;
		color: var(--color-text-light);
	}
	
	.email-input-group {
		display: flex;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-md);
	}
	
	.email-input {
		flex: 1;
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-family: inherit;
	}
	
	.email-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}
	
	.emails-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-md);
	}
	
	.email-tag {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		background: var(--color-primary);
		color: white;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.95rem;
	}
	
	.remove-email-btn {
		background: rgba(255, 255, 255, 0.3);
		border: none;
		color: white;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.remove-email-btn:hover {
		background: rgba(255, 255, 255, 0.5);
	}
	
	.message-textarea {
		width: 100%;
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-family: inherit;
		resize: vertical;
	}
	
	.message-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}
	
	.info-box {
		background: rgba(37, 99, 235, 0.05);
		border-left: 4px solid var(--color-primary);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		margin-top: var(--spacing-md);
	}
	
	.info-box p {
		color: var(--color-text);
		line-height: 1.7;
		margin: 0;
	}
</style>
