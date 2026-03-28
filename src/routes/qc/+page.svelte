<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { PageData, ActionData } from './$types';

	const QC_STORAGE_KEY = 'qc-form-state';

	type BedRow = { bedType: string; spotCount: number };
	type RoomRow = { beds: BedRow[] };
	type SelectionRow = { roomIndex: number; bedIndex: number };

	function getEmptyDefault() {
		return {
			totalTripCost: 0,
			totalTripNights: 1,
			minExpectedGuests: 1,
			maxCapacityGuests: 1,
			yesRsvpGuests: 0,
			partySize: 1,
			nightsStaying: 1,
			rooms: [] as RoomRow[],
			selections: [] as SelectionRow[]
		};
	}

	const emptyDefault = getEmptyDefault();

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let totalTripCost = $state(emptyDefault.totalTripCost);
	let totalTripNights = $state(emptyDefault.totalTripNights);
	let minExpectedGuests = $state(emptyDefault.minExpectedGuests);
	let maxCapacityGuests = $state(emptyDefault.maxCapacityGuests);
	let yesRsvpGuests = $state(emptyDefault.yesRsvpGuests);
	let partySize = $state(emptyDefault.partySize);
	let nightsStaying = $state(emptyDefault.nightsStaying);
	let rooms = $state<RoomRow[]>([]);
	let selections = $state<SelectionRow[]>([]);

	function saveToStorage() {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.setItem(
			QC_STORAGE_KEY,
			JSON.stringify({
				totalTripCost,
				totalTripNights,
				minExpectedGuests,
				maxCapacityGuests,
				yesRsvpGuests,
				partySize,
				nightsStaying,
				rooms,
				selections
			})
		);
	}

	function clearStorage() {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.removeItem(QC_STORAGE_KEY);
	}

	function restoreFromStorage() {
		if (typeof sessionStorage === 'undefined') return;
		const raw = sessionStorage.getItem(QC_STORAGE_KEY);
		if (!raw) return;
		try {
			const saved = JSON.parse(raw) as ReturnType<typeof getDefaultState>;
			if (saved.totalTripCost != null) totalTripCost = saved.totalTripCost;
			if (saved.totalTripNights != null) totalTripNights = saved.totalTripNights;
			if (saved.minExpectedGuests != null) minExpectedGuests = saved.minExpectedGuests;
			if (saved.maxCapacityGuests != null) maxCapacityGuests = saved.maxCapacityGuests;
			if (saved.yesRsvpGuests != null) yesRsvpGuests = saved.yesRsvpGuests;
			if (saved.partySize != null) partySize = saved.partySize;
			if ((saved as { nightsStaying?: number }).nightsStaying != null) nightsStaying = (saved as { nightsStaying: number }).nightsStaying;
			if (Array.isArray(saved.rooms)) rooms = saved.rooms;
			if (Array.isArray(saved.selections)) {
				selections = saved.selections.map((s: SelectionRow & { spotsClaimed?: number }) => ({
					roomIndex: s.roomIndex,
					bedIndex: s.bedIndex
				}));
			}
		} catch {
			// ignore invalid stored state
		}
	}

	onMount(() => {
		restoreFromStorage();
		window.addEventListener('beforeunload', clearStorage);
		return () => {
			window.removeEventListener('beforeunload', clearStorage);
			clearStorage();
		};
	});

	function addRoom() {
		rooms = [...rooms, { beds: [{ bedType: 'queen', spotCount: 1 }] }];
	}
	function removeRoom(roomIndex: number) {
		rooms = rooms.filter((_, i) => i !== roomIndex);
		selections = selections
			.filter((s) => s.roomIndex !== roomIndex)
			.map((s) => ({ ...s, roomIndex: s.roomIndex > roomIndex ? s.roomIndex - 1 : s.roomIndex, bedIndex: s.roomIndex === roomIndex ? 0 : s.bedIndex }));
	}
	function addBed(roomIndex: number) {
		rooms = rooms.map((r, i) => (i === roomIndex ? { beds: [...r.beds, { bedType: 'twin', spotCount: 1 }] } : r));
	}
	function removeBed(roomIndex: number, bedIndex: number) {
		rooms = rooms.map((r, i) => (i === roomIndex ? { beds: r.beds.filter((_, j) => j !== bedIndex) } : r));
		selections = selections.filter((s) => !(s.roomIndex === roomIndex && s.bedIndex === bedIndex));
	}
	function addSelection() {
		selections = [...selections, { roomIndex: 0, bedIndex: 0 }];
	}
	function removeSelection(idx: number) {
		selections = selections.filter((_, i) => i !== idx);
	}


	function buildPayload(): string {
		return JSON.stringify({
			totalTripCost,
			totalTripNights,
			minExpectedGuests,
			maxCapacityGuests,
			yesRsvpGuests,
			rooms,
			selections: selections.map((s) => ({
				roomIndex: s.roomIndex,
				bedIndex: s.bedIndex,
				spotsClaimed: rooms[s.roomIndex]?.beds[s.bedIndex]?.spotCount ?? 1,
				nightsStayed: nightsStaying
			}))
		});
	}

	const result = $derived(form?.success && form.result ? form.result : null);
	const error = $derived(form?.error ?? null);

	const bedWeightsEntries = $derived(
		data.defaultBedWeights
			? Object.entries(data.defaultBedWeights as Record<string, number>).sort((a, b) => a[0].localeCompare(b[0]))
			: []
	);
	const privacyRows = [
		{ beds: '1', factor: 1.25 },
		{ beds: '2', factor: 1.125 },
		{ beds: '3+', factor: 1.0 }
	];
	const typicalSpots: Record<string, number> = { king: 2, queen: 2, twin: 1, bunk: 2, full: 1, sofa: 1, other: 1 };
	const totalSpotsSelected = $derived(
		selections.reduce((sum, s) => sum + (rooms[s.roomIndex]?.beds[s.bedIndex]?.spotCount ?? 0), 0)
	);
