<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Sort dates
	const sortedDates = Object.keys(data.eventsByDate).sort();
</script>

<div class="itinerary-page">
	<div class="container">
		<div class="page-header">
			<h1>Itinerary: {data.trip.name}</h1>
			<a href="/trips/{data.trip.id}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="trip-dates">
			<p>
				📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}
			</p>
		</div>

		{#if sortedDates.length === 0}
			<div class="empty-state">
				<p>No events scheduled yet.</p>
			</div>
		{:else}
			<div class="itinerary-timeline">
				{#each sortedDates as date}
					<div class="day-section">
						<h2 class="day-header">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
						<div class="events-list">
							{#each data.eventsByDate[date] as event}
								<div class="event-card event-{event.type}">
									{#if event.type === 'arrival'}
										<div class="event-icon">✈️</div>
										<div class="event-content">
											<h3>{event.user.name || 'Guest'} Arrives</h3>
											{#if event.time}
												<p class="event-time">{new Date(event.time).toLocaleTimeString()}</p>
											{/if}
										</div>
									{:else if event.type === 'departure'}
										<div class="event-icon">🚪</div>
										<div class="event-content">
											<h3>{event.user.name || 'Guest'} Departs</h3>
											{#if event.time}
												<p class="event-time">{new Date(event.time).toLocaleTimeString()}</p>
											{/if}
										</div>
									{:else if event.type === 'meal'}
										<div class="event-icon">🍽️</div>
										<div class="event-content">
											<h3>{event.mealType.charAt(0).toUpperCase() + event.mealType.slice(1)}</h3>
											{#if event.time}
												<p class="event-time">{event.time}</p>
											{/if}
											{#if event.assignedUser}
												<p class="event-assigned">Assigned to: {event.assignedUser.name}</p>
											{/if}
											{#if event.menuText}
												<p class="event-menu">{event.menuText}</p>
											{/if}
											{#if event.notes}
												<p class="event-notes">{event.notes}</p>
											{/if}
										</div>
									{:else if event.type === 'activity'}
										<div class="event-icon">🎯</div>
										<div class="event-content">
											<h3>{event.title}</h3>
											{#if event.time}
												<p class="event-time">{event.time}</p>
											{/if}
											{#if event.location}
												<p class="event-location">📍 {event.location}</p>
											{/if}
											{#if event.pricePerPerson > 0}
												<p class="event-price">${event.pricePerPerson} per person</p>
											{/if}
											{#if event.participants.length > 0}
												<p class="event-participants">
													Participants: {event.participants.map(p => p.name).join(', ')}
												</p>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.itinerary-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 1000px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.trip-dates {
		background: white;
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-xl);
		text-align: center;
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-xl);
		background: white;
		border-radius: var(--radius-md);
	}

	.itinerary-timeline {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}

	.day-section {
		background: white;
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.day-header {
		margin: 0 0 var(--spacing-lg) 0;
		padding-bottom: var(--spacing-md);
		border-bottom: 2px solid var(--color-border);
		font-size: 1.5rem;
	}

	.events-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.event-card {
		display: flex;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--color-bg-light);
		border-radius: var(--radius-sm);
		border-left: 4px solid var(--color-primary);
	}

	.event-icon {
		font-size: 2rem;
		flex-shrink: 0;
	}

	.event-content {
		flex: 1;
	}

	.event-content h3 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.1rem;
	}

	.event-time,
	.event-location,
	.event-price,
	.event-assigned,
	.event-participants,
	.event-menu,
	.event-notes {
		margin: var(--spacing-xs) 0;
		color: var(--color-text-light);
		font-size: 0.9rem;
	}

	.event-menu {
		font-style: italic;
	}

	.event-arrival {
		border-left-color: #10b981;
	}

	.event-departure {
		border-left-color: #ef4444;
	}

	.event-meal {
		border-left-color: #f59e0b;
	}

	.event-activity {
		border-left-color: #3b82f6;
	}
</style>
