<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form?: Record<string, unknown> } = $props();

	// Search state
	let keyword = $state('');
	let searching = $state(false);
	let searchError = $state('');
	let hasSearched = $state(false);

	// Results state
	let results = $state<any[]>([]);
	let weather = $state<any>(null);
	let meta = $state<any>(null);
	let categoriesAvailable = $state<any[]>([]);

	// Filter state
	let selectedCategory = $state('');
	let selectedBudget = $state('any');
	let selectedIndoorOutdoor = $state('any');
	let selectedRadius = $state(25);
	let sortBy = $state('relevance');
	let currentPage = $state(1);

	// Expanded card state
	let expandedId = $state<string | null>(null);

	// Half-hour time slots for the time picker (12-hour AM/PM format)
	const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
		const h24 = Math.floor((i * 30) / 60);
		const mins = (i * 30) % 60;
		const ampm = h24 < 12 ? 'AM' : 'PM';
		const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
		return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
	});

	// Add-to-trip modal: selected discover result and form state
	let addModalResult = $state<Record<string, unknown> | null>(null);
	let addModalDate = $state('');
	let addModalTime = $state('9:00 AM');

	let addModalSubmitting = $state(false);
	let pollFormSubmittingId = $state<string | null>(null);
	let showPollCreatedModal = $state(false);

	// Carousel state: tracks current photo index per result id
	let carouselIndex = $state<Record<string, number>>({});

	function getPhotoIndex(id: string): number {
		return carouselIndex[id] || 0;
	}

	function nextPhoto(id: string, total: number) {
		const current = getPhotoIndex(id);
		carouselIndex = { ...carouselIndex, [id]: (current + 1) % total };
	}

	function prevPhoto(id: string, total: number) {
		const current = getPhotoIndex(id);
		carouselIndex = { ...carouselIndex, [id]: (current - 1 + total) % total };
	}

	const trip = $derived(data.trip);
	const tripLocation = $derived(trip.locationCity || trip.fullAddress || trip.location || 'Unknown location');

	const tripDateOptions = $derived.by(() => {
		const start = trip.checkInDate ? new Date(trip.checkInDate) : null;
		const end = trip.checkOutDate ? new Date(trip.checkOutDate) : null;
		if (!start || !end) return [] as { value: string; label: string }[];
		const out: { value: string; label: string }[] = [];
		const d = new Date(start);
		while (d <= end) {
			const yyyy = d.getFullYear();
			const mm = String(d.getMonth() + 1).padStart(2, '0');
			const dd = String(d.getDate()).padStart(2, '0');
			out.push({
				value: `${yyyy}-${mm}-${dd}`,
				label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
			});
			d.setDate(d.getDate() + 1);
		}
		return out;
	});

	function openAddModal(result: Record<string, unknown>) {
		addModalResult = result;
		const eventDate = result.event_date as string | undefined;
		const opts = tripDateOptions;
		const firstDay = opts[0]?.value ?? '';
		addModalDate = eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : firstDay;
		addModalTime = '9:00 AM';
	}
	function closeAddModal() {
		addModalResult = null;
	}

	/** Find a trip activity that matches this discover result (by title). */
	function getBookedActivityForResult(resultName: string): { date: Date; time: string | null } | null {
		const name = (resultName ?? '').trim().toLowerCase();
		if (!name || !data.activities?.length) return null;
		const activity = data.activities.find(
			(a: { title?: string | null }) => (a.title ?? '').trim().toLowerCase() === name
		);
		if (!activity?.date) return null;
		return {
			date: new Date(activity.date),
			time: (activity.time as string)?.trim() || null
		};
	}

	function formatBookedSlot(activity: { date: Date; time: string | null }): string {
		const day = activity.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
		return activity.time ? `${day} · ${activity.time}` : day;
	}

	const budgetOptions = [
		{ value: 'any', label: 'Any Price' },
		{ value: 'free', label: 'Free' },
		{ value: 'budget', label: 'Budget ($)' },
		{ value: 'moderate', label: 'Moderate ($$)' },
		{ value: 'premium', label: 'Premium ($$$)' }
	];

	const sortOptions = [
		{ value: 'relevance', label: 'Relevance' },
		{ value: 'rating', label: 'Top Rated' },
		{ value: 'distance', label: 'Nearest' },
		{ value: 'price', label: 'Cheapest' }
	];

	const indoorOutdoorOptions = [
		{ value: 'any', label: 'Any' },
		{ value: 'indoor', label: 'Indoor' },
		{ value: 'outdoor', label: 'Outdoor' }
	];

	const radiusOptions = [
		{ value: 10, label: '10 mi' },
		{ value: 25, label: '25 mi' },
		{ value: 50, label: '50 mi' },
		{ value: 100, label: '100 mi' }
	];

	async function discoverActivities(page = 1) {
		searching = true;
		searchError = '';
		currentPage = page;

		try {
			const body: Record<string, unknown> = {
				page,
				sort_by: sortBy,
				radius_miles: selectedRadius
			};

			if (keyword.trim()) {
				body.keywords = [keyword.trim()];
			}
			if (selectedCategory) {
				body.categories = [selectedCategory];
			}
			if (selectedBudget !== 'any') {
				body.budget = selectedBudget;
			}
			if (selectedIndoorOutdoor !== 'any') {
				body.indoor_outdoor = selectedIndoorOutdoor;
			}

			const res = await fetch(`/api/trips/${trip.id}/activities/discover`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const json = await res.json();

			if (!res.ok) {
				searchError = json.error || 'Something went wrong';
				return;
			}

			results = json.results || [];
			weather = json.weather || null;
			meta = json.meta || null;
			categoriesAvailable = json.categories_available || [];
			hasSearched = true;
		} catch (err) {
			searchError = 'Failed to connect. Please try again.';
		} finally {
			searching = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		selectedCategory = '';
		searchTimeout = setTimeout(() => discoverActivities(1), 300);
	}

	function selectCategory(key: string) {
		selectedCategory = selectedCategory === key ? '' : key;
		discoverActivities(1);
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function getPriceLabel(level: string): string {
		switch (level) {
			case 'free': return 'Free';
			case 'budget': return '$';
			case 'moderate': return '$$';
			case 'premium': return '$$$';
			default: return '';
		}
	}

	function getTypeIcon(type: string): string {
		switch (type) {
			case 'event': return '🎫';
			case 'activity': return '🏃';
			case 'business': return '🏪';
			default: return '📍';
		}
	}

	function getWeatherIcon(condition: string): string {
		const c = condition.toLowerCase();
		if (c.includes('clear') || c.includes('sunny')) return '☀️';
		if (c.includes('partly')) return '⛅';
		if (c.includes('cloud')) return '☁️';
		if (c.includes('rain')) return '🌧️';
		if (c.includes('snow')) return '❄️';
		if (c.includes('thunder') || c.includes('storm')) return '⛈️';
		return '🌤️';
	}

	function formatRating(rating: number | null): string {
		if (rating == null) return '';
		return rating.toFixed(1);
	}

	function handleResult() {
		return async ({
			result,
			update
		}: {
			result: { data?: Record<string, unknown>; type: string };
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update();
		};
	}

	$effect(() => {
		if (form?.addDiscoveredActivitySuccess && form?.pollCreated) {
			showPollCreatedModal = true;
		}
	});

	function buildDiscoverNotes(result: Record<string, unknown>): string {
		const parts: string[] = [];
		if (result.description && typeof result.description === 'string') {
			parts.push(result.description.slice(0, 500) + (result.description.length > 500 ? '…' : ''));
		}
		if (result.booking_url && typeof result.booking_url === 'string') {
			parts.push(`Book: ${result.booking_url}`);
		}
		if (result.website && typeof result.website === 'string') {
			parts.push(`Website: ${result.website}`);
		}
		return parts.join('\n\n') || '';
	}
</script>

<svelte:head>
	<title>Activities – {trip.name}</title>
</svelte:head>

<div class="activities-page">
	<header class="page-header">
		<div class="header-text">
			<h1>Discover Activities</h1>
			<p class="subtitle">Find things to do near {tripLocation}</p>
		</div>
		<a href="/trips/{trip.id}" class="btn btn-secondary">Back to Trip</a>
	</header>

	<!-- Weather Banner -->
	{#if weather}
		<div class="weather-banner">
			{#if Array.isArray(weather)}
				{#each weather.slice(0, 5) as w}
					<div class="weather-day">
						<span class="weather-date">{new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
						<span class="weather-icon">{getWeatherIcon(w.condition)}</span>
						<span class="weather-temps">{w.high_f}°/{w.low_f}°</span>
						{#if w.precipitation_chance > 30}
							<span class="weather-rain">{w.precipitation_chance}% rain</span>
						{/if}
					</div>
				{/each}
			{:else}
				<div class="weather-day">
					<span class="weather-icon">{getWeatherIcon(weather.condition)}</span>
					<span class="weather-condition">{weather.condition}</span>
					<span class="weather-temps">{weather.high_f}°/{weather.low_f}°F</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Search Section -->
	<div class="search-section">
		<form class="search-form" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
			<div class="search-input-wrap">
				<svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<circle cx="11" cy="11" r="8"/>
					<line x1="21" y1="21" x2="16.65" y2="16.65"/>
				</svg>
				<input
					type="text"
					placeholder="Search for activities, restaurants, things to do..."
					bind:value={keyword}
					class="search-input"
					aria-label="Search for activities"
				/>
			</div>
			<button type="submit" class="btn btn-primary" disabled={searching}>
				{searching ? 'Searching...' : 'Discover'}
			</button>
		</form>

		<!-- Filters Row -->
		<div class="filters-row">
			<div class="filter-group">
				<select bind:value={selectedBudget} class="filter-select" aria-label="Filter by budget" onchange={() => { if (hasSearched) discoverActivities(1); }}>
					{#each budgetOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<select bind:value={selectedIndoorOutdoor} class="filter-select" aria-label="Filter by indoor or outdoor" onchange={() => { if (hasSearched) discoverActivities(1); }}>
					{#each indoorOutdoorOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<select bind:value={selectedRadius} class="filter-select" aria-label="Search radius" onchange={() => { if (hasSearched) discoverActivities(1); }}>
					{#each radiusOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<select bind:value={sortBy} class="filter-select" aria-label="Sort results" onchange={() => { if (hasSearched) discoverActivities(1); }}>
					{#each sortOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Category Chips -->
		{#if categoriesAvailable.length > 0}
			<div class="category-chips">
				{#each categoriesAvailable as cat}
					<button
						type="button"
						class="chip"
						class:chip-active={selectedCategory === cat.key}
						onclick={() => selectCategory(cat.key)}
					>
						{cat.label}
						<span class="chip-count">{cat.count}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Error State -->
	{#if searchError}
		<div class="error-card">
			<p>{searchError}</p>
		</div>
	{/if}
	{#if form?.addDiscoveredActivitySuccess}
		<div class="success-toast" role="status">
			{form.pollCreated ? 'Poll created! Group can vote on the Polls page.' : 'Added to trip! You can see it in the itinerary.'}
		</div>
	{/if}
	{#if form?.addDiscoveredActivityError}
		<div class="error-card" role="alert">{form.addDiscoveredActivityError}</div>
	{/if}

	<!-- Results -->
	{#if searching}
		<div class="loading-state" role="status" aria-live="polite">
			<div class="spinner"></div>
			<p>Discovering activities near {tripLocation}...</p>
		</div>
	{:else if hasSearched && results.length === 0}
		<div class="empty-state">
			<div class="empty-icon" aria-hidden="true">🔍</div>
			<p>No activities found</p>
			<p class="empty-hint">Try different keywords or broaden your filters.</p>
		</div>
	{:else if results.length > 0}
		{#if meta}
			<div class="results-meta">
				<span>{meta.total_results} activities found</span>
				{#if meta.total_results > 20}
					<span class="meta-page">Page {meta.page} of {Math.ceil(meta.total_results / meta.per_page)}</span>
				{/if}
			</div>
		{/if}

		<div class="results-grid">
			{#each results as result (result.id)}
				{@const booked = getBookedActivityForResult(result.name)}
				<div class="result-card" class:result-card-expanded={expandedId === result.id}>
					<!-- Photo Carousel -->
					{#if result.photos && result.photos.length > 0}
						{@const photoIdx = getPhotoIndex(result.id)}
						<div class="result-photo">
							<img src={result.photos[photoIdx]} alt="{result.name} - photo {photoIdx + 1}" loading="lazy" />
							{#if result.price_level && result.price_level !== 'unknown'}
								<span class="price-badge">{getPriceLabel(result.price_level)}</span>
							{/if}
							{#if result.photos.length > 1}
								<button type="button" class="carousel-btn carousel-prev" onclick={(e) => { e.stopPropagation(); prevPhoto(result.id, result.photos.length); }} aria-label="Previous photo">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
								</button>
								<button type="button" class="carousel-btn carousel-next" onclick={(e) => { e.stopPropagation(); nextPhoto(result.id, result.photos.length); }} aria-label="Next photo">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
								</button>
								<div class="carousel-dots">
									{#each result.photos as _, i}
										<span class="carousel-dot" class:carousel-dot-active={i === photoIdx}></span>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<div class="result-body">
						<div class="result-header">
							<div class="result-title-row">
								<span class="type-icon">{getTypeIcon(result.type)}</span>
								<h3 class="result-name">{result.name}</h3>
							</div>
							{#if result.rating}
								<div class="result-rating">
									<span class="star">★</span>
									<span>{formatRating(result.rating)}</span>
									{#if result.review_count}
										<span class="review-count">({result.review_count.toLocaleString()})</span>
									{/if}
								</div>
							{/if}
						</div>

						{#if result.subcategory || result.category}
							<div class="result-tags">
								{#if result.group_friendly}
									<span class="tag tag-group">Group Friendly</span>
								{/if}
								{#each result.tags?.slice(0, 3) || [] as tag}
									<span class="tag">{tag}</span>
								{/each}
							</div>
						{/if}

						<p class="result-description">{result.description}</p>

						{#if result.why_recommended}
							<p class="result-recommendation">{result.why_recommended}</p>
						{/if}

						<div class="result-details">
							{#if result.address}
								<span class="detail-item">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
									{result.address}
								</span>
							{/if}
							{#if result.distance_miles != null}
								<span class="detail-item">
									{result.distance_miles.toFixed(1)} mi away
								</span>
							{/if}
							{#if result.hours_on_date}
								<span class="detail-item">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
									{result.hours_on_date.open} – {result.hours_on_date.close}
								</span>
							{/if}
						</div>

						<!-- Expanded Details -->
						{#if expandedId === result.id}
							<div class="expanded-details">
								{#if result.accessibility}
									<div class="detail-row">
										<span class="detail-label">Accessibility</span>
										<span>{result.accessibility.wheelchair ? 'Wheelchair accessible' : 'Not wheelchair accessible'}{result.accessibility.notes ? ` — ${result.accessibility.notes}` : ''}</span>
									</div>
								{/if}
								{#if result.group_size_limit}
									<div class="detail-row">
										<span class="detail-label">Max Group Size</span>
										<span>{result.group_size_limit}</span>
									</div>
								{/if}
								{#if result.phone}
									<div class="detail-row">
										<span class="detail-label">Phone</span>
										<a href="tel:{result.phone}" class="detail-link">{result.phone}</a>
									</div>
								{/if}
								{#if result.event_date}
									<div class="detail-row">
										<span class="detail-label">Event Date</span>
										<span>{new Date(result.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
									</div>
								{/if}
							</div>
						{/if}

						<div class="result-actions">
							<div class="result-actions-left">
								<button type="button" class="btn btn-ghost" onclick={() => toggleExpand(result.id)} aria-expanded={expandedId === result.id}>
									{expandedId === result.id ? 'Less' : 'More'}
								</button>
							</div>
							<div class="result-actions-center">
								{#if booked}
									<span class="result-booked-slot">{formatBookedSlot(booked)}</span>
								{:else}
									<button type="button" class="btn btn-add-to-trip btn-sm" onclick={() => openAddModal(result)}>Add to trip</button>
								{/if}
								<form
									method="POST"
									action="?/addDiscoveredActivity"
									use:enhance={() => {
										pollFormSubmittingId = result.id ?? result.name ?? 'poll';
										return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
											pollFormSubmittingId = null;
											await update();
											window.scrollTo({ top: 0, behavior: 'smooth' });
										};
									}}
									class="action-link-form"
								>
									<input type="hidden" name="title" value={result.name ?? ''} />
									<input type="hidden" name="location" value={result.address ?? ''} />
									<input type="hidden" name="notes" value={buildDiscoverNotes(result)} />
									<input type="hidden" name="additionType" value="poll" />
									<input type="hidden" name="date" value={tripDateOptions[0]?.value ?? ''} />
									<button type="submit" class="btn btn-poll btn-sm" disabled={pollFormSubmittingId !== null}>
										{pollFormSubmittingId === (result.id ?? result.name ?? 'poll') ? 'Creating…' : 'Propose as poll'}
									</button>
								</form>
							</div>
							<div class="action-links">
								{#if result.booking_url}
									<a href={result.booking_url} target="_blank" rel="noopener" class="btn btn-primary btn-sm">Book</a>
								{/if}
								{#if result.website}
									<a href={result.website} target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Website</a>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if meta && meta.total_results > meta.per_page}
			<div class="pagination">
				<button
					type="button"
					class="btn btn-secondary"
					disabled={currentPage <= 1}
					onclick={() => discoverActivities(currentPage - 1)}
				>
					Previous
				</button>
				<span class="page-info">Page {currentPage} of {Math.ceil(meta.total_results / meta.per_page)}</span>
				<button
					type="button"
					class="btn btn-secondary"
					disabled={currentPage >= Math.ceil(meta.total_results / meta.per_page)}
					onclick={() => discoverActivities(currentPage + 1)}
				>
					Next
				</button>
			</div>
		{/if}
	{:else}
		<!-- Initial State -->
		<div class="empty-state">
			<div class="empty-icon" aria-hidden="true">🗺️</div>
			<p>Discover events and activities</p>
			<p class="empty-hint">Search by keyword or hit Discover to see what's happening near your trip.</p>
			<button type="button" class="btn-discover-cta" onclick={() => discoverActivities(1)}>
				Discover Activities
			</button>
		</div>
	{/if}

	<!-- Add to trip modal -->
	{#if addModalResult}
		<div class="add-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-modal-title" onclick={(e) => e.target === e.currentTarget && closeAddModal()}>
			<div class="add-modal">
				<div class="add-modal-header">
					<h2 id="add-modal-title">Add to trip</h2>
					<button type="button" class="add-modal-close" onclick={closeAddModal} aria-label="Close">×</button>
				</div>
				<p class="add-modal-activity-name">{addModalResult.name as string}</p>
				<form
					method="POST"
					action="?/addDiscoveredActivity"
					use:enhance={() => {
						addModalSubmitting = true;
						return async ({ result, update }) => {
							await update();
							addModalSubmitting = false;
							if (result.type === 'success' && result.data?.addDiscoveredActivitySuccess) {
								closeAddModal();
							}
						};
					}}
					class="add-modal-form"
				>
					<input type="hidden" name="title" value={(addModalResult.name as string) ?? ''} />
					<input type="hidden" name="location" value={(addModalResult.address as string) ?? ''} />
					<input type="hidden" name="notes" value={buildDiscoverNotes(addModalResult)} />

					<label class="add-modal-label">Day</label>
					<select name="date" class="add-modal-select" bind:value={addModalDate} required>
						{#each tripDateOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>

					<label class="add-modal-label">Time</label>
					<select name="time" class="add-modal-select" bind:value={addModalTime} required>
						{#each TIME_OPTIONS as t}
							<option value={t}>{t}</option>
						{/each}
					</select>

					<input type="hidden" name="additionType" value="planned" />

					<p class="add-modal-note">Adding an activity to your itinerary does not book or reserve anything with the provider. Tickets and bookings still need to be made through the activity provider’s website.</p>

					<div class="add-modal-actions">
						<button type="button" class="btn btn-secondary" onclick={closeAddModal}>Cancel</button>
						<button type="submit" class="btn btn-add-to-trip" disabled={addModalSubmitting || !addModalDate || !addModalTime}>
							{addModalSubmitting ? 'Adding…' : 'Add to trip'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Poll created success modal -->
	{#if showPollCreatedModal}
		<div class="poll-created-backdrop" role="dialog" aria-modal="true" aria-labelledby="poll-created-title">
			<div class="poll-created-modal">
				<div class="poll-created-icon" aria-hidden="true">🗳️</div>
				<h2 id="poll-created-title" class="poll-created-title">Poll created!</h2>
				<p class="poll-created-message">
					Your group can vote on the Polls page. If &quot;Add to itinerary&quot; wins when the poll closes, the activity will be added automatically.
				</p>
				<div class="poll-created-actions">
					<a href="/trips/{trip?.id}/polls" class="btn btn-primary">Go to Polls</a>
					<button type="button" class="btn btn-secondary" onclick={() => (showPollCreatedModal = false)}>Close</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Existing Trip Activities -->
	{#if data.activities && data.activities.length > 0}
		<div class="saved-activities">
			<h2 class="section-title">Planned Activities</h2>
			<div class="saved-grid">
				{#each data.activities as activity}
					<div class="saved-card">
						<div class="saved-header">
							<h3>{activity.title}</h3>
						<div class="saved-header-badges">
							{#if activity.status === 'tentative'}
								<span class="saved-badge tentative">Tentative</span>
							{/if}
						</div>
						</div>
						<div class="saved-meta">
							{#if activity.date}
								<span>{new Date(activity.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
							{/if}
							{#if activity.time}
								<span>{activity.time}</span>
							{/if}
							{#if activity.location}
								<span>{activity.location}</span>
							{/if}
						</div>
						{#if activity.notes}
							<p class="saved-notes">{activity.notes}</p>
						{/if}
						<div class="saved-participants">
							{#if activity.participants && activity.participants.length > 0}
								<span class="participant-count">{activity.participants.length} going</span>
							{/if}
							{#if activity.participants?.some((p: any) => p.user.id === data.user.id)}
								<form method="POST" action="?/removeActivityParticipant" use:enhance={handleResult}>
									<input type="hidden" name="activityId" value={activity.id} />
									<input type="hidden" name="userId" value={data.user.id} />
									<button type="submit" class="btn btn-ghost btn-sm">Leave</button>
								</form>
							{:else}
								<form method="POST" action="?/addActivityParticipant" use:enhance={handleResult}>
									<input type="hidden" name="activityId" value={activity.id} />
									<input type="hidden" name="userId" value={data.user.id} />
									<button type="submit" class="btn btn-primary btn-sm">Join</button>
								</form>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.activities-page {
		max-width: 1000px;
		margin: 0 auto;
		padding: 0 1rem 2rem;
	}

	/* Header */
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		gap: 1rem;
	}

	.page-header h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0 0 0.25rem 0;
		color: var(--text);
	}

	.subtitle {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0;
	}

	/* Weather Banner */
	.weather-banner {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.875rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		margin-bottom: 1.25rem;
	}

	.weather-day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: 80px;
		padding: 0.5rem;
		font-size: 0.8125rem;
	}

	.weather-date {
		font-weight: 600;
		color: var(--text);
		font-size: 0.75rem;
	}

	.weather-icon {
		font-size: 1.25rem;
	}

	.weather-temps {
		color: var(--muted);
		font-size: 0.8125rem;
	}

	.weather-rain {
		color: var(--primary);
		font-size: 0.6875rem;
		font-weight: 500;
	}

	.weather-condition {
		color: var(--text);
		font-size: 0.8125rem;
	}

	/* Search Section */
	.search-section {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		margin-bottom: 1.25rem;
	}

	.search-form {
		display: flex;
		gap: 0.75rem;
	}

	.search-input-wrap {
		flex: 1;
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: 0.875rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--muted);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.6875rem 0.875rem 0.6875rem 2.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-family: inherit;
		background: var(--surfaceSolid);
		color: var(--text);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.search-input::placeholder {
		color: var(--muted);
		opacity: 0.7;
	}

	/* Filters */
	.filters-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.filter-select {
		padding: 0.4375rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		font-family: inherit;
		background: var(--surfaceSolid);
		color: var(--text);
		cursor: pointer;
	}

	.filter-select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	/* Category Chips */
	.category-chips {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3125rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 100px;
		font-size: 0.8125rem;
		font-family: inherit;
		background: var(--surfaceSolid);
		color: var(--text);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.chip:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.chip-active {
		background: var(--primary);
		color: white;
		border-color: var(--primary);
	}

	.chip-active:hover {
		background: var(--primaryHover);
		color: white;
	}

	.chip-count {
		font-size: 0.6875rem;
		opacity: 0.7;
	}

	/* Results Meta */
	.results-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	/* Results Grid */
	.results-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Result Card */
	.result-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		transition: box-shadow var(--transition-fast);
	}

	.result-card:hover {
		box-shadow: var(--shadow-md);
	}

	.result-photo {
		position: relative;
		height: 180px;
		overflow: hidden;
	}

	.result-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.price-badge {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: rgba(0, 27, 46, 0.75);
		color: white;
		padding: 0.25rem 0.625rem;
		border-radius: 100px;
		font-size: 0.75rem;
		font-weight: 600;
		z-index: 2;
	}

	/* Carousel */
	.carousel-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.85);
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity var(--transition-fast);
		z-index: 2;
		box-shadow: var(--shadow-sm);
	}

	.result-photo:hover .carousel-btn {
		opacity: 1;
	}

	.carousel-btn:hover {
		background: var(--surfaceSolid);
		box-shadow: var(--shadow-md);
	}

	.carousel-prev {
		left: 0.5rem;
	}

	.carousel-next {
		right: 0.5rem;
	}

	.carousel-dots {
		position: absolute;
		bottom: 0.5rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 0.3rem;
		z-index: 2;
	}

	.carousel-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.5);
		transition: background var(--transition-fast);
	}

	.carousel-dot-active {
		background: white;
	}

	.result-body {
		padding: 1rem 1.25rem;
	}

	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.result-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.type-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.result-name {
		font-size: 1.0625rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		line-height: 1.3;
	}

	.result-rating {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8125rem;
		color: var(--text);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.star {
		color: #f59e0b;
	}

	.review-count {
		color: var(--muted);
		font-size: 0.75rem;
	}

	/* Tags */
	.result-tags {
		display: flex;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}

	.tag {
		font-size: 0.6875rem;
		padding: 0.1875rem 0.5rem;
		border-radius: 100px;
		background: var(--surface2);
		color: var(--muted);
		font-weight: 500;
	}

	.tag-group {
		background: rgba(191, 78, 48, 0.1);
		color: var(--primary);
	}

	/* Description */
	.result-description {
		font-size: 0.875rem;
		color: var(--text);
		margin: 0 0 0.5rem 0;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.result-card-expanded .result-description {
		-webkit-line-clamp: unset;
	}

	.result-recommendation {
		font-size: 0.8125rem;
		color: var(--primary);
		margin: 0 0 0.625rem 0;
		padding: 0.5rem 0.75rem;
		background: rgba(191, 78, 48, 0.06);
		border-radius: var(--radius-md);
		line-height: 1.4;
	}

	/* Details */
	.result-details {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.detail-item {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.detail-item svg {
		flex-shrink: 0;
	}

	/* Expanded Details */
	.expanded-details {
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.detail-row {
		display: flex;
		gap: 0.5rem;
		padding: 0.375rem 0;
		font-size: 0.8125rem;
	}

	.detail-label {
		font-weight: 600;
		color: var(--muted);
		min-width: 120px;
	}

	.detail-link {
		color: var(--primary);
		text-decoration: none;
	}

	.detail-link:hover {
		text-decoration: underline;
	}

	/* Actions */
	.result-actions {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
		gap: 0.5rem;
	}

	.result-actions-left {
		justify-self: start;
	}
	.result-actions-center {
		justify-self: center;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.action-links {
		justify-self: end;
	}
	.result-actions-center .add-to-trip-form {
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.result-actions-center .btn-add-to-trip {
		margin: 0;
	}
	.result-booked-slot {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
	}

	.btn-add-to-trip {
		background: linear-gradient(135deg, var(--primary) 0%, var(--primaryHover) 100%);
		color: #fff;
		border: 1px solid transparent;
	}
	.btn-add-to-trip:hover {
		background: var(--primaryHover);
		color: #fff;
	}

	.action-links {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.action-link-form {
		display: inline-flex;
	}
	.btn-poll {
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border);
	}
	.btn-poll:hover {
		background: var(--surface2);
	}

	/* Add to trip modal */
	.add-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1100;
		padding: 1rem;
	}
	.add-modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-xl);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		max-width: 440px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}
	.add-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.25rem 0.5rem;
	}
	.add-modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
	}
	.add-modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: 0.25rem;
	}
	.add-modal-close:hover {
		color: var(--text);
	}
	.add-modal-activity-name {
		margin: 0 1.25rem 1rem;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	.add-modal-form {
		padding: 0 1.25rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.add-modal-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
	}
	.add-modal-label .muted {
		font-weight: 400;
		color: var(--muted);
	}
	.add-modal-select,
	.add-modal-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.9375rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surfaceSolid);
		color: var(--text);
	}
	.add-modal-fieldset {
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 1rem;
		margin: 0;
	}
	.add-modal-fieldset .add-modal-label {
		margin-bottom: 0.5rem;
	}
	.add-modal-radio {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
		cursor: pointer;
	}
	.add-modal-radio + .add-modal-hint {
		margin-top: 0.25rem;
		margin-bottom: 0.75rem;
	}
	.add-modal-radio:last-of-type + .add-modal-hint {
		margin-bottom: 0;
	}
	.add-modal-hint {
		margin: 0 0 0 1.5rem;
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.35;
	}
	.add-modal-note {
		margin: 0;
		padding: 0.75rem;
		font-size: 0.8125rem;
		color: var(--muted);
		background: var(--surface2);
		border-radius: var(--radius-md);
		line-height: 1.4;
	}

	.add-modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	/* Poll created success modal */
	.poll-created-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1100;
		padding: 1rem;
	}
	.poll-created-modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-xl);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		max-width: 380px;
		width: 100%;
		padding: 1.75rem 1.5rem;
		text-align: center;
	}
	.poll-created-icon {
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
	}
	.poll-created-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.5rem;
	}
	.poll-created-message {
		font-size: 0.9375rem;
		color: var(--muted);
		line-height: 1.5;
		margin: 0 0 1.5rem;
	}
	.poll-created-actions {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/* Loading */
	.loading-state {
		text-align: center;
		padding: 3rem 1.5rem;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		margin: 0 auto 1rem;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-state p {
		color: var(--muted);
		font-size: 0.9375rem;
		margin: 0;
	}

	/* Empty & Error */
	.empty-state {
		text-align: center;
		padding: 3rem 1.5rem;
		background: var(--surface);
		border-radius: var(--radius-2xl);
		border: 1px solid var(--border-soft);
	}

	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
		opacity: 0.7;
	}

	.empty-state p {
		margin: 0 0 0.25rem 0;
		color: var(--text);
		font-size: 1rem;
	}

	.empty-state .empty-hint {
		color: var(--muted);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.btn-discover-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.btn-discover-cta:hover {
		background: var(--primaryHover);
	}

	.btn-discover-cta:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.error-card {
		background: rgba(115, 44, 44, 0.08);
		border: 1px solid rgba(115, 44, 44, 0.2);
		border-radius: var(--radius-lg);
		padding: 1rem 1.25rem;
		margin-bottom: 1.25rem;
	}

	.error-card p {
		margin: 0;
		color: var(--danger);
		font-size: 0.9375rem;
	}

	.success-toast {
		background: rgba(41, 76, 96, 0.1);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 0.75rem 1.25rem;
		margin-bottom: 1.25rem;
		font-size: 0.9375rem;
		color: var(--text);
	}

	/* Pagination */
	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.page-info {
		font-size: 0.875rem;
		color: var(--muted);
	}

	/* Saved Activities Section */
	.saved-activities {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 1rem 0;
	}

	.saved-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.saved-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 1rem 1.25rem;
	}

	.saved-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.375rem;
	}

	.saved-header h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		color: var(--text);
	}

	.saved-header-badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.saved-badge.tentative {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
		background: var(--surface2);
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius-md);
	}
	.saved-price {
		font-size: 0.8125rem;
		color: var(--primary);
		font-weight: 600;
	}

	.saved-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: var(--muted);
		margin-bottom: 0.5rem;
	}

	.saved-notes {
		font-size: 0.875rem;
		color: var(--text);
		margin: 0 0 0.5rem 0;
		line-height: 1.4;
	}

	.saved-participants {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.participant-count {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
	}

	/* Shared Button Styles */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		border-radius: var(--radius-md);
		text-decoration: none;
		cursor: pointer;
		transition: all var(--transition-fast);
		border: none;
	}

	.btn-sm {
		padding: 0.3125rem 0.75rem;
		font-size: 0.8125rem;
	}

	.btn-primary {
		background: var(--primary);
		color: white;
	}

	.btn-primary:hover {
		background: var(--primaryHover);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--surface2);
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-ghost {
		background: transparent;
		color: var(--muted);
		padding: 0.3125rem 0.5rem;
	}

	.btn-ghost:hover {
		color: var(--text);
		background: var(--surface2);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
			gap: 0.5rem;
		}

		.search-form {
			flex-direction: column;
		}

		.filters-row {
			flex-direction: column;
		}

		.filter-select {
			width: 100%;
		}

		.result-photo {
			height: 140px;
		}

		.weather-banner {
			gap: 0.25rem;
		}

		.weather-day {
			min-width: 64px;
			padding: 0.375rem;
		}
	}
</style>
