<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const trip = data.trip;
</script>

<div class="pending-shell">
	<div class="pending-card">
		<div class="pending-icon">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="12" cy="12" r="10"/>
				<polyline points="12 6 12 12 16 14"/>
			</svg>
		</div>
		<h1 class="pending-title">Waiting for host approval</h1>
		<p class="pending-trip">{trip.name}</p>
		<p class="pending-desc">
			You'll be able to RSVP and participate once the host approves your request. We'll notify you when that happens.
		</p>
		<a href="/" class="pending-home">Back to home</a>
	</div>
</div>

<style>
	.pending-shell {
		min-height: 100vh;
		background: var(--bg, #faf9f7);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.pending-card {
		background: var(--surface, #fff);
		border-radius: 20px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
		max-width: 420px;
		width: 100%;
		padding: 3rem 2.5rem;
		text-align: center;
	}

	.pending-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: rgba(191, 78, 48, 0.08);
		color: var(--copper, #bf4e30);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.5rem;
	}

	.pending-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.625rem;
		font-weight: 700;
		color: var(--text, #1a1a1a);
		margin-bottom: 0.5rem;
		letter-spacing: -0.02em;
	}

	.pending-trip {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--copper, #bf4e30);
		margin-bottom: 1rem;
	}

	.pending-desc {
		font-size: 0.9375rem;
		color: var(--textSecondary, #4b5563);
		line-height: 1.6;
		margin-bottom: 2rem;
	}

	.pending-home {
		display: inline-block;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--textMuted, #6b7280);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 10px;
		padding: 0.625rem 1.5rem;
		text-decoration: none;
		transition: border-color 0.18s, color 0.18s;
	}

	.pending-home:hover {
		border-color: var(--copper, #bf4e30);
		color: var(--copper, #bf4e30);
	}
</style>
