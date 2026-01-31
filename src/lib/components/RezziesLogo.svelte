<script lang="ts">
	import whiteLogo from '$lib/assets/images/white logo.png';

	interface Props {
		/** Link href. Default "/" */
		href?: string;
		/** Optional class for the wrapper <a> (e.g. for sidebar vs nav styling) */
		class?: string;
		/** When true, show only the logo image (e.g. for collapsed sidebars) */
		compact?: boolean;
	}

	let { href = '/', class: className = '', compact = false }: Props = $props();

	const classList = $derived(`divvi-logo ${className ?? ''}`.trim());
</script>

<a {href} class={classList} class:compact aria-label="divvi">
	<img src={whiteLogo} alt="" class="divvi-logo-img" />
</a>

<style>
	.divvi-logo {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		color: inherit;
	}

	.divvi-logo-img {
		display: block;
		height: 2.75rem;
		width: auto;
		max-width: 8rem;
		object-fit: contain;
		flex-shrink: 0;
	}

	.divvi-logo.compact .divvi-logo-img {
		height: 2.25rem;
	}
</style>
