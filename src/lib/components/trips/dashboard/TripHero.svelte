<script lang="ts">
	import TripQuickActions from '$lib/components/trips/TripQuickActions.svelte';
	import TripCalendarWidget from '$lib/components/trips/TripCalendarWidget.svelte';

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

	// Extract simple region label from location if possible (e.g., "Santorini, Greece" -> "Greece")
	const regionLabel = $derived(() => {
		if (!trip.location) return 'Trip';
		const parts = trip.location.split(',').map((s) => s.trim());
		return parts.length > 1 ? parts[parts.length - 1] : parts[0];
	});
</script>

<div class="trip-hero">
	<div class="hero-image-wrap">
		{#if trip.listingCoverPhoto}
			<img src={trip.listingCoverPhoto} alt="" class="hero-image" />
		{:else}
			<div class="hero-placeholder"></div>
		{/if}
		<div class="hero-overlay">
			<div class="hero-top">
				<div class="hero-label-pill">
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
						<circle cx="12" cy="10" r="3"></circle>
					</svg>
					<span>{regionLabel()}</span>
				</div>
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
			<div class="hero-content">
				<h1 class="hero-name">{trip.name ?? 'Trip'}</h1>
				<p class="hero-subline">
					{#if calendarAddUrl}
						<a href={calendarAddUrl} target="_blank" rel="noopener noreferrer" class="hero-link" title="Add to calendar">{dateRange}</a>
					{:else}
						<span>{dateRange}</span>
					{/if}
					{#if trip.location?.trim()}
						<span class="hero-sep"> · </span>
						{#if mapsUrl}
							<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="hero-link" title="Open in Google Maps">{trip.location}</a>
						{:else}
							<span>{trip.location}</span>
						{/if}
					{/if}
				</p>
				<div class="hero-pills">
					{#if calendarAddUrl}
						<a href={calendarAddUrl} target="_blank" rel="noopener noreferrer" class="hero-pill">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="16" y1="2" x2="16" y2="6"></line>
								<line x1="8" y1="2" x2="8" y2="6"></line>
								<line x1="3" y1="10" x2="21" y2="10"></line>
							</svg>
							<span>Add to calendar</span>
						</a>
					{/if}
					{#if mapsUrl}
						<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="hero-pill">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
								<circle cx="12" cy="10" r="3"></circle>
							</svg>
							<span>Open maps</span>
						</a>
					{/if}
				</div>
			</div>
			<div class="hero-actions">
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

<style>
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

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.3) 40%, transparent 60%);
		color: white;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 1.5rem 2rem;
	}

	.hero-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.hero-label-pill {
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		background: rgba(255, 255, 255, 0.25);
		backdrop-filter: blur(10px);
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}

	.hero-label-pill svg {
		flex-shrink: 0;
	}

	.hero-calendar-wrap {
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-lg);
		border: 1px solid rgba(255, 255, 255, 0.25);
		padding: 0.5rem;
		max-width: 280px;
		font-size: 0.75rem;
	}

	.hero-calendar-wrap :global(.calendar-sidebar) {
		background: transparent;
		box-shadow: none;
		border: none;
		padding: 0;
		min-width: 0;
	}

	.hero-calendar-wrap :global(.month-calendar.sidebar-style) {
		font-size: inherit;
	}

	.hero-calendar-wrap :global(.month-header),
	.hero-calendar-wrap :global(.month-title) {
		font-size: 0.7rem;
		color: white;
	}

	.hero-calendar-wrap :global(.day-header) {
		font-size: 0.6rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.hero-calendar-wrap :global(.day-cell) {
		font-size: 0.65rem;
		color: white;
	}

	.hero-calendar-wrap :global(.day-cell.trip-day) {
		background: rgba(255, 255, 255, 0.35);
	}

	.hero-calendar-wrap :global(.month-chevron-btn) {
		color: white;
	}

	.hero-content {
		flex: 1;
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
		gap: 0.25rem;
		line-height: 1.5;
		max-width: 600px;
	}

	.hero-pills {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 1rem;
	}

	.hero-sep {
		opacity: 0.85;
	}

	.hero-link {
		color: inherit;
		text-decoration: none;
		opacity: 0.95;
		transition: opacity var(--transition-fast);
	}

	.hero-link:hover {
		opacity: 1;
		text-decoration: underline;
	}

	.hero-pill {
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		text-decoration: none;
		transition: all var(--transition-fast);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.hero-pill:hover {
		background: white;
		border-color: rgba(255, 255, 255, 0.6);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.hero-pill svg {
		flex-shrink: 0;
	}

	.hero-actions {
		position: absolute;
		right: 1.5rem;
		bottom: 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hero-actions :global(.quick-actions) {
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-xl);
		padding: 0.5rem;
		gap: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.hero-actions :global(.action-btn) {
		width: 2rem;
		height: 2rem;
		color: white;
		background: rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-md);
		border: none;
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
		}

		.hero-pills {
			flex-direction: column;
		}

		.hero-actions {
			right: 1rem;
			bottom: 1rem;
		}

		.hero-content {
			justify-content: flex-end;
			padding-bottom: 0.5rem;
		}
	}
</style>
