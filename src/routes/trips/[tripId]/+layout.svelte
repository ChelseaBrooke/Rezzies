<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/trips/dashboard/AppShell.svelte';
	import TripChat from '$lib/components/trips/TripChat.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// Only treat as callable when it's actually a function (avoids "undefined is not a function" on refresh)
	const safeChildren = $derived(
		typeof children === 'function' ? (children as () => unknown) : null
	);

	function handleInvite() {
		import('$app/navigation').then(({ goto }) => goto(`/trips/${data.trip.id}/guests?invite=1`));
	}
</script>

{#if data.membership?.inviteStatus === 'invited' && data.pendingInviteToken}
	<div class="invite-banner" role="alert">
		<p>You've been invited to this trip. Accept to join and RSVP.</p>
		<a href="/invite/{data.pendingInviteToken}" class="invite-banner-btn">Accept invite</a>
	</div>
{/if}

<AppShell
		tripId={data.trip.id}
		user={data.user}
		onInvite={handleInvite}
		showGuestsTab={data.isHost || data.membership?.role === 'co-host'}
		pollsUnvotedCount={data.pollsUnvotedCount ?? 0}
	>
	{#snippet children()}
		{#if safeChildren}
			{@render safeChildren()}
		{/if}
	{/snippet}
</AppShell>

{#if data.canChat && data.user}
	<TripChat tripId={data.trip.id} userId={data.user.id} />
{/if}

<style>
	.invite-banner {
		background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
		border-left: 4px solid var(--color-primary);
		padding: var(--spacing-md) var(--spacing-lg);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}
	.invite-banner p {
		margin: 0;
		color: var(--color-text);
	}
	.invite-banner-btn {
		background: var(--color-primary);
		color: white;
		padding: var(--spacing-xs) var(--spacing-md);
		border-radius: var(--radius-sm);
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
	}
	.invite-banner-btn:hover {
		opacity: 0.95;
	}
</style>
