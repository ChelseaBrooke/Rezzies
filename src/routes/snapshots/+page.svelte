<script lang="ts">
	import type { PageData } from './$types';
	import type { SnapshotEntry, PopupEntry } from './+page.server.js';

	let { data }: { data: PageData } = $props();

	type Device = 'desktop' | 'mobile';
	const VIEWPORTS: Record<Device, { w: number; h: number }> = {
		desktop: { w: 1440, h: 900 },
		mobile: { w: 390, h: 844 }
	};

	const ZOOMS = [
		{ label: 'S', w: 260 },
		{ label: 'M', w: 360 },
		{ label: 'L', w: 520 }
	];

	let device = $state<Device>('desktop');
	let thumbWidth = $state(360);
	let showPages = $state(true);
	let showPopups = $state(true);
	let nonce = $state(0); // bump to force-reload all iframes

	const viewport = $derived(VIEWPORTS[device]);
	const scale = $derived(thumbWidth / viewport.w);
	const thumbHeight = $derived(Math.round(viewport.h * scale));

	// Group entries by their `group` field, preserving first-seen order.
	function groupBy<T extends { group: string }>(items: T[]): { group: string; items: T[] }[] {
		const map = new Map<string, T[]>();
		for (const item of items) {
			const list = map.get(item.group) ?? [];
			list.push(item);
			map.set(item.group, list);
		}
		return [...map.entries()].map(([group, items]) => ({ group, items }));
	}

	const pageGroups = $derived(groupBy<SnapshotEntry>(data.pages));
	const popupGroups = $derived(groupBy<PopupEntry>(data.popups));

	const totalPages = $derived(data.pages.length);
	const resolvablePages = $derived(data.pages.filter((p) => p.url).length);

	function withNonce(url: string): string {
		return url + (url.includes('?') ? '&' : '?') + `__snap=${nonce}`;
	}
</script>

<svelte:head>
	<title>Snapshots — every page & popup</title>
</svelte:head>

