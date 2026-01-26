<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import { page } from '$app/stores';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>RoomSplit - Fair Room & Cost Splitting for Group Vacations</title>
</svelte:head>

<Navigation user={data?.user} />

<main>
	{@render children()}
</main>

<style>
	main {
		min-height: calc(100vh - 80px);
	}
</style>
