<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="error-page">
	<div class="error-card">
		<h1 class="error-code">{$page.status}</h1>
		<p class="error-message">{$page.error?.message ?? 'Something went wrong'}</p>
		<div class="error-actions">
			<a href="/trips" class="btn-primary">Go to My Trips</a>
			<button type="button" class="btn-secondary" onclick={() => history.back()}>Go Back</button>
		</div>
	</div>
</div>

<style>
	.error-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f6f4f1;
		padding: 2rem;
	}

	.error-card {
		text-align: center;
		max-width: 440px;
		width: 100%;
		background: #fff;
		border-radius: 16px;
		padding: 3rem 2.5rem;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
		border: 1px solid rgba(0, 0, 0, 0.06);
	}

	.error-code {
		font-family: var(--font-display);
		font-size: 4.5rem;
		font-weight: 700;
		color: #1e1a15;
		margin: 0 0 0.5rem;
		line-height: 1;
	}

	.error-message {
		font-size: 1.1rem;
		color: #5c534c;
		margin: 0 0 2rem;
		line-height: 1.5;
	}

	.error-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-primary {
		padding: 0.7rem 1.5rem;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 600;
		background: #1e1a15;
		color: #fff;
		text-decoration: none;
		border: none;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-primary:hover {
		background: #3d3631;
	}

	.btn-secondary {
		padding: 0.7rem 1.5rem;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 500;
		background: #fff;
		color: #5c534c;
		text-decoration: none;
		border: 1.5px solid #ddd9d2;
		cursor: pointer;
		font-family: inherit;
		transition: border-color 0.15s, background 0.15s;
	}

	.btn-secondary:hover {
		background: #faf9f7;
		border-color: #c4bcb3;
	}
</style>
