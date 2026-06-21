<script lang="ts">
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

	// Dev-only page load benchmark badge + CSV logger.
	//
	// Two complementary measurements:
	//   total/server — wall-clock timing for EVERY navigation (full reload AND
	//                  SvelteKit client-side route changes). total = time to
	//                  complete the navigation; server = hooks.server.ts + load
	//                  functions, read from the Server-Timing header.
	//   web-vitals   — Core Web Vitals for the INITIAL document load only
	//                  (LCP/FCP/TTFB fire once per hard load; CLS/INP are
	//                  cumulative over the document lifetime). These are the
	//                  "real" front-page load metrics.
	let total = $state<number | null>(null);
	let server = $state<number | null>(null);
	let kind = $state('load');
	let vitals = $state<Record<string, { value: number; rating: string }>>({});
	let navStart = 0;

	function readServerTiming(entry: PerformanceEntry | undefined): number | null {
		const srv = (entry as PerformanceResourceTiming | undefined)?.serverTiming?.find(
			(s) => s.name === 'srv'
		);
		return srv ? srv.duration : null;
	}

	// Append one metric to perf-log.csv via the dev-only endpoint.
	// Fire-and-forget; never blocks the UI.
	function logMetric(metric: string, value: number | null, rating = '') {
		if (value == null) return;
		fetch('/api/perf', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ path: location.pathname, kind, metric, value, rating }),
			keepalive: true
		}).catch(() => {});
	}

	function reportNav() {
		logMetric('total', total);
		logMetric('server', server);
	}

	function color(ms: number | null): string {
		if (ms == null) return '#9ca3af';
		if (ms < 300) return '#22c55e'; // fast
		if (ms < 800) return '#f59e0b'; // ok
		return '#ef4444'; // slow
	}

	function vitalColor(rating: string | undefined): string {
		if (rating === 'good') return '#22c55e';
		if (rating === 'needs-improvement') return '#f59e0b';
		if (rating === 'poor') return '#ef4444';
		return '#9ca3af';
	}

	// CLS is unitless (small decimals); the rest are milliseconds.
	function fmtVital(name: string, value: number): string {
		return name === 'CLS' ? value.toFixed(3) : value.toFixed(0);
	}

	onMount(() => {
		// --- Initial full-page load wall-clock timing ---
		const finalize = () => {
			const nav = performance.getEntriesByType('navigation')[0] as
				| PerformanceNavigationTiming
				| undefined;
			if (nav) {
				total = nav.loadEventEnd - nav.startTime;
				server = readServerTiming(nav);
				kind = 'load';
				reportNav();
			}
		};
		if (document.readyState === 'complete') finalize();
		else window.addEventListener('load', finalize, { once: true });

		// --- Core Web Vitals (initial document load) ---
		const onVital = (m: Metric) => {
			vitals = { ...vitals, [m.name]: { value: m.value, rating: m.rating } };
			logMetric(m.name, m.value, m.rating);
		};
		onTTFB(onVital);
		onFCP(onVital);
		onLCP(onVital);
		onCLS(onVital);
		onINP(onVital);
	});

	beforeNavigate(() => {
		navStart = performance.now();
	});

	afterNavigate((nav) => {
		// `enter` is the initial mount — handled by onMount above, skip it.
		if (nav.type === 'enter') return;

		total = performance.now() - navStart;
		kind = nav.type;

		// SvelteKit fetches `__data.json` for client-side navs; its response
		// carries the same Server-Timing header, surfaced via resource timing.
		const dataReq = performance
			.getEntriesByType('resource')
			.reverse()
			.find((r) => r.name.includes('__data.json'));
		server = readServerTiming(dataReq);
		reportNav();
	});
</script>

<div class="perf-badge" title="Dev page load benchmark — total / server / Core Web Vitals">
	<div class="row">
		<span class="dot" style:background={color(total)}></span>
		<span class="metric"><strong>{total != null ? total.toFixed(0) : '—'}</strong>ms</span>
		<span class="sep">·</span>
		<span class="metric" style:color={color(server)}>
			srv <strong>{server != null ? server.toFixed(0) : '—'}</strong>ms
		</span>
		<span class="kind">{kind}</span>
	</div>
	<div class="row vitals">
		{#each ['LCP', 'FCP', 'TTFB', 'CLS', 'INP'] as name}
			<span class="vital" style:color={vitalColor(vitals[name]?.rating)}>
				{name} <strong>{vitals[name] ? fmtVital(name, vitals[name].value) : '—'}</strong>
			</span>
		{/each}
	</div>
</div>

<style>
	.perf-badge {
		position: fixed;
		bottom: 10px;
		right: 10px;
		z-index: 99999;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 10px;
		font:
			11px/1 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		color: #e5e7eb;
		background: rgba(17, 24, 39, 0.92);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		pointer-events: none;
		user-select: none;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.vitals {
		gap: 8px;
		font-size: 10px;
		opacity: 0.95;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.metric strong,
	.vital strong {
		font-weight: 700;
	}
	.sep {
		opacity: 0.4;
	}
	.kind {
		padding-left: 4px;
		opacity: 0.5;
		text-transform: uppercase;
		font-size: 9px;
	}
</style>
