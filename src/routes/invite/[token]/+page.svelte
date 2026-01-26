<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="invite-page">
	<div class="container">
		{#if data.user && data.isMember}
			<div class="invite-card">
				<h1>You're already a member!</h1>
				<p>You're already part of this trip.</p>
				<a href="/trips/{data.trip.id}" class="btn btn-primary">Go to Trip</a>
			</div>
		{:else if data.user}
			<div class="invite-card">
				{#if data.trip.listingCoverPhoto}
					<img src={data.trip.listingCoverPhoto} alt={data.trip.name} class="trip-image" />
				{:else}
					<div class="trip-image-placeholder">🏖️</div>
				{/if}
				<div class="invite-content">
					<h1>You're Invited!</h1>
					<h2>{data.trip.name}</h2>
					{#if data.trip.description}
						<p class="trip-description">{data.trip.description}</p>
					{/if}
					<div class="trip-details">
						<p>📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}</p>
						{#if data.trip.location}
							<p>📍 {data.trip.location}</p>
						{/if}
					</div>
					<form method="POST" action="?/accept" use:enhance>
						<button type="submit" class="btn btn-primary btn-large">Accept Invite</button>
					</form>
				</div>
			</div>
		{:else}
			<div class="invite-card">
				{#if data.trip.listingCoverPhoto}
					<img src={data.trip.listingCoverPhoto} alt={data.trip.name} class="trip-image" />
				{:else}
					<div class="trip-image-placeholder">🏖️</div>
				{/if}
				<div class="invite-content">
					<h1>You're Invited!</h1>
					<h2>{data.trip.name}</h2>
					{#if data.trip.description}
						<p class="trip-description">{data.trip.description}</p>
					{/if}
					<div class="trip-details">
						<p>📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}</p>
						{#if data.trip.location}
							<p>📍 {data.trip.location}</p>
						{/if}
					</div>
					<div class="auth-actions">
						<a href="/login?redirect=/invite/{data.invite.token}" class="btn btn-primary btn-large">Log In to Accept</a>
						<a href="/signup?redirect=/invite/{data.invite.token}" class="btn btn-secondary btn-large">Sign Up to Accept</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.invite-page {
		min-height: calc(100vh - 80px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		width: 100%;
		max-width: 600px;
	}

	.invite-card {
		background: white;
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.trip-image {
		width: 100%;
		height: 300px;
		object-fit: cover;
	}

	.trip-image-placeholder {
		width: 100%;
		height: 300px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 6rem;
	}

	.invite-content {
		padding: var(--spacing-xl);
		text-align: center;
	}

	.invite-content h1 {
		margin: 0 0 var(--spacing-sm) 0;
		font-size: 2rem;
	}

	.invite-content h2 {
		margin: 0 0 var(--spacing-md) 0;
		font-size: 1.5rem;
		color: var(--color-primary);
	}

	.trip-description {
		color: var(--color-text-light);
		margin-bottom: var(--spacing-md);
	}

	.trip-details {
		margin: var(--spacing-lg) 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.auth-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		margin-top: var(--spacing-xl);
	}

	.btn-large {
		padding: var(--spacing-md) var(--spacing-lg);
		font-size: 1.1rem;
	}
</style>
