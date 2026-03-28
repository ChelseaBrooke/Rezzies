<script lang="ts">
	import MarketingShell from '$lib/components/MarketingShell.svelte';

	let { data } = $props();
</script>

<MarketingShell user={data?.user}>
	<div class="marketing-container">
		<div class="marketing-card find-hero">
			<h1 class="marketing-page-title">Find your trip</h1>
			<p class="marketing-page-subtitle">
				Your host will send you a direct link to your trip. Use that link to sign in and join.
			</p>

			<div class="info-box">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				<p>
					Trips are now accessed by a direct link from your host — there are no invite codes to enter.
					If you haven't received a link yet, reach out to whoever is organizing the trip.
				</p>
			</div>

			<a href="/login" class="find-submit">Sign in to view your trips</a>
		</div>
	</div>
</MarketingShell>

<style>
	.find-hero {
		max-width: 520px;
		margin-left: auto;
		margin-right: auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.marketing-page-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2rem;
		font-weight: 700;
		color: #fffbf7;
		margin: 0;
	}

	.marketing-page-subtitle {
		font-size: 1.0625rem;
		color: rgba(255, 255, 255, 0.85);
		line-height: 1.6;
		margin: 0;
	}

	.info-box {
		display: flex;
		gap: 0.875rem;
		align-items: flex-start;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 1.125rem 1.25rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.info-box svg {
		flex-shrink: 0;
		margin-top: 0.125rem;
		opacity: 0.8;
	}

	.info-box p {
		font-size: 0.9375rem;
		line-height: 1.6;
		margin: 0;
	}

	.find-submit {
		display: block;
		padding: 0.875rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: var(--copper, #bf4e30);
		border-radius: 8px;
		text-align: center;
		text-decoration: none;
		transition: background 0.2s;
	}

	.find-submit:hover {
		background: var(--primaryHover, #a03d24);
	}
</style>
