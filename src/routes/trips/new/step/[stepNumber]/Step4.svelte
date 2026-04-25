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

<div class="rev-page">

	<!-- ── Hero ──────────────────────────────────────────────── -->
	<section
		class="rev-hero"
		class:rev-hero--no-photo={!heroPhoto}
		class:rev-hero--with-notes={!!draft.description}
	>
		{#if heroPhoto}
			<img class="rev-hero-img" src={heroPhoto} alt={draft.name || 'Trip photo'} />
		{/if}
		<div class="rev-hero-overlay"></div>
		<div class="rev-hero-content">
			<div class="rev-hero-main">
				<span class="rev-hero-eyebrow">
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 2 14.5 9.5 22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
					</svg>
					Almost there!
				</span>
				<h2 class="rev-hero-title">{draft.name || 'Untitled Trip'}</h2>
				{#if locationDisplay}
					<p class="rev-hero-location">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
						</svg>
						{locationDisplay}
					</p>
				{/if}
				{#if draft.checkInDate && draft.checkOutDate}
					<p class="rev-hero-dates">
						{fmtDateShort(draft.checkInDate)} – {fmtDate(draft.checkOutDate)}
					</p>
				{/if}
				{#if showHeroHeadcountMeta}
					<div class="rev-hero-meta">
						{#if heroMetaNights > 0}
							<div class="rev-hero-meta-item">
								<span class="rev-hero-meta-label">Nights</span>
								<span class="rev-hero-meta-value">
									{heroMetaNights} night{heroMetaNights !== 1 ? 's' : ''}
								</span>
							</div>
						{/if}
						{#if draft.expectedGuestCount}
							<div class="rev-hero-meta-item" title="Minimum Headcount (Realistic Low)">
								<span class="rev-hero-meta-label">Min headcount</span>
								<span class="rev-hero-meta-value">{draft.expectedGuestCount}</span>
							</div>
						{/if}
						{#if Number(draft.maxOccupancy) > 0}
							<div class="rev-hero-meta-item" title="Maximum Headcount (Capacity Limit)">
								<span class="rev-hero-meta-label">Max headcount</span>
								<span class="rev-hero-meta-value">{draft.maxOccupancy}</span>
							</div>
						{:else if bedSpotsForCapacity > 0}
							<div class="rev-hero-meta-item" title="Pricing uses bed spot count when you leave max headcount blank">
								<span class="rev-hero-meta-label">Max headcount</span>
								<span class="rev-hero-meta-value">
									{bedSpotsForCapacity}
									<span class="rev-hero-meta-note">from beds</span>
								</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			{#if draft.description}
				<aside class="rev-hero-notes" aria-label="Trip notes">
					<span class="rev-hero-notes-label">
						<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
						</svg>
						What you told your guests
					</span>
					<p class="rev-hero-notes-body">{draft.description}</p>
				</aside>
			{/if}
		</div>
	</section>

	<!-- ── Main row: Hype (left) + Rooms/CTA (right) ────────── -->
	<div class="rev-main-row">

	<!-- ── HYPE: What's Included With Every Trip ─────────────── -->
	<section class="rev-hype">
		<header class="rev-hype-head">
			<span class="rev-label">Included with every trip</span>
			<h3 class="rev-section-title">Everything you and your guests get</h3>
			<p class="rev-section-sub">Divvi quietly takes care of the planning, splitting, and logistics so you can be a guest at your own trip.</p>
		</header>
		<div class="rev-hype-grid">
			{#each addons as addon (addon.key)}
				<article
					class="rev-feature rev-feature--{addon.key}"
					class:rev-feature--off={!addon.enabled}
				>
					<span class="rev-feature-icon">
						{#if addon.key === 'cost'}
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a2.5 2.5 0 0 1 0 5H9m0 0h5"/>
							</svg>
						{:else if addon.key === 'meals'}
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M3 2v7c0 1.1.9 2 2 2h0c1.1 0 2-.9 2-2V2"/>
								<path d="M7 2v20"/>
								<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h0"/>
								<path d="M21 15v7"/>
							</svg>
						{:else if addon.key === 'activities'}
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polygon points="3 11 22 2 13 21 11 13 3 11"/>
							</svg>
						{:else if addon.key === 'games'}
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<rect x="4" y="4" width="16" height="16" rx="2"/>
								<circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/>
								<circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/>
							</svg>
						{/if}
					</span>
					<div class="rev-feature-body">
						<div class="rev-feature-row">
							<h4 class="rev-feature-title">
								{#if addon.key === 'cost'}Cost Sharing
								{:else if addon.key === 'meals'}Meal Planning
								{:else if addon.key === 'activities'}Activity Planning
								{:else}Trip Games
								{/if}
							</h4>
							<span class="rev-status" class:rev-status--on={addon.enabled} class:rev-status--off={!addon.enabled}>
								{addon.enabled ? 'On' : 'Off'}
							</span>
						</div>
						<p class="rev-feature-copy">
							{#if addon.key === 'cost'}
								{#if addon.enabled}
									Guests see what they owe before they say yes, split per person, room, or bed.
								{:else}
									Want shared billing? Turn on cost sharing in Step 2 to split fairly per person, room, or bed.
								{/if}
							{:else if addon.key === 'meals'}
								Sign-up for meals or pool a shared food fund. No more "who's bringing breakfast?" texts.
							{:else if addon.key === 'activities'}
								Discover places, build a shared itinerary, run polls, and lock in plans together.
							{:else}
								Caption This, Scavenger Bingo, Alphabet Hunt &amp; Daily Trivia keep the group laughing.
							{/if}
						</p>
						{#if addon.enabled && addon.key === 'cost' && costPricingChipLine}
							<span class="rev-feature-chip">Pricing model · {costPricingChipLine}</span>
						{/if}
						{#if addon.enabled && addon.key === 'meals' && mealChipLine}
							<span class="rev-feature-chip">{mealChipLine}</span>
						{/if}
						{#if addon.enabled && addon.key === 'activities' && activitiesConfig?.items?.length}
							<span class="rev-feature-chip">{activitiesConfig.items.length} activit{activitiesConfig.items.length !== 1 ? 'ies' : 'y'} planned</span>
						{/if}
						{#if addon.enabled && addon.key === 'games' && gamesChipLine}
							<span class="rev-feature-chip">{gamesChipLine}</span>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</section>

	<!-- Right column: rooms (top) + compact CTA (bottom) -->
	<div class="rev-right-col" class:rev-right-col--no-rooms={draft.rooms.length === 0}>
		{#if draft.rooms.length > 0}
			<section class="rev-rooms">
				<header class="rev-section-head">
					<span class="rev-label">Sleeping arrangements</span>
					<h3 class="rev-section-title">{draft.rooms.length} room{draft.rooms.length === 1 ? '' : 's'} ready</h3>
				</header>
				<div class="rev-rooms-scroll">
					{#each draft.rooms as room (room.id)}
						<div class="rev-room-card">
							{#if room.photos && room.photos.length > 0}
								<div class="rev-room-photo-wrap">
									<img class="rev-room-photo" src={room.photos[0]} alt={room.name} />
								</div>
							{:else}
								<div class="rev-room-photo-wrap rev-room-photo-wrap--empty">
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
										<path d="M2 20v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2"/><path d="M3 10h18"/><path d="M3 10V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/>
									</svg>
								</div>
							{/if}
							<div class="rev-room-body">
								<div class="rev-room-head">
									<span class="rev-room-name">{room.name || 'Unnamed Room'}</span>
									<span class="rev-room-pill rev-room-pill--{room.type}">{room.type}</span>
								</div>
								{#if room.beds.length > 0}
									<ul class="rev-bed-list">
										{#each room.beds as bed (bed.id)}
											<li class="rev-bed-item">
												<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
													<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M2 20h20"/><path d="M2 12V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6"/>
												</svg>
												{bed.count > 1 ? `${bed.count}× ` : ''}{labelBed(bed.bedType)}
											</li>
										{/each}
									</ul>
								{:else}
									<p class="rev-room-empty">No beds configured</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Compact final CTA bar -->
		<section class="rev-cta rev-cta--compact" aria-label="Ready to publish">
			<div class="rev-cta-shine" aria-hidden="true"></div>
			<div class="rev-cta-text">
				<span class="rev-cta-eyebrow">Last step</span>
				<strong class="rev-cta-headline">Ready to bring your guests in?</strong>
			</div>
			<div class="rev-cta-arrow" aria-hidden="true">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>
				</svg>
			</div>
		</section>
	</div>

	</div><!-- /rev-main-row -->

</div>

<style>
	/* ════════════════════════════════════════════════════════════════
	 * Step 3 (Review) — Divvi hype-and-confirm redesign
	 * ════════════════════════════════════════════════════════════════ */

	.rev-page {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		max-width: 100%;
		width: 100%;
		margin: 0 auto;
	}

	/* ── Hero ─────────────────────────────────────────────── */
	.rev-hero {
		position: relative;
		border-radius: 1rem;
		overflow: hidden;
		min-height: 240px;
		background: linear-gradient(135deg, var(--navy) 0%, var(--primary) 60%, var(--warm) 130%);
		isolation: isolate;
		box-shadow: 0 14px 32px -22px rgba(29, 77, 78, 0.45);
		border: 1px solid rgba(47, 119, 120, 0.25);
	}

	.rev-hero--no-photo {
		min-height: 155px;
	}

	.rev-hero-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		z-index: 0;
	}

	.rev-hero-overlay {
		position: absolute;
		inset: 0;
		z-index: 1;
		background: linear-gradient(
			180deg,
			rgba(20, 35, 35, 0.15) 0%,
			rgba(20, 35, 35, 0.55) 55%,
			rgba(15, 28, 28, 0.88) 100%
		);
	}

	.rev-hero--no-photo .rev-hero-overlay {
		background: linear-gradient(135deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.18) 100%);
	}

	.rev-hero-content {
		position: relative;
		z-index: 2;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.1rem;
		padding: 1.4rem 1.5rem 1.5rem;
		min-height: inherit;
		align-items: stretch;
	}

	.rev-hero--with-notes .rev-hero-content {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	}

	@media (max-width: 820px) {
		.rev-hero--with-notes .rev-hero-content {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.rev-hero-main {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		justify-content: flex-end;
	}

	.rev-hero-notes {
		align-self: stretch;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.95rem 1.1rem 1.05rem;
		background: rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.85rem;
		max-height: 15.5rem;
		overflow: hidden;
		position: relative;
	}

	.rev-hero-notes::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2.2rem;
		background: linear-gradient(to top, rgba(20, 35, 35, 0.55), transparent);
		pointer-events: none;
		opacity: 0;
		transition: opacity 200ms ease;
	}

	.rev-hero-notes--clipped::after {
		opacity: 1;
	}

	.rev-hero-notes-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(255, 255, 255, 0.78);
	}

	.rev-hero-notes-body {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.94);
		white-space: pre-wrap;
		overflow-y: auto;
		max-height: 11.5rem;
		padding-right: 0.25rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
	}

	.rev-hero-notes-body::-webkit-scrollbar {
		width: 5px;
	}
	.rev-hero-notes-body::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.35);
		border-radius: 999px;
	}

	.rev-hero-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		align-self: flex-start;
		padding: 0.28rem 0.7rem;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--carrot);
		background: rgba(247, 170, 41, 0.14);
		border: 1px solid rgba(247, 170, 41, 0.45);
		border-radius: 999px;
		margin-bottom: 0.2rem;
		backdrop-filter: blur(4px);
	}

	.rev-hero-title {
		margin: 0;
		font-size: clamp(1.65rem, 2.4vw, 2.15rem);
		font-weight: 800;
		letter-spacing: -0.025em;
		color: #fff;
		line-height: 1.15;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
	}

	.rev-hero-location {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.86);
		display: flex;
		align-items: center;
		gap: 0.32rem;
	}

	.rev-hero-dates {
		margin: 0.05rem 0 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.78);
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.rev-hero-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.85rem;
	}

	.rev-hero-meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.08rem;
		padding: 0.42rem 0.6rem;
		background: rgba(255, 255, 255, 0.16);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 0.6rem;
		backdrop-filter: blur(4px);
		min-width: 3.5rem;
	}

	.rev-hero-meta-label {
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: rgba(255, 255, 255, 0.7);
		line-height: 1.15;
	}

	.rev-hero-meta-value {
		font-size: 0.95rem;
		font-weight: 800;
		color: #fff;
		letter-spacing: -0.02em;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}

	.rev-hero-meta-note {
		margin-left: 0.25rem;
		font-size: 0.68rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: none;
		letter-spacing: 0;
	}

	/* ── Shared section bits ─────────────────────────────── */
	.rev-section-head,
	.rev-hype-head {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		margin-bottom: 0.95rem;
	}

	.rev-eyebrow {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--warm);
		background: rgba(206, 86, 18, 0.1);
		border: 1px solid rgba(206, 86, 18, 0.25);
		border-radius: 999px;
		padding: 0.22rem 0.65rem;
		margin-bottom: 0.15rem;
	}

	/* Quieter label for in-content section heads (no chip) */
	.rev-label {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted);
		opacity: 0.65;
	}

	.rev-section-title {
		margin: 0;
		font-size: 1.12rem;
		font-weight: 800;
		color: var(--navy);
		letter-spacing: -0.02em;
		line-height: 1.2;
	}

	.rev-section-sub {
		margin: 0;
		font-size: 0.86rem;
		color: var(--muted);
		line-height: 1.45;
		max-width: 48rem;
	}

	/* ── Main row: hype (left) + rooms/CTA (right) ───────── */
	.rev-main-row {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 0.85rem;
		align-items: stretch;
	}

	@media (max-width: 1100px) {
		.rev-main-row {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.rev-right-col {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		min-width: 0;
	}

	/* ── HYPE: feature cards ─────────────────────────────── */
	.rev-hype {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 1.3rem 1.4rem 1.4rem;
		box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02), 0 8px 28px -20px rgba(29, 77, 78, 0.18);
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.rev-hype-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		flex: 1;
	}

	.rev-feature {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 0.9rem;
		padding: 1.05rem 1.15rem 1.1rem;
		background: #fff;
		border: 1px solid var(--border-soft);
		border-radius: 0.95rem;
		transition: border-color 200ms ease, box-shadow 200ms ease;
	}

	.rev-feature:hover {
		border-color: rgba(47, 119, 120, 0.25);
		box-shadow: 0 6px 16px -12px rgba(29, 77, 78, 0.25);
	}

	.rev-feature--cost {
		--rev-color: var(--primary);
		--rev-tint: rgba(47, 119, 120, 0.12);
		--rev-glow: rgba(47, 119, 120, 0.45);
	}

	.rev-feature--meals {
		--rev-color: var(--warm);
		--rev-tint: rgba(206, 86, 18, 0.12);
		--rev-glow: rgba(206, 86, 18, 0.45);
	}

	.rev-feature--activities {
		--rev-color: #1f6e8a;
		--rev-tint: rgba(122, 206, 211, 0.22);
		--rev-glow: rgba(122, 206, 211, 0.6);
	}

	.rev-feature--games {
		--rev-color: #b07a0a;
		--rev-tint: rgba(247, 170, 41, 0.18);
		--rev-glow: rgba(247, 170, 41, 0.6);
	}

	.rev-feature-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		color: var(--rev-color);
		background: var(--rev-tint);
		flex-shrink: 0;
	}

	.rev-feature-body {
		display: flex;
		flex-direction: column;
		gap: 0.42rem;
		min-width: 0;
		flex: 1;
	}

	.rev-feature-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.rev-feature-title {
		margin: 0;
		font-size: 1.02rem;
		font-weight: 800;
		color: var(--navy);
		letter-spacing: -0.01em;
		line-height: 1.2;
	}

	.rev-status {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		line-height: 1.3;
		color: var(--muted);
	}

	.rev-status::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.5;
	}

	.rev-status--on {
		color: var(--rev-color);
	}

	.rev-status--on::before {
		opacity: 1;
	}

	.rev-status--off {
		color: var(--muted);
		opacity: 0.55;
	}

	.rev-feature-copy {
		margin: 0;
		font-size: 0.86rem;
		color: var(--muted);
		line-height: 1.5;
	}

	.rev-feature-chip {
		display: inline-flex;
		align-self: flex-start;
		max-width: 100%;
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.18rem 0.5rem;
		border-radius: 999px;
		background: var(--rev-tint);
		color: var(--rev-color);
		line-height: 1.25;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
		margin-top: 0.15rem;
	}

	/* Off state: muted + remove glow */
	.rev-feature--off {
		opacity: 0.78;
	}
	.rev-feature--off .rev-feature-icon {
		background: rgba(15, 23, 42, 0.05);
		color: #94a3b8;
		box-shadow: none;
	}
	.rev-feature--off::before {
		opacity: 0;
	}
	.rev-feature--off .rev-feature-title {
		color: var(--muted);
	}

	/* ── Rooms scroll ─────────────────────────────────────── */
	.rev-rooms {
		background: transparent;
		padding: 0.4rem 0.25rem 0.25rem;
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		min-height: 0;
	}

	.rev-rooms-scroll {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
		gap: 0.85rem;
		flex: 1;
		min-width: 0;
		align-content: start;
		overflow-y: auto;
		min-height: 0;
		padding-right: 0.15rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(47, 119, 120, 0.35) transparent;
	}

	.rev-rooms-scroll::-webkit-scrollbar {
		width: 5px;
	}
	.rev-rooms-scroll::-webkit-scrollbar-thumb {
		background: rgba(47, 119, 120, 0.35);
		border-radius: 999px;
	}

	.rev-room-card {
		background: #fff;
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.rev-room-photo-wrap {
		height: 110px;
		background: linear-gradient(135deg, rgba(227, 206, 170, 0.5), rgba(122, 206, 211, 0.25));
		overflow: hidden;
		flex-shrink: 0;
	}

	.rev-room-photo-wrap--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(47, 119, 120, 0.55);
	}

	.rev-room-photo {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.rev-room-body {
		padding: 0.75rem 0.85rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.rev-room-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.rev-room-name {
		font-size: 0.84rem;
		font-weight: 800;
		color: var(--navy);
		letter-spacing: -0.01em;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rev-room-pill {
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		flex-shrink: 0;
		color: var(--muted);
		opacity: 0.7;
	}

	.rev-bed-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.rev-bed-item {
		font-size: 0.75rem;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 0.32rem;
		opacity: 0.85;
	}

	.rev-bed-item svg {
		color: var(--primary);
		opacity: 0.7;
	}

	.rev-room-empty {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
		font-style: italic;
		opacity: 0.7;
	}

	/* ── Final CTA banner ────────────────────────────────── */
	.rev-cta {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 1rem;
		padding: 1.05rem 1.3rem;
		border-radius: 1.1rem;
		background: linear-gradient(135deg, var(--warm) 0%, #b8480d 55%, var(--chocolate) 100%);
		color: #fff;
		overflow: hidden;
		isolation: isolate;
		box-shadow: 0 16px 32px -18px rgba(206, 86, 18, 0.55);
		min-width: 0;
	}

	.rev-cta--compact {
		padding: 0.85rem 1.05rem 0.9rem;
		gap: 0.85rem;
		border-radius: 0.9rem;
		flex-shrink: 0;
	}

	.rev-cta--compact .rev-cta-eyebrow {
		font-size: 0.6rem;
		letter-spacing: 0.13em;
	}

	.rev-cta--compact .rev-cta-headline {
		font-size: 1rem;
		line-height: 1.2;
	}

	.rev-cta--compact .rev-cta-arrow {
		width: 36px;
		height: 36px;
	}

	.rev-cta-shine {
		position: absolute;
		inset: 0;
		z-index: 0;
		background:
			radial-gradient(circle at 20% 20%, rgba(247, 170, 41, 0.45), transparent 55%),
			radial-gradient(circle at 90% 70%, rgba(255, 255, 255, 0.18), transparent 60%);
		pointer-events: none;
	}

	.rev-cta-text {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
		flex: 1;
		min-width: 0;
	}

	.rev-cta-eyebrow {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: rgba(255, 255, 255, 0.85);
	}

	.rev-cta-headline {
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: -0.015em;
		line-height: 1.2;
	}

	.rev-cta-sub {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.88);
		line-height: 1.4;
	}

	.rev-cta-arrow {
		position: relative;
		z-index: 1;
		flex-shrink: 0;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.16);
		border: 1.5px solid rgba(255, 255, 255, 0.35);
		color: #fff;
		animation: rev-bounce 2s ease-in-out infinite;
	}

	@keyframes rev-bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(4px); }
	}

	@media (max-width: 700px) {
		.rev-hype {
			padding: 1.1rem 1.1rem 1.2rem;
		}

		.rev-rooms-scroll {
			max-height: none;
		}

		.rev-section-title {
			font-size: 1.1rem;
		}
	}
</style>
