<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	const trip = $derived(data.trip);
	const memberCount = $derived(trip?.members?.length ?? 0);
	const totalBeds = $derived(
		trip?.rooms?.reduce((sum, r) => sum + (r.beds?.length ?? 0), 0) ?? 0
	);
	const activityCount = $derived(trip?.activities?.length ?? 0);
	const unpaidCount = $derived(
		trip?.invoices?.filter((i) => i.status === 'due').length ?? 0
	);

	const nextActions = $derived.by(() => {
		const actions: { label: string; href: string }[] = [];
		if (data.isHost) {
			if (memberCount === 0) actions.push({ label: 'Invite guests', href: `/trips/${trip?.id}/guests` });
			if ((trip?.rooms?.length ?? 0) === 0)
				actions.push({ label: 'Add rooms', href: `/trips/${trip?.id}/rooms` });
			if (unpaidCount > 0)
				actions.push({ label: 'Review payments', href: `/trips/${trip?.id}/payments` });
			actions.push({ label: 'Edit trip basics', href: `/trips/${trip?.id}/settings#basics` });
		} else {
			if (!data.userRsvp) actions.push({ label: 'RSVP & details', href: `/trips/${trip?.id}/rsvp` });
			actions.push({ label: 'View itinerary', href: `/trips/${trip?.id}/itinerary` });
			if ((data.userInvoices?.length ?? 0) > 0)
				actions.push({ label: 'View invoice', href: `/trips/${trip?.id}/invoice` });
		}
		return actions;
	});
</script>

<div class="overview-page">
	<div class="page-header">
		<h1>Overview</h1>
		<p class="subtitle">Summary and next steps for this trip</p>
	</div>

	<div class="summary-grid">
		<!-- Trip details card -->
		<div class="card details-card">
			<h2 class="card-title">Trip details</h2>
			<dl class="details-list">
				<dt>Dates</dt>
				<dd>
					{trip?.checkInDate
						? new Date(trip.checkInDate).toLocaleDateString(undefined, {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})
						: '—'}
					–
					{trip?.checkOutDate
						? new Date(trip.checkOutDate).toLocaleDateString(undefined, {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})
						: '—'}
				</dd>
				<dt>Location</dt>
				<dd>{trip?.location ?? '—'}</dd>
				<dt>Status</dt>
				<dd>
					<span class="status-pill" class:draft={!trip?.isPublished} class:live={trip?.isPublished}>
						{trip?.isPublished ? 'Live' : 'Draft'}
					</span>
				</dd>
			</dl>
		</div>

		<!-- Quick stats -->
		<div class="card stats-card">
			<h2 class="card-title">Quick stats</h2>
			<div class="stats-row">
				<div class="stat">
					<span class="stat-value">{memberCount}</span>
					<span class="stat-label">Guests</span>
				</div>
				<div class="stat">
					<span class="stat-value">{totalBeds}</span>
					<span class="stat-label">Beds</span>
				</div>
				<div class="stat">
					<span class="stat-value">{activityCount}</span>
					<span class="stat-label">Itinerary</span>
				</div>
				<div class="stat">
					<span class="stat-value">{unpaidCount > 0 ? unpaidCount : '—'}</span>
					<span class="stat-label">Outstanding</span>
				</div>
			</div>
		</div>

		<!-- Next actions -->
		<div class="card actions-card">
			<h2 class="card-title">Next actions</h2>
			<ul class="actions-list">
				{#each nextActions as action}
					<li>
						<a href={action.href} class="action-link">{action.label}</a>
					</li>
				{/each}
				{#if nextActions.length === 0}
					<li class="muted">You’re all set for now.</li>
				{/if}
			</ul>
		</div>
	</div>

	<!-- Members section (compact) -->
	{#if trip?.members?.length > 0}
		<div class="card">
			<h2 class="card-title">Members</h2>
			<div class="members-list">
				{#each trip.members as member}
					<div class="member-card">
						<div class="member-avatar">
							{member.user?.name?.[0]?.toUpperCase() ?? member.user?.email?.[0]?.toUpperCase() ?? '?'}
						</div>
						<span class="member-name">{member.user?.name ?? member.user?.email ?? '—'}</span>
						<span class="member-role">{member.role}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.overview-page {
		padding: 0;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
	}

	.subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.card {
		background: white;
		border-radius: var(--radius-lg, 1rem);
		border: 1px solid var(--border);
		padding: 1.25rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.card-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--text);
	}

	.details-list {
		margin: 0;
		font-size: 0.875rem;
	}

	.details-list dt {
		color: var(--muted);
		margin-top: 0.5rem;
	}

	.details-list dt:first-child {
		margin-top: 0;
	}

	.details-list dd {
		margin: 0.25rem 0 0 0;
	}

	.status-pill {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
	}

	.status-pill.draft {
		background: var(--border);
		color: var(--muted);
	}

	.status-pill.live {
		background: rgba(34, 197, 94, 0.15);
		color: #15803d;
	}

	.stats-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.actions-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.actions-list li {
		margin-bottom: 0.5rem;
	}

	.actions-list li:last-child {
		margin-bottom: 0;
	}

	.action-link {
		font-size: 0.9375rem;
		color: var(--primary);
		text-decoration: none;
	}

	.action-link:hover {
		text-decoration: underline;
	}

	.actions-list .muted {
		color: var(--muted);
		font-size: 0.875rem;
	}

	.members-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.member-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg);
		border-radius: var(--radius-md, 0.5rem);
		font-size: 0.875rem;
	}

	.member-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--primary) 0%, var(--primary-accent, #ea580c) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.member-name {
		font-weight: 500;
	}

	.member-role {
		color: var(--muted);
		font-size: 0.75rem;
		text-transform: capitalize;
	}
</style>
