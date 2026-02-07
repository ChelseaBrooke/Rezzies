<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

{#if !data.isHost}
	<div class="settings-page">
		<div class="error-message">
			<p>You don't have permission to edit trip settings. Only hosts can edit settings.</p>
			<a href="/trips/{data.trip?.id}" class="btn-primary">Back to Trip</a>
		</div>
	</div>
{:else}
	<!-- Host is redirected to /trips/[id]/settings/step/1; this is a fallback if JS runs before redirect -->
	<div class="settings-page">
		<p>Redirecting to edit trip…</p>
	</div>
{/if}

<style>
	.settings-page {
		min-height: 100%;
		padding: 2rem;
	}

	.error-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 3rem;
		text-align: center;
		min-height: 400px;
	}

	.error-message p {
		font-size: 1rem;
		color: var(--color-text);
		margin: 0;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
		padding: 0.625rem 1.25rem;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
	}

	.btn-primary:hover {
		opacity: 0.95;
	}
</style>
