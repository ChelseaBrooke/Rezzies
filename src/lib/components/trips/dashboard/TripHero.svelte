<script lang="ts">
	import TripQuickActions from '$lib/components/trips/TripQuickActions.svelte';
	import TripCalendarWidget from '$lib/components/trips/TripCalendarWidget.svelte';
	import type { DashboardMode } from '$lib/stores/dashboardMode.js';

	interface Props {
		trip: {
			id: string;
			name: string | null;
			location: string | null;
			locationCity?: string | null;
			fullAddress?: string | null;
			listingCoverPhoto: string | null;
		};
		dateRange: string;
		calendarAddUrl: string | null;
		mapsUrl: string | null;
		quickActions: {
			onInvite: () => void;
			showToast: (msg: string) => void;
		};
		tripInfoContent: string;
		isHost: boolean;
		rsvpUrl?: string | null;
		inviteCode?: string;
		checkInDate?: string;
		checkOutDate?: string;
		activities?: Array<{ id: string; title: string; date: Date | string; time?: string | null; location?: string | null }>;
		mealSlots?: Array<unknown>;
		/** From header store; read-only here */
		selectedMode?: DashboardMode;
	}

	let {
		trip,
		dateRange,
		calendarAddUrl,
		mapsUrl,
		quickActions,
		tripInfoContent,
		isHost,
		rsvpUrl = null,
		inviteCode,
		checkInDate = '',
		checkOutDate = '',
		activities = [],
		mealSlots = [],
		selectedMode = 'planning'
	}: Props = $props();

	const destinationLabel = $derived((trip.locationCity ?? trip.fullAddress ?? trip.location)?.trim() ?? '');
	const isCompact = $derived(selectedMode === 'vacation' || selectedMode === 'recap');
</script>

