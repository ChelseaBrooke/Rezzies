<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';

	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();

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
	function privacyFactor(room: { beds?: Array<{ count?: number }> }): number {
		const slots = (room.beds ?? []).reduce((s, b) => s + (b.count || 1), 0);
		return slots === 1 ? 1.25 : 1.0;
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

	// Per-bed breakdown
	const perBedSlotCount = $derived(
		rooms.reduce((s, r) => s + r.beds.reduce((b, bed) => b + (bed.count || 1), 0), 0)
	);
	const perBedSumWeight = $derived.by(() => {
		let sum = 0;
		rooms.forEach((room) => {
			const p = privacyFactor(room);
			room.beds.forEach((bed) => { sum += (bed.count || 1) * bedWeight(bed.bedType) * p; });
		});
		return sum;
	});
	const perBedAvgWeight  = $derived(perBedSlotCount > 0 ? perBedSumWeight / perBedSlotCount : 1);
	const basePerBedSlots  = $derived(perBedSlotCount > 0 ? total / perBedSlotCount : 0);
	const basePerPersonMax = $derived(maxG > 0 ? total / maxG : 0);

	const perBedRows = $derived.by(() => {
		if (perBedSlotCount <= 0) return [];
		const avg = perBedAvgWeight || 1;
		const list: { label: string; priceExp: number; priceMax: number }[] = [];
		rooms.forEach((room, ri) => {
			const p = privacyFactor(room);
			const roomName = room.name?.trim() || `Room ${ri + 1}`;
			room.beds.forEach((bed) => {
				const w = bedWeight(bed.bedType);
				const unitExp = (basePerBedSlots  * (w * p)) / avg;
				const unitMax = (basePerPersonMax  * (w * p)) / avg;
				const count = Math.max(1, bed.count || 1);
				const typeLabel = bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1).replace(/_/g, ' ');
				for (let i = 0; i < count; i++) {
					list.push({
						label:
							count > 1
								? `${roomName} - ${typeLabel} ${i + 1}`
								: `${roomName} - ${typeLabel}`,
						priceExp: unitExp,
						priceMax: unitMax
					});
				}
			});
		});
		return list;
	});

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
			desc: 'Mark off items you spot at the destination — first to bingo wins'
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
					<!-- Total cost input row -->
					<div class="cost-input-row">
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
						<span class="inline-note">incl. fees &amp; taxes guests will split</span>
					</div>

						<!-- Pricing model comparison table -->
						<div class="pricing-section">
							<div class="pricing-table-header">
								<span class="pricing-table-title">Choose pricing model</span>
								<span class="pricing-table-meta">
									{expected} expected · {maxG} max · {nights > 0 ? `${nights}n` : 'dates not set'}
								</span>
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
											{total > 0 ? `$${ppExpected.toFixed(2)}` : '—'}{#if nights > 0 && total > 0}<span class="pt-night"> · ${(ppExpected/nights).toFixed(2)}/n</span>{/if}
										</td>
										<td class="pt-val">
											{total > 0 ? `$${ppMax.toFixed(2)}` : '—'}{#if nights > 0 && total > 0}<span class="pt-night"> · ${(ppMax/nights).toFixed(2)}/n</span>{/if}
										</td>
										</tr>
										<tr class="pt-row" class:pt-selected={draft.pricingModel === 'per-room'}
											onclick={() => selectModel('per-room')} role="button" tabindex="0"
											onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectModel('per-room')}>
											<td class="pt-radio"><span class="radio-dot" class:radio-dot-on={draft.pricingModel === 'per-room'}></span></td>
											<td class="pt-model">Per Room</td>
										<td class="pt-val">
											{#if totalRooms > 0 && total > 0}${prExpected.toFixed(2)}/p{#if nights > 0}<span class="pt-night"> · ${(prExpected/nights).toFixed(2)}/n</span>{/if}{:else}—{/if}
										</td>
										<td class="pt-val">
											{#if totalRooms > 0 && total > 0}${prMax.toFixed(2)}/p{#if nights > 0}<span class="pt-night"> · ${(prMax/nights).toFixed(2)}/n</span>{/if}{:else}—{/if}
										</td>
										</tr>
										<tr class="pt-row" class:pt-selected={draft.pricingModel === 'per-bed'}
											onclick={() => selectModel('per-bed')} role="button" tabindex="0"
											onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectModel('per-bed')}>
											<td class="pt-radio"><span class="radio-dot" class:radio-dot-on={draft.pricingModel === 'per-bed'}></span></td>
											<td class="pt-model">Per Bed</td>
											<td class="pt-val">
												{#if perBedRows.length > 0 && total > 0}
													<ul class="bed-list">{#each perBedRows as row}<li><span class="bed-name">{row.label}</span><span class="bed-price">${row.priceExp.toFixed(2)}</span></li>{/each}</ul>
												{:else}—{/if}
											</td>
											<td class="pt-val">
												{#if perBedRows.length > 0 && total > 0}
													<ul class="bed-list">{#each perBedRows as row}<li><span class="bed-name">{row.label}</span><span class="bed-price">${row.priceMax.toFixed(2)}</span></li>{/each}</ul>
												{:else}—{/if}
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

	.cost-input-row {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		min-width: 0;
	}

	.cost-input-label {
		flex-shrink: 0;
		white-space: nowrap;
		margin: 0;
	}

	.cost-input-row .currency-wrap {
		width: 7rem;
		flex-shrink: 0;
	}

	.cost-input {
		width: 100%;
	}

	.cost-input-row .inline-note {
		font-size: 0.625rem;
		color: var(--muted);
		line-height: 1.25;
		flex: 1 1 auto;
		min-width: 0;
	}

	/* ── Pricing section ─────────────────────────────────── */
	.pricing-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		flex: 1;
		min-height: 0;
	}

	.pricing-table-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-shrink: 0;
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
	}

	.pricing-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
		table-layout: fixed;
	}

	.pricing-table th {
		padding: 0.25rem 0.375rem;
		text-align: center;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--bg, #f8fafc);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.pricing-table th:first-child { width: 22px; }
	.pricing-table th:nth-child(2) { width: 70px; }

	.pricing-table td {
		padding: 0.3rem 0.375rem;
		vertical-align: middle;
		text-align: center;
		border-bottom: 1px solid rgba(0,0,0,0.04);
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
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--border);
		background: white;
		vertical-align: middle;
		flex-shrink: 0;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.radio-dot.radio-dot-on {
		border-color: var(--primary);
		box-shadow: inset 0 0 0 3px white, inset 0 0 0 7px var(--primary);
	}

	.pt-model {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		text-align: center;
	}

	.pt-val {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
		text-align: center;
	}

	.pt-night {
		display: inline;
		font-size: 0.625rem;
		font-weight: 400;
		color: var(--muted);
	}

	/* Per-bed list inside table cell */
	.bed-list {
		list-style: none;
		padding: 0;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: center;
		max-width: 100%;
	}

	.bed-list li {
		display: flex;
		justify-content: center;
		align-items: baseline;
		gap: 0.2rem;
		flex-wrap: nowrap;
	}

	.bed-name {
		font-size: 0.625rem;
		color: var(--muted);
		font-weight: 400;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 0 1 auto;
	}

	.bed-price {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text);
		flex-shrink: 0;
	}

	/* ── Responsive ───────────────────────────────────────── */
	@media (max-width: 800px) {
		.addons-grid {
			flex-direction: column;
		}
	}
</style>
