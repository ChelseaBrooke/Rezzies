<script lang="ts">
	import MarketingShell from '$lib/components/MarketingShell.svelte';
	import type { PageData } from './$types';

	let { data } = $props();
	let inviteCode = $state('');
</script>

<MarketingShell user={data?.user}>
	<div class="marketing-container">
		<div class="marketing-card find-hero">
			<h1 class="marketing-page-title">Find a Trip</h1>
			<p class="marketing-page-subtitle">Enter your invite code to access your trip's room selection</p>

			<form
				class="find-form"
				method="GET"
				action="/trip"
				onsubmit={(e) => {
					if (!inviteCode.trim()) {
						e.preventDefault();
					}
				}}
			>
				<div class="form-field">
					<label for="code">Invite code</label>
					<input
						type="text"
						id="code"
						name="code"
						bind:value={inviteCode}
						placeholder="e.g. ABC123"
						required
						maxlength="6"
						style="text-transform: uppercase;"
					/>
					<small>Your host should have sent you a unique invite code</small>
				</div>
				<button type="submit" class="find-submit">Access Trip</button>
			</form>
		</div>

		<section class="marketing-card how-it-works">
			<h2 class="section-heading">How it works</h2>
			<div class="steps">
				<div class="step">
					<div class="step-num">1</div>
					<div class="step-body">
						<h4>Get your invite code</h4>
						<p>Your trip host will send you a unique invite code via email or message.</p>
					</div>
				</div>
				<div class="step">
					<div class="step-num">2</div>
					<div class="step-body">
						<h4>Enter code here</h4>
						<p>Type your invite code in the field above to access your trip's room selection page.</p>
					</div>
				</div>
				<div class="step">
					<div class="step-num">3</div>
					<div class="step-body">
						<h4>Reserve your room</h4>
						<p>Browse available rooms and beds, then reserve your preferred accommodations.</p>
					</div>
				</div>
			</div>
		</section>
	</div>
</MarketingShell>

<style>
	.find-hero {
		max-width: 500px;
		margin-left: auto;
		margin-right: auto;
	}

	.find-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-top: 1rem;
	}
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.form-field label {
		font-size: 0.875rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.95);
	}
	.form-field input {
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.12);
		color: white;
	}
	.form-field input::placeholder {
		color: rgba(255, 255, 255, 0.5);
	}
	.form-field input:focus {
		outline: none;
		border-color: rgba(255, 255, 255, 0.5);
		background: rgba(255, 255, 255, 0.15);
	}
	.form-field small {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.65);
	}
	.find-submit {
		padding: 0.875rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: var(--copper, #bf4e30);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
	}
	.find-submit:hover {
		background: var(--primaryHover, #a03d24);
	}

	.section-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: #fffbf7;
		margin: 0 0 1.5rem 0;
		text-align: center;
	}

	.how-it-works .steps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.5rem;
		margin-top: 0.5rem;
	}
	.step {
		display: flex;
		gap: 1rem;
		text-align: left;
	}
	.step-num {
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		background: var(--copper, #bf4e30);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.125rem;
	}
	.step-body h4 {
		font-size: 1rem;
		font-weight: 600;
		color: #fffbf7;
		margin: 0 0 0.25rem 0;
	}
	.step-body p {
		font-size: 0.9375rem;
		color: rgba(255, 255, 255, 0.85);
		line-height: 1.5;
		margin: 0;
	}

	@media (max-width: 768px) {
		.how-it-works .steps {
			grid-template-columns: 1fr;
		}
	}
</style>
