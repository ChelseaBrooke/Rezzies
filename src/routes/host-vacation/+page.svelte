<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="host-page">
	<div class="container container-narrow">
		<div class="page-header">
			<h1>Host a Trip</h1>
			<p class="subtitle">Set up your trip details, rooms, and pricing. An extension will help autofill step 1 from your listing later.</p>
		</div>

		<div class="action-wrap">
			<button
				class="btn btn-primary btn-large"
				onclick={() => goto('/trips/new')}
			>
				Get started
			</button>
		</div>
	</div>
</div>

<style>
	.host-page {
		padding: var(--spacing-2xl) 0;
		min-height: calc(100vh - 80px);
		background: var(--color-bg-light);
	}

	.page-header {
		text-align: center;
		margin-bottom: var(--spacing-xl);
	}

	.page-header h1 {
		margin-bottom: var(--spacing-sm);
	}

	.subtitle {
		font-size: 1.125rem;
		color: var(--color-text-light);
		max-width: 36rem;
		margin-left: auto;
		margin-right: auto;
		line-height: 1.6;
	}

	.action-wrap {
		display: flex;
		justify-content: center;
	}
</style>
