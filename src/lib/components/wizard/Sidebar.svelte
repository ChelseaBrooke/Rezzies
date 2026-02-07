<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import RezziesLogo from '$lib/components/RezziesLogo.svelte';
	
	let { user, isCollapsed = false }: { user?: { email?: string; name?: string } | null; isCollapsed?: boolean } = $props();
	
	let nightMode = $state(false);
	let collapsed = $state(isCollapsed);
	
	// Update CSS variable when collapsed state changes
	$effect(() => {
		if (browser) {
			document.documentElement.style.setProperty('--sidebar-width', collapsed ? '80px' : '280px');
		}
	});
	
	// Detect if we're viewing a trip
	const isTripPage = $derived(() => {
		const path = $page.url.pathname;
		// Match /trips/[tripId] or /trips/[tripId]/something
		const tripMatch = path.match(/^\/trips\/([^\/]+)/);
		return tripMatch !== null && tripMatch[1] !== 'new';
	});
	
	const currentTripId = $derived(() => {
		const path = $page.url.pathname;
		const tripMatch = path.match(/^\/trips\/([^\/]+)/);
		return tripMatch ? tripMatch[1] : null;
	});
	
	// General navigation (shown when not viewing a trip)
	const generalNavSections = [
		{
			title: 'Planning',
			items: [
				{ label: 'My Trips', icon: '✈️', path: '/trips' },
				{ label: 'Activities', icon: '📅', path: '/activities' },
				{ label: 'Calendar', icon: '📆', path: '/calendar' },
				{ label: 'Files', icon: '📁', path: '/files' }
			]
		},
		{
			title: 'Actions',
			items: [
				{ label: 'Create a Trip', icon: '➕', path: '/trips/new/step/1' }
			]
		}
	];
	
	// Trip-specific navigation (shown when viewing a trip) - reactive to tripId
	const tripNavSections = $derived(() => {
		const tripId = currentTripId();
		if (!tripId) return [];
		
		return [
			{
				title: 'Trip',
				items: [
					{ label: 'Overview', icon: '📊', path: `/trips/${tripId}` },
					{ label: 'Itinerary', icon: '📋', path: `/trips/${tripId}/itinerary` },
					{ label: 'Calendar', icon: '📆', path: `/trips/${tripId}/calendar` }
				]
			},
			{
				title: 'Management',
				items: [
					{ label: 'Activities', icon: '🎯', path: `/trips/${tripId}/activities` },
					{ label: 'Payments', icon: '💳', path: `/trips/${tripId}/payments` },
					{ label: 'Guest List', icon: '👥', path: `/trips/${tripId}/guests` },
					{ label: 'Files', icon: '📁', path: `/trips/${tripId}/files` }
				]
			},
			{
				title: 'Settings',
				items: [
					{ label: 'Manage Trip', icon: '⚙️', path: `/trips/${tripId}/manage` }
				]
			}
		];
	});
	
	const navSections = $derived(isTripPage() ? tripNavSections() : generalNavSections);
	
	const isActive = (path: string) => {
		const currentPath = $page.url.pathname;
		// Exact match or starts with path (for sub-routes)
		return currentPath === path || currentPath.startsWith(path + '/');
	};
	
	function toggleCollapse() {
		collapsed = !collapsed;
	}
	
	function toggleNightMode() {
		nightMode = !nightMode;
	}
</script>

