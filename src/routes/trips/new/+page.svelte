<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import AdminTripNew from '../../admin/trips/new/+page.svelte';
	
	// Trigger autofill if needed - this ensures it runs even when component is imported
	onMount(() => {
		console.log('[Trips/New Wrapper] onMount running');
		console.log('[Trips/New Wrapper] URL:', window.location.href);
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('autofill') === 'true') {
			console.log('[Trips/New Wrapper] Autofill mode detected');
			const url = sessionStorage.getItem('autofillUrl');
			console.log('[Trips/New Wrapper] URL from sessionStorage:', url);
		}
	});
</script>

<AdminTripNew />
