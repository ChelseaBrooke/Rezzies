<script lang="ts">
	import { page } from '$app/stores';
	import NotificationTray from '$lib/components/NotificationTray.svelte';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
</script>

<div class="topbar">
	<div class="topbar-content">
		<div class="topbar-actions">
			{#if $page.data?.user}
				<div class="topbar-msg-bell">
					<a href="/messages" class="topbar-icon-btn" title="Messages" aria-label="Messages">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
						</svg>
					</a>
					<span class="topbar-bell-wrap">
						<NotificationTray />
					</span>
				</div>
				<AvatarMenu user={$page.data.user} />
			{/if}
		</div>
	</div>
</div>

<style>
	.topbar {
		height: 50px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0 2rem;
		background: white;
		border-bottom: 1px solid var(--border);
	}
	
	.topbar-content {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}
	
	.topbar-actions {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}

	.topbar-msg-bell {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}

	.topbar-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		color: var(--muted);
		text-decoration: none;
		transition: all var(--transition-fast);
	}

	.topbar-icon-btn:hover {
		color: var(--text);
		background: var(--surface2);
	}

	.topbar-bell-wrap {
		display: inline-flex;
		align-items: center;
	}
</style>
