<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	
	let { user } = $props<{ user?: { email: string } | null }>();
</script>

<nav class="navbar">
	<div class="nav-container">
		<a href="/" class="logo">
			<span class="logo-icon">🏖️</span>
			<span class="logo-text">Rezzies</span>
		</a>
		
		<div class="nav-links">
			<a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>Home</a>
			<a href="/our-services" class="nav-link" class:active={$page.url.pathname === '/our-services'}>Our Services</a>
			<a href="/find-vacation" class="nav-link" class:active={$page.url.pathname === '/find-vacation'}>Find a Vacation</a>
			<a href="/host-vacation" class="nav-link" class:active={$page.url.pathname === '/host-vacation'}>Host a Vacation</a>
		</div>
		
		<div class="nav-auth">
			{#if user}
				<a href="/trips" class="nav-link">My Trips</a>
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
	
	.logo {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
		text-decoration: none;
	}
	
	.logo-icon {
		font-size: 2rem;
	}
	
	.nav-links {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		flex: 1;
		justify-content: center;
	}
	
	.nav-link {
		color: var(--color-text);
		font-weight: 500;
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
		text-decoration: none;
	}
	
	.nav-link:hover,
	.nav-link.active {
		color: var(--color-primary);
		background: var(--color-bg-gray);
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
