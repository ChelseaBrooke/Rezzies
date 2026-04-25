<script lang="ts">
	let {
		tripId,
		isHost = false,
		mapsUrl = null as string | null,
		streetLine = '',
		cityLine = '',
		wifiName = '',
		wifiPassword = '',
		checkOutTimeDisplay = '',
		checkOutDateLine = ''
	}: {
		tripId: string;
		isHost?: boolean;
		mapsUrl?: string | null;
		streetLine?: string;
		cityLine?: string;
		wifiName?: string;
		wifiPassword?: string;
		checkOutTimeDisplay?: string;
		checkOutDateLine?: string;
	} = $props();

	let wifiRevealed = $state(false);
	const hasWifi = $derived((wifiName ?? '').trim().length > 0);
	const pwd = $derived((wifiPassword ?? '').trim());
	const settingsHref = `/trips/${tripId}/settings`;
</script>

<section class="strip" aria-label="Trip essentials">
	<div class="strip-inner">
		{#if mapsUrl}
			<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="card card--link">
				<span class="label">Directions</span>
				<span class="primary">{streetLine || 'Open map'}</span>
				{#if cityLine}<span class="secondary">{cityLine}</span>{/if}
			</a>
		{:else}
			<div class="card">
				<span class="label">Directions</span>
				<span class="primary">{streetLine || 'Ask host'}</span>
				{#if cityLine}<span class="secondary">{cityLine}</span>{/if}
			</div>
		{/if}

		<div class="card">
			<span class="label">Wi-Fi</span>
			<span class="primary">{hasWifi ? wifiName : 'Ask host'}</span>
			{#if hasWifi && pwd}
				<div class="wifi-row">
					{#if wifiRevealed}
						<span class="secondary">{pwd}</span>
					{:else}
						<span class="secondary muted">Hidden</span>
					{/if}
					<button type="button" class="reveal" onclick={() => (wifiRevealed = !wifiRevealed)} aria-pressed={wifiRevealed}>
						{wifiRevealed ? 'Hide' : 'Show'}
					</button>
				</div>
			{:else if !hasWifi}
				<!-- HOST ONLY -->
				{#if isHost}
					<a href={settingsHref} class="nudge">Add Wi-Fi details →</a>
				{/if}
			{/if}
		</div>

		<div class="card">
			<span class="label">Check-out</span>
			<span class="primary primary--time">{checkOutTimeDisplay || 'Ask host'}</span>
			{#if checkOutDateLine}<span class="secondary">{checkOutDateLine}</span>{/if}
		</div>
	</div>

	<a href={settingsHref} class="more-link">+ Parking · House rules · More info →</a>
</section>

<style>
	.strip {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		margin-bottom: 1.25rem;
	}
	.strip-inner {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}
	@media (max-width: 767px) {
		.strip-inner {
			display: flex;
			gap: 0.65rem;
			overflow-x: auto;
			scroll-snap-type: x mandatory;
			padding-bottom: 4px;
			margin-inline: -4px;
			padding-inline: 4px;
		}
	}
	.card {
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
		border: 1px solid rgba(15, 23, 42, 0.06);
		border-left: 3px solid #2f7778;
		padding: 1rem 1.1rem;
		min-height: 108px;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-decoration: none;
		color: inherit;
	}
	@media (max-width: 767px) {
		.card {
			flex: 0 0 min(78vw, 260px);
			scroll-snap-align: start;
		}
	}
	a.card--link {
		cursor: pointer;
	}
	.label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #5a8f90;
	}
	.primary {
		font-size: 15px;
		font-weight: 600;
		color: #0f172a;
		line-height: 1.35;
		margin-top: 0.15rem;
	}
	.primary--time {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 20px;
		font-weight: 700;
		color: #0f172a;
	}
	.secondary {
		font-size: 13px;
		color: #64748b;
		line-height: 1.35;
	}
	.secondary.muted {
		font-style: italic;
	}
	.wifi-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.1rem;
	}
	.reveal {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: #2f7778;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.nudge {
		font-size: 13px;
		font-weight: 600;
		color: #2f7778;
		margin-top: 0.25rem;
		text-decoration: none;
	}
	.nudge:hover {
		text-decoration: underline;
	}
	.more-link {
		display: inline-block;
		margin-top: 0.65rem;
		font-size: 13px;
		color: #5a8f90;
		text-decoration: none;
		font-weight: 500;
	}
	.more-link:hover {
		color: #2f7778;
		text-decoration: underline;
	}
</style>
