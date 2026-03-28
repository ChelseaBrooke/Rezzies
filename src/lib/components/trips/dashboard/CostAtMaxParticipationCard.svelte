<script lang="ts">
	import type { CostAtMaxParticipation } from '$lib/server/pricing-canonical.js';

	let { data, tripId = '' }: { data: CostAtMaxParticipation | null; tripId?: string } = $props();

	const model = $derived((data?.pricingModel ?? '').toLowerCase());
	const headline = $derived.by(() => {
		if (!data) return null;
		if (model === 'per_person' && data.perPersonAtMax != null) {
			return `$${data.perPersonAtMax.toFixed(2)}`;
		}
		if (model === 'per_person_per_night' && data.perPersonPerNightAtMax != null) {
			return `$${data.perPersonPerNightAtMax.toFixed(2)}`;
		}
		if ((model === 'per_bed' || model === 'per_room') && data.perPersonAverageAtMax != null) {
			return `~$${data.perPersonAverageAtMax.toFixed(2)}`;
		}
		return null;
	});
	const unit = $derived.by(() => {
		if (model === 'per_person') return 'per person';
		if (model === 'per_person_per_night') return 'per person / night';
		if (model === 'per_bed') return 'avg per person (varies by bed)';
		if (model === 'per_room') return 'avg per person (varies by room)';
		return 'per person';
	});
	const subline = $derived(
		data ? `If all ${data.maxHeadcount} spots fill, total $${data.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null
	);
</script>

{#if data && headline}
	<div class="cost-at-max-card">
		<div class="cost-at-max-header">
			<span class="cost-at-max-icon" aria-hidden="true">📉</span>
			<h2 class="cost-at-max-title">Price at full capacity</h2>
		</div>
		<p class="cost-at-max-tagline">More yes RSVPs = lower cost per person. Here’s the best case:</p>
		<div class="cost-at-max-value">
			<span class="cost-at-max-amount">{headline}</span>
			<span class="cost-at-max-unit">{unit}</span>
		</div>
		{#if subline}
			<p class="cost-at-max-subline">{subline}</p>
		{/if}
		<a href="/trips/{tripId}/guests" class="cost-at-max-cta">Get more people to say yes →</a>
	</div>
{:else}
	<div class="cost-at-max-card cost-at-max-card--empty">
		<p class="cost-at-max-empty">Add rooms and set max guests to see price at full capacity.</p>
	</div>
{/if}

<style>
	.cost-at-max-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
	}

	.cost-at-max-card--empty {
		justify-content: center;
	}

	.cost-at-max-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.cost-at-max-icon {
		font-size: 1rem;
	}

	.cost-at-max-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.cost-at-max-tagline {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.4;
	}

	.cost-at-max-value {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem;
	}

	.cost-at-max-amount {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--warm);
		letter-spacing: -0.02em;
	}

	.cost-at-max-unit {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
	}

	.cost-at-max-subline {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
	}

	.cost-at-max-cta {
		margin-top: 0.25rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
		transition: opacity 0.15s;
	}

	.cost-at-max-cta:hover {
		opacity: 0.85;
		text-decoration: underline;
	}

	.cost-at-max-empty {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		text-align: center;
	}
</style>
