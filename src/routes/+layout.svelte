<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import { page } from '$app/stores';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Divvi - Fair Room & Cost Splitting for Group Vacations</title>
</svelte:head>

{#if $page.url.pathname !== '/' && $page.url.pathname !== '/login' && $page.url.pathname !== '/signup' && !$page.url.pathname.startsWith('/trips/new/step') && !$page.url.pathname.match(/^\/trips\/[^\/]+/)}
	<Navigation user={data?.user} />
{/if}

<main
	class:no-padding={$page.url.pathname.startsWith('/trips/new/step')}
	class:trip-portal-root={$page.url.pathname.match(/^\/trips\/[^\/]+/)}
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
