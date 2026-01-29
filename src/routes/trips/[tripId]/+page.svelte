<script lang="ts">
	import type { PageData } from './$types';
	import StatWidget from '$lib/components/trips/StatWidget.svelte';
	import WidgetCard from '$lib/components/trips/WidgetCard.svelte';
	import TableWidget from '$lib/components/trips/TableWidget.svelte';
	import PromoWidget from '$lib/components/trips/PromoWidget.svelte';

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

	const dateRange = $derived(
		trip?.checkInDate && trip?.checkOutDate
			? `${formatShort(trip.checkInDate)} – ${formatShort(trip.checkOutDate)}`
			: trip?.checkInDate
				? formatShort(trip.checkInDate)
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
	<!-- Top bar: search (left), dates + Edit (right) -->
	<header class="dashboard-topbar">
		<div class="search-pill">
			<span class="search-placeholder">Search in this trip…</span>
		</div>
		<div class="topbar-right">
			<span class="dates-pill">{dateRange}</span>
			<a href="/trips/{trip?.id}/settings" class="edit-btn">Edit</a>
		</div>
	</header>

	<!-- Widget grid (12-column feel, gap-5) -->
	<div class="widget-grid">
		<!-- Row 1: 3 stat widgets -->
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
		<StatWidget
			title="Trip dates"
			value={dateRange}
			subtext={trip?.location ?? '—'}
			barHeights={datesBars}
		/>

		<!-- Row 2: Quick Chat style (list) + Upcoming activities / Guest RSVP table -->
		<WidgetCard title="Quick chat" span={2}>
			<div class="list-widget">
				{#if trip?.members?.length > 0}
					{#each trip.members.slice(0, 3) as member}
						<div class="list-row">
							<div class="list-avatar">
								{member.user?.name?.[0]?.toUpperCase() ?? member.user?.email?.[0]?.toUpperCase() ?? '?'}
							</div>
							<div class="list-content">
								<span class="list-name">{member.user?.name ?? member.user?.email ?? '—'}</span>
								<span class="list-meta">Trip member</span>
							</div>
						</div>
					{/each}
				{:else}
					<div class="list-row">
						<div class="list-avatar">—</div>
						<div class="list-content">
							<span class="list-name">No messages yet</span>
							<span class="list-meta">Invite guests to get started</span>
						</div>
					</div>
				{/if}
			</div>
		</WidgetCard>

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

		<!-- Row 3: Itinerary/Payments table (wide) + Invite friends promo -->
		<TableWidget title="Itinerary" headers={['Activity', 'Date & time', 'Status']} span={2}>
			{#if nextActivities.length > 0}
				{#each nextActivities as activity}
					<div class="table-row">
						<span class="cell">{activity.title}</span>
						<span class="cell">{formatDateTime(activity.date)}</span>
						<span class="cell status-pill">Upcoming</span>
					</div>
				{/each}
			{:else}
				<div class="table-row muted">
					<span class="cell">No activities added yet</span>
					<span class="cell">—</span>
					<span class="cell">—</span>
				</div>
			{/if}
		</TableWidget>

		<PromoWidget
			title="Invite friends"
			subtitle="Share your trip and get everyone on the same page."
			ctaLabel="Invite now"
			ctaHref="/trips/{trip?.id}/guests"
		/>
	</div>
</div>

<style>
	.dashboard-page {
		padding: 1.5rem;
		min-height: 100%;
	}

	.dashboard-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.search-pill {
		height: 44px;
		min-width: 200px;
		flex: 1;
		max-width: 320px;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		border: 1px solid rgba(0, 0, 0, 0.05);
		display: flex;
		align-items: center;
		padding: 0 1rem;
	}

	.search-placeholder {
		font-size: 0.875rem;
		color: #94a3b8;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.dates-pill {
		height: 44px;
		display: flex;
		align-items: center;
		padding: 0 1rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
	}

	.edit-btn {
		height: 44px;
		display: flex;
		align-items: center;
		padding: 0 1rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
		text-decoration: none;
	}

	.edit-btn:hover {
		background: #f8fafc;
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
