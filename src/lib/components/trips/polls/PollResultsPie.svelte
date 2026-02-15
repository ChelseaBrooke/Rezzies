<script lang="ts">
	import type { PollOptionWithCount } from './types.js';

	interface Props {
		options: PollOptionWithCount[];
		totalVotes: number;
		userOptionIds?: string[];
		size?: number;
	}

	let { options, totalVotes, userOptionIds = [], size = 110 }: Props = $props();

	// Refined, modern palette - softer tones that work together
	const PIE_COLORS = [
		'#C75B45',
		'#3D6B7A',
		'#7B9E7A',
		'#D4A84B',
		'#9B6B8E',
		'#5B8FA3',
		'#C4895A',
		'#6B7B7B'
	];

	const GAP_DEG = 2;
	const segments = $derived(
		options
			.filter((o) => o.voteCount > 0)
			.map((opt, i) => ({
				...opt,
				percentage: totalVotes > 0 ? (opt.voteCount / totalVotes) * 100 : 0,
				color: PIE_COLORS[i % PIE_COLORS.length],
				isUserVote: userOptionIds.includes(opt.id)
			}))
	);

	// Build conic-gradient with gaps between segments (modern segmented donut)
	const conicStops = $derived.by(() => {
		if (segments.length === 0) return 'var(--border-soft) 0deg 360deg';
		const totalGaps = segments.length * GAP_DEG;
		const available = 360 - totalGaps;
		let acc = 0;
		return segments
			.map((s) => {
				const segDeg = (s.percentage / 100) * available;
				const start = acc;
				acc += segDeg + GAP_DEG;
				return `${s.color} ${start}deg ${start + segDeg}deg`;
			})
			.join(', ');
	});
</script>

<div class="pie-wrap">
	<div class="pie-inner" style="--size: {size}px">
		<div
			class="pie-donut"
			style="background: conic-gradient(from -90deg, {conicStops})"
			role="img"
			aria-label="Poll results"
		>
			<div class="pie-center">
				<span class="pie-total-num">{totalVotes}</span>
				<span class="pie-total-label">{totalVotes === 1 ? 'vote' : 'votes'}</span>
			</div>
		</div>
	</div>
	{#if totalVotes > 0 && segments.length > 0}
		<ul class="pie-legend" role="list">
			{#each segments as seg}
				<li class="legend-item" class:user-vote={seg.isUserVote}>
					<span class="legend-swatch" style="--swatch: {seg.color}"></span>
					<span class="legend-content">
						<span class="legend-label">{seg.label}</span>
						<span class="legend-pct">{Math.round(seg.percentage)}%</span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.pie-wrap {
		display: flex;
		align-items: flex-start;
		gap: 1.25rem;
		min-width: 0;
	}
	.pie-inner {
		flex-shrink: 0;
	}
	.pie-donut {
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 2px 8px rgba(0, 27, 46, 0.06),
			inset 0 1px 0 rgba(255, 255, 255, 0.6);
	}
	.pie-center {
		width: 58%;
		height: 58%;
		background: var(--surfaceSolid);
		border-radius: 50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 0 0 1px rgba(0, 27, 46, 0.06);
	}
	.pie-total-num {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--text);
		line-height: 1.2;
	}
	.pie-total-label {
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.pie-legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.legend-item.user-vote .legend-label {
		font-weight: 600;
		color: var(--primary);
	}
	.legend-item.user-vote .legend-swatch {
		box-shadow: 0 0 0 2px var(--primary);
	}
	.legend-swatch {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		background: var(--swatch);
		flex-shrink: 0;
	}
	.legend-content {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
	}
	.legend-label {
		font-size: 0.8125rem;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.legend-pct {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted);
		flex-shrink: 0;
	}
</style>
