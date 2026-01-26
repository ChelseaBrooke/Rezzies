<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="notifications-page">
	<div class="container">
		<div class="page-header">
			<h1>Notifications</h1>
			{#if data.unreadCount > 0}
				<span class="badge">{data.unreadCount} unread</span>
			{/if}
		</div>

		{#if data.notifications.length === 0}
			<div class="empty-state">
				<p>No notifications yet.</p>
			</div>
		{:else}
			<div class="notifications-list">
				{#each data.notifications as notification}
					<div class="notification-card {notification.read ? 'read' : 'unread'}">
						<div class="notification-content">
							<h3>{notification.title}</h3>
							<p>{notification.message}</p>
							<time>{new Date(notification.createdAt).toLocaleString()}</time>
						</div>
						{#if notification.relatedTripId}
							<a href="/trips/{notification.relatedTripId}" class="btn btn-sm btn-secondary">View Trip</a>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.notifications-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-xl);
	}

	.badge {
		background: var(--color-primary);
		color: white;
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-xl);
		background: white;
		border-radius: var(--radius-md);
	}

	.notifications-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.notification-card {
		background: white;
		padding: var(--spacing-lg);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
	}

	.notification-card.unread {
		border-left: 4px solid var(--color-primary);
		background: rgba(102, 126, 234, 0.05);
	}

	.notification-content {
		flex: 1;
	}

	.notification-content h3 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.1rem;
	}

	.notification-content p {
		margin: 0 0 var(--spacing-xs) 0;
		color: var(--color-text-light);
	}

	.notification-content time {
		font-size: 0.875rem;
		color: var(--color-text-light);
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-md);
		font-size: 0.875rem;
	}
</style>
