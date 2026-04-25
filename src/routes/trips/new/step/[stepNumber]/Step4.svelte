<script lang="ts">
	import type { TripDraft, MealsConfig, ActivitiesConfig } from '$lib/stores/tripDraft.js';
	import { totalBedSpotCount } from '$lib/stores/tripDraft.js';

	let { draft }: { draft: TripDraft } = $props();

	const mealsConfig = $derived(
		draft.meals && typeof draft.meals === 'object' && 'enabled' in draft.meals
			? (draft.meals as MealsConfig)
			: null
	);

	const activitiesConfig = $derived(
		draft.activities && typeof draft.activities === 'object' && 'items' in draft.activities
			? (draft.activities as ActivitiesConfig)
			: null
	);

	const numberOfNights = $derived(() => {
		if (!draft.checkInDate || !draft.checkOutDate) return 0;
		const checkIn = new Date(draft.checkInDate);
		const checkOut = new Date(draft.checkOutDate);
		const diffTime = checkOut.getTime() - checkIn.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	});

	function fmtDate(dateStr: string) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function fmtDateShort(dateStr: string) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const heroPhoto = $derived(
		draft.coverPhoto ||
		(draft.galleryPhotos && draft.galleryPhotos.length > 0 ? draft.galleryPhotos[0] : '') ||
		draft.rooms.find(r => r.photos && r.photos.length > 0)?.photos[0] || ''
	);

	const addons = $derived([
		{
			key: 'cost',
			label: 'Cost-sharing',
			enabled: draft.costSharingEnabled,
			colorClass: 'addon-chip--cost',
		},
		{
			key: 'meals',
			label: 'Meal-planning',
			enabled: true,
			colorClass: 'addon-chip--meals',
		},
		{
			key: 'activities',
			label: 'Activity-planning',
			enabled: true,
			colorClass: 'addon-chip--activities',
		},
		{
			key: 'games',
			label: 'Games',
			enabled: true,
			colorClass: 'addon-chip--games',
		},
	]);

	const enabledAddons = $derived(addons.filter(a => a.enabled));
	const disabledAddons = $derived(addons.filter(a => !a.enabled));

	const pricingModelLabel: Record<string, string> = {
		'per-person': 'Per person',
		'per-person-per-night': 'Per person / night',
		'per-room': 'Per room',
		'per-bed': 'Per bed',
		'hybrid': 'Hybrid',
	};

	const GAME_ID_LABELS: Record<string, string> = {
		'caption-this': 'Caption This',
		'scavenger-bingo': 'Scavenger Bingo',
		'alphabet-hunt': 'Alphabet Hunt',
		'daily-trivia': 'Daily Trivia',
	};

	/** Meal-planning modes + optional slot count for the add-on chip */
	function mealChipSubtitle(mc: MealsConfig | null): string | null {
		if (!mc) return null;
		const parts: string[] = [];
		if (mc.modes?.signups) parts.push('Sign-ups');
		if (mc.modes?.fund) parts.push('Shared food fund');
		if (mc.modes?.informal) parts.push('Informal');
		let line = parts.join(' · ');
		if (mc.modes?.signups && mc.signupConfig?.slots?.length) {
			const n = mc.signupConfig.slots.length;
			line = line ? `${line} · ${n} meal slot${n !== 1 ? 's' : ''}` : `${n} meal slot${n !== 1 ? 's' : ''}`;
		}
		return line || null;
	}

	function gamesChipSubtitle(ids: string[] | undefined): string | null {
		if (!ids?.length) return null;
		return ids.map((id) => GAME_ID_LABELS[id] ?? id).join(' · ');
	}

	const mealChipLine = $derived(mealChipSubtitle(mealsConfig));
	const gamesChipLine = $derived(gamesChipSubtitle(Object.keys(GAME_ID_LABELS)));
	const costPricingChipLine = $derived(
		draft.costSharingEnabled && draft.pricingModel
			? pricingModelLabel[draft.pricingModel] ?? draft.pricingModel
			: null
	);

	const bedTypeLabel: Record<string, string> = {
		king: 'King',
		queen: 'Queen',
		full: 'Full',
		twin: 'Twin',
		single: 'Single',
		bunk: 'Bunk',
		sofa: 'Sofa bed',
		futon: 'Futon',
		air: 'Air mattress',
		crib: 'Crib',
	};
	function labelBed(type: string) {
		return bedTypeLabel[type.toLowerCase()] ?? type;
	}

	const locationDisplay = $derived(
		[draft.locationCity || draft.destinationCity, draft.destinationState, draft.destinationCountry]
			.filter(Boolean)
			.join(', ')
	);

	const bedSpotsForCapacity = $derived(totalBedSpotCount(draft.rooms));

	const heroMetaNights = $derived(
		draft.checkInDate && draft.checkOutDate && numberOfNights() > 0 ? numberOfNights() : 0
	);
	const showHeroHeadcountMeta = $derived(
		heroMetaNights > 0 ||
			!!draft.expectedGuestCount ||
			Number(draft.maxOccupancy) > 0 ||
			bedSpotsForCapacity > 0
	);
