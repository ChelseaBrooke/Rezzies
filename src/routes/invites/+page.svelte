<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Pending invites – Divvi</title>
</svelte:head>

<div class="invites-page">
	<div class="container">
		<h1>Pending invites</h1>
		{#if data.pending.length === 0}
			<p class="muted">You have no pending trip invites. When someone invites you, it’ll show up here.</p>
			<a href="/trips" class="btn btn-primary">View my trips</a>
		{:else}
			<ul class="invites-list">
				{#each data.pending as inv}
					<li>
						<a href="/invite/{inv.token}">{inv.trip.name}</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.invites-page {
		padding: var(--spacing-xl) var(--spacing-md);
	}
	.invites-page h1 {
		margin-bottom: var(--spacing-md);
	}
	.muted {
		color: var(--muted);
		margin-bottom: var(--spacing-md);
	}
	.invites-list {
		list-style: none;
		padding: 0;
	}
	.invites-list li {
		margin-bottom: 0.5rem;
	}
	.invites-list a {
		color: var(--primary);
	}
</style>
