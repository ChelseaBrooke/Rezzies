<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import { computePerBedRangeByBedId } from '$lib/pricing/per-bed-selection.js';

	// Universal bed weights (see PRICING_MATH.md); privacy from room type or inferred from slot count
	const BED_WEIGHTS: Record<string, number> = {
		twin: 1.0,
		single: 1.0,
		bunk: 0.9,
		full: 1.1,
		double: 1.1,
		queen: 1.2,
		king: 1.3,
		sofa: 0.85,
		sofa_bed: 0.85,
		air_mattress: 0.75,
		other: 1.0
	};
	function bedWeight(type: string): number {
		return BED_WEIGHTS[type.toLowerCase().replace(/\s+/g, '_')] ?? BED_WEIGHTS.other;
	}
	function roomSlotCount(room: { beds?: Array<{ count?: number }> }): number {
		if (!room.beds?.length) return 0;
		return room.beds.reduce((s, b) => s + (b.count || 1), 0);
	}
	// Matches server getEffectivePrivacyFactor: 1 bed → 1.25, 2 → 1.125, 3+ → 1.0
	function privacyFactor(room: { type?: string; beds?: Array<{ count?: number }> }): number {
		const bedCount = roomSlotCount(room);
		return Math.max(1.0, Math.min(1.25, 1.25 - (bedCount - 1) * 0.125));
	}

	type PricingModelOption = 'per-person' | 'per-room' | 'per-bed';

	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();

	const expected = $derived(Math.max(1, Number(draft.expectedGuestCount) || 1));
	const max = $derived(Math.max(expected, Math.max(1, Number(draft.maxOccupancy) || 1)));

	const nights = $derived.by(() => {
		if (!draft.checkInDate || !draft.checkOutDate) return 0;
		const checkIn = new Date(draft.checkInDate);
		const checkOut = new Date(draft.checkOutDate);
		const diff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
		return diff > 0 ? diff : 0;
	});

	const customItemsTotal = $derived(
		draft.customLineItems?.length
			? draft.customLineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
			: 0
	);
	const total = $derived((parseFloat(draft.totalTripCost) || 0) + customItemsTotal);

	const rooms = $derived(draft.rooms ?? []);
	const totalRooms = $derived(rooms.length);
	const totalBeds = $derived(
		rooms.reduce((sum, room) => sum + room.beds.reduce((b, bed) => b + bed.count, 0), 0)
	);
	const bedsByType = $derived.by(() => {
		const map = new Map<string, number>();
		rooms.forEach((room) => {
			room.beds.forEach((bed) => {
				const t = bed.bedType.toLowerCase().replace(/\s+/g, '_');
				map.set(t, (map.get(t) ?? 0) + bed.count);
			});
		});
		return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
	});
	const perRoomCost = $derived(totalRooms > 0 ? total / totalRooms : 0);
	const perPersonAtMin = $derived(expected > 0 ? total / expected : 0);
	const perPersonAtMax = $derived(max > 0 ? total / max : 0);

	// Per-room: denominator = sum of (room privacy × people in room). We don't have assignments in preview, so approximate: assume guests fill rooms (by maxOccupancy). Then denominator = sum over rooms of (privacy × min(people in room, capacity)).
	const roomDenomExpected = $derived.by(() => {
		let remaining = expected;
		let sum = 0;
		for (const room of rooms) {
			const cap = Math.max(1, room.maxOccupants ?? 1);
			const people = Math.min(cap, remaining);
			if (people <= 0) break;
			sum += privacyFactor(room) * people;
			remaining -= people;
		}
		return Math.max(sum, expected);
	});
	const roomDenomMax = $derived.by(() => {
		let remaining = max;
		let sum = 0;
		for (const room of rooms) {
			const cap = Math.max(1, room.maxOccupants ?? 1);
			const people = Math.min(cap, remaining);
			if (people <= 0) break;
			sum += privacyFactor(room) * people;
			remaining -= people;
		}
		return Math.max(sum, max);
	});
	const perRoomPricePerPersonExpected = $derived(roomDenomExpected > 0 ? total / roomDenomExpected : 0);
	const perRoomPricePerPersonMax = $derived(roomDenomMax > 0 ? total / roomDenomMax : 0);

	const BED_SPOT_COUNTS_P: Record<string, number> = {
		twin: 1, single: 1, bunk: 2, full: 2, double: 2,
		queen: 2, king: 2, sofa: 2, sofa_bed: 2, air_mattress: 2, other: 1
	};
	function bedSpotCountP(type: string): number {
		return BED_SPOT_COUNTS_P[type.toLowerCase().replace(/\s+/g, '_')] ?? 1;
	}

	// PER_BED: occupancy-based simulation (matches server / Add-Ons step)
	const perBedSlotBreakdown = $derived.by(() => {
		type U = { bedId: string; weight: number; spotCount: number };
		const units: U[] = [];
		rooms.forEach((room, ri) => {
			const p = privacyFactor(room);
			room.beds.forEach((bed, bi) => {
				const w = bedWeight(bed.bedType) * p;
				const count = Math.max(1, bed.count || 1);
				for (let i = 0; i < count; i++) {
					units.push({ bedId: `p-${ri}-${bi}-${i}`, weight: w, spotCount: bedSpotCountP(bed.bedType) });
				}
			});
		});
		if (units.length === 0 || total <= 0) return [];
		const totalSpots = units.reduce((s, u) => s + u.spotCount, 0);
		const sim = Math.min(expected, totalSpots);
		const rangeMap = computePerBedRangeByBedId(total, sim, units);
		const list: {
			roomName: string;
			bedType: string;
			label: string;
			low: number;
			high: number;
			perNightLow: number;
			perNightHigh: number;
			lowPP: number;
			highPP: number;
		}[] = [];
		rooms.forEach((room, ri) => {
			const roomName = room.name || 'Room';
			room.beds.forEach((bed, bi) => {
				const count = Math.max(1, bed.count || 1);
				const typeLabel = bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1).replace(/_/g, ' ');
				for (let i = 0; i < count; i++) {
					const id = `p-${ri}-${bi}-${i}`;
					const r = rangeMap.get(id);
					list.push({
						roomName,
						bedType: bed.bedType,
						label: count > 1 ? `${roomName}, ${typeLabel} ${i + 1}` : `${roomName}, ${typeLabel}`,
						low: r?.lowBedPrice ?? 0,
						high: r?.highBedPrice ?? 0,
						perNightLow: nights > 0 ? (r?.lowBedPrice ?? 0) / nights : 0,
						perNightHigh: nights > 0 ? (r?.highBedPrice ?? 0) / nights : 0,
						lowPP: r?.lowPerPersonPrice ?? 0,
						highPP: r?.highPerPersonPrice ?? 0
					});
				}
			});
		});
		return list;
	});

	const perPersonAtMinPerNight = $derived(nights > 0 ? perPersonAtMin / nights : 0);
	const perPersonAtMaxPerNight = $derived(nights > 0 ? perPersonAtMax / nights : 0);
	const perRoomCostPerNight = $derived(nights > 0 ? perRoomCost / nights : 0);

	function selectModel(value: PricingModelOption) {
		draft.pricingModel = value;
		autosave();
	}
