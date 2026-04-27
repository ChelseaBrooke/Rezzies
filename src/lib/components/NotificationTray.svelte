<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

	interface Notification {
		id: string;
		type: string;
		title: string;
		message: string;
		relatedTripId: string | null;
		relatedEntityId: string | null;
		read: boolean;
		createdAt: string;
	}

	let open = $state(false);
	let notifications = $state<Notification[]>([]);
	let unreadCount = $state(0);
	let loading = $state(false);
	let trayEl: HTMLDivElement;
	let triggerEl: HTMLButtonElement;

	function handleClickOutside(e: MouseEvent) {
		if (open && trayEl && triggerEl && !trayEl.contains(e.target as Node) && !triggerEl.contains(e.target as Node)) {
			open = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	let fetchError = $state<string | null>(null);

	async function fetchNotifications() {
		loading = true;
		fetchError = null;
		try {
			const res = await fetch('/api/notifications');
			if (!res.ok) {
				fetchError = 'Could not load notifications';
				return;
			}
			const data = await res.json();
			notifications = data.notifications ?? [];
			unreadCount = data.unreadCount ?? 0;
		} catch {
			fetchError = 'Could not load notifications';
		} finally {
			loading = false;
		}
	}

	async function markRead(notificationId: string, tripId?: string | null) {
		try {
			await fetch('/api/notifications/mark-read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notificationId, tripId })
			});
		} catch {
			// ignore
		}
	}

	function tripPath(tripId: string, sub: string) {
		return sub ? `/trips/${tripId}/${sub}` : `/trips/${tripId}`;
	}

	async function handleNotificationClick(
		notification: Notification,
		e: MouseEvent
	) {
		e.stopPropagation();

		if (notification.type === 'friend_request' && notification.relatedEntityId) {
			await markRead(notification.id);
			open = false;
			openProfileCard(notification.relatedEntityId);
			return;
		}

		if (notification.relatedTripId) {
			const tid = notification.relatedTripId;
			await markRead(notification.id, tid);
			open = false;

			// Message copy often says "approve" — take people to the screen where that action exists.
			if (notification.type === 'bed_share_request') {
				const q = notification.relatedEntityId
					? `?bedId=${encodeURIComponent(notification.relatedEntityId)}`
					: '';
				goto(`/trips/${tid}/rooms${q}`);
				return;
			}
			if (notification.type === 'household_duplicate_review') {
				goto(tripPath(tid, 'guests'));
				return;
			}
			if (notification.type === 'cost_share_guest_approved') {
				goto(tripPath(tid, 'guests'));
				return;
			}
			// cost_share_reapproval, rsvp_nudge, room_assigned, waitlist_*, invite_received, etc.
			goto(tripPath(tid, ''));
			return;
		}
	}

	function toggle() {
		open = !open;
		if (open) fetchNotifications();
	}

	onMount(() => {
		if (!browser) return;
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		// Load unread count for badge without opening tray
		fetch('/api/notifications')
			.then((r) => r.ok ? r.json() : null)
			.then((data) => {
				if (data) unreadCount = data.unreadCount ?? 0;
			});
	});

	onDestroy(() => {
		if (!browser) return;
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="tray-wrap">
	<button
		type="button"
		class="tray-trigger"
		aria-label="Notifications"
		aria-expanded={open}
		aria-haspopup="true"
		onclick={toggle}
		bind:this={triggerEl}
	>
		<svg class="bell-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
			<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
		</svg>
		{#if unreadCount > 0}
			<span class="tray-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
		{/if}
	</button>

	{#if open}
		<div class="tray-panel" bind:this={trayEl} role="dialog" aria-label="Notifications">
			<div class="tray-header">
				<h2 class="tray-title">Notifications</h2>
				{#if unreadCount > 0}
					<span class="tray-unread">{unreadCount} unread</span>
				{/if}
			</div>

			<div class="tray-list">
				{#if loading}
					<p class="tray-loading">Loading…</p>
				{:else if fetchError}
					<p class="tray-empty" style="color: #b91c1c;">{fetchError}</p>
				{:else if notifications.length === 0}
					<p class="tray-empty">No notifications yet.</p>
				{:else}
					{#each notifications as notification}
						{#if notification.relatedTripId || (notification.type === 'friend_request' && notification.relatedEntityId)}
							<button
								type="button"
								class="tray-item {notification.read ? 'read' : 'unread'}"
								onclick={(e) => handleNotificationClick(notification, e)}
							>
								<div class="tray-item-content">
									<h3>{notification.title}</h3>
									<p>{notification.message}</p>
									<time datetime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
								</div>
								<span class="tray-arrow" aria-hidden="true">→</span>
							</button>
						{:else}
							<div class="tray-item {notification.read ? 'read' : 'unread'} tray-item-static">
								<div class="tray-item-content">
									<h3>{notification.title}</h3>
									<p>{notification.message}</p>
									<time datetime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
								</div>
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.tray-wrap {
		position: relative;
		display: inline-flex;
	}

	.tray-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: relative;
		padding: 0.5rem;
		background: transparent;
		border: none;
		cursor: pointer;
		color: inherit;
		border-radius: 6px;
	}
	.tray-trigger:hover {
		background: transparent;
	}
	:global(.navbar) .tray-trigger:hover {
		background: transparent;
	}

	.bell-icon {
		display: block;
		color: inherit;
	}

	.tray-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.25rem;
		text-align: center;
		background: var(--copper, #bf4e30);
		color: white;
		border-radius: 10px;
	}

	.tray-panel {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.5rem;
		width: min(380px, calc(100vw - 2rem));
		max-height: min(70vh, 420px);
		display: flex;
		flex-direction: column;
		background: var(--surfaceSolid, #fff);
		border-radius: var(--radius-lg, 8px);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border);
		z-index: 1000;
		overflow: hidden;
	}

	.tray-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.tray-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
	}

	.tray-unread {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.tray-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.tray-loading,
	.tray-empty {
		margin: 0;
		padding: 1.5rem 1rem;
		text-align: center;
		font-size: 0.9375rem;
		color: var(--muted);
	}

	.tray-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 1rem 1rem;
		text-align: left;
		background: none;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font: inherit;
		color: inherit;
		margin-bottom: 0.25rem;
		transition: background 0.15s;
	}
	.tray-item:last-child {
		margin-bottom: 0;
	}
	.tray-item:hover {
		background: var(--surface2, #f0ede5);
	}
	.tray-item.unread {
		background: rgba(191, 78, 48, 0.06);
		border-left: 3px solid var(--copper, #bf4e30);
	}
	.tray-item.unread:hover {
		background: rgba(191, 78, 48, 0.1);
	}

	.tray-item-static {
		cursor: default;
	}

	.tray-item-content {
		flex: 1;
		min-width: 0;
	}

	.tray-item-content h3 {
		margin: 0 0 0.25rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}

	.tray-item-content p {
		margin: 0 0 0.25rem 0;
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.4;
	}

	.tray-item-content time {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.tray-arrow {
		flex-shrink: 0;
		color: var(--primary);
		font-size: 1.125rem;
	}
</style>
