<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import RezziesLogo from '$lib/components/RezziesLogo.svelte';

	let { user } = $props<{ user?: { email: string } | null }>();
</script>

<nav class="navbar">
	<div class="nav-container">
		<RezziesLogo href="/" class="nav-logo" />
		
		<div class="nav-links">
			<a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>Home</a>
			<a href="/our-services" class="nav-link" class:active={$page.url.pathname === '/our-services'}>Our Services</a>
			<a href="/find-vacation" class="nav-link" class:active={$page.url.pathname === '/find-vacation'}>Find a Vacation</a>
			<a href="/trips/new" class="nav-link" class:active={$page.url.pathname === '/trips/new'}>Host a Trip</a>
		</div>
		
		<div class="nav-auth">
			{#if user}
				<a href="/trips" class="nav-link">My Trips</a>
				<a href="/profile" class="nav-link" class:active={$page.url.pathname === '/profile'}>Profile</a>
				<form method="POST" action="/logout" style="display: inline;">
					<button type="submit" class="btn btn-secondary">Log Out</button>
				</form>
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
	
	@media (max-width: 768px) {
		.nav-links {
			display: none;
		}
		
		.nav-container {
			gap: var(--spacing-sm);
		}
	}
</style>