</script>

<svelte:head><title>Pricing QC</title></svelte:head>

<div class="qc-page">
	<div class="main">
		<header class="qc-header">
			<h1>Pricing QC</h1>
			<p class="subtitle">PER_BED: trip + guest counts + rooms/beds + my selections → price & range.</p>
		</header>

		<form
			method="POST"
			action="?/compute"
			use:enhance={() => {
				return async ({ result, update }) => {
					const outcome = await result;
					await update({ reset: false });
					if (outcome?.data && (outcome.data as { success?: boolean }).success) saveToStorage();
				};
			}}
			onsubmit={(e) => {
				const f = e.target as HTMLFormElement;
				const i = f.querySelector('input[name="payload"]') as HTMLInputElement;
				if (i) i.value = buildPayload();
			}}
			class="qc-form"
		>
			<input type="hidden" name="payload" value={buildPayload()} />

			<div class="row-blocks">
				<div class="block block-trip">
					<span class="block-label">Trip</span>
					<span class="inline-fields">
						$<input type="number" step="0.01" min="0" bind:value={totalTripCost} class="w5" />
						Trip nights <input type="number" min="1" bind:value={totalTripNights} class="w4" title="Number of nights for the whole trip" />
					</span>
				</div>
				<div class="block">
					<span class="block-label">Guests</span>
					<span class="inline-fields">
						Min <input type="number" min="1" bind:value={minExpectedGuests} class="w4" />
						Max <input type="number" min="1" bind:value={maxCapacityGuests} class="w4" />
						Yes <input type="number" min="0" bind:value={yesRsvpGuests} class="w4" />
					</span>
					<p class="assumption-note">“Yes” is one headcount for the trip; per-night occupancy is not modeled.</p>
				</div>
				<div class="block">
					<span class="block-label">My party</span>
					<span class="inline-fields">
						<input type="number" min="1" bind:value={partySize} class="w4" title="People in my group (me + others)" />
						<span class="party-hint">people (me + guests).</span>
						# of nights I'm staying <input type="number" min="1" bind:value={nightsStaying} class="w4" title="Nights applied to all my selections" />
					</span>
					{#if totalSpotsSelected !== partySize}
						<p class="party-match">Spots selected: <strong>{totalSpotsSelected}</strong>, should match party size for correct QC.</p>
					{/if}
				</div>
			</div>

			<div class="two-col-blocks">
				<div class="block">
					<span class="block-label">Rooms & beds</span>
					<div class="rooms-compact">
						{#each rooms as room, ri}
							<div class="room-line">
								<span class="room-num">R{ri + 1}</span>
								{#each room.beds as bed, bi}
									<span class="bed-chip">
										<select bind:value={bed.bedType} class="sel-type">
											{#each data.bedTypeOptions as bt}<option value={bt}>{bt}</option>{/each}
										</select>
										<input type="number" min="1" bind:value={bed.spotCount} class="w3" title="Spots" />
										<button type="button" class="btn-x" onclick={() => removeBed(ri, bi)} title="Remove bed">×</button>
									</span>
								{/each}
								<button type="button" class="btn-plus" onclick={() => addBed(ri)}>+</button>
								<button type="button" class="btn-x" onclick={() => removeRoom(ri)} title="Remove room">−</button>
							</div>
						{/each}
						<button type="button" class="btn-add" onclick={addRoom}>+ Room</button>
					</div>
				</div>

				<div class="block">
					<span class="block-label">My selections</span>
					<div class="selections-compact">
					{#each selections as sel, idx}
						<div class="sel-line">
							<select bind:value={sel.roomIndex} class="sel-r">
								{#each rooms as _, ri}<option value={ri}>R{ri + 1}</option>{/each}
							</select>
							<select bind:value={sel.bedIndex} class="sel-b">{#each rooms[sel.roomIndex]?.beds ?? [] as bed, bi}<option value={bi}>{bed.bedType}×{bed.spotCount}</option>{/each}</select>
							<button type="button" class="btn-x" onclick={() => removeSelection(idx)}>×</button>
						</div>
					{/each}
					<button type="button" class="btn-add" onclick={addSelection}>+ Selection</button>
					</div>
				</div>
			</div>

			<button type="submit" class="btn-primary">Compute</button>
		</form>

		{#if error}
			<div class="result error"><strong>Error:</strong> {error}</div>
		{/if}

		{#if result}
			<div class="result success">
				<div class="result-summary">
					<span class="big">${result.displayPrice.toFixed(2)}</span>
					<span class="range">Range: ${result.lowEnd.toFixed(2)} – ${result.highEnd.toFixed(2)}</span>
				</div>
				<dl class="result-meta">
					<dt>Nights</dt><dd>{result.totalTripNights}</dd>
					<dt>Night cost</dt><dd>${result.nightCost.toFixed(2)}</dd>
					<dt>Eff. guests</dt><dd>{result.effectiveGuests}</dd>
					<dt>Eff. weight</dt><dd>{result.effectiveWeight}</dd>
					<dt>Avg spot W</dt><dd>{result.avgSpotWeight}</dd>
				</dl>
				<div class="formula-filled">
					<div class="formula-title">Formula (filled)</div>
					<pre class="formula-pre">nightCost = totalCost / nights = {totalTripCost} / {result.totalTripNights} = ${result.nightCost.toFixed(2)}
effectiveGuests = max(minExp, yes) = max({result.minExpectedGuests}, {yesRsvpGuests}) = {result.effectiveGuests}
effectiveWeight = effectiveGuests × avgSpotWeight = {result.effectiveWeight}
spotPricePerNight = nightCost × (spotWeight / effectiveWeight)
guestDisplayedTotal = spotPricePerNight × nightsStayed × spotsClaimed
displayPrice = sum(contrib) = ${result.displayPrice.toFixed(2)}
Range: highEnd = same denominator (effWeight); lowEnd = maxCap × avgW
highEnd → ${result.highEnd.toFixed(2)}  lowEnd → ${result.lowEnd.toFixed(2)}</pre>
				</div>
				{#if result.breakdown?.length}
					<table class="tbl">
						<thead><tr><th>R</th><th>Bed</th><th>Type</th><th>W</th><th>N</th><th>Sp</th><th>$</th></tr></thead>
						<tbody>
							{#each result.breakdown as row}
								<tr>
									<td>{row.roomIndex + 1}</td><td>{row.bedIndex + 1}</td><td>{row.bedType}</td>
									<td>{row.spotWeight.toFixed(2)}</td><td>{row.nightsStayed}</td><td>{row.spotsClaimed}</td>
									<td>${row.contribution.toFixed(2)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/if}
	</div>

	<aside class="sidebar">
		<h3>Bed weights</h3>
		<table class="ref-tbl">
			<thead><tr><th>Type</th><th>Weight</th></tr></thead>
			<tbody>
				{#each bedWeightsEntries as [t, w]}
					<tr><td>{t}</td><td>{w}</td></tr>
				{/each}
			</tbody>
		</table>
		<h3>Spot count (typical)</h3>
		<table class="ref-tbl">
			<thead><tr><th>Type</th><th>Spots</th></tr></thead>
			<tbody>
				{#each Object.entries(typicalSpots) as [t, s]}
					<tr><td>{t}</td><td>{s}</td></tr>
				{/each}
			</tbody>
		</table>
		<h3>Privacy factor</h3>
		<p class="ref-desc">By beds in room:</p>
		<table class="ref-tbl">
			<thead><tr><th>Beds</th><th>Factor</th></tr></thead>
			<tbody>
				{#each privacyRows as r}
					<tr><td>{r.beds}</td><td>{r.factor}</td></tr>
				{/each}
			</tbody>
		</table>
		<p class="ref-note">spot weight = bed weight × privacy</p>
	</aside>
</div>

<style>
	.qc-page {
		display: flex;
		gap: 1.25rem;
		width: 100%;
		max-width: 1600px;
		margin: 0 auto;
		padding: 1rem 1.5rem;
		font-family: system-ui, sans-serif;
		font-size: 0.875rem;
		box-sizing: border-box;
	}
	.main { flex: 1; min-width: 0; }
	.sidebar {
		width: 220px;
		flex-shrink: 0;
		padding: 0.75rem;
		background: #f5f5f5;
		border-radius: 6px;
		border: 1px solid #e0e0e0;
	}
	.block-trip {
		align-items: center;
	}
	.two-col-blocks {
		display: flex;
		gap: 1rem;
		width: 100%;
		margin-bottom: 0.75rem;
	}
	.two-col-blocks .block {
		flex: 1 1 0;
		min-width: 0;
	}
	.sidebar h3 {
		margin: 0.75rem 0 0.25rem 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: #555;
	}
	.sidebar h3:first-child { margin-top: 0; }
	.ref-tbl {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}
	.ref-tbl th, .ref-tbl td {
		padding: 0.2rem 0.4rem;
		text-align: left;
		border-bottom: 1px solid #e8e8e8;
	}
	.ref-tbl th { background: #eee; }
	.ref-desc, .ref-note { font-size: 0.75rem; color: #666; margin: 0.15rem 0 0 0; }
	.ref-note { margin-top: 0.5rem; }
	.assumption-note { font-size: 0.75rem; color: #555; margin: 0.35rem 0 0 0; max-width: 420px; }
	.party-hint { font-size: 0.8rem; color: #555; }
	.party-match { font-size: 0.75rem; color: #c60; margin: 0.25rem 0 0 0; }

	.qc-header { margin-bottom: 0.75rem; }
	.qc-header h1 { font-size: 1.2rem; margin: 0 0 0.15rem 0; }
	.subtitle { color: #666; font-size: 0.8rem; margin: 0; }

	.row-blocks { display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; margin-bottom: 0.75rem; }
	.block {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 0.75rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 0.85rem;
		background: #f9f9f9;
		border-radius: 6px;
		border: 1px solid #eee;
		flex: 1 1 280px;
		min-width: 0;
	}
	.block-label { font-weight: 600; min-width: 4.5rem; font-size: 0.8rem; }
	.inline-fields { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem; }
	.inline-fields input { padding: 0.2rem 0.35rem; }
	.w3 { width: 2.5rem; }
	.w4 { width: 3rem; }
	.w5 { width: 4.5rem; }
	.w8 { width: 7rem; }

	.rooms-compact, .selections-compact { display: flex; flex-direction: column; gap: 0.35rem; width: 100%; }
	.room-line, .sel-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.6rem;
	}
	.room-num { font-weight: 600; min-width: 1.5rem; }
	.bed-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.25rem;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 3px;
	}
	.sel-type, .sel-r, .sel-b { min-width: 4.5rem; padding: 0.15rem 0.25rem; font-size: 0.8rem; }
	.btn-plus, .btn-add { padding: 0.15rem 0.4rem; font-size: 0.75rem; cursor: pointer; }
	.btn-x { padding: 0 0.25rem; font-size: 1rem; line-height: 1; cursor: pointer; border: none; background: none; color: #666; }
	.btn-x:hover { color: #c00; }
	.btn-primary { margin-top: 0.5rem; padding: 0.4rem 0.8rem; background: #333; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
	.btn-primary:hover { background: #555; }

	.result { margin-top: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.85rem; }
	.result.error { background: #fee; border: 1px solid #c00; }
	.result.success { background: #efe; border: 1px solid #8c8; }
	.result-summary { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
	.result-summary .big { font-size: 1.25rem; font-weight: 700; }
	.result-summary .range { color: #555; }
	.result-meta { display: grid; grid-template-columns: auto auto auto auto; gap: 0.15rem 0.75rem; margin: 0 0 0.35rem 0; font-size: 0.8rem; }
	.result-meta dt { font-weight: 500; }
	.result-meta dd { margin: 0; }
	.formula-filled { margin-top: 0.5rem; padding: 0.4rem 0.5rem; background: #f8f8f8; border-radius: 4px; border: 1px solid #e0e0e0; }
	.formula-title { font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; color: #555; }
	.formula-pre { margin: 0; font-size: 0.72rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; }
	.tbl { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.25rem; }
	.tbl th, .tbl td { padding: 0.2rem 0.4rem; text-align: left; border-bottom: 1px solid #ddd; }
	.tbl th { background: #eee; }
</style>
