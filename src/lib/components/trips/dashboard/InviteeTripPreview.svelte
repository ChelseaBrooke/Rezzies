<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import TripHero from '$lib/components/trips/dashboard/TripHero.svelte';
	import { getContext, onMount } from 'svelte';

	const INVITE_STORAGE_KEY = 'divvi_invite_token';

	interface GoingMember {
		user?: { id: string; name: string | null; email: string | null; avatarUrl?: string | null } | null;
	}

	interface Props {
		tripId: string;
		inviteToken: string;
		inviteStatus: string;
		trip: {
			id: string;
			name: string | null;
			description?: string | null;
			listingCoverPhoto?: string | null;
			checkInDate?: Date | string | null;
			checkOutDate?: Date | string | null;
			location?: string | null;
			locationCity?: string | null;
			activitiesEnabled?: boolean;
			gamesEnabled?: boolean;
		};
		previewHostName: string;
		goingMembers: GoingMember[];
		counts: { meals: number; activities: number; games: number };
		/** Mirrors trip layout `gamesUiEnabled` (see `src/lib/config/features.ts`). */
		gamesUiEnabled?: boolean;
	}

	let {
		tripId,
		inviteToken,
		inviteStatus,
		trip,
		previewHostName,
		goingMembers,
		counts,
		gamesUiEnabled = false
	}: Props = $props();

	const quickActions = getContext<{ onInvite: () => void; showToast: (msg: string) => void }>('tripQuickActions');

	onMount(() => {
		if (inviteToken) {
			try {
				sessionStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify({ tripId, token: inviteToken }));
			} catch { /* sessionStorage unavailable */ }
		}
	});

	function formatTripDateRange(start: Date | string, end: Date | string): string {
		const s = typeof start === 'string' ? new Date(start) : start;
		const e = typeof end === 'string' ? new Date(end) : end;
		return `${s.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}, ${e.getFullYear()}`;
	}

	const dateRange = $derived(
		trip?.checkInDate && trip?.checkOutDate
			? formatTripDateRange(trip.checkInDate, trip.checkOutDate)
			: trip?.checkInDate
				? new Date(trip.checkInDate).toLocaleDateString(undefined, {
						month: 'long',
						day: 'numeric',
						year: 'numeric'
					})
				: '-'
	);

	const cityLine = $derived((trip.locationCity ?? trip.location ?? '').trim());
	const mapsQuery = $derived(cityLine || (trip.location ?? '').trim());
	const mapsUrl = $derived(
		mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null
	);

	const hostedByLine = $derived(`Hosted by ${previewHostName}`);

	const joinWithInvite = $derived(
		`/login?redirect=${encodeURIComponent(`/trips/${tripId}/join?invite=${encodeURIComponent(inviteToken)}`)}`
	);
	const signupWithInvite = $derived(
		`/signup?redirect=${encodeURIComponent(`/trips/${tripId}/join?invite=${encodeURIComponent(inviteToken)}`)}`
	);

	const mealSlotsForHero = $derived(Array.from({ length: counts.meals }, (_, i) => ({ id: `pv-meal-${i}` })));
	const activitiesForHero = $derived(Array.from({ length: counts.activities }, (_, i) => ({ id: `pv-act-${i}` })));

	const declined = $derived(inviteStatus === 'declined');
	let declineBusy = $state(false);
	let declineMsg = $state<string | null>(null);

	async function submitCantMakeIt() {
		declineMsg = null;
		declineBusy = true;
		try {
			const res = await fetch(`/api/trips/${tripId}/invite-respond`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: inviteToken, response: 'no' })
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				declineMsg = (j as { message?: string }).message ?? 'Something went wrong. Try again.';
				return;
			}
			await invalidateAll();
		} finally {
			declineBusy = false;
		}
	}

	function initials(name: string | null | undefined, email?: string | null): string {
		if (name?.trim()) {
			const parts = name.trim().split(/\s+/);
			return parts.length >= 2
				? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
				: name.slice(0, 2).toUpperCase();
		}
		if (email) return email.slice(0, 2).toUpperCase();
		return '?';
	}
</script>