<aside class="sidebar" class:collapsed>
	<div class="sidebar-content">
		<!-- Top Branding Section -->
		<div class="branding-section">
			<RezziesLogo href="/trips" class="wizard-brand" compact={collapsed} />
			{#if !collapsed}
				<p class="brand-subtitle">Group Trip Planning</p>
			{/if}
		</div>
		
		<!-- Navigation Sections -->
		<nav class="nav">
			{#each navSections as section}
				<div class="nav-section">
					{#if !collapsed}
						<h3 class="section-header">{section.title}</h3>
					{:else}
						<h3 class="section-header collapsed">{section.title}</h3>
					{/if}
					<div class="section-items">
						{#each section.items as item}
							<button
								class="nav-item"
								class:active={isActive(item.path)}
								onclick={() => goto(item.path)}
								type="button"
								title={collapsed ? item.label : ''}
							>
								<span class="nav-icon">{item.icon}</span>
								{#if !collapsed}
									<span class="nav-label">{item.label}</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</nav>
		
		<!-- Bottom Utilities and Profile -->
		<div class="bottom-section">
			<!-- Utility Options -->
			<div class="utility-options">
				<button class="utility-item" onclick={toggleNightMode} type="button" title={collapsed ? 'Night Mode' : ''}>
					<span class="utility-icon">🌙</span>
					{#if !collapsed}
						<span class="utility-label">Night Mode</span>
						<div class="toggle-switch" class:active={nightMode}>
							<div class="toggle-slider"></div>
						</div>
					{/if}
				</button>
			</div>
			
			<!-- User Profile Card -->
			{#if user}
				<div class="user-profile">
					<div class="user-avatar">
						<span>{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}</span>
					</div>
					{#if !collapsed}
						<div class="user-info">
							<div class="user-name">{user.name || 'User'}</div>
							<div class="user-email">{user.email || 'user@example.com'}</div>
						</div>
						<button class="profile-arrow" type="button" aria-label="View profile">
							<span>›</span>
						</button>
					{/if}
				</div>
			{:else}
				<div class="user-profile">
					<div class="user-avatar">
						<span>👤</span>
					</div>
					{#if !collapsed}
						<div class="user-info">
							<div class="user-name">Guest</div>
							<div class="user-email">Not signed in</div>
						</div>
						<button class="profile-arrow" onclick={() => goto('/login')} type="button" aria-label="Sign in">
							<span>›</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	
	<!-- Collapse Toggle Button -->
	<button class="collapse-toggle" onclick={toggleCollapse} type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
		<span>{collapsed ? '›' : '‹'}</span>
	</button>
</aside>

<style>
	.sidebar {
		width: 280px;
		height: 100vh;
		position: fixed;
		left: 0;
		top: 0;
		background: white;
		border-radius: 0 1.5rem 1.5rem 0;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
		z-index: 100;
		overflow-y: auto;
		overflow-x: hidden;
		transition: width 0.3s ease;
		display: flex;
		flex-direction: column;
	}
	
	.sidebar.collapsed {
		width: 80px;
	}
	
	.sidebar-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 1.5rem 1rem;
		flex: 1;
	}
	
	/* Top Branding Section */
	.branding-section {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.wizard-brand {
		color: var(--text);
	}

	.brand-subtitle {
		font-size: 0.75rem;
		color: var(--muted);
		margin: 0;
		font-weight: 400;
	}
	
	/* Navigation Sections */
	.nav {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		flex: 1;
		overflow-y: auto;
	}
	
	.nav-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.section-header {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		margin: 0 0 0.5rem 0;
		padding: 0 0.75rem;
	}
	
	.section-header.collapsed {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transform: rotate(180deg);
		font-size: 0.625rem;
		padding: 0.5rem 0;
		margin: 0;
		align-self: flex-end;
		opacity: 0.5;
	}
	
	.section-items {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border: none;
		background: transparent;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		font-size: 0.9375rem;
		color: var(--muted);
		text-align: left;
		width: 100%;
		position: relative;
	}
	
	.nav-item:hover {
		background: rgba(30, 58, 138, 0.05);
		color: var(--primary);
	}
	
	.nav-item.active {
		background: rgba(30, 58, 138, 0.1);
		color: var(--primary);
		font-weight: 500;
	}
	
	.nav-item.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 3px;
		height: 60%;
		background: var(--primary);
		border-radius: 0 2px 2px 0;
	}
	
	.nav-icon {
		font-size: 1.25rem;
		width: 1.5rem;
		text-align: center;
		flex-shrink: 0;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.nav-label {
		flex: 1;
		min-width: 0;
	}
	
	/* Bottom Section */
	.bottom-section {
		margin-top: auto;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.utility-options {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.utility-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border: none;
		background: transparent;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		font-size: 0.9375rem;
		color: var(--muted);
		text-align: left;
		width: 100%;
	}
	
	.utility-item:hover {
		background: rgba(0, 0, 0, 0.03);
		color: var(--text);
	}
	
	.utility-icon {
		font-size: 1.25rem;
		width: 1.5rem;
		text-align: center;
		flex-shrink: 0;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.utility-label {
		flex: 1;
		min-width: 0;
	}
	
	.toggle-switch {
		width: 40px;
		height: 22px;
		background: var(--border);
		border-radius: 11px;
		position: relative;
		transition: background 0.2s ease;
		flex-shrink: 0;
	}
	
	.toggle-switch.active {
		background: var(--primary);
	}
	
	.toggle-slider {
		width: 18px;
		height: 18px;
		background: white;
		border-radius: 50%;
		position: absolute;
		top: 2px;
		left: 2px;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
	
	.toggle-switch.active .toggle-slider {
		transform: translateX(18px);
	}
	
	/* User Profile Card */
	.user-profile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(30, 58, 138, 0.02);
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.user-profile:hover {
		background: rgba(30, 58, 138, 0.05);
		border-color: rgba(30, 58, 138, 0.2);
	}
	
	.user-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--primary) 0%, var(--primary-accent) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: white;
		font-weight: 600;
		font-size: 0.875rem;
	}
	
	.user-info {
		flex: 1;
		min-width: 0;
	}
	
	.user-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.125rem;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.user-email {
		font-size: 0.75rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.profile-arrow {
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 1.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color 0.2s ease;
	}
	
	.profile-arrow:hover {
		color: var(--text);
	}
	
	/* Collapse Toggle */
	.collapse-toggle {
		position: absolute;
		top: 1rem;
		right: -12px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: white;
		border: 1px solid var(--border);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		color: var(--text);
		z-index: 10;
		transition: all 0.2s ease;
	}
	
	.collapse-toggle:hover {
		background: var(--bg);
		border-color: var(--primary);
		color: var(--primary);
	}
	
	/* Collapsed State Styles */
	.sidebar.collapsed .brand-subtitle {
		display: none;
	}

	.sidebar.collapsed .nav-label,
	.sidebar.collapsed .utility-label,
	.sidebar.collapsed .toggle-switch,
	.sidebar.collapsed .user-info,
	.sidebar.collapsed .profile-arrow {
		display: none;
	}
	
	.sidebar.collapsed .branding-section {
		align-items: center;
		padding-bottom: 1rem;
		margin-bottom: 1rem;
	}
	
	.sidebar.collapsed .nav-item,
	.sidebar.collapsed .utility-item {
		justify-content: center;
		padding: 0.625rem;
	}
	
	.sidebar.collapsed .user-profile {
		justify-content: center;
		padding: 0.5rem;
	}
	
	.sidebar.collapsed .section-header:not(.collapsed) {
		display: none;
	}
	
	/* Responsive */
	@media (max-width: 1024px) {
		.sidebar {
			transform: translateX(-100%);
			transition: transform 0.3s ease;
		}
		
		.sidebar.open {
			transform: translateX(0);
		}
	}
</style>
