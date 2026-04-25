<script lang="ts">
	import TripQuickActions from '$lib/components/trips/TripQuickActions.svelte';
	import OnboardingTooltip from '$lib/components/ui/OnboardingTooltip.svelte';
	import { getTooltip } from '$lib/config/onboardingTooltips.js';
	import type { DashboardMode } from '$lib/stores/dashboardMode.js';

	interface Props {
		trip: {
			id: string;
			name: string | null;
			location: string | null;
			locationCity?: string | null;
			fullAddress?: string | null;
			listingCoverPhoto: string | null;
			/** Trip blurb shown under host line on all dashboard heroes */
			description?: string | null;
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
	checkInDate?: string;
		checkOutDate?: string;
		activities?: Array<{ id: string; title: string; date: Date | string; time?: string | null; location?: string | null }>;
		mealSlots?: Array<unknown>;
		/** From header store; read-only here */
		selectedMode?: DashboardMode;
		/** Link to itinerary (meals + activities); when set, meals/activities counts are clickable */
		itineraryHref?: string;
		/** Link to games page; when set, games count is clickable */
		gamesHref?: string;
		/** Number of games (for "Z games" line) */
		gamesCount?: number;
		/** e.g. "Hosted by Alex" or "Hosted by Alex, Sam, and Jordan" */
		hostedByLine?: string | null;
		/** Hide share/edit quick-action buttons (e.g. invite preview) */
		hideQuickActions?: boolean;
		/** Host or co-host: full share menu */
		canHostShare?: boolean;
		/** Guest primary: plus-one link when unclaimed proxies exist */
		householdShare?: {
			householdId: string;
			hasUnclaimedProxyMembers: boolean;
			unclaimedFirstNames: string[];
			primaryFirstName: string;
		} | null;
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
	checkInDate = '',
		checkOutDate = '',
		activities = [],
		mealSlots = [],
		selectedMode = 'planning',
		itineraryHref = '',
		gamesHref = '',
		gamesCount = 0,
		hostedByLine = null,
		hideQuickActions = false,
		canHostShare = false,
		householdShare = null
	}: Props = $props();

	const quickActionsTip = $derived(isHost ? getTooltip('host_quick_actions') : null);

	const mealsCount = $derived(mealSlots.length);
	const activitiesCount = $derived(activities.length);
	const showMealsActivitiesGames = $derived(mealsCount > 0 || activitiesCount > 0 || gamesCount > 0);

	const destinationLabel = $derived((trip.locationCity ?? trip.fullAddress ?? trip.location)?.trim() ?? '');
	const isCompact = $derived(selectedMode === 'vacation' || selectedMode === 'recap');
	const tripDescriptionTrim = $derived((trip.description ?? '').trim());

	const daysUntil = $derived.by(() => {
		if (!checkInDate) return null;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const checkIn = new Date(checkInDate);
		checkIn.setHours(0, 0, 0, 0);
		const diff = Math.round((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return diff > 0 ? diff : null;
	});

	const daysUntilDigitCount = $derived(daysUntil === null ? 0 : String(daysUntil).length);
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
				{#if showMealsActivitiesGames}
					<div class="hero-counts">
						{#if itineraryHref}
							<a href={itineraryHref} class="hero-count-link">{mealsCount} meals</a>
						{:else}
							<span class="hero-count-text">{mealsCount} meals</span>
						{/if}
						<span class="hero-count-sep">|</span>
						{#if itineraryHref}
							<a href={itineraryHref} class="hero-count-link">{activitiesCount} activities</a>
						{:else}
							<span class="hero-count-text">{activitiesCount} activities</span>
						{/if}
						<span class="hero-count-sep">|</span>
						{#if gamesHref}
							<a href={gamesHref} class="hero-count-link">{gamesCount} games</a>
						{:else}
							<span class="hero-count-text">{gamesCount} games</span>
						{/if}
					</div>
				{/if}
				<div class="compact-title-stack">
					<h1 class="compact-name">{trip.name ?? 'Trip'}</h1>
					{#if hostedByLine}
						<p class="compact-hosted-by">{hostedByLine}</p>
					{/if}
					{#if tripDescriptionTrim}
						<p class="compact-trip-desc">{tripDescriptionTrim}</p>
					{/if}
				</div>
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

		{#if !hideQuickActions}
		<div class="compact-actions">
		<TripQuickActions
			tripId={trip.id}
			onInvite={quickActions.onInvite}
			showToast={quickActions.showToast}
			{isHost}
			{canHostShare}
			{householdShare}
		/>
	</div>
		{/if}
</div>
{:else}
	<!-- ═══ Full hero for Planning ═══ -->
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
			{#if daysUntil !== null}
				<div
					class="hero-countdown"
					style="--countdown-digits: {daysUntilDigitCount}"
					aria-label="{daysUntil} days until the trip"
				>
					<span class="hero-countdown-num">{daysUntil}</span>
					<span class="hero-countdown-unit">day{daysUntil === 1 ? '' : 's'}</span>
					<span class="hero-countdown-label">to go</span>
				</div>
			{/if}
			<div class="hero-overlay">
				<div class="hero-content">
				{#if showMealsActivitiesGames}
					<div class="hero-counts">
						{#if itineraryHref}
							<a href={itineraryHref} class="hero-count-link">{mealsCount} meals</a>
						{:else}
							<span class="hero-count-text">{mealsCount} meals</span>
						{/if}
						<span class="hero-count-sep">|</span>
						{#if itineraryHref}
							<a href={itineraryHref} class="hero-count-link">{activitiesCount} activities</a>
						{:else}
							<span class="hero-count-text">{activitiesCount} activities</span>
						{/if}
						<span class="hero-count-sep">|</span>
						{#if gamesHref}
							<a href={gamesHref} class="hero-count-link">{gamesCount} games</a>
						{:else}
							<span class="hero-count-text">{gamesCount} games</span>
						{/if}
					</div>
				{/if}
				<div class="hero-title-stack">
					<h1 class="hero-name">{trip.name ?? 'Trip'}</h1>
					{#if hostedByLine}
						<p class="hero-hosted-by">{hostedByLine}</p>
					{/if}
					{#if tripDescriptionTrim}
						<p class="hero-trip-desc">{tripDescriptionTrim}</p>
					{/if}
				</div>
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
			{#if !hideQuickActions}
			<div class="hero-center-actions" style="position:relative;">
		<TripQuickActions
					tripId={trip.id}
					onInvite={quickActions.onInvite}
					showToast={quickActions.showToast}
					{isHost}
					{canHostShare}
					{householdShare}
				/>
				{#if quickActionsTip}
					<OnboardingTooltip
						key={quickActionsTip.key}
						title={quickActionsTip.title}
						body={quickActionsTip.body}
						position={quickActionsTip.position}
						align={quickActionsTip.align}
					/>
				{/if}
				</div>
			{/if}
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
		/* Top clearance comes from AppShell .main-content-inner padding when the floating bar is present */
		margin-top: 0;
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
		background: linear-gradient(135deg, rgba(10, 18, 22, 0.65) 0%, rgba(47, 119, 120, 0.45) 100%);
	}

	.compact-hero.recap-mode .compact-overlay {
		background: linear-gradient(135deg, rgba(10, 18, 22, 0.72) 0%, rgba(165, 68, 14, 0.45) 100%);
	}

	.compact-hero.compact-hero--has-desc {
		min-height: 168px;
		height: auto;
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
		gap: 0.5rem;
		min-width: 0;
	}

	.compact-title-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		min-width: 0;
	}

	.compact-left .hero-counts {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.85);
		justify-content: flex-start;
	}

	.compact-name {
		font-family: 'Fraunces', Georgia, serif;
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: white;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		letter-spacing: -0.02em;
		line-height: 1.15;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 420px;
	}

	.compact-hosted-by {
		margin: 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.9);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
		line-height: 1.3;
		max-width: min(420px, 100%);
	}

	.compact-trip-desc {
		margin: 0.2rem 0 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		font-size: 0.75rem;
		font-weight: 400;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.82);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
		max-width: min(520px, 100%);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
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
	.compact-actions :global(.quick-actions .sh-btn) {
		color: white;
		background: rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-md);
		border: none;
		width: 28px;
		height: 28px;
		min-height: 28px;
		padding: 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.compact-actions :global(.quick-actions .sh-btn:hover) {
		background: rgba(255, 255, 255, 0.3);
		color: white;
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
	   On trip dashboard: first pixel of cover photo sits `--trip-dash-hero-offset` below the top
	   of `.main-content-inner` (floating mode pill + messages row). margin-top stays 0 — do not
	   duplicate that offset here; vacation/recap dashboard roots follow the same rule.
	   ════════════════════════════════════ */
	.trip-hero {
		margin-top: 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		border-radius: var(--radius-3xl);
		overflow: hidden;
		box-shadow: var(--shadow-soft);
		height: 460px;
		min-height: 460px;
		background: var(--bg);
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
		background: var(--warm);
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

	/* ── Countdown badge (auto-height; number scales with digit count) ── */
	.hero-countdown {
		--countdown-box: 6rem;
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		z-index: 2;
		box-sizing: border-box;
		width: var(--countdown-box);
		height: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		background: rgba(0, 0, 0, 0.42);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.22);
		border-radius: 1.25rem;
		padding: 0.6rem 0.5rem 0.65rem;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.12);
		text-align: center;
		pointer-events: none;
		user-select: none;
	}

	.hero-countdown-num {
		/* Shrink glyph size as digit count grows so 1–999 stay inside the square */
		font-size: clamp(
			1.75rem,
			calc(4rem / (0.4 + var(--countdown-digits, 2) * 0.46)),
			4rem
		);
		font-weight: 800;
		line-height: 0.95;
		color: white;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
		max-width: 100%;
		overflow: hidden;
		text-overflow: clip;
	}

	.hero-countdown-unit {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--warm);
		margin-top: 0.12rem;
		line-height: 1;
	}

	.hero-countdown-label {
		font-size: 0.5625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255, 255, 255, 0.5);
		line-height: 1;
		margin-top: 0.06rem;
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

	.hero-content {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.hero-title-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		max-width: min(48rem, 100%);
	}

	.hero-counts {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.hero-count-link {
		color: rgba(255, 255, 255, 0.95);
		text-decoration: none;
		font-weight: 500;
	}
	.hero-count-link:hover {
		text-decoration: underline;
		color: white;
	}

	.hero-count-text {
		color: rgba(255, 255, 255, 0.9);
	}

	.hero-count-sep {
		color: rgba(255, 255, 255, 0.5);
		user-select: none;
	}

	.hero-name {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 4rem;
		font-weight: 700;
		line-height: 1.08;
		color: white;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		letter-spacing: -0.025em;
		text-align: center;
	}

	.hero-hosted-by {
		margin: 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		font-size: 1rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.94);
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
		line-height: 1.3;
		text-align: center;
		max-width: 42rem;
	}

	.hero-trip-desc {
		margin: 0.35rem 0 0;
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		font-size: 0.9375rem;
		font-weight: 400;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.88);
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
		text-align: center;
		max-width: 40rem;
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

	/* ShareButton uses .sh-btn — match .action-btn (My RSVP / Edit trip); chain .quick-actions for specificity over ShareButton.svelte */
	.hero-center-actions :global(.quick-actions .sh-btn) {
		color: white;
		background: rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-md);
		border: none;
		transition: opacity var(--transition-fast);
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.hero-center-actions :global(.quick-actions .sh-btn:hover) {
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

		.hero-hosted-by {
			font-size: 0.9375rem;
		}

		.hero-trip-desc {
			font-size: 0.875rem;
		}

		.hero-subline {
			font-size: 0.9375rem;
		}
	}

	@media (max-width: 640px) {
		.compact-hero {
			margin-left: -0.5rem;
			margin-right: -0.5rem;
			width: calc(100% + 1rem);
			border-radius: 0;
		}

		.trip-hero {
			margin-left: -0.5rem;
			margin-right: -0.5rem;
			width: calc(100% + 1rem);
			border-radius: 0;
			height: 280px;
			min-height: 280px;
		}

		.hero-countdown {
			--countdown-box: 4.5rem;
			top: 0.75rem;
			right: 0.75rem;
			border-radius: 0.75rem;
			padding: 0.45rem 0.35rem 0.5rem;
		}

		.hero-countdown-num {
			font-size: clamp(
				1.1rem,
				calc(2.6rem / (0.4 + var(--countdown-digits, 2) * 0.46)),
				2.6rem
			);
		}

		.hero-countdown-unit {
			font-size: 0.5rem;
			letter-spacing: 0.06em;
		}

		.hero-countdown-label {
			font-size: 0.4375rem;
		}

		.hero-overlay {
			padding: 1rem 1.25rem;
		}

		.hero-name {
			font-size: 2.5rem;
		}

		.hero-hosted-by {
			font-size: 0.875rem;
			padding: 0 0.25rem;
		}

		.hero-trip-desc {
			font-size: 0.8125rem;
			padding: 0 0.5rem;
		}

		.hero-subline {
			font-size: 0.875rem;
			gap: 1rem;
		}

		.hero-content {
			justify-content: center;
			padding-bottom: 0.5rem;
		}
	}
</style>
