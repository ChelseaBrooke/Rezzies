<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Block list – Divvi</title>
</svelte:head>

<div class="blocked-page">
	<div class="container">
		<h1>Block list</h1>
		{#if data.blocked.length === 0}
			<p class="muted">You haven’t blocked anyone. Blocked users won’t be able to invite you or see your profile.</p>
		{:else}
			<ul class="blocked-list">
				{#each data.blocked as item}
					<li>{item}</li>
				{/each}
			</ul>
		{/if}
		<a href="/profile" class="btn btn-ghost">Back to profile</a>
	</div>
</div>

<style>
	.blocked-page {
		padding: var(--spacing-xl) var(--spacing-md);
	}
	.blocked-page h1 {
		margin-bottom: var(--spacing-md);
	}
	.muted {
		color: var(--muted);
		margin-bottom: var(--spacing-md);
	}
	.blocked-list {
		list-style: none;
		padding: 0;
		margin-bottom: var(--spacing-md);
	}
</style>
