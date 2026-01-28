<script lang="ts">
	import Sidebar from '$lib/components/wizard/Sidebar.svelte';
	import { page } from '$app/stores';
	
	let { children, data } = $props();
</script>

<div class="trip-layout">
	<!-- Sidebar -->
	<Sidebar user={data?.user} />
	
	<!-- Main Content -->
	<main class="main-content">
		{@render children()}
	</main>
</div>

<style>
	.trip-layout {
		min-height: 100vh;
		display: flex;
		background: var(--bg);
		position: relative;
	}
	
	.main-content {
		flex: 1;
		margin-left: var(--sidebar-width, 280px);
		display: flex;
		flex-direction: column;
		position: relative;
		z-index: 1;
		min-height: 100vh;
		transition: margin-left 0.3s ease;
	}
	
	@media (max-width: 1024px) {
		.main-content {
			margin-left: 0;
		}
	}
</style>
