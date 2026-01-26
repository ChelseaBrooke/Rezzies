<script lang="ts">
	import { onMount } from 'svelte';
	import AdminTripNew from '../../../admin/trips/new/+page.svelte';
	
	// This page is specifically for autofill - trigger it on mount
	onMount(() => {
		// The AdminTripNew component will check for autofill mode
		// We ensure the URL has the autofill param
		if (!window.location.search.includes('autofill=true')) {
			const url = new URL(window.location.href);
			url.searchParams.set('autofill', 'true');
			window.history.replaceState({}, '', url.toString());
		}
	});
</script>

<AdminTripNew />
