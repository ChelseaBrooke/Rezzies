<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

	let selectedId = $state<string | null>(data.suggestedMemberId ?? null);
	let showNotMe = $state(false);

	const formatRange = (a: Date | string, b: Date | string) => {
		const s = new Date(a);
		const e = new Date(b);
		return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	};

	const displayName = (m: { firstName: string; lastName: string | null }) =>
		[m.firstName, m.lastName].filter(Boolean).join(' ');

	const selectedMember = $derived(data.unclaimed.find((u) => u.id === selectedId) ?? null);
</script>

<svelte:head>
	<title>Join {data.trip.name} · Divvi</title>
</svelte:head>

<div
	class="hc-outer"
	style={data.trip.listingCoverPhoto ? `background-image: url('${data.trip.listingCoverPhoto}')` : ''}
>
	<div class="hc-frost"></div>
	<div class="hc-inner">
		{#if data.allClaimed}
			<div class="hc-card">
				<h1 class="hc-h1">You're all set</h1>
				<p class="hc-body">
					Everyone in {data.primaryFirstName}'s household has already joined the trip.
				</p>
				{#if data.isAuthenticated && data.isTripMember}
					<a class="hc-btn" href="/trips/{data.tripId}">Go to the trip →</a>
				{:else if data.isAuthenticated}
					<a class="hc-btn" href="/">Go to Divvi →</a>
				{:else}
					<a class="hc-btn" href={data.loginRedirect}>Sign in to Divvi →</a>
				{/if}
			</div>
		{:else if data.isTripMember}
			<div class="hc-card">
				<h1 class="hc-h1a">You're already on this trip</h1>
				<p class="hc-meta">{data.trip.name} · {formatRange(data.trip.checkInDate, data.trip.checkOutDate)}</p>
				<a class="hc-btn" href="/trips/{data.tripId}">Go to your dashboard →</a>
			</div>
		{:else if !data.isAuthenticated}
			{#if showNotMe}
				<div class="hc-card">
					<p class="hc-body">
						This link was meant for someone in {data.primaryFirstName}'s household. If you're a different guest,
						ask {data.hostName} for access.
					</p>
					<a class="hc-link" href="/">Go to Divvi →</a>
				</div>
			{:else}
				<div class="hc-label">You've been invited by {data.primaryFirstName}</div>
				<h1 class="hc-title">{data.trip.name}</h1>
				<div class="hc-card">
					<h2 class="hc-h2">Which one are you?</h2>
					<p class="hc-sub">{data.primaryFirstName} added you to this trip. Select your name to get started.</p>
					<div class="hc-list" role="list">
						{#each data.unclaimed as m (m.id)}
							<button
								type="button"
								role="listitem"
								class="hc-pick"
								class:hc-pick--on={selectedId === m.id}
								onclick={() => (selectedId = m.id)}
							>
								{#if selectedId === m.id}
									<span class="hc-check" aria-hidden="true">✓</span>
								{/if}
								{displayName(m)}
							</button>
						{/each}
					</div>
					<button type="button" class="hc-notme" onclick={() => (showNotMe = true)}>That's not me</button>
					{#if selectedId && selectedMember}
						<form method="POST" action="?/setClaimCookie" use:enhance>
							<input type="hidden" name="householdMemberId" value={selectedId} />
							<button type="submit" class="hc-btn hc-btn--block">
								Continue as {displayName(selectedMember)} →
							</button>
						</form>
					{/if}
					<p class="hc-hint"><a class="hc-a" href={data.loginRedirect}>Already have an account? Sign in</a></p>
				</div>
			{/if}
		{:else if showNotMe}
			<div class="hc-card">
				<p class="hc-body">
					This link was meant for someone in {data.primaryFirstName}'s household. If you're a different guest,
					ask {data.hostName} for access.
				</p>
				<a class="hc-link" href="/">Go to Divvi →</a>
			</div>
		{:else}
			<div class="hc-label">Welcome back, {data.currentUser?.name?.split(/\s+/)[0] ?? 'there'}</div>
			<h1 class="hc-title">{data.trip.name}</h1>
			<div class="hc-card">
				<p class="hc-sub">
					{data.primaryFirstName} added you to this trip. Confirm it's you and you're in.
				</p>
				<div class="hc-list" role="list">
					{#each data.unclaimed as m (m.id)}
						<button
							type="button"
							role="listitem"
							class="hc-pick"
							class:hc-pick--on={selectedId === m.id}
							onclick={() => (selectedId = m.id)}
						>
							{#if selectedId === m.id}
								<span class="hc-check" aria-hidden="true">✓</span>
							{/if}
							{displayName(m)}
						</button>
					{/each}
				</div>
				<button type="button" class="hc-notme" onclick={() => (showNotMe = true)}>That's not me</button>
				{#if selectedId}
					<form method="POST" action="?/confirmAsUser" use:enhance>
						<input type="hidden" name="householdMemberId" value={selectedId} />
						<button type="submit" class="hc-btn hc-btn--block">Confirm and join →</button>
					</form>
				{/if}
			</div>
		{/if}
		{#if form?.error}
			<p class="hc-err" role="alert">{form.error}</p>
		{/if}
	</div>
</div>

<style>
	.hc-outer {
		min-height: 100vh;
		background: #0f172a;
		background-size: cover;
		background-position: center;
		position: relative;
	}
	.hc-frost {
		position: absolute;
		inset: 0;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(8px);
	}
	.hc-inner {
		position: relative;
		z-index: 1;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem 3rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
	}
	.hc-label {
		color: rgba(255, 255, 255, 0.85);
		font-size: 0.8rem;
		margin-bottom: 0.5rem;
	}
	.hc-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.65rem;
		font-weight: 700;
		color: #fff;
		margin: 0 0 1.25rem;
		text-align: center;
		max-width: 22rem;
	}
	.hc-card {
		background: rgba(255, 255, 255, 0.95);
		border-radius: 16px;
		padding: 1.5rem 1.35rem;
		max-width: 26rem;
		width: 100%;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
	}
	.hc-h1 {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		margin: 0 0 0.5rem;
	}
	.hc-h1a {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.35rem;
		margin: 0 0 0.4rem;
	}
	.hc-h2 {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.2rem;
		margin: 0 0 0.35rem;
	}
	.hc-body,
	.hc-sub,
	.hc-meta {
		color: #64748b;
		font-size: 0.95rem;
		line-height: 1.45;
		margin: 0 0 0.75rem;
	}
	.hc-pad {
		margin-top: 0.5rem;
	}
	.hc-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0.75rem 0 0.5rem;
	}
	.hc-pick {
		position: relative;
		padding: 0.85rem 1rem;
		border-radius: 10px;
		border: 2px solid #e2e8f0;
		background: #fff;
		font-size: 1rem;
		font-weight: 600;
		text-align: center;
		cursor: pointer;
		font-family: inherit;
	}
	.hc-pick--on {
		border-color: #2f7778;
		background: rgba(47, 119, 120, 0.1);
	}
	.hc-check {
		position: absolute;
		top: 0.35rem;
		right: 0.45rem;
		color: #2f7778;
		font-weight: 800;
	}
	.hc-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.6rem 1.1rem;
		border-radius: 10px;
		background: #2f7778;
		color: #fff;
		font-weight: 600;
		text-decoration: none;
		border: none;
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		margin-top: 0.5rem;
	}
	.hc-btn--block {
		width: 100%;
	}
	.hc-notme {
		margin: 0.75rem 0 0;
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 0.8125rem;
		cursor: pointer;
		font-family: inherit;
	}
	.hc-hint {
		margin: 0.75rem 0 0;
		font-size: 0.8rem;
	}
	.hc-a {
		color: #2f7778;
	}
	.hc-err {
		color: #b91c1c;
		margin-top: 0.5rem;
	}
	.hc-link {
		color: #2f7778;
		font-weight: 600;
	}
</style>
