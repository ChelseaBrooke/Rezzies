<script lang="ts">
	/** Dashboard view mode: before trip = planning, during = vacation, after = recap */
	export type DashboardMode = 'planning' | 'vacation' | 'recap';

	interface Props {
		checkInDate: Date | string | null | undefined;
		checkOutDate: Date | string | null | undefined;
		/** Current selection; bind to override or read. Initialized from date. */
		selectedMode?: DashboardMode;
	}

	let { checkInDate, checkOutDate, selectedMode = $bindable('planning') }: Props = $props();

	const MODES: { id: DashboardMode; label: string }[] = [
		{ id: 'planning', label: 'Planning' },
		{ id: 'vacation', label: 'Vacation' },
		{ id: 'recap', label: 'Recap' }
	];

	/** Mode that corresponds to today's date relative to trip dates. */
	const modeFromDate = $derived.by((): DashboardMode => {
		const checkIn = checkInDate ? new Date(checkInDate) : null;
		const checkOut = checkOutDate ? new Date(checkOutDate) : null;
		if (!checkIn || !checkOut) return 'planning';
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const start = new Date(checkIn);
		start.setHours(0, 0, 0, 0);
		const end = new Date(checkOut);
		end.setHours(23, 59, 59, 999);
		if (today < start) return 'planning';
		if (today >= start && today <= end) return 'vacation';
		return 'recap';
	});

	/** Initialize selectedMode from date once; user can then click to switch. */
	let initialized = false;
	$effect(() => {
		const m = modeFromDate;
		if (!initialized) {
			selectedMode = m;
			initialized = true;
		}
	});
</script>

<div class="mode-selector-wrap">
	<div class="mode-selector" role="tablist" aria-label="Dashboard view">
		<div
			class="mode-thumb"
			style="transform: translateX({MODES.findIndex((m) => m.id === selectedMode) * 100}%);"
			aria-hidden="true"
		></div>
		{#each MODES as mode}
			<button
				type="button"
				role="tab"
				class="mode-tab"
				class:active={selectedMode === mode.id}
				class:current-by-date={modeFromDate === mode.id}
				aria-pressed={selectedMode === mode.id}
				aria-current={modeFromDate === mode.id ? 'true' : undefined}
				onclick={() => (selectedMode = mode.id)}
			>
				{mode.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.mode-selector-wrap {
		display: flex;
		justify-content: center;
		margin-bottom: 0;
		width: 100%;
	}

	.mode-selector {
		display: inline-flex;
		align-items: stretch;
		position: relative;
		background: #d1d5db;
		border-radius: 10px;
		padding: 4px;
		gap: 0;
		box-shadow: 4px 0 24px rgba(17, 24, 39, 0.06);
	}

	.mode-thumb {
		position: absolute;
		top: 4px;
		left: 4px;
		width: calc((100% - 8px) / 3);
		height: calc(100% - 8px);
		background: #fcfcfc;
		border-radius: 8px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: none;
		z-index: 0;
	}

	.mode-tab {
		position: relative;
		z-index: 1;
		flex: 1;
		min-width: 6rem;
		padding: 0.5rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #374151;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.mode-tab:hover {
		color: #111827;
	}

	.mode-tab.active {
		color: #111827;
	}

	.mode-tab.current-by-date.active {
		color: #111827;
	}

	.mode-tab.current-by-date:not(.active) {
		color: #374151;
	}
</style>
