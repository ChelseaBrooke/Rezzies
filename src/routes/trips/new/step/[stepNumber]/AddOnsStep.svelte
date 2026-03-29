<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import { getDefaultMealsConfig } from '$lib/stores/tripDraft.js';
	import { computePerBedRangeByBedId } from '$lib/pricing/per-bed-selection.js';
	import { SCAVENGER_BINGO_ITEMS } from '$lib/games/scavengerBingoItems.js';

	/** Faux "photo" squares on the add-ons bingo preview (indices match SCAVENGER_BINGO_ITEMS). */
	const GAMES_BINGO_MOCK_PHOTOS = new Set([0, 8, 19]);

	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();

	let bedBreakdownModalOpen = $state(false);

	function openBedBreakdownModal(ev: MouseEvent) {
		ev.stopPropagation();
		bedBreakdownModalOpen = true;
	}

	function closeBedBreakdownModal() {
		bedBreakdownModalOpen = false;
	}

	// ─── Toggle helpers ──────────────────────────────────────────────────────────

	function toggleCostSharing() {
		draft.costSharingEnabled = !draft.costSharingEnabled;
		autosave();
	}
	function toggleMeals() {
		if (!draft.meals) return;
		draft.meals.enabled = !draft.meals.enabled;
		autosave();
	}
	function toggleActivities() {
		if (!draft.activities) return;
		draft.activities.enabled = !draft.activities.enabled;
		autosave();
	}
	function toggleGames() {
		draft.gamesEnabled = !draft.gamesEnabled;
		autosave();
	}
	function ensureMealsFundConfig() {
		if (!draft.meals) return;
		const d = getDefaultMealsConfig().fundConfig!;
		draft.meals.fundConfig = {
			...d,
			...draft.meals.fundConfig,
			contributionStyle: draft.meals.fundConfig?.contributionStyle ?? d.contributionStyle,
			managers: draft.meals.fundConfig?.managers ?? d.managers,
			totalToSplit: draft.meals.fundConfig?.totalToSplit ?? d.totalToSplit ?? ''
		};
	}

	function setMealMode(mode: 'signups' | 'fund') {
		if (!draft.meals) return;
		draft.meals.modes.signups = mode === 'signups';
		draft.meals.modes.fund = mode === 'fund';
		draft.meals.modes.informal = false;
		if (mode === 'fund') ensureMealsFundConfig();
		autosave();
	}
	function toggleGame(gameId: string) {
		const current = draft.selectedGames ?? [];
		draft.selectedGames = current.includes(gameId)
			? current.filter((g) => g !== gameId)
			: [...current, gameId];
		autosave();
	}
	function selectModel(model: TripDraft['pricingModel']) {
		draft.pricingModel = model;
		autosave();
	}

	function roundUsd(n: number): number {
		return Math.round(Number.isFinite(n) ? n : 0);
	}

	// ─── Simple card state ───────────────────────────────────────────────────────

	const costEnabled      = $derived(draft.costSharingEnabled);
	const mealsEnabled     = $derived(draft.meals?.enabled ?? false);
	const activitiesEnabled = $derived(draft.activities?.enabled ?? false);
	const gamesEnabled     = $derived(draft.gamesEnabled);
	const mealMode         = $derived(draft.meals?.modes?.fund ? 'fund' : 'signups');
	const selectedGames    = $derived(draft.selectedGames ?? []);

	// ─── Pricing calculations (ported from PricingStep) ──────────────────────────

	const BED_WEIGHTS: Record<string, number> = {
		twin: 1.0, single: 1.0, bunk: 0.9, full: 1.1, double: 1.1,
		queen: 1.2, king: 1.3, sofa: 0.85, sofa_bed: 0.85,
		air_mattress: 0.75, other: 1.0
	};
	const BED_SPOT_COUNTS: Record<string, number> = {
		twin: 1, single: 1, bunk: 2, full: 2, double: 2,
		queen: 2, king: 2, sofa: 2, sofa_bed: 2,
		air_mattress: 2, other: 1
	};
	function bedWeight(type: string): number {
		return BED_WEIGHTS[type.toLowerCase().replace(/\s+/g, '_')] ?? 1.0;
	}
	function bedSpotCount(type: string): number {
		return BED_SPOT_COUNTS[type.toLowerCase().replace(/\s+/g, '_')] ?? 1;
	}
	// Matches server getEffectivePrivacyFactor: 1 bed → 1.25, 2 → 1.125, 3+ → 1.0
	function privacyFactor(room: { beds?: Array<{ count?: number }> }): number {
		const bedCount = (room.beds ?? []).reduce((s, b) => s + (b.count || 1), 0);
		return Math.max(1.0, Math.min(1.25, 1.25 - (bedCount - 1) * 0.125));
	}

	const expected = $derived(Math.max(1, Number(draft.expectedGuestCount) || 1));
	const maxG     = $derived(Math.max(expected, Math.max(1, Number(draft.maxOccupancy) || 1)));

	const nights = $derived.by(() => {
		if (!draft.checkInDate || !draft.checkOutDate) return 0;
		const diff = Math.ceil(
			(new Date(draft.checkOutDate).getTime() - new Date(draft.checkInDate).getTime()) /
			(1000 * 60 * 60 * 24)
		);
		return diff > 0 ? diff : 0;
	});

	const total      = $derived(parseFloat(String(draft.totalTripCost)) || 0);
	const rooms      = $derived(draft.rooms ?? []);
	const totalRooms = $derived(rooms.length);

	// Per-person
	const ppExpected = $derived(expected > 0 ? total / expected : 0);
	const ppMax      = $derived(maxG     > 0 ? total / maxG     : 0);

	// Per-room (privacy-weighted per-person)
	const roomDenomExpected = $derived.by(() => {
		let rem = expected, sum = 0;
		for (const room of rooms) {
			const cap = Math.max(1, (room as any).maxOccupants ?? 1);
			const people = Math.min(cap, rem);
			if (people <= 0) break;
			sum += privacyFactor(room) * people;
			rem -= people;
		}
		return Math.max(sum, expected);
	});
	const roomDenomMax = $derived.by(() => {
		let rem = maxG, sum = 0;
		for (const room of rooms) {
			const cap = Math.max(1, (room as any).maxOccupants ?? 1);
			const people = Math.min(cap, rem);
			if (people <= 0) break;
			sum += privacyFactor(room) * people;
			rem -= people;
		}
		return Math.max(sum, maxG);
	});
	const prExpected = $derived(roomDenomExpected > 0 ? total / roomDenomExpected : 0);
	const prMax      = $derived(roomDenomMax      > 0 ? total / roomDenomMax      : 0);

	/** Selection-based PER_BED: occupancy-range sim at expected headcount + at full bed count. */
	const perBedSelection = $derived.by(() => {
		type U = { bedId: string; bedType: string; weight: number; spotCount: number };
		const units: U[] = [];
		rooms.forEach((room, ri) => {
			const p = privacyFactor(room);
			room.beds.forEach((bed, bi) => {
				const w = bedWeight(bed.bedType) * p;
				const sc = bedSpotCount(bed.bedType);
				const count = Math.max(1, bed.count || 1);
				for (let i = 0; i < count; i++) {
					units.push({
						bedId: `w-${ri}-${bi}-${i}`,
						bedType: bed.bedType.toLowerCase(),
						weight: w,
						spotCount: sc
					});
				}
			});
		});
		type BedRow = { label: string; low: number; high: number };
		type RoomGrp = { roomName: string; beds: BedRow[] };
		const empty = { groups: [] as RoomGrp[], groupsFull: [] as RoomGrp[], bedCount: 0 };
		if (units.length === 0 || total <= 0) return empty;

		// Expected-headcount table: range based on occupancy extremes
		const totalSpots = units.reduce((s, u) => s + u.spotCount, 0);
		const sim = Math.min(expected, totalSpots);
		const rangeMap = computePerBedRangeByBedId(total, sim, units);

		// Full-capacity table: deterministic — 1 guest per bed, all beds selected
		const totalWeight = units.reduce((s, u) => s + u.weight, 0);
		const fixedPriceById = new Map<string, number>(
			units.map((u) => [u.bedId, totalWeight > 0 ? total * (u.weight / totalWeight) : 0])
		);

		function buildGroups(map: ReturnType<typeof computePerBedRangeByBedId>): RoomGrp[] {
			const groups: RoomGrp[] = [];
			rooms.forEach((room, ri) => {
				const roomName = room.name?.trim() || `Room ${ri + 1}`;
				const beds: BedRow[] = [];
				room.beds.forEach((bed, bi) => {
					const count = Math.max(1, bed.count || 1);
					const typeLabel = bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1).replace(/_/g, ' ');
					for (let i = 0; i < count; i++) {
						const id = `w-${ri}-${bi}-${i}`;
						const r = map.get(id);
						beds.push({
							label: count > 1 ? `${typeLabel} ${i + 1}` : typeLabel,
							low: r?.lowBedPrice ?? 0,
							high: r?.highBedPrice ?? 0
						});
					}
				});
				if (beds.length > 0) groups.push({ roomName, beds });
			});
			return groups;
		}

		function buildGroupsFull(): RoomGrp[] {
			const groups: RoomGrp[] = [];
			rooms.forEach((room, ri) => {
				const roomName = room.name?.trim() || `Room ${ri + 1}`;
				const beds: BedRow[] = [];
				room.beds.forEach((bed, bi) => {
					const count = Math.max(1, bed.count || 1);
					const typeLabel = bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1).replace(/_/g, ' ');
					for (let i = 0; i < count; i++) {
						const id = `w-${ri}-${bi}-${i}`;
						const price = fixedPriceById.get(id) ?? 0;
						beds.push({ label: count > 1 ? `${typeLabel} ${i + 1}` : typeLabel, low: price, high: price });
					}
				});
				if (beds.length > 0) groups.push({ roomName, beds });
			});
			return groups;
		}

		const groups = buildGroups(rangeMap);
		const groupsFull = buildGroupsFull();

		return { groups, groupsFull, bedCount: units.length };
	});

	const perBedByRoom = $derived(perBedSelection.groups);
	const perBedByRoomFull = $derived(perBedSelection.groupsFull);
	const perBedBedCount = $derived(perBedSelection.bedCount);

	function formatBedPriceTotal(low: number, high: number): string {
		const a = roundUsd(low);
		const b = roundUsd(high);
		if (a === b) return `$${a}`;
		return `$${a}–$${b}`;
	}
	// ─── Games catalogue ─────────────────────────────────────────────────────────

	const GAMES = [
		{
			id: 'caption-this',
			name: 'Caption This',
			desc: 'Submit photos, everyone writes captions, group votes for the funniest'
		},
		{
			id: 'scavenger-bingo',
			name: 'Scavenger Bingo',
			desc: 'Mark off items you spot at the destination, first to bingo wins'
		},
		{
			id: 'alphabet-hunt',
			name: 'Alphabet Hunt',
			desc: 'Find and photograph something for each letter of the alphabet'
		},
		{
			id: 'daily-trivia',
			name: 'Daily Trivia',
			desc: 'A new trivia question drops each day for the whole group to answer'
		}
	];
