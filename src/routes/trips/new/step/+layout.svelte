<script lang="ts">
	import { onNavigate } from '$app/navigation';

	let { children } = $props();

	onNavigate((navigation) => {
		if (typeof document === 'undefined' || !document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

{@render children()}

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	@keyframes fade-out {
		to {
			opacity: 0;
			transform: translateY(-8px);
		}
	}

	:global(::view-transition-old(root)) {
		animation: 180ms ease both fade-out;
	}

	:global(::view-transition-new(root)) {
		animation: 220ms ease both fade-in;
	}
</style>