<div class="inv-preview">
	<div class="inv-hero-wrap">
		<TripHero
			trip={{
				id: trip.id,
				name: trip.name,
				location: trip.location ?? null,
				locationCity: trip.locationCity ?? null,
				fullAddress: null,
				listingCoverPhoto: trip.listingCoverPhoto ?? null,
				description: trip.description ?? null
			}}
			{dateRange}
			calendarAddUrl={null}
			{mapsUrl}
			quickActions={{
				onInvite: quickActions?.onInvite ?? (() => {}),
				showToast: quickActions?.showToast ?? (() => {})
			}}
			tripInfoContent="You’re viewing an invitation preview. Join the trip to unlock the full dashboard, itinerary, rooms, and more."
			isHost={false}
			rsvpUrl={null}
			checkInDate={trip.checkInDate ? String(trip.checkInDate) : ''}
			checkOutDate={trip.checkOutDate ? String(trip.checkOutDate) : ''}
			activities={activitiesForHero}
			mealSlots={mealSlotsForHero}
			selectedMode="planning"
			itineraryHref=""
			gamesHref=""
			gamesCount={gamesUiEnabled ? counts.games : 0}
			{hostedByLine}
			hideQuickActions={true}
		/>
	</div>

	<section class="inv-panel" aria-labelledby="inv-preview-h">
		<h2 id="inv-preview-h" class="inv-panel-title">Invitation preview</h2>
		<p class="inv-panel-lead">
			You’ve been invited to this trip. RSVP after you sign in, more details unlock once you’re going.
		</p>

		<div class="inv-going">
			<h3 class="inv-going-h">Who’s going</h3>
			{#if goingMembers.length === 0}
				<p class="inv-going-empty">No one has RSVP’d yet. Be the first.</p>
			{:else}
				<ul class="inv-going-list">
					{#each goingMembers as m}
						{#if m.user}
							<li class="inv-going-row">
								<span class="inv-av">
									{#if m.user.avatarUrl}
										<img src={m.user.avatarUrl} alt="" />
									{:else}
										{initials(m.user.name, m.user.email)}
									{/if}
								</span>
								<span class="inv-name">{m.user.name?.trim() || m.user.email || 'Guest'}</span>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>

		<div class="inv-locked" aria-hidden="false">
			<div class="inv-locked-inner">
				<span class="inv-lock-icon" aria-hidden="true">🔒</span>
				<p class="inv-locked-title">
					{#if gamesUiEnabled}
						Itinerary, rooms, polls, games &amp; chat stay private until you join
					{:else}
						Itinerary, rooms, polls &amp; chat stay private until you join
					{/if}
				</p>
				<p class="inv-locked-copy">
					We keep collaboration details for confirmed guests. Sign in and join to see everything.
				</p>
			</div>
		</div>

		<div class="inv-rsvp-card">
			<h3 class="inv-rsvp-h">Your RSVP</h3>
			{#if declined}
				<p class="inv-rsvp-copy">You’ve let the host know you can’t make it. Changed your mind?</p>
				<div class="inv-rsvp-actions">
					<a href={joinWithInvite} class="inv-btn inv-btn--secondary">Sign in to update</a>
				</div>
			{:else}
				<p class="inv-rsvp-copy">
					<strong>Going</strong>, sign in, join the trip, then pick your room and bed on the RSVP page.
				</p>
				<p class="inv-rsvp-copy inv-rsvp-muted">
					<strong>Can’t make it</strong>, tell the host now (no account needed). You can always sign in later to
					update.
				</p>
				<div class="inv-rsvp-actions">
					<a href={joinWithInvite} class="inv-btn inv-btn--primary">I’m going, sign in</a>
					<a href={signupWithInvite} class="inv-btn inv-btn--ghost">Create account</a>
					<button
						type="button"
						class="inv-btn inv-btn--quiet"
						disabled={declineBusy}
						onclick={submitCantMakeIt}
					>
						{declineBusy ? 'Saving…' : 'Can’t make it'}
					</button>
				</div>
				{#if declineMsg}
					<p class="inv-rsvp-err" role="alert">{declineMsg}</p>
				{/if}
			{/if}
		</div>
	</section>
</div>

<style>
	.inv-preview {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 0 2.5rem;
	}

	.inv-panel {
		margin: 1.25rem 1.5rem 0;
		padding: 1.35rem 1.5rem 1.5rem;
		border-radius: 18px;
		background: var(--surfaceSolid, #fff);
		box-shadow: 0 8px 36px rgba(29, 77, 78, 0.1), 0 1px 4px rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(29, 77, 78, 0.08);
	}

	.inv-panel-title {
		margin: 0 0 0.35rem;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
	}

	.inv-panel-lead {
		margin: 0 0 1rem;
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--muted, #5c6f70);
	}

	.inv-going {
		margin-bottom: 1.25rem;
	}

	.inv-going-h {
		margin: 0 0 0.5rem;
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted, #5c6f70);
	}

	.inv-going-empty {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted, #5c6f70);
	}

	.inv-going-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.inv-going-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.inv-av {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: linear-gradient(135deg, var(--slate, #2f7778), var(--navy, #1d4d4e));
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.inv-av img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.inv-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}

	.inv-locked {
		margin-bottom: 1.35rem;
		border-radius: 14px;
		background: linear-gradient(145deg, rgba(29, 77, 78, 0.06), rgba(47, 119, 120, 0.04));
		border: 1px dashed rgba(47, 119, 120, 0.25);
	}

	.inv-locked-inner {
		padding: 1rem 1.1rem;
		text-align: center;
	}

	.inv-lock-icon {
		font-size: 1.25rem;
		display: block;
		margin-bottom: 0.35rem;
		opacity: 0.85;
	}

	.inv-locked-title {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
		font-weight: 650;
		color: var(--navy, #1d4d4e);
	}

	.inv-locked-copy {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--muted, #5c6f70);
	}

	.inv-rsvp-card {
		padding: 1.1rem 1.15rem;
		border-radius: 14px;
		background: rgba(29, 77, 78, 0.04);
		border: 1px solid rgba(29, 77, 78, 0.1);
	}

	.inv-rsvp-h {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
	}

	.inv-rsvp-copy {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text, #1a1a1a);
	}

	.inv-rsvp-muted {
		color: var(--muted, #5c6f70);
	}

	.inv-rsvp-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.inv-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s ease, transform 0.12s ease;
	}

	.inv-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.inv-btn--primary {
		background: var(--copper, #bf4e30);
		color: #fff;
	}

	.inv-btn--primary:hover:not(:disabled) {
		filter: brightness(1.05);
	}

	.inv-btn--secondary {
		background: var(--slate, #2f7778);
		color: #fff;
	}

	.inv-btn--ghost {
		background: transparent;
		color: var(--slate, #2f7778);
		border: 1px solid rgba(47, 119, 120, 0.35);
	}

	.inv-btn--quiet {
		background: transparent;
		color: var(--muted, #5c6f70);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.inv-rsvp-err {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: #b91c1c;
	}
</style>
