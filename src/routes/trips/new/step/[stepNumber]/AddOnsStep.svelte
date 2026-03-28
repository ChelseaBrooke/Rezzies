<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import { computePerBedRangeByBedId } from '$lib/pricing/per-bed-selection.js';

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
	function setMealMode(mode: 'signups' | 'fund') {
		if (!draft.meals) return;
		draft.meals.modes.signups = mode === 'signups';
		draft.meals.modes.fund = mode === 'fund';
		draft.meals.modes.informal = false;
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
	function bedWeight(type: string): number {
		return BED_WEIGHTS[type.toLowerCase().replace(/\s+/g, '_')] ?? 1.0;
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

	/** Selection-based PER_BED: expected sim + full occupancy (every bed taken). */
	const perBedSelection = $derived.by(() => {
		type U = { bedId: string; bedType: string; weight: number };
		const units: U[] = [];
		rooms.forEach((room, ri) => {
			const p = privacyFactor(room);
			room.beds.forEach((bed, bi) => {
				const w = bedWeight(bed.bedType) * p;
				const count = Math.max(1, bed.count || 1);
				for (let i = 0; i < count; i++) {
					units.push({
						bedId: `w-${ri}-${bi}-${i}`,
						bedType: bed.bedType.toLowerCase(),
						weight: w
					});
				}
			});
		});
		type BedRow = { label: string; low: number; high: number };
		type RoomGrp = { roomName: string; beds: BedRow[] };
		const empty = {
			groups: [] as RoomGrp[],
			groupsFull: [] as RoomGrp[],
			byType: [] as { type: string; low: number; high: number }[],
			bedCount: 0
		};
		if (units.length === 0 || total <= 0) {
			return empty;
		}
		const sim = Math.min(expected, units.length);
		const rangeMap = computePerBedRangeByBedId(total, sim, units);
		const rangeMapFull = computePerBedRangeByBedId(total, units.length, units);

		function buildGroups(map: Map<string, { low: number; high: number }>): RoomGrp[] {
			const groups: RoomGrp[] = [];
			rooms.forEach((room, ri) => {
				const roomName = room.name?.trim() || `Room ${ri + 1}`;
				const beds: BedRow[] = [];
				room.beds.forEach((bed, bi) => {
					const count = Math.max(1, bed.count || 1);
					const typeLabel = bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1).replace(/_/g, ' ');
					for (let i = 0; i < count; i++) {
						const id = `w-${ri}-${bi}-${i}`;
						const r = map.get(id) ?? { low: 0, high: 0 };
						beds.push({
							label: count > 1 ? `${typeLabel} ${i + 1}` : typeLabel,
							low: r.low,
							high: r.high
						});
					}
				});
				if (beds.length > 0) groups.push({ roomName, beds });
			});
			return groups;
		}

		const groups = buildGroups(rangeMap);
		const groupsFull = buildGroups(rangeMapFull);

		const byType: Record<string, { low: number; high: number }> = {};
		for (const u of units) {
			const r = rangeMap.get(u.bedId);
			if (!r) continue;
			if (!byType[u.bedType]) byType[u.bedType] = { low: r.low, high: r.high };
			else {
				byType[u.bedType].low = Math.min(byType[u.bedType].low, r.low);
				byType[u.bedType].high = Math.max(byType[u.bedType].high, r.high);
			}
		}
		const byTypeList = Object.entries(byType).map(([type, r]) => ({
			type: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
			low: r.low,
			high: r.high
		}));
		return { groups, groupsFull, byType: byTypeList, bedCount: units.length };
	});

	const perBedByRoom = $derived(perBedSelection.groups);
	const perBedByRoomFull = $derived(perBedSelection.groupsFull);
	const perBedBedCount = $derived(perBedSelection.bedCount);
	const perBedTypeEstimates = $derived(perBedSelection.byType);

	function formatBedPriceTotal(low: number, high: number): string {
		const a = roundUsd(low);
		const b = roundUsd(high);
		if (a === b) return `$${a}`;
		return `$${a}–$${b}`;
	}
	function formatBedPriceNight(low: number, high: number): string {
		if (nights <= 0) return '';
		const a = roundUsd(low / nights);
		const b = roundUsd(high / nights);
		if (a === b) return `$${a}/night`;
		return `$${a}–$${b}/night`;
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
		<p class="addons-subtitle">Select the features you want for this trip. Everything can be changed later.</p>
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
					{#if costEnabled}<span class="header-badge">✓ Active</span>{/if}
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
						<div class="addon-illustration cost-illustration">
							<div class="illus-bg">
								<svg width="60" height="60" viewBox="0 0 60 60" fill="none">
									<circle cx="30" cy="30" r="28" fill="rgba(30,58,138,0.08)"/>
									<circle cx="30" cy="30" r="20" fill="rgba(30,58,138,0.12)"/>
									<text x="30" y="38" text-anchor="middle" font-size="22" font-weight="700" fill="rgba(30,58,138,0.6)" font-family="sans-serif">$</text>
								</svg>
								<div class="illus-dots">
									<span class="illus-dot"></span>
									<span class="illus-dot"></span>
									<span class="illus-dot"></span>
								</div>
							</div>
						</div>
						<p class="addon-desc">Automatically calculate what each guest pays based on your trip setup. Costs update dynamically as headcount changes.</p>
						<p class="addon-cta-hint">Enable to configure →</p>
					</div>
				{:else}
					<div class="addon-pane checked-pane cost-checked-pane" onclick={(e) => e.stopPropagation()} role="none">
						<!-- Pricing model comparison table -->
						<div class="pricing-section">
							<div class="cost-pricing-toolbar">
								<div class="pricing-toolbar-left">
									<span class="pricing-table-title">Choose pricing model</span>
									<span class="pricing-table-meta">
										{expected} expected · {maxG} max · {nights > 0 ? `${nights}n` : 'dates not set'}
									</span>
								</div>
								<div class="pricing-toolbar-total">
									<div class="cost-input-inline">
										<label class="config-label cost-input-label" for="totalTripCost">Total Trip Cost</label>
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
											/>
										</div>
									</div>
									<span class="inline-note inline-note--total">incl. fees &amp; taxes guests will split</span>
								</div>
							</div>

							<div class="pricing-table-wrap">
								<table class="pricing-table">
									<thead>
										<tr>
											<th></th>
											<th>Model</th>
											<th>At {expected} guest{expected !== 1 ? 's' : ''}</th>
											<th>At {maxG} guest{maxG !== 1 ? 's' : ''}</th>
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
												<span class="pt-amount">${roundUsd(ppExpected)}</span>{#if nights > 0}<span class="pt-night">${roundUsd(ppExpected / nights)}/night</span>{/if}
											{:else}—{/if}
										</td>
										<td class="pt-val">
											{#if total > 0}
												<span class="pt-amount">${roundUsd(ppMax)}</span>{#if nights > 0}<span class="pt-night">${roundUsd(ppMax / nights)}/night</span>{/if}
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
												<span class="pt-amount">${roundUsd(prExpected)}</span>{#if nights > 0}<span class="pt-night">${roundUsd(prExpected / nights)}/night</span>{/if}
											{:else}—{/if}
										</td>
										<td class="pt-val">
											{#if totalRooms > 0 && total > 0}
												<span class="pt-amount">${roundUsd(prMax)}</span>{#if nights > 0}<span class="pt-night">${roundUsd(prMax / nights)}/night</span>{/if}
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
													{#if perBedTypeEstimates.length > 0 && total > 0}
														<div class="bed-type-est-list">
															{#each perBedTypeEstimates as row}
																<span class="bed-type-est"
																	>{row.type}: ${roundUsd(row.low)}–${roundUsd(row.high)}</span
																>
															{/each}
														</div>
													{:else}
														<span class="bed-summary-muted">Estimated price per bed (by type) after you add beds and cost.</span>
													{/if}
													<button
														type="button"
														class="bed-summary-link"
														onclick={openBedBreakdownModal}
													>
														Room-by-room breakdown
													</button>
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
					{#if activitiesEnabled}<span class="header-badge header-badge--teal">✓ Live</span>{/if}
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
					<div class="addon-pane unchecked-pane">
						<div class="addon-illustration activity-illustration">
							<div class="illus-bg">
								<svg width="60" height="60" viewBox="0 0 60 60" fill="none">
									<circle cx="30" cy="30" r="28" fill="rgba(47,119,120,0.08)"/>
									<circle cx="30" cy="30" r="20" fill="rgba(47,119,120,0.12)"/>
									<polygon points="30,18 36,26 44,27 38,33 40,41 30,37 20,41 22,33 16,27 24,26" stroke="rgba(47,119,120,0.6)" stroke-width="1.5" fill="none"/>
								</svg>
								<div class="illus-dots">
									<span class="illus-dot" style="background: rgba(47,119,120,0.3)"></span>
									<span class="illus-dot" style="background: rgba(47,119,120,0.3)"></span>
									<span class="illus-dot" style="background: rgba(47,119,120,0.3)"></span>
								</div>
							</div>
						</div>
						<p class="addon-desc">Plan and organize what your group will do during the trip. Discover nearby places, build a shared itinerary, and let guests suggest ideas.</p>
						<p class="addon-cta-hint">Enable to activate →</p>
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
					{#if mealsEnabled}<span class="header-badge header-badge--copper">✓ Added</span>{/if}
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
						<div class="addon-illustration meal-illustration">
							<div class="illus-bg">
								<svg width="60" height="60" viewBox="0 0 60 60" fill="none">
									<circle cx="30" cy="30" r="28" fill="rgba(191,78,48,0.08)"/>
									<circle cx="30" cy="30" r="20" fill="rgba(191,78,48,0.12)"/>
									<path d="M24 20v6a6 6 0 0 0 12 0v-6M30 38v4M27 42h6" stroke="rgba(191,78,48,0.6)" stroke-width="2" stroke-linecap="round"/>
								</svg>
								<div class="illus-dots">
									<span class="illus-dot" style="background: rgba(191,78,48,0.3)"></span>
									<span class="illus-dot" style="background: rgba(191,78,48,0.3)"></span>
									<span class="illus-dot" style="background: rgba(191,78,48,0.3)"></span>
								</div>
							</div>
						</div>
						<p class="addon-desc">Coordinate meals and food plans with your group. Sign-up sheets, shared funds, or just let everyone know what's happening.</p>
						<p class="addon-cta-hint">Enable to configure →</p>
					</div>
			{:else}
				<div class="addon-pane checked-pane" onclick={(e) => e.stopPropagation()} role="none">
					<div class="config-row">
							<label class="config-label">How will meals work?</label>
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
								<label class="radio-option" onclick={(e) => e.stopPropagation()} role="none">
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
					{#if gamesEnabled}<span class="header-badge header-badge--purple">✓ Active</span>{/if}
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
					<div class="addon-pane unchecked-pane">
						<div class="addon-illustration game-illustration">
							<div class="illus-bg">
								<svg width="60" height="60" viewBox="0 0 60 60" fill="none">
									<circle cx="30" cy="30" r="28" fill="rgba(120,80,180,0.08)"/>
									<circle cx="30" cy="30" r="20" fill="rgba(120,80,180,0.12)"/>
									<rect x="18" y="24" width="24" height="14" rx="3" stroke="rgba(120,80,180,0.6)" stroke-width="1.5" fill="none"/>
									<circle cx="24" cy="31" r="1.5" fill="rgba(120,80,180,0.6)"/>
									<circle cx="30" cy="31" r="1.5" fill="rgba(120,80,180,0.6)"/>
									<circle cx="36" cy="31" r="1.5" fill="rgba(120,80,180,0.6)"/>
									<path d="M28 19h4m-2-2v4" stroke="rgba(120,80,180,0.6)" stroke-width="1.5" stroke-linecap="round"/>
								</svg>
								<div class="illus-dots">
									<span class="illus-dot" style="background: rgba(120,80,180,0.3)"></span>
									<span class="illus-dot" style="background: rgba(120,80,180,0.3)"></span>
									<span class="illus-dot" style="background: rgba(120,80,180,0.3)"></span>
								</div>
							</div>
						</div>
						<p class="addon-desc">Add fun, interactive games for your group. Keep everyone entertained before and during the trip.</p>
						<p class="addon-cta-hint">Enable to pick games →</p>
					</div>
				{:else}
				<div class="addon-pane checked-pane" onclick={(e) => e.stopPropagation()} role="none">
					<div class="config-row">
							<label class="config-label">Choose your games <span class="optional-tag">optional</span></label>
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
				<p class="bed-modal-lede">
					<strong>Each bed gets a share of the total trip cost.</strong>
					What you pay for a spot depends on bed type and whether the room feels more private or shared.
				</p>
				<ul class="bed-modal-bullets">
					<li>
						<strong>Bigger beds</strong> (i.e., king vs. twin) are weighted a little higher, so they can cost a bit more per spot.
					</li>
					<li>
						<strong>Single-bed rooms</strong> get a privacy bump compared to rooms with several beds.
					</li>
				</ul>
			<p class="bed-modal-follow">
				<span class="bed-follow-mid">The left column assumes </span>
				<span class="bed-follow-tag bed-follow-tag--exp">{expected} guest{expected !== 1 ? 's' : ''}</span>
				<span class="bed-follow-mid">
					booking beds (capped at bed count). <strong>Low</strong> = others take priciest beds first; <strong>high</strong> = cheapest first.
					The right column is </span>
				<span class="bed-follow-tag bed-follow-tag--max">full occupancy</span>
				<span class="bed-follow-mid">
					— every bed taken ({perBedBedCount} guest{perBedBedCount !== 1 ? 's' : ''}), so each bed’s share is a fixed slice of the total. After people pick beds, cost is split among who’s on each bed.</span>
			</p>

				{#if perBedByRoom.length > 0 && total > 0}
					<div class="bed-modal-columns">
						<div class="bed-modal-col">
							<h4 class="bed-modal-col-title">At expected headcount</h4>
							<p class="bed-modal-col-sub bed-modal-col-sub--exp">{expected} guest{expected !== 1 ? 's' : ''} · low–high (full trip)</p>
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
														<div class="bed-price-stack">
															<span class="bed-price-total">{formatBedPriceTotal(b.low, b.high)}</span>
															{#if nights > 0}<span class="bed-price-night">{formatBedPriceNight(b.low, b.high)}</span>{/if}
														</div>
													</td>
												</tr>
											{/each}
										{/each}
									</tbody>
								</table>
							</div>
						</div>
						<div class="bed-modal-col">
							<h4 class="bed-modal-col-title">Full capacity</h4>
							<p class="bed-modal-col-sub bed-modal-col-sub--max">Every bed taken · est. per bed</p>
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
														<div class="bed-price-stack">
															<span class="bed-price-total bed-price-total--max">{formatBedPriceTotal(b.low, b.high)}</span>
															{#if nights > 0}<span class="bed-price-night">{formatBedPriceNight(b.low, b.high)}</span>{/if}
														</div>
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
		background: white;
		border: 1.5px solid var(--border);
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

	/* ── Header active badge ──────────────────────────────── */
	.header-badge {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--primary);
		background: rgba(30, 58, 138, 0.1);
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.header-badge--copper {
		color: var(--copper, #bf4e30);
		background: rgba(191, 78, 48, 0.1);
	}

	.header-badge--teal {
		color: var(--slate, #2f7778);
		background: rgba(47, 119, 120, 0.1);
	}

	.header-badge--purple {
		color: #7850b4;
		background: rgba(120, 80, 180, 0.1);
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
		height: 156px;
		overflow-y: auto;
	}

	/* Taller pair: cost-sharing + games (same height) */
	.addon-card--tall .addon-body {
		height: 330px;
		overflow-y: auto;
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

	.addon-illustration {
		flex-shrink: 0;
	}

	.illus-bg {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.illus-dots {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}

	.illus-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(30, 58, 138, 0.2);
	}

	.addon-desc {
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.55;
		margin: 0;
		flex: 1;
	}

	.addon-cta-hint {
		font-size: 0.75rem;
		color: var(--primary);
		margin: 0;
		font-weight: 500;
		opacity: 0.7;
	}

	/* ── Checked pane ─────────────────────────────────────── */
	.checked-pane {
		gap: 0.75rem;
		cursor: default;
	}

	.activated-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--primary);
		background: rgba(30, 58, 138, 0.08);
		padding: 0.3rem 0.625rem;
		border-radius: 999px;
		flex-shrink: 0;
		align-self: flex-start;
	}

	.activated-badge.teal {
		color: var(--slate, #2f7778);
		background: rgba(47, 119, 120, 0.08);
	}

	.activated-badge.purple {
		color: #7850b4;
		background: rgba(120, 80, 180, 0.08);
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

	/* ── Segmented control (pricing model) ───────────────── */
	.segment-control {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--bg, #f8fafc);
	}

	.segment-btn {
		flex: 1;
		padding: 0.4rem 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
		font-family: inherit;
		background: transparent;
		border: none;
		color: var(--muted);
		cursor: pointer;
		transition: all 0.15s;
		border-right: 1px solid var(--border);
		white-space: nowrap;
	}

	.segment-btn:last-child {
		border-right: none;
	}

	.segment-btn.selected {
		background: var(--primary);
		color: white;
		font-weight: 600;
	}

	.segment-btn:hover:not(.selected) {
		background: rgba(30, 58, 138, 0.05);
		color: var(--text);
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

	/* ── Activity info pane ───────────────────────────────── */
	.info-pane {
		gap: 0.5rem;
	}

	.info-intro {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.4;
	}

	.feature-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.feature-list li {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: var(--text);
		font-weight: 500;
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
		gap: 0.5rem;
		overflow: visible;
	}

	.cost-input-label {
		flex-shrink: 0;
		white-space: nowrap;
		margin: 0;
	}

	.cost-input {
		width: 100%;
	}

	/* One row: Choose pricing model (left) · Total Trip Cost (right) */
	.cost-pricing-toolbar {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.pricing-toolbar-left {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.pricing-toolbar-total {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.12rem;
		flex-shrink: 0;
	}

	.cost-input-inline {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: nowrap;
	}

	.pricing-toolbar-total .currency-wrap {
		width: 7rem;
		flex-shrink: 0;
	}

	.inline-note--total {
		font-size: 0.625rem;
		color: var(--muted);
		line-height: 1.25;
		text-align: right;
		max-width: 16rem;
	}

	/* ── Pricing section ─────────────────────────────────── */
	.pricing-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		flex: 1;
		min-height: 0;
	}

	.pricing-table-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
	}

	.pricing-table-meta {
		font-size: 0.6875rem;
		color: var(--muted);
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
		padding: 0.45rem 0.5rem;
		text-align: center;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--bg, #f8fafc);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	/* Dividers only: Model | At X guests | At Y guests */
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
	}

	.pricing-table td {
		padding: 0.45rem 0.5rem;
		vertical-align: middle;
		text-align: center;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
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
		padding: 0.45rem 0.5rem;
		font-weight: 400;
		line-height: 1.45;
	}

	.bed-summary-copy {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--text);
		display: block;
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

	.bed-type-est-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.6rem;
		justify-content: center;
		margin-bottom: 0.35rem;
	}

	.bed-type-est {
		font-size: 0.8125rem;
		color: var(--text);
	}

	.bed-summary-muted {
		font-size: 0.8125rem;
		color: var(--muted);
		display: block;
		margin-bottom: 0.25rem;
	}

	.bed-modal-single {
		margin-top: 0.75rem;
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

	.pt-night {
		display: block;
		margin-top: 0.12rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
		line-height: 1.25;
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
		border-bottom: 1px solid rgba(109, 40, 217, 0.15);
		background: linear-gradient(110deg, rgba(109, 40, 217, 0.07) 0%, rgba(15, 118, 110, 0.08) 100%);
		flex-shrink: 0;
	}

	.bed-modal-title {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.2;
		background: linear-gradient(120deg, var(--primary, #1e3a8a) 0%, var(--bed-violet) 55%, var(--bed-teal) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
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

	.bed-modal-lede {
		margin: 0 0 0.85rem;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--text);
		font-weight: 400;
	}

	.bed-modal-lede > strong:first-of-type {
		display: block;
		margin-bottom: 0.35rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.015em;
	}

	.bed-modal-bullets {
		margin: 0 0 0.85rem;
		padding: 0.65rem 0.85rem;
		list-style: none;
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--text);
		font-weight: 400;
		background: rgba(255, 255, 255, 0.65);
		border-radius: 0.65rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}

	.bed-modal-bullets li {
		margin-bottom: 0.55rem;
	}

	.bed-modal-bullets li:last-child {
		margin-bottom: 0;
	}

	.bed-modal-bullets li strong {
		font-weight: 700;
		color: var(--text);
	}

	.bed-modal-follow {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		line-height: 1.6;
		padding: 0;
		color: var(--bed-slate);
	}

	.bed-follow-when {
		font-weight: 700;
		color: var(--text);
	}

	.bed-follow-mid {
		font-weight: 450;
	}

	.bed-follow-drop {
		font-weight: 900;
		font-size: 1.02em;
		color: var(--bed-teal);
		letter-spacing: -0.02em;
	}

	.bed-follow-why {
		font-weight: 450;
	}

	.bed-follow-tag {
		display: inline-block;
		font-weight: 800;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.12em 0.45em;
		border-radius: 0.3rem;
		vertical-align: baseline;
	}

	.bed-follow-tag--exp {
		color: var(--bed-violet);
		background: var(--bed-violet-soft);
	}

	.bed-follow-tag--max {
		color: var(--bed-coral);
		background: var(--bed-coral-soft);
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

	.bed-modal-col-title {
		margin: 0 0 0.2rem;
		font-size: 0.9375rem;
		font-weight: 800;
		color: var(--text);
		text-align: center;
		letter-spacing: -0.02em;
	}

	.bed-modal-col-sub {
		margin: 0 0 0.55rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		text-align: center;
	}

	.bed-modal-col-sub--exp {
		color: var(--bed-violet);
	}

	.bed-modal-col-sub--max {
		color: var(--warm, #ce5612);
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

	.bed-price-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.08rem;
		line-height: 1.2;
	}

	.bed-price-total {
		font-weight: 800;
		color: var(--text);
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.bed-price-night {
		font-weight: 600;
		font-size: 0.78em;
		color: var(--muted);
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