<div class="snap">
	<header class="snap-header">
		<div class="title-block">
			<h1>App snapshots</h1>
			<p class="subtitle">
				Live mini-previews of every page and popup. {resolvablePages}/{totalPages} pages resolved,
				{data.popups.length} popups.
			</p>
		</div>

		<div class="controls">
			{#if !data.isLoggedIn}
				<span class="warn">Not logged in — gated pages will show their login/redirect state.</span>
			{:else if !data.sample.tripId}
				<span class="warn">No accessible trip — trip pages can’t be previewed.</span>
			{:else}
				<span class="ok">Sample trip: {data.sample.tripName}</span>
			{/if}

			<div class="seg">
				<button class:active={device === 'desktop'} onclick={() => (device = 'desktop')}>Desktop</button>
				<button class:active={device === 'mobile'} onclick={() => (device = 'mobile')}>Mobile</button>
			</div>

			<div class="seg">
				{#each ZOOMS as z}
					<button class:active={thumbWidth === z.w} onclick={() => (thumbWidth = z.w)}>{z.label}</button>
				{/each}
			</div>

			<label class="chk"><input type="checkbox" bind:checked={showPages} /> Pages</label>
			<label class="chk"><input type="checkbox" bind:checked={showPopups} /> Popups</label>

			<button class="reload" onclick={() => (nonce += 1)}>Reload all</button>
		</div>
	</header>

	{#if showPages}
		<section>
			<h2 class="section-head">Pages</h2>
			{#each pageGroups as grp}
				<div class="group-label">{grp.group}</div>
				<div class="grid">
					{#each grp.items as entry}
						<figure class="card" style="width:{thumbWidth}px;">
							<div class="thumb" style="width:{thumbWidth}px;height:{thumbHeight}px;">
								{#if entry.url}
									<iframe
										title={entry.label}
										src={withNonce(entry.url)}
										loading="lazy"
										style="width:{viewport.w}px;height:{viewport.h}px;transform:scale({scale});"
									></iframe>
								{:else}
									<div class="missing">
										<span>No preview</span>
										{#if entry.note}<small>{entry.note}</small>{/if}
									</div>
								{/if}
							</div>
							<figcaption>
								<span class="label">{entry.label}</span>
								{#if entry.url}
									<a class="open" href={entry.url} target="_blank" rel="noreferrer">Open ↗</a>
								{/if}
							</figcaption>
						</figure>
					{/each}
				</div>
			{/each}
		</section>
	{/if}

	{#if showPopups}
		<section>
			<h2 class="section-head">Popups &amp; modals</h2>
			{#each popupGroups as grp}
				<div class="group-label">{grp.group}</div>
				<div class="grid">
					{#each grp.items as entry}
						<figure class="card" style="width:{thumbWidth}px;">
							<div class="thumb" style="width:{thumbWidth}px;height:{thumbHeight}px;">
								<iframe
									title={entry.label}
									src={withNonce(entry.url)}
									loading="lazy"
									style="width:{viewport.w}px;height:{viewport.h}px;transform:scale({scale});"
								></iframe>
							</div>
							<figcaption>
								<span class="label">{entry.label}</span>
								<a class="open" href={entry.url} target="_blank" rel="noreferrer">Open ↗</a>
							</figcaption>
						</figure>
					{/each}
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.snap {
		padding: 1rem 1.25rem 4rem;
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
		color: #1c2430;
		background: #f4f6f8;
		min-height: 100vh;
	}

	.snap-header {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.25rem;
		padding: 0.85rem 1rem;
		margin: -1rem -1.25rem 1.25rem;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid #dde3e8;
	}

	.title-block h1 {
		margin: 0;
		font-size: 1.25rem;
	}
	.subtitle {
		margin: 0.15rem 0 0;
		font-size: 0.8rem;
		color: #5b6672;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		font-size: 0.8rem;
	}

	.warn {
		color: #9a4a00;
		background: #fff2e0;
		border: 1px solid #f0cfa0;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
	}
	.ok {
		color: #1f5e3a;
		background: #e6f4ec;
		border: 1px solid #b6dcc4;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
	}

	.seg {
		display: inline-flex;
		border: 1px solid #cdd5dd;
		border-radius: 7px;
		overflow: hidden;
	}
	.seg button {
		border: none;
		background: #fff;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		font-size: 0.8rem;
		color: #36414f;
	}
	.seg button + button {
		border-left: 1px solid #cdd5dd;
	}
	.seg button.active {
		background: #2f6f4f;
		color: #fff;
	}

	.chk {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
	}

	.reload {
		border: 1px solid #cdd5dd;
		background: #fff;
		border-radius: 7px;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		font-size: 0.8rem;
	}
	.reload:hover {
		background: #eef2f5;
	}

	.section-head {
		font-size: 1rem;
		margin: 1.5rem 0 0.25rem;
	}
	.group-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7682;
		margin: 1rem 0 0.5rem;
		font-weight: 600;
	}

	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.card {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.thumb {
		position: relative;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid #d2dae1;
		background: #fff;
		box-shadow: 0 1px 3px rgba(20, 30, 40, 0.08);
	}
	.thumb iframe {
		position: absolute;
		top: 0;
		left: 0;
		border: 0;
		transform-origin: top left;
		background: #fff;
		/* Block interaction so clicks scroll the gallery, not the frame. */
		pointer-events: none;
	}

	.missing {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		text-align: center;
		padding: 0.75rem;
		color: #8a96a2;
		background: repeating-linear-gradient(45deg, #f6f8f9, #f6f8f9 10px, #eef2f4 10px, #eef2f4 20px);
	}
	.missing span {
		font-weight: 600;
		font-size: 0.85rem;
	}
	.missing small {
		font-size: 0.7rem;
		line-height: 1.3;
		max-width: 90%;
	}

	figcaption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.82rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.open {
		font-size: 0.75rem;
		color: #2f6f4f;
		text-decoration: none;
		white-space: nowrap;
	}
	.open:hover {
		text-decoration: underline;
	}
</style>
