<script lang="ts">
	import templogo1 from '$lib/assets/images/templogo1.png';

	interface Props {
		/** Link href. Default "/" */
		href?: string;
		/** Optional class for the wrapper <a> (e.g. for sidebar vs nav styling) */
		class?: string;
		/** When true, show only the logo image (e.g. for collapsed sidebars) */
		compact?: boolean;
	}

	let { href = '/', class: className = '', compact = false }: Props = $props();

	const classList = $derived(`rezzies-logo ${className ?? ''}`.trim());
</script>

<a {href} class={classList} class:compact>
	<span class="rezzies-logo-text">rezzies</span>
	<img src={templogo1} alt="rezzies" class="rezzies-logo-img" />
</a>

<style>
	.rezzies-logo {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		text-decoration: none;
		color: inherit;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.rezzies-logo-text {
		text-transform: lowercase;
		letter-spacing: -0.5px;
		white-space: nowrap;
	}

	.rezzies-logo-img {
		display: block;
		height: 2rem;
		width: auto;
		max-width: 4rem;
		object-fit: contain;
		flex-shrink: 0;
	}

	.rezzies-logo.compact .rezzies-logo-text {
		display: none;
	}

	.rezzies-logo.compact .rezzies-logo-img {
		height: 1.75rem;
	}
</style>