</script>

<div class="step-content pricing-step">
	<div class="step-header">
		<h1 class="step-title">Pricing</h1>
		<p class="step-subtitle">Set guest counts and compare how each pricing model affects cost per person or per room.</p>
	</div>

	<div class="pricing-inputs section-box">
		<div class="input-row">
			<div class="form-group">
				<label for="expectedGuestCount" class="form-label">Expected guest count (minimum)</label>
				<input
					type="number"
					id="expectedGuestCount"
					class="form-input"
					bind:value={draft.expectedGuestCount}
					oninput={autosave}
					min="1"
					placeholder="e.g. 6"
				/>
			</div>
			<div class="form-group">
				<label for="maxOccupancy" class="form-label">Max occupancy (if everyone RSVPs)</label>
				<input
					type="number"
					id="maxOccupancy"
					class="form-input"
					bind:value={draft.maxOccupancy}
					oninput={autosave}
					min="1"
					placeholder="e.g. 10"
				/>
			</div>
		</div>
		<p class="cost-note">Total trip cost: <strong>${total.toFixed(2)}</strong> (set in Basics &amp; Rooms)</p>
	</div>

	<div class="comparison section-box">
		<p class="section-header-with-caption"><strong>Compare pricing models</strong> <span class="separator">|</span> Choose how you want to split the total cost. Costs update based on expected vs. max headcount where applicable.</p>
		<div class="comparison-table-wrapper">
			<table class="comparison-table">
				<thead>
					<tr>
						<th class="col-select">Choose</th>
						<th class="col-model">Model</th>
						<th class="col-scenario">At {expected} guest{expected !== 1 ? 's' : ''} (expected)</th>
						<th class="col-scenario">At {max} guest{max !== 1 ? 's' : ''} (max RSVPs)</th>
					</tr>
				</thead>
				<tbody>
					<tr class="model-row" class:selected={draft.pricingModel === 'per-person'} role="button" tabindex="0" onclick={() => selectModel('per-person')} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectModel('per-person'); } }}>
						<td class="col-select">
							<label class="radio-label">
								<input
									type="radio"
									name="pricingModel"
									value="per-person"
									checked={draft.pricingModel === 'per-person'}
									onchange={() => selectModel('per-person')}
								/>
								<span class="radio-custom"></span>
							</label>
						</td>
						<td class="col-model">Per Person</td>
						<td class="col-scenario">
							<span>${perPersonAtMin.toFixed(2)} per person</span>
							{#if nights > 0}
								<p class="per-night"><strong>Per night:</strong> ${perPersonAtMinPerNight.toFixed(2)}</p>
							{/if}
						</td>
						<td class="col-scenario">
							<span>${perPersonAtMax.toFixed(2)} per person</span>
							{#if nights > 0}
								<p class="per-night"><strong>Per night:</strong> ${perPersonAtMaxPerNight.toFixed(2)}</p>
							{/if}
						</td>
					</tr>
					<tr class="model-row" class:selected={draft.pricingModel === 'per-room'} role="button" tabindex="0" onclick={() => selectModel('per-room')} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectModel('per-room'); } }}>
						<td class="col-select">
							<label class="radio-label">
								<input
									type="radio"
									name="pricingModel"
									value="per-room"
									checked={draft.pricingModel === 'per-room'}
									onchange={() => selectModel('per-room')}
								/>
								<span class="radio-custom"></span>
							</label>
						</td>
						<td class="col-model">Per Room</td>
						<td class="col-scenario">
							{#if totalRooms > 0}
								<span>${perRoomPricePerPersonExpected.toFixed(2)} per person</span>
								{#if nights > 0}
									<p class="per-night"><strong>Per night:</strong> ${(perRoomPricePerPersonExpected / nights).toFixed(2)}</p>
								{/if}
							{:else}
								—
							{/if}
						</td>
						<td class="col-scenario">
							{#if totalRooms > 0}
								<span>${perRoomPricePerPersonMax.toFixed(2)} per person</span>
								{#if nights > 0}
									<p class="per-night"><strong>Per night:</strong> ${(perRoomPricePerPersonMax / nights).toFixed(2)}</p>
								{/if}
							{:else}
								—
							{/if}
						</td>
					</tr>
					<tr class="model-row" class:selected={draft.pricingModel === 'per-bed'} role="button" tabindex="0" onclick={() => selectModel('per-bed')} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectModel('per-bed'); } }}>
						<td class="col-select">
							<label class="radio-label">
								<input
									type="radio"
									name="pricingModel"
									value="per-bed"
									checked={draft.pricingModel === 'per-bed'}
									onchange={() => selectModel('per-bed')}
								/>
								<span class="radio-custom"></span>
							</label>
						</td>
						<td class="col-model">Per Bed</td>
						<td class="col-scenario" colspan="2">
							{#if perBedSlotBreakdown.length > 0}
								<ul class="bed-breakdown bed-by-room">
									{#each perBedSlotBreakdown as item, i (item.roomName + '-' + item.bedType + '-' + i)}
										<li>
											<span class="bed-slot-label">{item.label}</span>
											<span class="bed-slot-price">${item.low.toFixed(2)}–${item.high.toFixed(2)}</span>
											{#if nights > 0}
												<p class="per-night">
													<strong>Per night:</strong> ${item.perNightLow.toFixed(2)}–${item.perNightHigh.toFixed(2)}
												</p>
											{/if}
											<p class="per-night per-person-price">${item.lowPP.toFixed(2)}–${item.highPP.toFixed(2)}<span class="per-person-label">/person</span></p>
										</li>
									{/each}
								</ul>
								<p class="per-bed-col-note">Simulated at {expected} guest{expected !== 1 ? 's' : ''}. Prices vary based on how guests share beds; live price reflects who actually books which bed.</p>
							{:else}
								—
							{/if}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
		{#if draft.pricingModel === 'per-bed'}
			<p class="per-bed-note">
				Each <strong>bed</strong> earns a share of the trip total from bed weight and room privacy. We show a <strong>low–high</strong> range for each bed at your expected headcount; prices vary based on how guests share beds. After guests choose beds, <strong>live price</strong> splits each bed’s share among the people on that bed.
			</p>
		{/if}
		{#if draft.pricingModel === 'per-room'}
			<p class="formula-note"><strong>Formula:</strong> Price per person = Total cost × (room privacy) ÷ denominator. Denominator = sum of (room privacy × people in that room) for occupied rooms, with a floor of guest count. More guests → larger denominator → lower price per person.</p>
		{/if}
	</div>
</div>

<style>
	.pricing-step {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.step-header {
		display: block;
	}
	.step-title {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.2;
	}
	.step-subtitle {
		margin: 0.2em 0 0;
		color: var(--muted);
		font-size: 0.9375rem;
		line-height: 1.3;
	}
	.section-box {
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1.5rem;
	}
	.section-header {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
	}
	.pricing-inputs .input-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.form-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
	}
	.form-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 1rem;
	}
	.cost-note {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
	.section-header-with-caption {
		margin: 0 0 1rem 0;
		font-size: 0.9375rem;
		color: var(--text);
		line-height: 1.5;
	}
	.section-header-with-caption strong {
		color: var(--text);
	}
	.section-header-with-caption .separator {
		margin: 0 0.5em;
		color: var(--muted);
		font-weight: normal;
	}
	.per-bed-note {
		margin: 1rem 0 0;
		font-size: 0.875rem;
		color: var(--muted);
		line-height: 1.5;
		max-width: 56ch;
	}
	.per-bed-col-note {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.45;
		max-width: 52ch;
	}
	.formula-note {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.45;
		max-width: 56ch;
	}
	.comparison-table-wrapper {
		overflow-x: auto;
	}
	.comparison-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}
	.comparison-table th,
	.comparison-table td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	.comparison-table tbody tr {
		height: 9rem;
	}
	.comparison-table tbody td.col-scenario {
		height: 9rem;
		max-height: 9rem;
		overflow-y: auto;
	}
	.per-night {
		margin: 0.35rem 0 0 0;
		font-size: 0.8125rem;
		color: var(--text);
	}
	.per-night strong {
		font-weight: 700;
	}
	.comparison-table thead th {
		font-weight: 600;
		color: var(--text);
		background: var(--surface2);
	}
	.comparison-table tbody tr.model-row {
		cursor: pointer;
	}
	.comparison-table tbody tr.model-row:hover {
		background: var(--surface2);
	}
	.comparison-table tbody tr.selected {
		background: rgba(102, 126, 234, 0.08);
	}
	.col-select {
		width: 4rem;
		vertical-align: middle;
	}
	.col-model {
		min-width: 8rem;
		font-weight: 500;
	}
	.col-scenario {
		min-width: 10rem;
		color: var(--muted);
	}
	.bed-breakdown {
		margin: 0;
		padding-left: 1.25rem;
		list-style: disc;
		font-size: 0.875rem;
	}
	.bed-breakdown li {
		margin-bottom: 0.35rem;
	}
	.bed-breakdown li:last-child {
		margin-bottom: 0;
	}
	.bed-breakdown .per-night {
		margin: 0.15rem 0 0 0;
	}
	.per-person-price {
		font-weight: 700;
		color: var(--primary, #1e3a8a);
		font-size: 0.8125rem;
	}
	.per-person-label {
		font-weight: 500;
		font-size: 0.9em;
		color: var(--muted);
		margin-left: 0.1em;
	}
	.bed-by-room li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem;
	}
	.bed-slot-label {
		flex: 1;
		min-width: 0;
	}
	.bed-slot-price {
		font-weight: 600;
		color: var(--text);
	}
	.radio-label {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}
	.radio-label input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.radio-custom {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid var(--border);
		border-radius: 50%;
		background: white;
		position: relative;
	}
	.radio-label input:checked + .radio-custom {
		border-color: var(--primary);
		background: var(--primary);
		box-shadow: inset 0 0 0 3px white;
	}
	@media (max-width: 768px) {
		.pricing-inputs .input-row {
			grid-template-columns: 1fr;
		}
		.comparison-table th,
		.comparison-table td {
			padding: 0.5rem 0.75rem;
			font-size: 0.875rem;
		}
	}
</style>