{#if isCompact}
	<!-- ═══ Compact header for Vacation / Recap ═══ -->
	<div class="compact-hero" class:recap-mode={selectedMode === 'recap'}>
		{#if trip.listingCoverPhoto}
			<img src={trip.listingCoverPhoto} alt="" class="compact-bg-img" />
		{:else}
			<div class="compact-bg-grad"></div>
		{/if}
		<div class="compact-overlay"></div>

		<div class="compact-content">
			<div class="compact-left">
				<h1 class="compact-name">{trip.name ?? 'Trip'}</h1>
				<div class="compact-meta">
					{#if calendarAddUrl}
						<a href={calendarAddUrl} target="_blank" rel="noopener noreferrer" class="compact-meta-link" title="Add to calendar">
							<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
							{dateRange}
						</a>
					{:else}
						<span class="compact-meta-text">
							<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
							{dateRange}
						</span>
					{/if}
					{#if destinationLabel}
						<span class="compact-meta-sep">·</span>
						{#if mapsUrl}
							<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="compact-meta-link" title="Open in Maps">
								<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
								{destinationLabel}
							</a>
						{:else}
							<span class="compact-meta-text">
								<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
								{destinationLabel}
							</span>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<div class="compact-actions">
			<TripQuickActions
				tripId={trip.id}
				{inviteCode}
				onInvite={quickActions.onInvite}
				showToast={quickActions.showToast}
				{isHost}
			/>
		</div>
	</div>
{:else}
	<!-- ═══ Full hero for Planning ═══ -->
	<div class="hero-with-calendar">
		<div class="trip-hero">
			<div class="hero-image-wrap">
				{#if trip.listingCoverPhoto}
					<img src={trip.listingCoverPhoto} alt="" class="hero-image" />
				{:else}
					<div class="hero-placeholder"></div>
				{/if}
				{#if rsvpUrl}
					<a href={rsvpUrl} class="hero-rsvp-button">RSVP</a>
				{/if}
				<div class="hero-overlay">
					<div class="hero-content">
					<h1 class="hero-name">{trip.name ?? 'Trip'}</h1>
					<div class="hero-subline">
						{#if calendarAddUrl}
							<a href={calendarAddUrl} target="_blank" rel="noopener noreferrer" class="hero-meta-link" title="Add to calendar">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
								<span>{dateRange}</span>
							</a>
						{:else}
							<span class="hero-meta-text">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
								<span>{dateRange}</span>
							</span>
						{/if}
						{#if destinationLabel}
							{#if mapsUrl}
								<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="hero-meta-link" title="Open in Google Maps">
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
									<span>{destinationLabel}</span>
								</a>
							{:else}
								<span class="hero-meta-text">
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
									<span>{destinationLabel}</span>
								</span>
							{/if}
						{/if}
					</div>
					<div class="hero-center-actions">
						<TripQuickActions
							tripId={trip.id}
							{inviteCode}
							onInvite={quickActions.onInvite}
							showToast={quickActions.showToast}
							{isHost}
						/>
					</div>
				</div>
				</div>
			</div>
		</div>
		<div class="hero-calendar-layer">
			<div class="hero-calendar-outer">
				<div class="hero-calendar-back" aria-hidden="true"></div>
				<div class="hero-calendar-wrap">
					<TripCalendarWidget
						tripId={trip.id}
						placement="sidebar"
						{checkInDate}
						{checkOutDate}
						{activities}
						{mealSlots}
					/>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ════════════════════════════════════
	   COMPACT HERO (Vacation / Recap)
	   ════════════════════════════════════ */
	.compact-hero {
		position: relative;
		width: 100%;
		border-radius: var(--radius-3xl);
		overflow: hidden;
		height: 140px;
		min-height: 140px;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		box-shadow: var(--shadow-soft);
		margin-bottom: 0;
		/* Match Planning: gap under pill before main photo section */
		margin-top: 3rem;
	}

	.compact-bg-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(3px) saturate(1.1);
		transform: scale(1.05);
	}

	.compact-bg-grad {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, var(--slate) 0%, #1a3a4f 100%);
	}

	.compact-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, rgba(0, 27, 46, 0.7) 0%, rgba(41, 76, 96, 0.6) 100%);
	}

	.compact-hero.recap-mode .compact-overlay {
		background: linear-gradient(135deg, rgba(0, 27, 46, 0.75) 0%, rgba(60, 40, 30, 0.6) 100%);
	}

	.compact-content {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.75rem;
		height: 100%;
	}

	.compact-left {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}

	.compact-name {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: white;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		letter-spacing: -0.02em;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 420px;
	}

	.compact-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.compact-meta-link, .compact-meta-text {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.85);
		text-decoration: none;
	}
	.compact-meta-link:hover {
		color: white;
		text-decoration: underline;
	}
	.compact-meta-sep {
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.875rem;
	}

	.compact-actions {
		position: absolute;
		bottom: 0.75rem;
		right: 1rem;
		z-index: 2;
	}
	.compact-actions :global(.quick-actions) {
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-lg);
		padding: 0.3rem;
		gap: 0.25rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}
	.compact-actions :global(.action-btn) {
		color: white;
		background: rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-md);
		border: none;
		width: 28px;
		height: 28px;
	}
	.compact-actions :global(.action-btn:hover) {
		background: rgba(255, 255, 255, 0.3);
	}

	@media (max-width: 768px) {
		.compact-hero {
			height: auto;
			min-height: 120px;
		}
		.compact-content {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
			padding: 1rem 1.25rem;
		}
		.compact-name {
			font-size: 1.375rem;
			max-width: 100%;
		}
	}

	/* ════════════════════════════════════
	   FULL HERO (Planning)
	   ════════════════════════════════════ */
	.hero-with-calendar {
		position: relative;
		width: 100%;
		overflow: visible;
		margin-top: 3rem;
	}

	.trip-hero {
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		border-radius: var(--radius-3xl);
		overflow: hidden;
		box-shadow: var(--shadow-soft);
		height: 460px;
		min-height: 460px;
		background: var(--surface2);
		position: relative;
		z-index: 0;
		margin-bottom: 0;
		width: 100%;
	}

	.hero-image-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.hero-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.hero-placeholder {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, var(--slate) 0%, var(--muted) 100%);
	}

	.hero-rsvp-button {
		position: absolute;
		top: 1.25rem;
		left: 1.25rem;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.875rem 1.75rem;
		font-size: 1.125rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: white;
		background: var(--copper, #bf4e30);
		border: none;
		border-radius: var(--radius-lg, 12px);
		text-decoration: none;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.hero-rsvp-button:hover {
		transform: scale(1.03);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
		color: white;
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.3) 40%, transparent 60%);
		color: white;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 1.5rem 2rem;
	}

	.hero-calendar-layer {
		position: absolute;
		top: -3rem;
		right: 6rem;
		left: auto;
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 1rem;
		z-index: 2;
		pointer-events: none;
	}

	.hero-calendar-layer > * {
		pointer-events: auto;
	}

	.hero-calendar-outer {
		position: relative;
		width: 300px;
		min-width: 300px;
		min-height: 300px;
	}

	.hero-calendar-back {
		position: absolute;
		inset: 0;
		border-radius: 12px;
		border: none;
		background: var(--bg);
		z-index: 0;
		box-shadow: 8px -4px 20px rgba(0, 27, 46, 0.04);
	}

	.hero-calendar-wrap {
		position: relative;
		z-index: 1;
		border-radius: 12px;
		border: none;
		padding: 0.75rem 0.5rem;
		width: 100%;
		min-height: 300px;
		font-size: 0.8125rem;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: transparent;
	}

	.hero-calendar-wrap :global(.calendar-sidebar) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg) !important;
		box-shadow: none !important;
		border: none !important;
		outline: none;
		padding: 0;
		min-width: 0;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.hero-calendar-wrap :global(.day-detail-view) {
		overflow-y: auto;
		min-height: 0;
		flex: 1;
	}

	.hero-calendar-wrap :global(.month-calendar.sidebar-style) {
		font-size: inherit;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		flex: 1;
		min-height: 0;
	}

	.hero-calendar-wrap :global(.month-calendar.sidebar-style .days-grid) {
		flex: 1;
		min-height: 0;
		align-content: space-evenly;
		grid-auto-rows: minmax(28px, 1fr);
		gap: 4px;
	}

	.hero-calendar-wrap :global(.month-header) {
		margin-bottom: 0;
		color: var(--text);
	}

	.hero-calendar-wrap :global(.month-title) {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--text);
	}

	.hero-calendar-wrap :global(.day-headers) {
		margin-bottom: 0;
	}

	.hero-calendar-wrap :global(.day-header) {
		font-size: 0.7rem;
		color: var(--copper);
	}

	.hero-calendar-wrap :global(.calendar-sidebar .day-cell.sidebar-cell) {
		font-size: 0.75rem;
		color: var(--muted);
		background: transparent;
	}

	.hero-calendar-wrap :global(.calendar-sidebar .day-cell.sidebar-cell.trip-day) {
		background: rgba(191, 78, 48, 0.25);
		color: var(--copper);
	}

	.hero-calendar-wrap :global(.calendar-sidebar .day-cell.sidebar-cell.trip-day:hover) {
		background: rgba(191, 78, 48, 0.4);
		color: var(--copper);
	}

	.hero-calendar-wrap :global(.calendar-sidebar .day-cell.sidebar-cell.trip-day.selected) {
		background: var(--copper, #BF4E30);
		color: white;
	}

	.hero-calendar-wrap :global(.calendar-sidebar .day-cell.sidebar-cell.trip-day.selected:hover) {
		background: var(--primaryHover, #A03D24);
		color: white;
	}

	.hero-calendar-wrap :global(.month-chevron-btn) {
		color: var(--text);
	}

	.hero-calendar-wrap :global(.month-chevron-btn:hover:not(:disabled)) {
		background: var(--border-soft);
		color: var(--text);
	}

	.hero-calendar-wrap :global(.day-detail-hint) {
		color: var(--muted);
		font-size: 0.7rem;
		opacity: 0.95;
	}

	.hero-calendar-wrap :global(.day-detail-back) {
		color: var(--primary);
	}

	.hero-calendar-wrap :global(.day-detail-title) {
		color: var(--text);
	}

	.hero-calendar-wrap :global(.day-detail-empty),
	.hero-calendar-wrap :global(.day-detail-label) {
		color: var(--muted);
	}

	.hero-calendar-wrap :global(.day-detail-item) {
		color: var(--text);
		border-bottom-color: var(--border);
	}

	.hero-calendar-wrap :global(.day-detail-ctas) {
		border-top-color: var(--border);
	}

	.hero-calendar-wrap :global(.day-detail-cta) {
		background: var(--primary);
		border: 1px solid var(--primary);
		color: white;
	}

	.hero-calendar-wrap :global(.day-detail-cta:hover) {
		background: var(--primaryHover);
		border-color: var(--primaryHover);
	}

	.hero-calendar-wrap :global(.calendar-empty-msg) {
		color: var(--muted);
	}

	.hero-calendar-wrap :global(.calendar-empty-msg a) {
		color: var(--primary);
		text-decoration: underline;
	}

	.hero-calendar-wrap :global(.day-detail-item .item-title) {
		color: var(--text);
	}

	.hero-calendar-wrap :global(.day-detail-item .item-meta) {
		color: var(--muted);
	}

	.hero-content {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		text-align: center;
	}

	.hero-name {
		margin: 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		font-size: 4rem;
		font-weight: 700;
		line-height: 1.1;
		color: white;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		letter-spacing: -0.025em;
		text-align: center;
	}

	.hero-subline {
		margin: 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		font-size: 1rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 1.25rem;
		line-height: 1.5;
		max-width: 600px;
	}

	.hero-meta-link,
	.hero-meta-text {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.hero-meta-link {
		text-decoration: none;
		transition: opacity var(--transition-fast);
	}

	.hero-meta-link:hover {
		opacity: 1;
		text-decoration: underline;
	}

	.hero-meta-link svg,
	.hero-meta-text svg {
		flex-shrink: 0;
		opacity: 0.9;
	}

	.hero-center-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		cursor: pointer;
	}

	.hero-center-actions :global(.quick-actions) {
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-xl);
		padding: 0.5rem;
		gap: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.hero-center-actions :global(.action-btn) {
		color: white;
		background: rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-md);
		border: none;
		transition: opacity var(--transition-fast);
	}

	.hero-center-actions :global(.action-btn:hover) {
		background: rgba(255, 255, 255, 0.35);
		color: white;
	}

	@media (max-width: 1024px) {
		.trip-hero {
			height: 420px;
			min-height: 420px;
		}

		.hero-overlay {
			padding: 1.25rem 1.5rem;
		}

		.hero-name {
			font-size: 3rem;
		}

		.hero-subline {
			font-size: 0.9375rem;
		}
	}

	@media (max-width: 640px) {
		.trip-hero {
			height: 340px;
			min-height: 340px;
		}

		.hero-overlay {
			padding: 1rem 1.25rem;
		}

		.hero-name {
			font-size: 2.5rem;
		}

		.hero-subline {
			font-size: 0.875rem;
			gap: 1rem;
		}

		.hero-content {
			justify-content: flex-end;
			padding-bottom: 0.5rem;
		}
	}
</style>
