<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import DivviLogo from '$lib/components/DivviLogo.svelte';
	import NotificationTray from '$lib/components/NotificationTray.svelte';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';

	let { user } = $props<{ user?: { id?: string; name?: string | null; email?: string; avatarUrl?: string | null } | null }>();
</script>

<nav class="navbar">
	<div class="nav-container">
		<DivviLogo href="/" class="nav-logo" variant="dark" />
		
		<div class="nav-links">
			<a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>Home</a>
			<a href="/our-services" class="nav-link" class:active={$page.url.pathname === '/our-services'}>Our Services</a>
			<a href="/trips/new" class="nav-link" class:active={$page.url.pathname === '/trips/new'}>Host a Trip</a>
		</div>
		
		<div class="nav-auth">
			{#if user}
				<a href="/trips" class="nav-link">My Trips</a>
				<div class="nav-msg-bell">
					<a href="/messages" class="nav-icon-btn" title="Messages" aria-label="Messages">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
					</a>
					<span class="nav-bell-wrap">
						<NotificationTray />
					</span>
				</div>
				<AvatarMenu user={user} />
			{:else}
				<a href="/login" class="nav-link">Log In</a>
				<a href="/signup" class="btn btn-primary">Sign Up</a>
			{/if}
		</div>
	</div>
</nav>

<style>
	.navbar {
		background: white;
		box-shadow: var(--shadow-sm);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
		padding: var(--spacing-sm) 0;
	}
	
	.nav-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 var(--spacing-md);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-lg);
	}
	
	.nav-logo {
		color: var(--text);
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		flex: 1;
		justify-content: center;
	}
	
	.nav-link {
		color: var(--muted);
		font-weight: 500;
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	
	.nav-link:hover {
		color: var(--text);
		background: var(--surface2);
	}
	
	.nav-link.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
		background: transparent;
	}
	
	.nav-auth {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.nav-msg-bell {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}
	.nav-icon-btn {
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
	.nav-icon-btn:hover {
		color: var(--text);
		background: var(--surface2);
	}
	.nav-bell-wrap {
		display: inline-flex;
		align-items: center;
	}
	
	@media (max-width: 768px) {
		.nav-links {
			display: none;
		}
		
		.nav-container {
			gap: var(--spacing-sm);
		}
	}
</style>