</script>

<div class="review-root">

	<!-- ── Hero ──────────────────────────────────────────────── -->
	<div class="review-hero" class:review-hero--no-photo={!heroPhoto}>
		{#if heroPhoto}
			<img class="review-hero-img" src={heroPhoto} alt={draft.name || 'Trip photo'} />
		{/if}
		<div class="review-hero-overlay">
			<div class="review-hero-content">
				<p class="review-hero-eyebrow">Review your trip</p>
				<h2 class="review-hero-title">{draft.name || 'Untitled Trip'}</h2>
				{#if locationDisplay}
					<p class="review-hero-location">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
						</svg>
						{locationDisplay}
					</p>
				{/if}
				{#if draft.checkInDate && draft.checkOutDate}
					<p class="review-hero-dates">
						{fmtDateShort(draft.checkInDate)} – {fmtDate(draft.checkOutDate)}
					</p>
				{/if}
				{#if showHeroHeadcountMeta}
					<div class="review-hero-meta">
						{#if heroMetaNights > 0}
							<div class="review-hero-meta-item">
								<span class="review-hero-meta-label">Nights</span>
								<span class="review-hero-meta-value">
									{heroMetaNights} night{heroMetaNights !== 1 ? 's' : ''}
								</span>
							</div>
						{/if}
						{#if draft.expectedGuestCount}
							<div class="review-hero-meta-item review-hero-meta-item--min" title="Minimum Headcount (Realistic Low)">
								<span class="review-hero-meta-label">Min headcount</span>
								<span class="review-hero-meta-value">{draft.expectedGuestCount}</span>
							</div>
						{/if}
						{#if Number(draft.maxOccupancy) > 0}
							<div class="review-hero-meta-item" title="Maximum Headcount (Capacity Limit)">
								<span class="review-hero-meta-label">Max headcount</span>
								<span class="review-hero-meta-value">{draft.maxOccupancy}</span>
							</div>
						{:else if bedSpotsForCapacity > 0}
							<div class="review-hero-meta-item" title="Pricing uses bed spot count when you leave max headcount blank">
								<span class="review-hero-meta-label">Max headcount</span>
								<span class="review-hero-meta-value">
									{bedSpotsForCapacity}
									<span class="review-hero-meta-note">from beds</span>
								</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- ── Rooms ──────────────────────────────────────────────── -->
	{#if draft.rooms.length > 0}
		<section class="review-section">
			<h3 class="review-section-title">Rooms &amp; beds</h3>
			<div class="rooms-scroll">
				{#each draft.rooms as room (room.id)}
					<div class="room-card">
						{#if room.photos && room.photos.length > 0}
							<div class="room-card-photo-wrap">
								<img class="room-card-photo" src={room.photos[0]} alt={room.name} />
							</div>
						{:else}
							<div class="room-card-photo-wrap room-card-photo-wrap--empty">
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
									<path d="M2 20v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2"/><path d="M3 10h18"/><path d="M3 10V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/>
								</svg>
							</div>
						{/if}
						<div class="room-card-body">
							<div class="room-card-head">
								<span class="room-card-name">{room.name || 'Unnamed Room'}</span>
								<span class="room-card-type-pill room-card-type-pill--{room.type}">{room.type}</span>
							</div>
							{#if room.beds.length > 0}
								<ul class="room-bed-list">
									{#each room.beds as bed (bed.id)}
										<li class="room-bed-item">
											<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
												<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M2 20h20"/><path d="M2 12V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6"/>
											</svg>
											{bed.count > 1 ? `${bed.count}× ` : ''}{labelBed(bed.bedType)}
										</li>
									{/each}
								</ul>
							{:else}
								<p class="room-no-beds">No beds configured</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Add-ons ────────────────────────────────────────────── -->
	<section class="review-section">
		<h3 class="review-section-title">Trip add-ons</h3>
		<div class="addon-chips-grid">
			{#each addons as addon (addon.key)}
				<div
					class="addon-chip {addon.colorClass}"
					class:addon-chip--on={addon.enabled}
					class:addon-chip--off={!addon.enabled}
				>
					<span class="addon-chip-icon">
						{#if addon.key === 'cost'}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M9.17 9.17A4 4 0 1 0 14.83 14.83"/>
							</svg>
						{:else if addon.key === 'meals'}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 2v7c0 1.1.9 2 2 2h0c1.1 0 2-.9 2-2V2"/>
								<path d="M7 2v20"/>
								<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h0"/>
								<path d="M21 15v7"/>
							</svg>
						{:else if addon.key === 'activities'}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polygon points="3 11 22 2 13 21 11 13 3 11"/>
							</svg>
						{:else if addon.key === 'games'}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="4" y="4" width="16" height="16" rx="2"/>
								<circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/>
							</svg>
						{/if}
					</span>
					<span class="addon-chip-label">{addon.label}</span>
					{#if addon.enabled}
						<span class="addon-chip-badge">On</span>
					{:else}
						<span class="addon-chip-badge addon-chip-badge--off">Off</span>
					{/if}

					{#if addon.enabled && addon.key === 'cost' && costPricingChipLine}
						<div class="addon-chip-detail">
							<span class="addon-chip-summary">{costPricingChipLine}</span>
						</div>
					{/if}
					{#if addon.enabled && addon.key === 'meals' && mealChipLine}
						<div class="addon-chip-detail">
							<span class="addon-chip-summary">{mealChipLine}</span>
						</div>
					{/if}
					{#if addon.enabled && addon.key === 'games' && gamesChipLine}
						<div class="addon-chip-detail">
							<span class="addon-chip-summary">{gamesChipLine}</span>
						</div>
					{/if}
					{#if addon.enabled && addon.key === 'activities' && activitiesConfig?.items?.length}
						<div class="addon-chip-detail">
							<span class="addon-chip-tag addon-chip-tag--neutral">{activitiesConfig.items.length} activit{activitiesConfig.items.length !== 1 ? 'ies' : 'y'}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- ── Description ────────────────────────────────────────── -->
	{#if draft.description}
		<section class="review-section">
			<h3 class="review-section-title">Description</h3>
			<p class="review-description">{draft.description}</p>
		</section>
	{/if}

</div>

<style>
	/* ── CSS vars (mirror AddOnsStep accent palette) ─────── */
	:root {
		--review-cost-color: #2f7778;
		--review-cost-bg: rgba(47, 119, 120, 0.09);
		--review-cost-glow: rgba(47, 119, 120, 0.55);
		--review-meals-color: #ea580c;
		--review-meals-bg: rgba(249, 115, 22, 0.09);
		--review-meals-glow: rgba(234, 88, 12, 0.55);
		--review-activities-color: #1e40af;
		--review-activities-bg: rgba(30, 58, 138, 0.08);
		--review-activities-glow: rgba(59, 130, 246, 0.55);
		--review-games-color: #7850b4;
		--review-games-bg: rgba(120, 80, 180, 0.09);
		--review-games-glow: rgba(120, 80, 180, 0.6);
	}

	.review-root {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	/* ── Hero ─────────────────────────────────────────────── */
	.review-hero {
		position: relative;
		border-radius: 0.875rem;
		overflow: hidden;
		min-height: 200px;
		background: #e8eaef;
	}

	.review-hero--no-photo {
		min-height: 120px;
		background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
	}

	.review-hero-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.review-hero-overlay {
		position: relative;
		z-index: 1;
		min-height: 200px;
		display: flex;
		align-items: flex-end;
		background: linear-gradient(
			to top,
			rgba(10, 15, 35, 0.78) 0%,
			rgba(10, 15, 35, 0.38) 46%,
			transparent 72%
		);
		padding: 1.25rem 1.25rem 1.4rem;
	}

	.review-hero--no-photo .review-hero-overlay {
		background: none;
		align-items: center;
		min-height: 120px;
		padding: 1.5rem;
	}

	.review-hero-content {
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
	}

	.review-hero-eyebrow {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: rgba(255, 255, 255, 0.62);
	}

	.review-hero-title {
		margin: 0;
		font-size: 1.45rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		color: #fff;
		line-height: 1.15;
	}

	.review-hero-location {
		margin: 0;
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.75);
		display: flex;
		align-items: center;
		gap: 0.28rem;
		margin-top: 0.15rem;
	}

	.review-hero-dates {
		margin: 0;
		margin-top: 0.12rem;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.7);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.review-hero-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.review-hero-meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.06rem;
		padding: 0.35rem 0.55rem;
		background: rgba(255, 255, 255, 0.14);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.55rem;
		min-width: 3.25rem;
	}

	.review-hero-meta-item--min {
		padding: 0.32rem 0.5rem;
	}

	.review-hero-meta-label {
		font-size: 0.58rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(255, 255, 255, 0.55);
		line-height: 1.15;
	}

	.review-hero-meta-value {
		font-size: 0.88rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}

	.review-hero-meta-note {
		margin-left: 0.25rem;
		font-size: 0.68rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.55);
		text-transform: none;
		letter-spacing: 0;
	}

	.review-hero--no-photo .review-hero-meta-item {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.18);
	}

	/* ── Section ──────────────────────────────────────────── */
	.review-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.review-section-title {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	/* ── Add-on chips ─────────────────────────────────────── */
	.addon-chips-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 560px) {
		.addon-chips-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.addon-chip {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.85rem 0.9rem 0.8rem;
		border-radius: 0.875rem;
		border: 1.5px solid transparent;
		background: #f3f4f6;
		transition: box-shadow 0.2s ease, background 0.2s ease;
		position: relative;
	}

	.addon-chip-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		flex-shrink: 0;
	}

	.addon-chip-label {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--text);
		line-height: 1.2;
	}

	.addon-chip-badge {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		padding: 0.14rem 0.42rem;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		border-radius: 999px;
	}

	.addon-chip-badge--off {
		background: rgba(15, 23, 42, 0.07);
		color: #94a3b8;
	}

	/* On-state: per-color glow */
	.addon-chip--on.addon-chip--cost {
		background: var(--review-cost-bg);
		box-shadow: 0 0 0 1.5px rgba(47, 119, 120, 0.52), 0 0 16px rgba(47, 119, 120, 0.16);
	}
	.addon-chip--on.addon-chip--cost .addon-chip-icon {
		background: rgba(47, 119, 120, 0.14);
		color: var(--review-cost-color);
	}
	.addon-chip--on.addon-chip--cost .addon-chip-badge {
		background: rgba(47, 119, 120, 0.14);
		color: var(--review-cost-color);
	}

	.addon-chip--on.addon-chip--meals {
		background: var(--review-meals-bg);
		box-shadow: 0 0 0 1.5px rgba(234, 88, 12, 0.52), 0 0 16px rgba(249, 115, 22, 0.16);
	}
	.addon-chip--on.addon-chip--meals .addon-chip-icon {
		background: rgba(249, 115, 22, 0.14);
		color: var(--review-meals-color);
	}
	.addon-chip--on.addon-chip--meals .addon-chip-badge {
		background: rgba(249, 115, 22, 0.14);
		color: var(--review-meals-color);
	}

	.addon-chip--on.addon-chip--activities {
		background: var(--review-activities-bg);
		box-shadow: 0 0 0 1.5px rgba(59, 130, 246, 0.52), 0 0 16px rgba(59, 130, 246, 0.16);
	}
	.addon-chip--on.addon-chip--activities .addon-chip-icon {
		background: rgba(30, 58, 138, 0.12);
		color: var(--review-activities-color);
	}
	.addon-chip--on.addon-chip--activities .addon-chip-badge {
		background: rgba(30, 58, 138, 0.12);
		color: var(--review-activities-color);
	}

	.addon-chip--on.addon-chip--games {
		background: var(--review-games-bg);
		box-shadow: 0 0 0 1.5px rgba(120, 80, 180, 0.55), 0 0 16px rgba(120, 80, 180, 0.18);
	}
	.addon-chip--on.addon-chip--games .addon-chip-icon {
		background: rgba(120, 80, 180, 0.12);
		color: var(--review-games-color);
	}
	.addon-chip--on.addon-chip--games .addon-chip-badge {
		background: rgba(120, 80, 180, 0.12);
		color: var(--review-games-color);
	}

	/* Off-state icons */
	.addon-chip--off .addon-chip-icon {
		background: rgba(15, 23, 42, 0.05);
		color: #94a3b8;
	}
	.addon-chip--off .addon-chip-label {
		color: #94a3b8;
	}

	.addon-chip-detail {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.1rem;
	}

	.addon-chip-summary {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted);
		line-height: 1.35;
		width: 100%;
	}

	.addon-chip-tag {
		font-size: 0.62rem;
		font-weight: 600;
		padding: 0.1rem 0.32rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.55);
		color: inherit;
		border: 1px solid currentColor;
		opacity: 0.7;
	}

	.addon-chip-tag--neutral {
		background: rgba(15, 23, 42, 0.07);
		color: var(--muted);
		border-color: transparent;
		opacity: 1;
	}

	/* ── Rooms scroll ─────────────────────────────────────── */
	.rooms-scroll {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
	}

	.room-card {
		flex: 0 0 auto;
		width: 180px;
		background: #f3f4f6;
		border: 1.5px solid rgba(15, 23, 42, 0.08);
		border-radius: 0.875rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.room-card-photo-wrap {
		height: 100px;
		background: #e8eaef;
		overflow: hidden;
		flex-shrink: 0;
	}

	.room-card-photo-wrap--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #94a3b8;
	}

	.room-card-photo {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.room-card-body {
		padding: 0.65rem 0.7rem 0.7rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.room-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem;
	}

	.room-card-name {
		font-size: 0.825rem;
		font-weight: 700;
		color: var(--text);
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.room-card-type-pill {
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.12rem 0.32rem;
		border-radius: 999px;
		flex-shrink: 0;
	}

	.room-card-type-pill--private {
		background: rgba(30, 58, 138, 0.1);
		color: var(--primary);
	}

	.room-card-type-pill--shared {
		background: rgba(15, 23, 42, 0.07);
		color: var(--muted);
	}

	.room-bed-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
	}

	.room-bed-item {
		font-size: 0.75rem;
		color: var(--muted);
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.room-no-beds {
		margin: 0;
		font-size: 0.75rem;
		color: #94a3b8;
		font-style: italic;
	}

	/* ── Description ──────────────────────────────────────── */
	.review-description {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
		line-height: 1.65;
		white-space: pre-wrap;
	}
</style>