</script>

<svelte:window
	onkeydown={(e) => {
		if (bedBreakdownModalOpen && e.key === 'Escape') {
			e.preventDefault();
			closeBedBreakdownModal();
		}
	}}
/>

<div class="addons-screen">
	<div class="addons-header">
		<h2 class="addons-title">Trip Add-Ons</h2>
		<p class="addons-subtitle">Select the features you want for this trip.</p>
	</div>

	<div class="addons-grid">
		<div class="addons-column">
		<!-- ── Cost-sharing ─────────────────────────────────── -->
		<div class="addon-card addon-card--cost addon-card--tall" class:active={costEnabled} onclick={toggleCostSharing} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleCostSharing()}>
			<div class="addon-header">
				<div class="addon-title-group">
					<span class="addon-icon cost-icon">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M9.17 9.17A4 4 0 1 0 14.83 14.83"/>
						</svg>
					</span>
					<span class="addon-title">Cost-sharing</span>
				</div>
				<label class="addon-toggle" class:checked={costEnabled} onclick={(e) => e.stopPropagation()}>
					<input
						type="checkbox"
						checked={costEnabled}
						onchange={toggleCostSharing}
						aria-label="Enable cost-sharing"
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
				</label>
			</div>

			<div class="addon-body">
				{#if !costEnabled}
					<div class="addon-pane unchecked-pane">
						<p class="addon-desc">
							Split the trip total fairly—per person, per room, or per bed. When guests RSVP <strong>Yes</strong>, they’ll see their share (or a clear estimate) on the RSVP flow so they know what to expect before they commit.
						</p>
					</div>
				{:else}
					<div class="addon-pane checked-pane cost-checked-pane" onclick={(e) => e.stopPropagation()} role="none">
						<!-- Pricing model comparison table -->
						<div class="pricing-section">
							<div class="cost-pricing-toolbar">
								<div class="cost-total-block">
									<div class="cost-total-inline">
										<label
											class="config-label cost-input-label cost-input-label--tip"
											for="totalTripCost"
											title="trip fees and taxes that all guests will split"
										>
											Total Trip Cost
										</label>
										<div class="currency-wrap">
											<span class="currency-sym">$</span>
											<input
												id="totalTripCost"
												type="number"
												class="config-input cost-input"
												bind:value={draft.totalTripCost}
												oninput={autosave}
												placeholder="0.00"
												step="0.01"
												min="0"
												title="trip fees and taxes that all guests will split"
											/>
										</div>
									</div>
								</div>
								<div class="pricing-model-header">
									<span class="pricing-table-title">Choose pricing model</span>
									<span class="pricing-table-meta">
										{expected} expected guest{expected !== 1 ? 's' : ''} · {maxG} max guest{maxG !== 1 ? 's' : ''} · {nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'dates not set'}
									</span>
								</div>
							</div>
							<div class="pricing-table-wrap">
								<table class="pricing-table">
									<thead>
										<tr>
											<th></th>
											<th>Model</th>
											<th>Total cost, at {expected} guest{expected !== 1 ? 's' : ''}</th>
											<th>Total cost, at {maxG} guest{maxG !== 1 ? 's' : ''}</th>
										</tr>
									</thead>
									<tbody>
										<tr class="pt-row" class:pt-selected={draft.pricingModel === 'per-person'}
											onclick={() => selectModel('per-person')} role="button" tabindex="0"
											onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectModel('per-person')}>
											<td class="pt-radio"><span class="radio-dot" class:radio-dot-on={draft.pricingModel === 'per-person'}></span></td>
											<td class="pt-model">Per Person</td>
										<td class="pt-val">
											{#if total > 0}
												<span class="pt-amount">${roundUsd(ppExpected)}</span>
											{:else}—{/if}
										</td>
										<td class="pt-val">
											{#if total > 0}
												<span class="pt-amount">${roundUsd(ppMax)}</span>
											{:else}—{/if}
										</td>
										</tr>
										<tr class="pt-row" class:pt-selected={draft.pricingModel === 'per-room'}
											onclick={() => selectModel('per-room')} role="button" tabindex="0"
											onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectModel('per-room')}>
											<td class="pt-radio"><span class="radio-dot" class:radio-dot-on={draft.pricingModel === 'per-room'}></span></td>
											<td class="pt-model">Per Room</td>
										<td class="pt-val">
											{#if totalRooms > 0 && total > 0}
												<span class="pt-amount">${roundUsd(prExpected)}</span>
											{:else}—{/if}
										</td>
										<td class="pt-val">
											{#if totalRooms > 0 && total > 0}
												<span class="pt-amount">${roundUsd(prMax)}</span>
											{:else}—{/if}
										</td>
										</tr>
										<tr class="pt-row" class:pt-selected={draft.pricingModel === 'per-bed'}
											onclick={() => selectModel('per-bed')} role="button" tabindex="0"
											onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectModel('per-bed')}>
											<td class="pt-radio"><span class="radio-dot" class:radio-dot-on={draft.pricingModel === 'per-bed'}></span></td>
											<td class="pt-model">Per Bed</td>
											<td class="pt-val pt-val--bed-summary" colspan="2">
												<div class="bed-summary-copy">
													<p class="bed-summary-text">
														What each guest pays depends on <strong>which bed they choose</strong>. Open the{' '}
														<button
															type="button"
															class="bed-summary-link bed-summary-link--inline"
															onclick={openBedBreakdownModal}
														>
															room-by-room breakdown
														</button>
														{' '}for estimated ranges by room and bed.
													</p>
												</div>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- ── Activity-planning (left column, below cost) ──── -->
		<div class="addon-card addon-card--compact" class:active={activitiesEnabled} onclick={toggleActivities} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleActivities()}>
			<div class="addon-header">
				<div class="addon-title-group">
					<span class="addon-icon activity-icon">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polygon points="3 11 22 2 13 21 11 13 3 11"/>
						</svg>
					</span>
					<span class="addon-title">Activity-planning</span>
				</div>
				<label class="addon-toggle" class:checked={activitiesEnabled} onclick={(e) => e.stopPropagation()}>
					<input
						type="checkbox"
						checked={activitiesEnabled}
						onchange={toggleActivities}
						aria-label="Enable activity-planning"
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
				</label>
			</div>

			<div class="addon-body">
				{#if !activitiesEnabled}
					<div class="addon-pane unchecked-pane activity-unchecked-pane">
						<p class="addon-desc activity-unchecked-desc">
							Plan and organize what your group will do during the trip. Discover nearby places, build a shared itinerary, and let guests suggest ideas.
						</p>
						<div class="activity-itin-fade" aria-hidden="true">
							<div class="activity-itin-mock">
								<div class="itin-mini-grid itin-mini-grid--3day">
									<div class="itin-mini-corner"></div>
									<div class="itin-mini-dayhead itin-mini-dayhead--col">
										<span class="itin-mini-daynum">13</span>
										<span class="itin-mini-dow">FRI</span>
									</div>
									<div class="itin-mini-dayhead itin-mini-dayhead--col">
										<span class="itin-mini-daynum">14</span>
										<span class="itin-mini-dow">SAT</span>
									</div>
									<div class="itin-mini-dayhead">
										<span class="itin-mini-daynum">15</span>
										<span class="itin-mini-dow">SUN</span>
									</div>
									<div class="itin-mini-time">9 AM</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Road trip</span>
											<div class="itin-mini-evt-row">
												<span class="itin-mini-evt-time">9:00 AM</span>
												<span class="itin-mini-evt-pill">✓5</span>
											</div>
										</div>
									</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--meal">
											<span class="itin-mini-evt-title">Breakfast</span>
											<span class="itin-mini-evt-time">9:00 AM</span>
										</div>
									</div>
									<div class="itin-mini-cell itin-mini-cell--empty"></div>
									<div class="itin-mini-time">10 AM</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Check-in</span>
											<span class="itin-mini-evt-time">10:00 AM</span>
										</div>
									</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Kayak</span>
											<div class="itin-mini-evt-row">
												<span class="itin-mini-evt-time">10:30 AM</span>
												<span class="itin-mini-evt-pill">✓4</span>
											</div>
										</div>
									</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Hike</span>
											<div class="itin-mini-evt-row">
												<span class="itin-mini-evt-time">10:00 AM</span>
												<span class="itin-mini-evt-pill">✓6</span>
											</div>
										</div>
									</div>
									<div class="itin-mini-time">11 AM</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Explore town</span>
											<span class="itin-mini-evt-time">11:00 AM</span>
										</div>
									</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Farmers market</span>
											<span class="itin-mini-evt-time">11:20 AM</span>
										</div>
									</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--meal">
											<span class="itin-mini-evt-title">Brunch</span>
											<span class="itin-mini-evt-time">11:45 AM</span>
											<span class="itin-mini-chef">🍳 Sam</span>
										</div>
									</div>
									<div class="itin-mini-time">2 PM</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Sunset walk</span>
											<span class="itin-mini-evt-time">2:00 PM</span>
										</div>
									</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Board games</span>
											<span class="itin-mini-evt-time">2:00 PM</span>
										</div>
									</div>
									<div class="itin-mini-cell">
										<div class="itin-mini-event itin-mini-event--activity">
											<span class="itin-mini-evt-title">Pack up</span>
											<div class="itin-mini-evt-row">
												<span class="itin-mini-evt-time">2:30 PM</span>
												<span class="itin-mini-evt-pill">✓3</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{:else}
				<div class="addon-pane checked-pane info-pane">
					<p class="info-intro">Your guests can now access the full activity toolkit:</p>
						<ul class="feature-list">
							<li>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
								Discover nearby activities &amp; restaurants
							</li>
							<li>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
								Manually add your own activities
							</li>
							<li>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
								Create activity polls for the group
							</li>
							<li>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
								Build a shared itinerary with dates &amp; times
							</li>
						</ul>
					</div>
				{/if}
			</div>
		</div>
		</div>

		<div class="addons-column">
		<!-- ── Meal-planning ────────────────────────────────── -->
		<div class="addon-card addon-card--compact" class:active={mealsEnabled} onclick={toggleMeals} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleMeals()}>
			<div class="addon-header">
				<div class="addon-title-group">
					<span class="addon-icon meal-icon">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 11l19-9-9 19-2-8-8-2z"/>
						</svg>
					</span>
					<span class="addon-title">Meal-planning</span>
				</div>
				<label class="addon-toggle" class:checked={mealsEnabled} onclick={(e) => e.stopPropagation()}>
					<input
						type="checkbox"
						checked={mealsEnabled}
						onchange={toggleMeals}
						aria-label="Enable meal-planning"
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
				</label>
			</div>

			<div class="addon-body">
				{#if !mealsEnabled}
					<div class="addon-pane unchecked-pane">
						<p class="addon-desc">Coordinate meals and food plans with your group. Sign-up sheets, shared funds, or just let everyone know what's happening.</p>
					</div>
			{:else}
				<div class="addon-pane checked-pane meal-checked-pane" onclick={(e) => e.stopPropagation()} role="none">
					<div class="config-row meal-config-row">
						<div class="radio-stack">
							<label class="radio-option" onclick={(e) => e.stopPropagation()} role="none">
								<input
									type="radio"
									name="mealMode"
									value="signups"
									checked={mealMode === 'signups'}
									onchange={() => setMealMode('signups')}
								/>
								<div class="radio-content">
									<span class="radio-label">Meal Sign-ups</span>
									<span class="radio-desc">Guests claim breakfast, lunch, or dinner slots</span>
								</div>
							</label>
							<label
								class="radio-option radio-option--fund-row"
								onclick={(e) => e.stopPropagation()}
								role="none"
							>
								<input
									type="radio"
									name="mealMode"
									value="fund"
									checked={mealMode === 'fund'}
									onchange={() => setMealMode('fund')}
								/>
								<div class="radio-content">
									<span class="radio-label">Shared Food Fund</span>
									<span class="radio-desc">Everyone contributes to a collective budget</span>
								</div>
								{#if mealMode === 'fund'}
									<div class="meal-fund-split" onclick={(e) => e.stopPropagation()} role="none">
										<span class="meal-fund-field-label" id="foodFundTotalSplit-label">Total to split</span>
										<div class="currency-wrap meal-fund-currency">
											<span class="currency-sym">$</span>
											<input
												id="foodFundTotalSplit"
												type="number"
												class="config-input meal-fund-input"
												required
												min="0.01"
												step="0.01"
												placeholder="0.00"
												aria-labelledby="foodFundTotalSplit-label"
												value={draft.meals?.fundConfig?.totalToSplit ?? ''}
												oninput={(e) => {
													ensureMealsFundConfig();
													const v = (e.target as HTMLInputElement).value;
													if (draft.meals?.fundConfig) {
														draft.meals.fundConfig.totalToSplit = v;
														autosave();
													}
												}}
											/>
										</div>
									</div>
								{/if}
							</label>
						</div>
					</div>
				</div>
				{/if}
			</div>
		</div>

		<!-- ── Games ────────────────────────────────────────── -->
		<div class="addon-card addon-card--games addon-card--tall" class:active={gamesEnabled} onclick={toggleGames} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleGames()}>
			<div class="addon-header">
				<div class="addon-title-group">
					<span class="addon-icon game-icon">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="2" y="7" width="20" height="14" rx="2"/>
							<path d="M16 3h-4m2-2v4"/>
							<circle cx="8" cy="14" r="1" fill="currentColor"/>
							<circle cx="12" cy="14" r="1" fill="currentColor"/>
							<circle cx="16" cy="14" r="1" fill="currentColor"/>
						</svg>
					</span>
					<span class="addon-title">Games</span>
				</div>
				<label class="addon-toggle" class:checked={gamesEnabled} onclick={(e) => e.stopPropagation()}>
					<input
						type="checkbox"
						checked={gamesEnabled}
						onchange={toggleGames}
						aria-label="Enable games"
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
				</label>
			</div>

			<div class="addon-body">
				{#if !gamesEnabled}
					<div class="addon-pane unchecked-pane games-unchecked-pane">
						<p class="addon-desc games-unchecked-desc">
							Add fun, interactive games for your group. Keep everyone entertained before and during the trip.
						</p>
						<div class="games-bingo-fade" aria-hidden="true">
							<div class="games-bingo-mock">
								<div class="bingo-board-frame">
									<div class="bingo-board-inner">
										<span class="bingo-letter">B</span>
										<span class="bingo-letter">I</span>
										<span class="bingo-letter">N</span>
										<span class="bingo-letter">G</span>
										<span class="bingo-letter">O</span>
										{#each SCAVENGER_BINGO_ITEMS as item, idx}
											<div
												class="bingo-cell"
												class:has-photo={GAMES_BINGO_MOCK_PHOTOS.has(idx)}
											>
												{#if GAMES_BINGO_MOCK_PHOTOS.has(idx)}
													<div class="games-bingo-mock-snapshim"></div>
												{/if}
												<span class="bingo-item-icon">{item.icon}</span>
												<span class="bingo-label">{item.label}</span>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>
					</div>
				{:else}
				<div class="addon-pane checked-pane" onclick={(e) => e.stopPropagation()} role="none">
					<div class="config-row">
							<div class="config-label">Choose your games <span class="optional-tag">optional</span></div>
							<div class="game-list">
								{#each GAMES as game}
									<label class="game-option" onclick={(e) => e.stopPropagation()} role="none">
										<input
											type="checkbox"
											checked={selectedGames.includes(game.id)}
											onchange={() => toggleGame(game.id)}
										/>
										<div class="game-content">
											<span class="game-name">{game.name}</span>
											<span class="game-desc">{game.desc}</span>
										</div>
									</label>
								{/each}
							</div>
							<p class="config-note">You can also manage games from your trip portal later.</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
		</div>
	</div>

	{#if bedBreakdownModalOpen}
		<div class="bed-modal-backdrop" onclick={closeBedBreakdownModal} role="presentation"></div>
		<div
			class="bed-modal-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="bed-modal-title"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="bed-modal-header">
				<h3 id="bed-modal-title" class="bed-modal-title">Per-bed pricing</h3>
				<button type="button" class="bed-modal-close" onclick={closeBedBreakdownModal} aria-label="Close">×</button>
			</div>
			<div class="bed-modal-body">
				<div class="bed-modal-intro">
					<p class="bed-modal-intro-lead">
						Each bed gets a share of the trip cost.
						<span class="bed-modal-intro-dot" aria-hidden="true">·</span>
						Bigger beds and more private rooms cost more.
					</p>
					<p class="bed-modal-amounts-scope">
						Each price is that bed’s <strong>total for the whole trip</strong> (not per night). The left table can show a low–high range; the right table is a single amount per bed when every bed is filled.
					</p>
				</div>
				<div class="bed-modal-table-labels">
					<div class="bed-modal-table-label bed-modal-table-label--exp">
						<span class="bed-label-tag">{expected} guest{expected !== 1 ? 's' : ''}</span>
						<span class="bed-label-desc">may vary based on sharing</span>
					</div>
					<div class="bed-modal-table-label bed-modal-table-label--max">
						<span class="bed-label-tag">all beds filled</span>
						<span class="bed-label-desc">fixed per bed</span>
					</div>
				</div>

				{#if perBedByRoom.length > 0 && total > 0}
					<div class="bed-modal-columns">
						<div class="bed-modal-col">
							<div class="bed-modal-table-shell bed-modal-table-shell--exp">
								<table class="bed-mini-table bed-mini-table--modal">
									<tbody>
										{#each perBedByRoom as grp, gi}
											{#each grp.beds as b, bi}
												<tr class:bed-mini-room-sep={bi === 0 && gi > 0}>
													<td class="bed-mini-desc-modal">
														<span class="bed-mini-room-name">{grp.roomName}</span><span class="bed-mini-dot" aria-hidden="true">·</span><span class="bed-mini-bed-label">{b.label}</span>
													</td>
													<td class="bed-mini-price-modal">
														<span class="bed-price-total">{formatBedPriceTotal(b.low, b.high)}</span>
													</td>
												</tr>
											{/each}
										{/each}
									</tbody>
								</table>
							</div>
						</div>
						<div class="bed-modal-col">
							<div class="bed-modal-table-shell bed-modal-table-shell--max">
								<table class="bed-mini-table bed-mini-table--modal">
									<tbody>
										{#each perBedByRoomFull as grp, gi}
											{#each grp.beds as b, bi}
												<tr class:bed-mini-room-sep={bi === 0 && gi > 0}>
													<td class="bed-mini-desc-modal">
														<span class="bed-mini-room-name">{grp.roomName}</span><span class="bed-mini-dot" aria-hidden="true">·</span><span class="bed-mini-bed-label bed-mini-bed-label--max">{b.label}</span>
													</td>
													<td class="bed-mini-price-modal">
														<span class="bed-price-total bed-price-total--max">{formatBedPriceTotal(b.low, b.high)}</span>
													</td>
												</tr>
											{/each}
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{:else}
					<p class="bed-modal-empty">
						Add rooms and beds in <strong>Basics &amp; Rooms</strong> and enter a <strong>total trip cost</strong> above to see per-bed estimates here.
					</p>
				{/if}
			</div>
			<div class="bed-modal-footer">
				<button type="button" class="bed-modal-done" onclick={closeBedBreakdownModal}>Done</button>
			</div>
		</div>
	{/if}

</div>

<style>
	/* Dancing Script: loaded in app.html with other fonts to avoid bingo-letter FOUT */

	/* ── Layout ───────────────────────────────────────────── */
	.addons-screen {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.addons-header {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.addons-title {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.25rem;
		letter-spacing: -0.02em;
	}

	.addons-subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}

	/* Two independent columns: same vertical gap within each (meal→games matches cost→activity) */
	.addons-grid {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 1rem;
	}

	.addons-column {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* ── Card shell ───────────────────────────────────────── */
	.addon-card {
		background: #f3f4f6;
		border: 1.5px solid rgba(15, 23, 42, 0.1);
		border-radius: 1rem;
		overflow: hidden;
		cursor: pointer;
		transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
		user-select: none;
	}

	.addon-card:hover {
		border-color: var(--primary);
		box-shadow: 0 2px 12px rgba(30, 58, 138, 0.08);
	}

	.addon-card:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.addon-card.active {
		border-color: var(--primary);
		background: rgba(30, 58, 138, 0.025);
	}

	/* ── Card header ──────────────────────────────────────── */
	.addon-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.125rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.addon-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.addon-icon {
		width: 28px;
		height: 28px;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.cost-icon { background: rgba(30, 58, 138, 0.1); color: var(--primary); }
	.meal-icon { background: rgba(191, 78, 48, 0.1); color: var(--copper, #bf4e30); }
	.activity-icon { background: rgba(47, 119, 120, 0.1); color: var(--slate, #2f7778); }
	.game-icon { background: rgba(120, 80, 180, 0.1); color: #7850b4; }

	.addon-title {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	/* ── Toggle switch ────────────────────────────────────── */
	.addon-toggle {
		position: relative;
		flex-shrink: 0;
	}

	.addon-toggle input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-track {
		display: block;
		width: 38px;
		height: 22px;
		background: var(--border);
		border-radius: 999px;
		position: relative;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.addon-toggle.checked .toggle-track {
		background: var(--primary);
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s ease;
	}

	.addon-toggle.checked .toggle-thumb {
		transform: translateX(16px);
	}

	/* ── Card body (fixed height; pair sizes via --compact / --tall) ─ */
	.addon-body {
		position: relative;
		overflow: hidden;
	}

	/* Shorter pair: meal-planning + activity-planning (same height) */
	.addon-card--compact .addon-body {
		height: 175px;
		overflow-y: auto;
	}

	/* Activity unchecked: no scroll — clip faux itinerary at card bottom */
	.addon-card--compact:has(.activity-unchecked-pane) .addon-body {
		overflow-y: hidden;
	}

	/* Taller pair: cost-sharing + games (same height) */
	.addon-card--tall .addon-body {
		height: 312px;
		overflow-y: auto;
	}

	.addon-card--tall:has(.games-unchecked-pane) .addon-body {
		overflow-y: hidden;
	}

	.addon-pane {
		position: absolute;
		inset: 0;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	/* ── Unchecked pane ───────────────────────────────────── */
	.unchecked-pane {
		opacity: 1;
	}

	.addon-desc {
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.55;
		margin: 0;
		flex: 1;
	}

	/* Activity card · ghost itinerary: lives in the bottom-right quadrant of the body */
	.activity-unchecked-pane {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		overflow: hidden;
	}

	.activity-unchecked-desc {
		flex: 0 1 auto;
		padding-right: 0.25rem;
	}

	.activity-itin-fade {
		position: relative;
		flex: 1;
		min-height: 0;
		align-self: stretch;
		/* Cancel .addon-pane padding so the quadrant can hug the card body */
		margin-left: -1.125rem;
		margin-right: -1.125rem;
		margin-bottom: -1rem;
		padding: 0 0.15rem 0 0.25rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: flex-end;
		-webkit-mask-image: linear-gradient(
			to right,
			#000 0%,
			#000 58%,
			rgba(0, 0, 0, 0.5) 80%,
			transparent 100%
		);
		mask-image: linear-gradient(
			to right,
			#000 0%,
			#000 58%,
			rgba(0, 0, 0, 0.5) 80%,
			transparent 100%
		);
	}

	.activity-itin-mock {
		width: min(26.5rem, 100%);
		max-height: 100%;
		flex-shrink: 0;
		margin-right: 1.65rem;
		background: rgba(255, 255, 255, 0.38);
		border: 1px solid rgba(226, 232, 240, 0.65);
		border-radius: 0.5rem;
		box-shadow: 0 1px 6px rgba(17, 24, 39, 0.04);
		padding: 0;
		overflow: hidden;
		opacity: 0.62;
		filter: saturate(0.38);
	}

	/* Same palette as itinerary EVENT_STYLES */
	.itin-mini-grid {
		display: grid;
		grid-template-columns: 2.15rem 1fr;
		grid-template-rows: auto repeat(4, minmax(2.05rem, auto));
		font-size: 0.5rem;
		line-height: 1.15;
		align-items: stretch;
	}

	.itin-mini-grid--3day {
		grid-template-columns: 2.15rem minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
	}

	.itin-mini-grid--3day > .itin-mini-dayhead--col {
		border-right: 1px solid #f0f2f5;
	}

	/* Time row: time + 3 day cells → vertical borders before last column */
	.itin-mini-grid--3day > .itin-mini-cell:nth-child(4n + 6),
	.itin-mini-grid--3day > .itin-mini-cell:nth-child(4n + 7) {
		border-right: 1px solid #f0f2f5;
	}

	.itin-mini-corner {
		background: #f8fafc;
		border-right: 1px solid #f0f2f5;
		border-bottom: 1px solid #f0f2f5;
		min-height: 1.65rem;
	}

	.itin-mini-dayhead {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		padding: 0.2rem 0.25rem;
		background: #f8fafc;
		border-bottom: 1px solid #f0f2f5;
		min-height: 1.65rem;
		box-sizing: border-box;
	}

	.itin-mini-daynum {
		font-size: 0.6875rem;
		font-weight: 800;
		color: #1e293b;
		line-height: 1;
	}

	.itin-mini-dow {
		font-size: 0.4375rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: #94a3b8;
		text-transform: uppercase;
	}

	.itin-mini-time {
		padding: 0 0.15rem 0 0.2rem;
		font-size: 0.5rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.03em;
		line-height: 1.1;
		white-space: nowrap;
		color: #94a3b8;
		background: #f8fafc;
		border-right: 1px solid #f0f2f5;
		border-bottom: 1px solid #f0f2f5;
		display: flex;
		align-items: flex-start;
		padding-top: 0.28rem;
		box-sizing: border-box;
	}

	.itin-mini-cell {
		border-bottom: 1px solid #f0f2f5;
		padding: 0.14rem 0.2rem 0.12rem 0.18rem;
		display: flex;
		align-items: flex-start;
		box-sizing: border-box;
		min-height: 0;
		overflow: hidden;
	}

	.itin-mini-cell--empty {
		background: #fff;
	}

	.itin-mini-event {
		position: relative;
		width: 100%;
		max-width: 100%;
		border-radius: 5px;
		padding: 0.15rem 0.28rem 0.18rem;
		display: flex;
		flex-direction: column;
		gap: 0.04rem;
		box-sizing: border-box;
		overflow: hidden;
		align-self: start;
	}

	.itin-mini-event--meal {
		background: rgba(232, 93, 38, 0.12);
		border: 1px solid #e85d26;
	}

	.itin-mini-event--meal .itin-mini-evt-title {
		color: #7c2d12;
	}

	.itin-mini-event--meal .itin-mini-evt-time,
	.itin-mini-event--meal .itin-mini-chef {
		color: #c2410c;
	}

	.itin-mini-event--meal:has(.itin-mini-chef) {
		padding-bottom: 0.42rem;
	}

	.itin-mini-event--activity {
		background: rgba(74, 167, 91, 0.13);
		border: 1px solid #3a9e53;
	}

	.itin-mini-event--activity .itin-mini-evt-title {
		color: #14532d;
	}

	.itin-mini-event--activity .itin-mini-evt-time,
	.itin-mini-event--activity .itin-mini-evt-pill {
		color: #166534;
	}

	.itin-mini-evt-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.2rem;
		margin-top: 0.02rem;
		flex-wrap: nowrap;
		min-width: 0;
	}

	.itin-mini-evt-title {
		font-weight: 700;
		font-size: 0.5rem;
		line-height: 1.15;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.itin-mini-evt-time {
		font-size: 0.4375rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		line-height: 1.15;
		white-space: nowrap;
		flex-shrink: 0;
		opacity: 0.9;
	}

	.itin-mini-chef {
		position: absolute;
		bottom: 0.1rem;
		right: 0.2rem;
		font-size: 0.375rem;
		opacity: 0.88;
		max-width: 55%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.itin-mini-evt-pill {
		font-size: 0.4rem;
		font-weight: 700;
		opacity: 0.92;
		flex-shrink: 0;
	}

	/* Games card · scavenger bingo preview: same chrome as trip Games board, bottom-left flush */
	.games-unchecked-pane {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		overflow: hidden;
	}

	.games-unchecked-desc {
		flex: 0 1 auto;
		padding-right: 0.25rem;
	}

	.games-bingo-fade {
		position: relative;
		flex: 1;
		min-height: 0;
		align-self: stretch;
		margin-left: -1.125rem;
		margin-right: -1.125rem;
		margin-bottom: -1rem;
		padding: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: flex-start;
		-webkit-mask-image: linear-gradient(
			to top right,
			#000 0%,
			#000 40%,
			rgba(0, 0, 0, 0.5) 72%,
			transparent 100%
		);
		mask-image: linear-gradient(
			to top right,
			#000 0%,
			#000 40%,
			rgba(0, 0, 0, 0.5) 72%,
			transparent 100%
		);
	}

	.games-bingo-mock {
		flex-shrink: 0;
		width: min(29rem, 122%);
		max-height: 108%;
		margin: 0 0 -0.9rem 0;
		line-height: normal;
		opacity: 0.65;
		filter: saturate(0.35);
	}

	/* Copied from trips/[tripId]/games bingo board, scoped + compact for card */
	.games-bingo-mock .bingo-board-frame {
		display: inline-block;
		padding: 1.1rem 1.45rem;
		border-radius: 1.25rem;
		box-shadow: 0 6px 26px rgba(0, 0, 0, 0.09);
		background:
			radial-gradient(ellipse 120% 80% at 20% 30%, rgba(255, 182, 193, 0.35) 0%, transparent 50%),
			radial-gradient(ellipse 100% 100% at 80% 20%, rgba(221, 160, 221, 0.3) 0%, transparent 50%),
			radial-gradient(ellipse 90% 70% at 50% 80%, rgba(173, 216, 230, 0.35) 0%, transparent 50%),
			linear-gradient(135deg, rgba(255, 218, 185, 0.25) 0%, rgba(230, 230, 250, 0.3) 50%, rgba(240, 248, 255, 0.25) 100%);
	}

	.games-bingo-mock .bingo-board-inner {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.34rem;
		width: 100%;
		max-width: 26.5rem;
	}

	.games-bingo-mock .bingo-letter {
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Dancing Script', 'Brush Script MT', cursive;
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: 0.02em;
		padding-bottom: 0.12rem;
	}

	.games-bingo-mock .bingo-cell {
		aspect-ratio: 1;
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 0.52rem;
		padding: 0.26rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		background: #fff;
		position: relative;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		overflow: hidden;
		pointer-events: none;
		cursor: default;
	}

	.games-bingo-mock .bingo-cell.has-photo .bingo-item-icon,
	.games-bingo-mock .bingo-cell.has-photo .bingo-label {
		display: none;
	}

	.games-bingo-mock .games-bingo-mock-snapshim {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: calc(0.52rem - 1px);
		background: linear-gradient(145deg, #a7f3d0 0%, #5eead4 42%, #fde68a 88%);
	}

	.games-bingo-mock .bingo-item-icon {
		font-size: 1.15rem;
		line-height: 1;
		margin-bottom: 0.12rem;
		position: relative;
		z-index: 1;
	}

	.games-bingo-mock .bingo-cell .bingo-label {
		position: relative;
		z-index: 1;
		text-shadow: 0 0 2px var(--surface, #fff);
	}

	.games-bingo-mock .bingo-label {
		font-size: 0.52rem;
		font-weight: 600;
		line-height: 1.15;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	/* ── Checked pane ─────────────────────────────────────── */
	.checked-pane {
		gap: 0.75rem;
		cursor: default;
	}

	/* ── Config rows ──────────────────────────────────────── */
	.config-row {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.config-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.optional-tag {
		font-size: 0.6875rem;
		font-weight: 400;
		color: var(--muted);
		background: var(--bg, #f8fafc);
		padding: 0.1rem 0.375rem;
		border-radius: 999px;
		border: 1px solid var(--border);
	}

	.config-note {
		font-size: 0.6875rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.4;
	}

	/* ── Currency input ───────────────────────────────────── */
	.currency-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.currency-sym {
		position: absolute;
		left: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text);
		pointer-events: none;
		z-index: 1;
	}

	.config-input {
		padding: 0.4rem 0.5rem 0.4rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		width: 100%;
		outline: none;
		transition: border-color 0.15s;
	}

	.config-input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px rgba(30, 58, 138, 0.1);
	}

	/* ── Radio options (meals) ────────────────────────────── */
	.radio-stack {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.radio-option {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
		background: white;
		transition: border-color 0.15s, background 0.15s;
	}

	.radio-option:has(input:checked) {
		border-color: var(--primary);
		background: rgba(30, 58, 138, 0.04);
	}

	.radio-option input[type='radio'] {
		margin-top: 2px;
		accent-color: var(--primary);
		flex-shrink: 0;
		cursor: pointer;
	}

	.radio-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.radio-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.radio-desc {
		font-size: 0.6875rem;
		color: var(--muted);
		line-height: 1.3;
	}

	.radio-option--fund-row {
		flex-wrap: wrap;
		align-items: flex-start;
	}

	.radio-option--fund-row .radio-content {
		flex: 1;
		min-width: 9rem;
	}

	.meal-fund-split {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
		flex: 0 1 auto;
		min-width: 0;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.meal-fund-field-label {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.meal-fund-currency .meal-fund-input {
		width: 6.75rem;
	}

	.meal-checked-pane {
		padding-top: 0.65rem;
	}

	.meal-config-row {
		margin-top: 0.3rem;
	}

	/* ── Activity info pane ───────────────────────────────── */
	.info-pane {
		gap: 0.5rem;
	}

	.info-intro {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--muted);
		margin: 0;
		line-height: 1.45;
	}

	.feature-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem 0.65rem;
	}

	.feature-list li {
		display: flex;
		align-items: flex-start;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: var(--text);
		font-weight: 500;
		min-width: 0;
	}

	.feature-list li svg {
		color: var(--slate, #2f7778);
		flex-shrink: 0;
	}

	/* ── Games list ───────────────────────────────────────── */
	.game-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.game-option {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
		background: white;
		transition: border-color 0.15s, background 0.15s;
	}

	.game-option:has(input:checked) {
		border-color: #7850b4;
		background: rgba(120, 80, 180, 0.04);
	}

	.game-option input[type='checkbox'] {
		margin-top: 2px;
		accent-color: #7850b4;
		flex-shrink: 0;
		cursor: pointer;
	}

	.game-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.game-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.game-desc {
		font-size: 0.6875rem;
		color: var(--muted);
		line-height: 1.3;
	}

	/* ── Cost-sharing checked pane layout ────────────────── */
	.cost-checked-pane {
		gap: 0.45rem;
		overflow: visible;
	}

	.cost-input-label {
		flex-shrink: 0;
		margin: 0;
		font-size: 0.8125rem;
		text-align: left;
	}

	.cost-input {
		width: 100%;
	}

	/* Total cost: label left of field, note below; then pricing model header + table */
	.cost-pricing-toolbar {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.cost-total-block {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.12rem;
		width: 100%;
		padding: 0;
	}

	.cost-total-inline {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
		width: 100%;
	}

	.cost-total-block .cost-input-label {
		justify-content: flex-end;
		width: auto;
	}

	.cost-input-label--tip {
		cursor: help;
		text-decoration: underline dotted;
		text-underline-offset: 0.15em;
	}

	.cost-total-block .currency-wrap {
		width: 7.5rem;
		max-width: 100%;
		flex-shrink: 0;
	}

	.cost-total-block .cost-input {
		text-align: right;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.cost-total-block .cost-input::-webkit-outer-spin-button,
	.cost-total-block .cost-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.pricing-model-header {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.35rem 1rem;
		min-width: 0;
		width: 100%;
	}

	/* ── Pricing section ─────────────────────────────────── */
	.pricing-section {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex: 1;
		min-height: 0;
	}

	.pricing-table-title {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.02em;
		line-height: 1.2;
		flex: 1 1 auto;
		min-width: 0;
	}

	.pricing-table-meta {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted);
		line-height: 1.35;
		text-align: right;
		flex: 0 1 auto;
		max-width: 100%;
	}

	.pricing-table-wrap {
		overflow-x: auto;
		flex: 1;
		min-height: 0;
		padding-left: 0.125rem;
		padding-right: 0.125rem;
	}

	.pricing-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		table-layout: fixed;
	}

	.pricing-table th {
		padding: 0.35rem 0.4rem;
		text-align: center;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--bg, #f8fafc);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	/* Dividers only: Model | Total cost at expected | Total cost at max */
	.pricing-table th:nth-child(2),
	.pricing-table td:nth-child(2),
	.pricing-table th:nth-child(3),
	.pricing-table td:nth-child(3) {
		border-right: 1px solid rgba(0, 0, 0, 0.07);
	}

	.pricing-table th:first-child {
		width: 1.5rem;
	}
	.pricing-table th:nth-child(2) {
		width: 18%;
	}
	.pricing-table th:nth-child(3),
	.pricing-table th:nth-child(4) {
		width: 41%;
		text-align: center;
		white-space: normal;
		line-height: 1.25;
	}

	.pricing-table td {
		padding: 0.38rem 0.45rem;
		vertical-align: middle;
		text-align: center;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
	}

	/* Compact rows; Per bed row grows with copy */
	.pricing-table tbody .pt-row td {
		padding-top: 1.05rem;
		padding-bottom: 1.05rem;
		box-sizing: border-box;
		vertical-align: middle;
	}

	.pricing-table tbody .pt-row:nth-child(2) td {
		padding-top: 1.05rem;
		padding-bottom: 1.05rem;
	}

	/* Per bed: row height follows the tallest cell — radio + label were still 1.05rem */
	.pricing-table tbody .pt-row:nth-child(3) td {
		padding-top: 0.72rem;
		padding-bottom: 0.72rem;
	}

	.pt-row {
		cursor: pointer;
		transition: background 0.1s;
	}

	.pt-row:hover { background: rgba(30,58,138,0.04); }

	.pt-row.pt-selected { background: rgba(30,58,138,0.07); }

	.pt-radio {
		vertical-align: middle;
		text-align: center;
	}

	.radio-dot {
		display: inline-block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--border);
		background: white;
		vertical-align: middle;
		flex-shrink: 0;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.radio-dot.radio-dot-on {
		border-color: var(--primary);
		box-shadow: inset 0 0 0 3px white, inset 0 0 0 8px var(--primary);
	}

	.pt-model {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		text-align: center;
	}

	.pt-val {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		text-align: center;
		line-height: 1.45;
	}

	.pt-amount {
		display: block;
		font-weight: 600;
		color: var(--text);
	}

	.pt-val--bed-summary {
		text-align: center;
		vertical-align: middle;
		padding: 0.28rem 0.4rem;
		font-weight: 400;
		line-height: 1.35;
	}

	.bed-summary-copy {
		max-width: 36rem;
		margin: 0 auto;
		text-align: center;
	}

	.bed-summary-text {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.28;
		color: var(--text);
	}

	.bed-summary-link--inline {
		vertical-align: baseline;
		line-height: inherit;
	}

	.bed-summary-link {
		display: inline;
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-size: inherit;
		font-weight: 600;
		color: var(--primary);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.bed-summary-link:hover {
		color: var(--primary-dark, #152a66);
	}

	.bed-mini-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.6875rem;
		table-layout: auto;
	}

	.bed-mini-table tbody tr.bed-mini-room-sep td {
		padding-top: 0.4rem;
		border-top: 1px solid rgba(0, 0, 0, 0.07);
	}

	.bed-mini-table td {
		padding: 0.08rem 0.3rem 0.08rem 0;
		vertical-align: top;
		border: none;
		line-height: 1.35;
	}

	/* ── Per-bed breakdown modal ──────────────────────────── */
	.bed-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 2000;
		background: rgba(15, 23, 42, 0.5);
		backdrop-filter: blur(3px);
	}

	.bed-modal-panel {
		--bed-violet: #6d28d9;
		--bed-violet-soft: rgba(109, 40, 217, 0.12);
		--bed-teal: #0f766e;
		--bed-teal-soft: rgba(15, 118, 110, 0.12);
		--bed-coral: #c2410c;
		--bed-coral-soft: rgba(194, 65, 12, 0.12);
		--bed-amber: #b45309;
		--bed-slate: #475569;

		position: fixed;
		z-index: 2010;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(56rem, calc(100vw - 1.5rem));
		max-height: min(88vh, 52rem);
		display: flex;
		flex-direction: column;
		background: linear-gradient(165deg, #ffffff 0%, #f8fafc 48%, #f5f3ff 100%);
		border-radius: 0.875rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.28);
		border: 1px solid var(--border);
		overflow: hidden;
	}

	.bed-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.125rem;
		border-bottom: 1px solid var(--border);
		background: #fff;
		flex-shrink: 0;
	}

	.bed-modal-title {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.2;
		color: var(--text);
	}

	.bed-modal-close {
		width: 2.25rem;
		height: 2.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--muted);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.bed-modal-close:hover {
		background: rgba(0, 0, 0, 0.06);
		color: var(--text);
	}

	.bed-modal-body {
		padding: 1.1rem 1.2rem 1.35rem;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.bed-modal-intro {
		margin: 0 0 0.85rem;
	}

	.bed-modal-intro-lead {
		margin: 0 0 0.45rem;
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--muted);
		line-height: 1.45;
	}

	.bed-modal-intro-dot {
		margin: 0 0.35rem;
		color: var(--border);
		font-weight: 600;
	}

	.bed-modal-amounts-scope {
		margin: 0.45rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--muted);
		font-weight: 450;
	}

	.bed-modal-amounts-scope strong {
		color: var(--text);
		font-weight: 600;
	}

	.bed-modal-table-labels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1rem;
		margin: 0 0 0.5rem;
	}

	.bed-modal-table-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.15rem;
	}

	.bed-label-tag {
		display: inline-block;
		font-weight: 800;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.12em 0.5em;
		border-radius: 0.3rem;
	}

	.bed-modal-table-label--exp .bed-label-tag {
		color: var(--bed-violet);
		background: var(--bed-violet-soft);
	}

	.bed-modal-table-label--max .bed-label-tag {
		color: var(--bed-coral);
		background: var(--bed-coral-soft);
	}

	.bed-label-desc {
		font-size: 0.8rem;
		font-weight: 450;
		color: var(--muted);
	}

	.bed-modal-empty {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.bed-modal-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem 1.25rem;
		margin-top: 0.25rem;
	}

	.bed-modal-col {
		min-width: 0;
	}

	.bed-modal-table-shell {
		border-radius: 0.7rem;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.1);
		background: #fff;
		box-shadow:
			0 1px 3px rgba(15, 23, 42, 0.06),
			0 8px 24px -8px rgba(109, 40, 217, 0.12);
	}

	.bed-mini-table--modal {
		font-size: 0.8125rem;
		table-layout: fixed;
		width: 100%;
	}

	.bed-mini-table--modal tbody tr:nth-child(odd) {
		background: rgba(248, 250, 252, 0.9);
	}

	.bed-mini-table--modal tbody tr:nth-child(even) {
		background: rgba(255, 255, 255, 0.95);
	}

	.bed-mini-table--modal tbody tr:hover {
		background: rgba(109, 40, 217, 0.06);
	}

	.bed-modal-table-shell--max .bed-mini-table--modal tbody tr:hover {
		background: rgba(206, 86, 18, 0.07);
	}

	.bed-mini-table--modal td {
		padding: 0.38rem 0.65rem;
		vertical-align: middle;
	}

	.bed-mini-table--modal tbody tr.bed-mini-room-sep td {
		padding-top: 0.55rem;
		border-top: 1px dashed rgba(15, 23, 42, 0.14);
	}

	.bed-mini-desc-modal {
		padding-right: 0.5rem !important;
		line-height: 1.4;
		word-break: break-word;
	}

	.bed-mini-room-name {
		font-weight: 800;
		color: var(--text);
		letter-spacing: -0.02em;
	}

	.bed-mini-dot {
		display: inline-block;
		padding: 0 0.28em;
		font-weight: 400;
		color: var(--muted);
		font-size: 0.85em;
	}

	.bed-mini-bed-label {
		font-weight: 600;
		color: var(--bed-violet);
	}

	.bed-modal-table-shell--max .bed-mini-bed-label,
	.bed-mini-bed-label--max {
		color: var(--warm, #ce5612);
	}

	.bed-price-total--max {
		color: var(--warm, #ce5612);
	}

	.bed-mini-price-modal {
		font-variant-numeric: tabular-nums;
		width: 42%;
		text-align: right;
		vertical-align: middle;
		padding-left: 0.35rem !important;
	}

	.bed-price-total {
		font-weight: 800;
		color: var(--text);
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.bed-modal-footer {
		padding: 0.75rem 1.125rem;
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
		background: var(--bg, #f8fafc);
	}

	.bed-modal-done {
		padding: 0.5rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		color: white;
		background: var(--primary);
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.bed-modal-done:hover {
		background: var(--primary-dark, #152a66);
	}

	/* ── Responsive ───────────────────────────────────────── */
	@media (max-width: 800px) {
		.addons-grid {
			flex-direction: column;
		}

		.bed-modal-columns {
			grid-template-columns: 1fr;
		}
	}
</style>
