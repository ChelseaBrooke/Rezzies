<script lang="ts">
	let {
		totalSpots,
		maxHeadcount,
		roomsSettingsHref
	}: {
		totalSpots: number;
		maxHeadcount: number;
		roomsSettingsHref: string;
	} = $props();

	const shortfall = $derived(Math.max(0, maxHeadcount - totalSpots));
</script>

{#if shortfall > 0}
	<div class="per-bed-cap-banner" role="status">
		<p class="per-bed-cap-banner__line">
			<strong>⚠️</strong>
			You have {totalSpots} bed-spot{totalSpots === 1 ? '' : 's'} but {maxHeadcount} max guests. Some guests
			won’t have a bed to pick. Add {shortfall} more spot{shortfall === 1 ? '' : 's'} or lower your max capacity.
		</p>
		<p class="per-bed-cap-banner__action">
			<a href={roomsSettingsHref} class="per-bed-cap-banner__link">→ Go to Rooms & Beds</a>
		</p>
	</div>
{/if}

<style>
	.per-bed-cap-banner {
		margin-bottom: 1.25rem;
		padding: 0.85rem 1rem;
		border-radius: 8px;
		border: 1px solid #c9a227;
		background: #fffbeb;
		color: #422006;
		font-size: 0.95rem;
		line-height: 1.45;
	}
	.per-bed-cap-banner__line {
		margin: 0 0 0.5rem;
	}
	.per-bed-cap-banner__action {
		margin: 0;
	}
	.per-bed-cap-banner__link {
		color: #0d9488;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.per-bed-cap-banner__link:hover {
		color: #0f766e;
	}
</style>
