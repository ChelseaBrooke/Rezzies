<script lang="ts">
	import TripQuickActions from '$lib/components/trips/TripQuickActions.svelte';
	import TripCalendarWidget from '$lib/components/trips/TripCalendarWidget.svelte';
	import NotificationTray from '$lib/components/NotificationTray.svelte';

	interface Props {
		trip: {
			id: string;
			name: string | null;
			location: string | null;
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
		inviteCode?: string;
		checkInDate?: string;
		checkOutDate?: string;
		activities?: Array<{ id: string; title: string; date: Date | string; time?: string | null; location?: string | null }>;
		mealSlots?: Array<unknown>;
	}

	let {
		trip,
		dateRange,
		calendarAddUrl,
		mapsUrl,
		quickActions,
		tripInfoContent,
		isHost,
		inviteCode,
		checkInDate = '',
		checkOutDate = '',
		activities = [],
		mealSlots = []
	}: Props = $props();

</script>

<div class="hero-with-calendar">
	<div class="trip-hero">
		<div class="hero-image-wrap">
			{#if trip.listingCoverPhoto}
				<img src={trip.listingCoverPhoto} alt="" class="hero-image" />
			{:else}
				<div class="hero-placeholder"></div>
			{/if}
			<div class="hero-overlay">
				<div class="hero-content">
				<h1 class="hero-name">{trip.name ?? 'Trip'}</h1>
				<div class="hero-subline">
					{#if calendarAddUrl}
						<a href={calendarAddUrl} target="_blank" rel="noopener noreferrer" class="hero-meta-link" title="Add to calendar">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="16" y1="2" x2="16" y2="6"></line>
								<line x1="8" y1="2" x2="8" y2="6"></line>
								<line x1="3" y1="10" x2="21" y2="10"></line>
							</svg>
							<span>{dateRange}</span>
						</a>
					{:else}
						<span class="hero-meta-text">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="16" y1="2" x2="16" y2="6"></line>
								<line x1="8" y1="2" x2="8" y2="6"></line>
								<line x1="3" y1="10" x2="21" y2="10"></line>
							</svg>
							<span>{dateRange}</span>
						</span>
					{/if}
					{#if trip.location?.trim()}
						{#if mapsUrl}
							<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="hero-meta-link" title="Open in Google Maps">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
									<circle cx="12" cy="10" r="3"></circle>
								</svg>
								<span>{trip.location}</span>
							</a>
						{:else}
							<span class="hero-meta-text">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
									<circle cx="12" cy="10" r="3"></circle>
								</svg>
								<span>{trip.location}</span>
							</span>
						{/if}
					{/if}
				</div>
				<!-- Share / Edit trip / Info (same hover state as former bottom-right icons) -->
				<div class="hero-center-actions">
					<TripQuickActions
						tripId={trip.id}
						{inviteCode}
						onInvite={quickActions.onInvite}
						showToast={quickActions.showToast}
						{tripInfoContent}
						{isHost}
					/>
				</div>
			</div>
			</div>
		</div>
	</div>
	<!-- Calendar and bell layered over hero -->
	<div class="hero-calendar-layer">
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
		<span class="hero-bell">
			<NotificationTray />
		</span>
	</div>
</div>

<style>
	.hero-with-calendar {
		position: relative;
		width: 100%;
		overflow: visible;
		/* Reserve space so calendar/bell (top: -3rem) aren’t clipped by main-content */
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
 /* Slight inset so calendar top isn’t clipped by radius */
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
		right: 1rem;
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

	.hero-bell {
		flex-shrink: 0;
		display: inline-flex;
	}
	.hero-bell :global(.tray-trigger) {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		background: transparent;
		color: #111827;
		transition: opacity var(--transition-fast);
	}
	.hero-bell :global(.tray-trigger:hover) {
		opacity: 0.75;
	}

	.hero-calendar-wrap {
		/* Lighter, more transparent frosted glass; subtle tint so text stays readable */
		background: linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.18) 0%,
			rgba(255, 255, 255, 0.12) 40%,
			rgba(255, 255, 255, 0.06) 100%
		);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-radius: var(--radius-lg);
		border: 1px solid rgba(203, 213, 225, 0.45);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
		padding: 0.75rem 0.5rem;
		width: 300px;
		min-width: 300px;
		min-height: 300px;
		font-size: 0.8125rem;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.hero-calendar-wrap :global(.calendar-sidebar) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: transparent;
		box-shadow: none;
		border: none;
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
	}

	.hero-calendar-wrap :global(.month-header) {
		color: #1e293b;
		text-shadow: 0 0 1px rgba(255, 255, 255, 0.8);
	}

	.hero-calendar-wrap :global(.month-title) {
		font-size: 1.0625rem;
		font-weight: 700;
		color: #1e293b;
		text-shadow: 0 0 1px rgba(255, 255, 255, 0.8);
	}

	.hero-calendar-wrap :global(.day-headers) {
		margin-bottom: 0;
	}

	.hero-calendar-wrap :global(.day-header) {
		font-size: 0.7rem;
		color: rgba(30, 41, 59, 0.85);
	}

	.hero-calendar-wrap :global(.day-cell) {
		font-size: 0.75rem;
		color: #334155;
	}

	.hero-calendar-wrap :global(.day-cell.trip-day) {
		background: rgba(30, 41, 59, 0.14);
		color: #1e293b;
	}

	.hero-calendar-wrap :global(.month-chevron-btn) {
		color: #475569;
	}

	/* Match hint text to the trip-day box fill (white/off-white) */
	.hero-calendar-wrap :global(.day-detail-hint) {
		color: #f1f5f9;
		font-size: 0.7rem;
		opacity: 0.95;
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

	/* Share / Edit / Info in center of hero (same hover as former bottom-right icons) */
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
