<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import ProfileCard from '$lib/components/profile/ProfileCard.svelte';
	import EditProfileModal from '$lib/components/profile/EditProfileModal.svelte';
	import { page } from '$app/stores';

	let { children, data } = $props();

	/**
	 * Derive nav visibility from URL patterns instead of a manually maintained allowlist.
	 *   - Trip portal (/trips/[id]/...) has its own sidebar nav, no top navbar.
	 *   - Trip creation wizard (/trips/new/step/...) is full-screen, no top navbar.
	 *   - Auth/marketing pages (/, /login, /signup, etc.) have their own nav via MarketingShell.
	 *   - Everything else (404, /settings, /messages, /qc, ...) should show the top navbar.
	 *
	 * The key insight: we should SHOW the nav by default and HIDE it on specific pattern matches,
	 * rather than maintaining a manually-grown allowlist.
	 */
	const isTripPortal = $derived(/^\/trips\/[^/]+/.test($page.url.pathname));
	const isWizardStep = $derived($page.url.pathname.startsWith('/trips/new/step'));
	const isMarketingOrAuth = $derived(
		/^\/(login|signup|our-services|find-vacation|sitemap)?$/.test($page.url.pathname) ||
		$page.url.pathname === '/trips'
	);
	const showNav = $derived(!isTripPortal && !isWizardStep && !isMarketingOrAuth);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Divvi - Fair Room & Cost Splitting for Group Vacations</title>
</svelte:head>

{#if showNav}
	<Navigation user={data?.user} />
{/if}

<ProfileCard />
<EditProfileModal />

<main
	class:no-padding={isWizardStep}
	class:trip-portal-root={isTripPortal}
>
	{#if children != null && typeof children === 'function'}
		{@render children()}
	{/if}
</main>

<style>
	main {
		min-height: calc(100vh - 80px);
	}
	
	main.no-padding {
		min-height: 100vh;
		padding: 0;
		margin: 0;
	}

	main.trip-portal-root {
		min-height: 100vh;
		padding: 0;
		margin: 0;
	}
	
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
