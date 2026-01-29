<script lang="ts">
	import type { PageData } from './$types';
	import StatWidget from '$lib/components/trips/StatWidget.svelte';
	import WidgetCard from '$lib/components/trips/WidgetCard.svelte';
	import TableWidget from '$lib/components/trips/TableWidget.svelte';
	import PromoWidget from '$lib/components/trips/PromoWidget.svelte';
	import TripCalendarWidget from '$lib/components/trips/TripCalendarWidget.svelte';

	let { data }: { data: PageData } = $props();

	const trip = $derived(data.trip);
	const memberCount = $derived(trip?.members?.length ?? 0);
	const roomCount = $derived(trip?.rooms?.length ?? 0);
	const totalBedSlots = $derived(
		trip?.rooms?.reduce((sum, r) => sum + (r.beds?.reduce((s, b) => s + (b.capacitySlots ?? 1), 0) ?? 0), 0) ?? 0
	);
	const activityCount = $derived(trip?.activities?.length ?? 0);
	const nextActivities = $derived(
		(trip?.activities ?? [])
			.slice()
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
			.slice(0, 5)
	);
	const unpaidCount = $derived((trip?.invoices?.filter((i) => i.status === 'due') ?? []).length);
	const paidTotal = $derived(
		(trip?.invoices?.filter((i) => i.status === 'paid') ?? []).reduce((s, i) => s + i.totalAmount, 0)
	);
	const dueTotal = $derived(
		(trip?.invoices?.filter((i) => i.status === 'due') ?? []).reduce((s, i) => s + i.totalAmount, 0)
	);
	const totalCost = $derived(trip?.totalCost ?? 0);

	/** Full Month Day – Full Month (if diff) Day, Full Year */
	function formatTripDateRange(start: Date | string, end: Date | string): string {
		const s = typeof start === 'string' ? new Date(start) : start;
		const e = typeof end === 'string' ? new Date(end) : end;
		const startMonth = s.getMonth();
		const startDay = s.getDate();
		const endMonth = e.getMonth();
		const endDay = e.getDate();
		const year = e.getFullYear();
		const startStr = s.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
		const endStr =
			endMonth !== startMonth
				? e.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
				: String(endDay);
		return `${startStr} – ${endStr}, ${year}`;
	}

	const dateRange = $derived(
		trip?.checkInDate && trip?.checkOutDate
			? formatTripDateRange(trip.checkInDate, trip.checkOutDate)
			: trip?.checkInDate
				? (() => {
						const d = typeof trip.checkInDate === 'string' ? new Date(trip.checkInDate) : trip.checkInDate;
						return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
					})()
				: '—'
	);

	/** Micro bar heights (visual only), derived from counts or placeholder */
	const guestsBars = $derived([memberCount ? Math.min(100, memberCount * 15) : 40, 60, 75, 50, 85, 70, 55]);
	const paymentsBars = $derived(
		totalCost > 0 ? [65, 80, 70, 90, 75, 85, 70] : [30, 45, 40, 50, 35, 55, 40]
	);
	const datesBars = $derived([70, 65, 80, 75, 90, 85, 78]);

	function formatShort(d: Date | string) {
		const date = typeof d === 'string' ? new Date(d) : d;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
	}

	function formatDateTime(d: Date | string) {
		const date = typeof d === 'string' ? new Date(d) : d;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<div class="dashboard-page">
	<div class="dashboard-layout">
		<!-- Upper-left: main trip photo with name and date range on top -->
		<section class="trip-hero">
			<div class="trip-hero-image-wrap">
				{#if trip?.listingCoverPhoto}
					<img src={trip.listingCoverPhoto} alt="" class="trip-hero-image" />
				{:else}
					<div class="trip-hero-placeholder"></div>
				{/if}
				<div class="trip-hero-overlay">
					<h1 class="trip-hero-name">{trip?.name ?? 'Trip'}</h1>
					<p class="trip-hero-dates">{dateRange}</p>
				</div>
			</div>
		</section>

		<!-- Upper-right: stat cards + calendar -->
		<aside class="dashboard-right">
			<div class="stats-row">
				<StatWidget
					title="Guests"
					value={memberCount}
					subtext={memberCount + ' invited'}
					barHeights={guestsBars}
				/>
				<StatWidget
					title="Payments"
					value={totalCost > 0 ? `$${paidTotal.toFixed(0)} / $${totalCost.toFixed(0)}` : '—'}
					subtext={unpaidCount > 0 ? `${unpaidCount} unpaid` : 'All set'}
					barHeights={paymentsBars}
				/>
			</div>
			<div class="calendar-wrap">
				<TripCalendarWidget
					tripId={trip?.id}
					placement="sidebar"
					checkInDate={trip?.checkInDate ?? ''}
					checkOutDate={trip?.checkOutDate ?? ''}
					activities={trip?.activities ?? []}
					mealSlots={trip?.mealSlots ?? []}
				/>
			</div>
			<div class="promo-wrap">
				<PromoWidget
					title="Invite friends"
					subtitle="Share your trip and get everyone on the same page."
					ctaLabel="Invite now"
					ctaHref="/trips/{trip?.id}/guests"
				/>
			</div>
		</aside>

		<!-- Bottom-left: upcoming list (Upcoming Appointments style) -->
		<section class="section-bottom-left">
			<TableWidget title="Upcoming activities" headers={['Activity', 'Date', 'Status']} span={1}>
				{#if nextActivities.length > 0}
					{#each nextActivities as activity}
						<div class="table-row">
							<span class="cell">{activity.title}</span>
							<span class="cell">{formatShort(activity.date)}</span>
							<span class="cell status-pill">Upcoming</span>
						</div>
					{/each}
				{:else}
					<div class="table-row muted">
						<span class="cell">No activities yet</span>
						<span class="cell">—</span>
						<span class="cell">—</span>
					</div>
				{/if}
			</TableWidget>
		</section>

		<!-- Bottom-right is the promo card, already in dashboard-right -->
	</div>
</div>

<style>
	.dashboard-page {
		padding: 1.5rem;
		min-height: 100%;
		display: flex;
		flex-direction: column;
	}

	.dashboard-layout {
		display: grid;
		grid-template-columns: 1fr 320px;
		grid-template-rows: auto auto;
		grid-template-areas:
			'hero right'
			'bottom-left right';
		column-gap: 1.25rem;
		row-gap: 0;
		flex: 1;
		min-height: 0;
		align-items: start;
	}

	.trip-hero {
		grid-area: hero;
		min-height: 450px;
		max-height: 600px;
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		margin-bottom: 0;
	}

	.trip-hero-image-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 450px;
		max-height: 600px;
		background: #e2e8f0;
	}

	.trip-hero-image {
		width: 100%;
		height: 100%;
		min-height: 450px;
		max-height: 600px;
		object-fit: cover;
		display: block;
	}

	.trip-hero-placeholder {
		width: 100%;
		height: 100%;
		min-height: 450px;
		max-height: 600px;
		background: linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%);
	}

	.trip-hero-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.75rem 1rem;
		background: linear-gradient(to top, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.4) 60%, transparent 100%);
		color: white;
	}

	.trip-hero-name {
		margin: 0 0 0.125rem 0;
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1.2;
		color: white;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
	}

	.trip-hero-dates {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 500;
		color: white;
		opacity: 0.95;
	}

	.dashboard-right {
		grid-area: right;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.stats-row :global(article) {
		min-width: 0;
	}

	.calendar-wrap {
		flex-shrink: 0;
	}

	.promo-wrap {
		flex-shrink: 0;
	}

	.section-bottom-left {
		grid-area: bottom-left;
		min-width: 0;
		width: 100%;
		margin-top: 0;
		padding-top: 0;
	}

	.section-bottom-left :global(article) {
		margin-top: 0;
	}

	@media (max-width: 1024px) {
		.dashboard-layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto auto;
			grid-template-areas:
				'hero'
				'right'
				'bottom-left';
		}

		.stats-row {
			grid-template-columns: 1fr;
		}
	}

	.widget-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
	}

	.dashboard-topbar {
		min-height: 44px;
	}

	@media (max-width: 1024px) {
		.widget-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 640px) {
		.widget-grid {
			grid-template-columns: 1fr;
		}
	}

	.list-widget {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.list-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.list-row:last-child {
		border-bottom: none;
	}

	.list-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		flex-shrink: 0;
	}

	.list-content {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.list-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: #0f172a;
	}

	.list-meta {
		font-size: 0.75rem;
		color: #64748b;
	}

	.table-row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		font-size: 0.8125rem;
	}

	.table-row:last-child {
		border-bottom: none;
	}

	.table-row.muted .cell {
		color: #94a3b8;
	}

	.cell {
		color: #334155;
	}

	.status-pill {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.2rem 0.4rem;
		border-radius: 9999px;
		background: #e0f2fe;
		color: #0369a1;
	}
</style>
