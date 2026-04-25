<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="denied-shell">
	<div class="denied-card">
		<div class="denied-icon">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="12" cy="12" r="10"/>
				<line x1="15" y1="9" x2="9" y2="15"/>
				<line x1="9" y1="9" x2="15" y2="15"/>
			</svg>
		</div>
		{#if data.fromCostReapproval}
			<h1 class="denied-title">You've been removed from this trip</h1>
			{#if data.trip}
				<p class="denied-trip">{data.trip.name}</p>
			{/if}
			<p class="denied-desc">
				You chose to leave after your cost share changed. If this wasn't intentional, contact your host.
			</p>
			<a href="/" class="denied-home">Go to Divvi →</a>
		{:else}
			<h1 class="denied-title">You're not approved to join this trip</h1>
			{#if data.trip}
				<p class="denied-trip">{data.trip.name}</p>
			{/if}
			<p class="denied-desc">
				Your request to join was not approved by the host. Please contact your host if you believe this is a mistake.
			</p>
			<a href="/" class="denied-home">Back to home</a>
		{/if}
	</div>
</div>

<style>
	.denied-shell {
		min-height: 100vh;
		background: var(--bg, #faf9f7);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.denied-card {
		background: var(--surface, #fff);
		border-radius: 20px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
		max-width: 420px;
		width: 100%;
		padding: 3rem 2.5rem;
		text-align: center;
	}

	.denied-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: rgba(220, 38, 38, 0.08);
		color: #dc2626;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.5rem;
	}

	.denied-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.625rem;
		font-weight: 700;
		color: var(--text, #1a1a1a);
		margin-bottom: 0.5rem;
		letter-spacing: -0.02em;
	}

	.denied-trip {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--textMuted, #6b7280);
		margin-bottom: 1rem;
	}

	.denied-desc {
		font-size: 0.9375rem;
		color: var(--textSecondary, #4b5563);
		line-height: 1.6;
		margin-bottom: 2rem;
	}

	.denied-home {
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

	.denied-home:hover {
		border-color: var(--text, #1a1a1a);
		color: var(--text, #1a1a1a);
	}
</style>
