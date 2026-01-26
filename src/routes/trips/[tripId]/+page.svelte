<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();
</script>

<div class="trip-page">
	<div class="container">
		<div class="trip-header">
			<div class="trip-hero">
				{#if data.trip.listingCoverPhoto}
					<img src={data.trip.listingCoverPhoto} alt={data.trip.name} class="hero-image" />
				{:else}
					<div class="hero-placeholder">🏖️</div>
				{/if}
			</div>
			<div class="trip-info">
				<h1>{data.trip.name}</h1>
				{#if data.trip.description}
					<p class="trip-description">{data.trip.description}</p>
				{/if}
				<div class="trip-meta">
					<p class="trip-dates">
						📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}
					</p>
					{#if data.trip.location}
						<p class="trip-location">📍 {data.trip.location}</p>
					{/if}
				</div>
			</div>
		</div>

		{#if data.isHost}
			<div class="host-actions">
				<a href="/trips/{data.trip.id}/manage" class="btn btn-primary">Manage Trip</a>
				<a href="/trips/{data.trip.id}/itinerary" class="btn btn-secondary">View Itinerary</a>
			</div>
		{:else}
			<div class="guest-actions">
				<a href="/trips/{data.trip.id}/rsvp" class="btn btn-primary">RSVP & Details</a>
				<a href="/trips/{data.trip.id}/itinerary" class="btn btn-secondary">View Itinerary</a>
				<a href="/trips/{data.trip.id}/invoice" class="btn btn-secondary">View Invoice</a>
			</div>
		{/if}

		<div class="trip-sections">
			<section class="trip-section">
				<h2>Members</h2>
				<div class="members-list">
					{#each data.trip.members as member}
						<div class="member-card">
							<div class="member-avatar">
								{member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
							</div>
							<div class="member-info">
								<p class="member-name">{member.user.name || member.user.email}</p>
								<span class="member-role">{member.role}</span>
							</div>
						</div>
					{/each}
				</div>
			</section>

			{#if !data.isHost}
				<section class="trip-section">
					<h2>Your RSVP</h2>
					{#if data.userRsvp}
						<div class="rsvp-status">
							<p><strong>Status:</strong> {data.userRsvp.status}</p>
							{#if data.userRsvp.arrivalDatetime}
								<p><strong>Arrival:</strong> {data.userRsvp.arrivalDatetime.toLocaleString()}</p>
							{/if}
							{#if data.userRsvp.departureDatetime}
								<p><strong>Departure:</strong> {data.userRsvp.departureDatetime.toLocaleString()}</p>
							{/if}
						</div>
					{:else}
						<p>You haven't RSVP'd yet.</p>
					{/if}
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.trip-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.trip-header {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: var(--spacing-xl);
		margin-bottom: var(--spacing-xl);
	}

	.trip-hero {
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.hero-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		min-height: 300px;
	}

	.hero-placeholder {
		width: 100%;
		height: 300px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 6rem;
	}

	.trip-info h1 {
		margin: 0 0 var(--spacing-md) 0;
	}

	.trip-description {
		color: var(--color-text-light);
		margin-bottom: var(--spacing-md);
	}

	.trip-meta {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.trip-dates,
	.trip-location {
		margin: 0;
		color: var(--color-text-light);
	}

	.host-actions,
	.guest-actions {
		display: flex;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xl);
	}

	.trip-sections {
		display: grid;
		gap: var(--spacing-xl);
	}

	.trip-section {
		background: white;
		padding: var(--spacing-lg);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.trip-section h2 {
		margin: 0 0 var(--spacing-md) 0;
		font-size: 1.5rem;
	}

	.members-list {
		display: grid;
		gap: var(--spacing-md);
	}

	.member-card {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--color-bg-light);
		border-radius: var(--radius-sm);
	}

	.member-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 600;
		font-size: 1.25rem;
	}

	.member-info {
		flex: 1;
	}

	.member-name {
		margin: 0 0 var(--spacing-xs) 0;
		font-weight: 500;
	}

	.member-role {
		font-size: 0.875rem;
		color: var(--color-text-light);
		text-transform: capitalize;
	}

	.rsvp-status {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	@media (max-width: 768px) {
		.trip-header {
			grid-template-columns: 1fr;
		}
	}
</style>
