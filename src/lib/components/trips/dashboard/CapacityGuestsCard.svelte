<script lang="ts">
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import type { CostAtMaxParticipation } from '$lib/server/pricing-canonical.js';

	type Member = {
		user?: { id: string; name: string | null; email: string | null; avatarUrl?: string | null } | null;
	};
	type RsvpRow = {
		status: string;
		userId?: string;
		user?: { id?: string; name: string | null; email?: string | null; avatarUrl?: string | null } | null;
	};

	let {
		tripId,
		members,
		rsvps,
		data,
		costSharingEnabled = true,
		expectedPeopleCount = null,
		planningMaxHeadcount = 1,
		roomsFilled = 0,
		roomsTotal = 0,
		bedsCurrent = 0,
		bedsTotal = 0,
		onInvite
	}: {
		tripId: string;
		members: Member[];
		rsvps: RsvpRow[];
		data: CostAtMaxParticipation | null;
		costSharingEnabled?: boolean;
		expectedPeopleCount?: number | null;
		/** When pricing payload is missing, max for "X of Y confirmed" (matches server headcount rules when possible). */
		planningMaxHeadcount?: number;
		roomsFilled?: number;
		roomsTotal?: number;
		bedsCurrent?: number;
		bedsTotal?: number;
		onInvite?: () => void;
	} = $props();

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

	function fmtMoney(n: number): string {
		const rounded = Math.round(n * 100) / 100;
		return `$${rounded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
	}

	const acceptedRsvpCount = $derived(rsvps.filter((r) => r.status === 'yes').length);
	const roomsConfigured = $derived(roomsTotal > 0);

	const maxHeadcount = $derived(Math.max(1, data?.maxHeadcount ?? planningMaxHeadcount));

	const fullCpp = $derived.by((): number | null => {
		if (!data) return null;
		if (data.perPersonAtMax != null) return data.perPersonAtMax;
		if (data.perPersonAverageAtMax != null) return data.perPersonAverageAtMax;
		return null;
	});

	const expectedHeadcount = $derived.by(() => {
		const max = maxHeadcount;
		if (expectedPeopleCount != null && expectedPeopleCount > 0) {
			return Math.min(max, Math.max(1, expectedPeopleCount));
		}
		const guess = Math.max(2, Math.ceil(max * 0.55));
		return Math.min(max, Math.max(1, guess));
	});

	const currentCpp = $derived.by((): number | null => {
		if (!data || data.totalCost <= 0) return null;
		const n = Math.max(1, acceptedRsvpCount);
		return Math.round((data.totalCost / n) * 100) / 100;
	});

	const expectedCpp = $derived.by((): number | null => {
		if (!data || data.totalCost <= 0) return null;
		const n = Math.max(1, expectedHeadcount);
		return Math.round((data.totalCost / n) * 100) / 100;
	});

	const hasPricingHero = $derived(
		costSharingEnabled &&
			data != null &&
			data.totalCost > 0 &&
			fullCpp != null &&
			currentCpp != null &&
			expectedCpp != null
	);

	/** Position on track: 1 → max maps to 0–100% */
	function headcountToPct(n: number, max: number): number {
		if (max <= 1) return 50;
		const clamped = Math.min(max, Math.max(1, n));
		return ((clamped - 1) / (max - 1)) * 100;
	}

	const pctCurrent = $derived(headcountToPct(acceptedRsvpCount, maxHeadcount));
	const pctExpected = $derived(headcountToPct(expectedHeadcount, maxHeadcount));

	const needsTripTotal = $derived(
		costSharingEnabled && roomsConfigured && data != null && data.totalCost <= 0
	);

	const insightText = $derived.by((): string => {
		if (!hasPricingHero || currentCpp == null || expectedCpp == null || fullCpp == null || !data) return '';
		if (acceptedRsvpCount === 0) {
			return 'Invite guests to split the trip—every confirmation lowers what each person pays.';
		}
		const toExpected = Math.max(0, currentCpp - expectedCpp);
		const toFull = Math.max(0, currentCpp - fullCpp);
		const gapToExpected = expectedHeadcount - acceptedRsvpCount;
		if (gapToExpected > 0 && toExpected >= 1) {
			return `Invite ${gapToExpected} more ${gapToExpected === 1 ? 'guest' : 'guests'} to reach your expected headcount—about ${fmtMoney(toExpected)} less per person vs. today.`;
		}
		if (acceptedRsvpCount < maxHeadcount && toFull >= 1) {
			return `Full capacity (${maxHeadcount} guests) lowers cost by about ${fmtMoney(toFull)} per person compared to now.`;
		}
		if (acceptedRsvpCount < expectedHeadcount && toExpected > 0) {
			return `Reach your expected headcount to lower cost by about ${fmtMoney(toExpected)} per person.`;
		}
		return 'Great momentum—more confirmations keep the per-person share low.';
	});

	const setupProgressPct = $derived.by(() => {
		let p = 0;
		if (roomsTotal > 0) p += 38;
		if (bedsTotal > 0) p += 27;
		if (acceptedRsvpCount > 0) p += 20;
		if (costSharingEnabled) p += 15;
		return Math.min(100, p);
	});

	const rsvpStatusByUserId = $derived.by(() => {
		const m = new Map<string, string>();
		for (const r of rsvps) {
			const uid = r.userId ?? r.user?.id;
			if (uid) m.set(uid, r.status);
		}
		return m;
	});

	function rsvpBadgeLabel(status: string | undefined): string {
		if (status === 'yes') return 'Going';
		if (status === 'no') return 'Declined';
		return 'Pending';
	}

	const subtitleCounts = $derived(`${acceptedRsvpCount} of ${maxHeadcount} confirmed`);

	const stateBFallbackRooms = $derived(!roomsConfigured);
	const settingsHref = $derived(`/trips/${tripId}/settings`);
	/** Cost sharing & trip total are edited in AddOnsStep (wizard step 2). */
	const settingsCostSharingHref = $derived(`/trips/${tripId}/settings/step/2`);
	const roomsHref = $derived(`/trips/${tripId}/rooms`);
</script>

<div class="cg-root">
	{#if hasPricingHero && data}
		<!-- ========== State A: Cost per Person ========== -->
		<div class="cg-header">
			<div class="cg-header-left">
				<h2 class="cg-heading-tight">
					<span class="cg-heading-title">Cost per Person</span>
					<span class="cg-heading-count">{subtitleCounts}</span>
				</h2>
			</div>
			{#if onInvite}
				<button type="button" class="cg-invite" onclick={onInvite}>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
					Invite
				</button>
			{/if}
		</div>

		<div class="cg-hero-band">
			<div class="cg-hero-col cg-hero-col--current">
				<span class="cg-hero-label">Current</span>
				<span class="cg-hero-amount">{fmtMoney(currentCpp!)}</span>
				<span class="cg-hero-sub">per person now</span>
				<span class="cg-hero-meta">{acceptedRsvpCount} guest{acceptedRsvpCount === 1 ? '' : 's'} confirmed</span>
			</div>
			<div class="cg-hero-divider" aria-hidden="true"></div>
			<div class="cg-hero-col cg-hero-col--expected">
				<span class="cg-hero-label">Expected</span>
				<span class="cg-hero-amount">{fmtMoney(expectedCpp!)}</span>
				<span class="cg-hero-sub">at expected headcount</span>
				<span class="cg-hero-meta">{expectedHeadcount} guests expected</span>
			</div>
			<div class="cg-hero-divider" aria-hidden="true"></div>
			<div class="cg-hero-col cg-hero-col--full">
				<span class="cg-hero-label">Full</span>
				<span class="cg-hero-amount">{fmtMoney(fullCpp!)}</span>
				<span class="cg-hero-sub">if full</span>
				<span class="cg-hero-meta">{maxHeadcount} guests max</span>
			</div>
		</div>

		<div class="cg-viz">
			<div class="cg-viz-track-wrap">
				<div class="cg-viz-track" aria-hidden="true">
					<div class="cg-viz-track-fill"></div>
					<div class="cg-viz-marker cg-viz-marker--expected" style="left: {pctExpected}%"></div>
					<div class="cg-viz-marker cg-viz-marker--current" style="left: {pctCurrent}%"></div>
				</div>
				<div class="cg-viz-labels">
					<span>1</span>
					<span class="cg-viz-label-mid">{expectedHeadcount} expected</span>
					<span>{maxHeadcount} max</span>
				</div>
			</div>
		</div>

		{#if insightText}
			<div class="cg-insight" role="status">
				<span class="cg-insight-text">{insightText}</span>
			</div>
		{/if}
	{:else}
		<!-- ========== State B: Trip setup (and cost-sharing on without trip total) ========== -->
		<div class="cg-header">
			<div class="cg-header-left">
				<h2 class="cg-heading-tight">
					<span class="cg-heading-title">{needsTripTotal ? 'Cost per Person' : 'Trip Setup'}</span>
					<span class="cg-heading-count">{subtitleCounts}</span>
				</h2>
			</div>
			{#if needsTripTotal}
				<a href={settingsHref} class="cg-header-cta">Add trip total</a>
			{:else if stateBFallbackRooms}
				<a href={roomsHref} class="cg-header-cta">Set up rooms</a>
			{:else if onInvite}
				<button type="button" class="cg-invite" onclick={onInvite}>Invite</button>
			{/if}
		</div>

		{#if needsTripTotal}
			<div class="cg-fallback">
				<h3 class="cg-fallback-title">Add your trip total</h3>
				<p class="cg-fallback-copy">
					Set the full trip cost in settings so this card can show how each person’s share drops as more guests
					confirm.
				</p>
				<a href={settingsHref} class="cg-primary-link">Open trip settings</a>
			</div>
		{:else if stateBFallbackRooms}
			<div class="cg-fallback cg-fallback--visual">
				<div class="cg-setup-visual" aria-hidden="true">
					<svg class="cg-setup-illus" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 72" fill="none" aria-hidden="true">
						<rect x="8" y="28" width="36" height="36" rx="6" stroke="currentColor" stroke-width="2" opacity="0.35"/>
						<rect x="52" y="18" width="28" height="46" rx="5" stroke="currentColor" stroke-width="2" opacity="0.5"/>
						<rect x="86" y="32" width="26" height="32" rx="5" stroke="currentColor" stroke-width="2" opacity="0.35"/>
						<path d="M24 20v12M42 14v18" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
					</svg>
				</div>
				<h3 class="cg-fallback-title">Set up rooms and capacity</h3>
				<p class="cg-fallback-copy">
					Add rooms, beds, and guest capacity to unlock pricing estimates and bed assignments.
				</p>
				<a href={roomsHref} class="cg-primary-link">Set up rooms</a>
			</div>
		{:else}
			<div class="cg-fallback cg-fallback--split">
				<div class="cg-fallback-text">
					<h3 class="cg-fallback-title">Cost sharing is off</h3>
					<p class="cg-fallback-copy">
						Guests can still RSVP and choose rooms, but shared pricing estimates stay hidden until cost sharing is on.
					</p>
				</div>
				<div class="cg-fallback-actions cg-fallback-actions--rail">
					<a href={settingsCostSharingHref} class="cg-primary-link">Enable cost sharing</a>
					<a href={roomsHref} class="cg-secondary-pill">Manage rooms</a>
				</div>
			</div>
		{/if}

		<div class="cg-b-stats">
			<div class="cg-b-stat"><span class="cg-b-stat-label">Confirmed guests</span><span class="cg-b-stat-val">{acceptedRsvpCount}</span></div>
			<div class="cg-b-stat"><span class="cg-b-stat-label">Rooms reserved</span><span class="cg-b-stat-val">{roomsFilled} / {roomsTotal}</span></div>
			<div class="cg-b-stat"><span class="cg-b-stat-label">Beds reserved</span><span class="cg-b-stat-val">{bedsCurrent} / {bedsTotal}</span></div>
			<div class="cg-b-stat"><span class="cg-b-stat-label">Max capacity</span><span class="cg-b-stat-val">{maxHeadcount}</span></div>
		</div>

		<div class="cg-setup-progress">
			<div class="cg-setup-progress-head">
				<span>Trip setup progress</span>
				<span class="cg-setup-progress-pct">{setupProgressPct}%</span>
			</div>
			<div class="cg-setup-bar" aria-hidden="true">
				<div class="cg-setup-bar-fill" style="width: {setupProgressPct}%"></div>
			</div>
		</div>
	{/if}

	<div class="cg-guest-strip">
		<span class="cg-guest-label">Guests</span>
		<div class="cg-guest-scroll">
			{#each members as member}
				{@const uid = member.user?.id ?? ''}
				{@const rsvpStatus = rsvpStatusByUserId.get(uid)}
				{@const guestLabel = member.user?.name ?? member.user?.email ?? 'Guest'}
				{@const tip = `${guestLabel} · ${rsvpBadgeLabel(rsvpStatus)}`}
				<div
					class="cg-chip"
					class:cg-chip--going={rsvpStatus === 'yes'}
					class:cg-chip--declined={rsvpStatus === 'no'}
				>
					{#if member.user?.id}
						<ProfileTooltip userId={member.user.id}>
							<button
								type="button"
								class="cg-chip-btn"
								onclick={() => openProfileCard(member.user!.id)}
								aria-label={tip}
								title={tip}
							>
								{#if member.user.avatarUrl}
									<img src={member.user.avatarUrl} alt="" class="cg-chip-img" />
								{:else}
									<span class="cg-chip-initials">{initials(member.user?.name, member.user?.email)}</span>
								{/if}
								<span
									class="cg-chip-dot"
									class:cg-chip-dot--yes={rsvpStatus === 'yes'}
									class:cg-chip-dot--no={rsvpStatus === 'no'}
									class:cg-chip-dot--pending={rsvpStatus !== 'yes' && rsvpStatus !== 'no'}
									aria-hidden="true"
								></span>
							</button>
						</ProfileTooltip>
					{:else}
						<span class="cg-chip-btn cg-chip-btn--static" title={tip}>
							{#if member.user?.avatarUrl}
								<img src={member.user.avatarUrl} alt="" class="cg-chip-img" />
							{:else}
								<span class="cg-chip-initials">{initials(member.user?.name, member.user?.email)}</span>
							{/if}
							<span
								class="cg-chip-dot"
								class:cg-chip-dot--yes={rsvpStatus === 'yes'}
								class:cg-chip-dot--no={rsvpStatus === 'no'}
								class:cg-chip-dot--pending={rsvpStatus !== 'yes' && rsvpStatus !== 'no'}
								aria-hidden="true"
							></span>
						</span>
					{/if}
				</div>
			{/each}
		</div>
		<a href="/trips/{tripId}/guests" class="cg-manage">Manage</a>
	</div>
</div>

<style>
	.cg-root {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		min-height: 0;
		flex: 1;
		min-width: 0;
	}

	.cg-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.cg-header-left {
		min-width: 0;
		flex: 1;
	}

	/** One baseline-aligned row so total height lines up with Invite / header CTAs */
	.cg-heading-tight {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 0.45rem;
		row-gap: 0.1rem;
		line-height: 1.15;
		min-width: 0;
	}

	.cg-heading-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
		letter-spacing: -0.02em;
	}

	.cg-heading-count {
		font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
	}

	.cg-invite {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		background: var(--slate, #2f7778);
		color: white;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.15;
		border: none;
		cursor: pointer;
		font-family: inherit;
		flex-shrink: 0;
		transition: background 0.18s ease, transform 0.12s ease;
	}

	.cg-invite:hover {
		background: var(--navy, #1d4d4e);
		transform: translateY(-1px);
	}

	.cg-header-cta {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		background: rgba(47, 119, 120, 0.1);
		color: var(--slate, #2f7778);
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.15;
		text-decoration: none;
		border: 1px solid rgba(47, 119, 120, 0.22);
		transition: background 0.18s ease, border-color 0.18s ease;
	}

	.cg-header-cta:hover {
		background: rgba(47, 119, 120, 0.16);
		border-color: rgba(47, 119, 120, 0.35);
	}

	/* —— State A: hero band —— */
	.cg-hero-band {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto 1fr;
		align-items: stretch;
		gap: 0;
		padding: 1rem 0.75rem;
		border-radius: var(--radius-xl, 14px);
		background: linear-gradient(165deg, rgba(252, 252, 252, 0.98) 0%, rgba(245, 248, 248, 0.95) 100%);
		box-shadow: 0 4px 20px rgba(29, 77, 78, 0.07), 0 1px 3px rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(29, 77, 78, 0.08);
	}

	.cg-hero-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.2rem;
		min-width: 0;
		padding: 0 0.25rem;
	}

	.cg-hero-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.85;
	}

	.cg-hero-col--current .cg-hero-label {
		color: var(--warm, #ce5612);
	}
	.cg-hero-col--expected .cg-hero-label {
		color: var(--slate, #2f7778);
	}
	.cg-hero-col--full .cg-hero-label {
		color: #15803d;
	}

	.cg-hero-amount {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.35rem, 3.5vw, 1.65rem);
		font-weight: 800;
		line-height: 1.05;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.03em;
	}

	.cg-hero-col--current .cg-hero-amount {
		color: var(--warm, #ce5612);
	}
	.cg-hero-col--expected .cg-hero-amount {
		color: var(--navy, #1d4d4e);
	}
	.cg-hero-col--full .cg-hero-amount {
		color: #166534;
	}

	.cg-hero-sub {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text);
		opacity: 0.88;
	}

	.cg-hero-meta {
		font-size: 0.625rem;
		color: var(--muted);
		font-weight: 500;
		margin-top: 0.15rem;
		line-height: 1.25;
	}

	.cg-hero-divider {
		width: 1px;
		background: linear-gradient(180deg, transparent, rgba(29, 77, 78, 0.12), transparent);
		align-self: stretch;
		margin: 0.25rem 0;
	}

	/* —— Visualization —— */
	.cg-viz {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.cg-viz-track-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.cg-viz-track {
		position: relative;
		height: 10px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			rgba(206, 86, 18, 0.22) 0%,
			rgba(47, 119, 120, 0.2) 55%,
			rgba(22, 101, 52, 0.18) 100%
		);
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.45);
	}

	.cg-viz-track-fill {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		opacity: 0.35;
		background: rgba(255, 255, 255, 0.25);
		pointer-events: none;
	}

	.cg-viz-marker {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
		transition: left 0.55s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease;
		z-index: 1;
	}

	.cg-viz-marker--expected {
		background: var(--slate, #2f7778);
		width: 11px;
		height: 11px;
		opacity: 0.92;
		z-index: 0;
	}

	.cg-viz-marker--current {
		background: var(--warm, #ce5612);
		width: 16px;
		height: 16px;
		z-index: 2;
		animation: cg-pulse 2.8s ease-in-out infinite;
	}

	@keyframes cg-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(206, 86, 18, 0.35);
		}
		50% {
			box-shadow: 0 0 0 6px rgba(206, 86, 18, 0);
		}
	}

	.cg-viz-labels {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.cg-viz-label-mid {
		text-align: center;
		flex: 1;
		padding: 0 0.25rem;
	}

	/* —— Insight —— */
	.cg-insight {
		padding: 0.65rem 0.85rem;
		border-radius: var(--radius-lg, 10px);
		background: linear-gradient(120deg, rgba(247, 170, 41, 0.12) 0%, rgba(47, 119, 120, 0.1) 100%);
		border: 1px solid rgba(47, 119, 120, 0.14);
	}

	.cg-insight-text {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--navy, #1d4d4e);
		line-height: 1.4;
	}

	/* —— State B fallback —— */
	.cg-fallback {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.85rem 0.75rem;
		border-radius: var(--radius-xl, 14px);
		background: rgba(47, 119, 120, 0.05);
		border: 1px solid rgba(47, 119, 120, 0.1);
	}

	.cg-fallback--visual {
		align-items: center;
		text-align: center;
	}

	/* Cost-sharing off: copy left, CTAs right — shorter vertically */
	.cg-fallback--split {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		flex-wrap: wrap;
	}

	.cg-fallback-text {
		flex: 1;
		min-width: min(100%, 11rem);
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.cg-fallback--split .cg-fallback-title {
		line-height: 1.2;
	}

	.cg-fallback--split .cg-fallback-copy {
		line-height: 1.35;
	}

	.cg-fallback-actions--rail {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.35rem;
		flex-shrink: 0;
		margin-top: 0;
		min-width: 9.5rem;
	}

	.cg-fallback-actions--rail .cg-primary-link {
		margin-top: 0;
		text-align: center;
		white-space: nowrap;
		padding: 0.45rem 0.75rem;
		font-size: 0.75rem;
	}

	.cg-secondary-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		background: rgba(47, 119, 120, 0.08);
		color: var(--slate, #2f7778);
		font-size: 0.75rem;
		font-weight: 600;
		text-decoration: none;
		border: 1px solid rgba(47, 119, 120, 0.22);
		white-space: nowrap;
		transition: background 0.18s ease, border-color 0.18s ease;
	}

	.cg-secondary-pill:hover {
		background: rgba(47, 119, 120, 0.14);
		border-color: rgba(47, 119, 120, 0.35);
	}

	.cg-setup-visual {
		color: var(--slate, #2f7778);
		margin-bottom: 0.25rem;
	}

	.cg-setup-illus {
		width: 120px;
		height: auto;
		opacity: 0.85;
	}

	.cg-fallback-title {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
		line-height: 1.25;
	}

	.cg-fallback-copy {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.45;
		max-width: 34rem;
	}

	.cg-fallback--split .cg-fallback-copy {
		max-width: none;
	}

	.cg-primary-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.25rem;
		padding: 0.5rem 1rem;
		border-radius: 999px;
		background: var(--slate, #2f7778);
		color: white !important;
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.18s ease, transform 0.12s ease;
	}

	.cg-primary-link:hover {
		background: var(--navy, #1d4d4e);
		transform: translateY(-1px);
	}

	.cg-b-stats {
		display: flex;
		align-items: stretch;
		gap: 0;
		padding: 0.45rem 0.35rem;
		border-radius: 10px;
		background: rgba(29, 77, 78, 0.045);
		border: 1px solid rgba(29, 77, 78, 0.08);
	}

	.cg-b-stat {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		padding: 0.2rem 0.35rem;
		text-align: center;
	}

	.cg-b-stat:not(:last-child) {
		border-right: 1px solid rgba(29, 77, 78, 0.1);
	}

	.cg-b-stat-label {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		line-height: 1.2;
		max-width: 100%;
	}

	.cg-b-stat-val {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
		font-variant-numeric: tabular-nums;
		line-height: 1.15;
		white-space: nowrap;
	}

	.cg-setup-progress {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-bottom: 0.15rem;
	}

	.cg-setup-progress-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--muted);
	}

	.cg-setup-progress-pct {
		font-variant-numeric: tabular-nums;
		color: var(--slate, #2f7778);
	}

	.cg-setup-bar {
		height: 6px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.06);
		overflow: hidden;
	}

	.cg-setup-bar-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--slate, #2f7778), rgba(47, 119, 120, 0.75));
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* —— Guest strip —— */
	.cg-guest-strip {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		padding-top: 0.3rem;
		margin-top: 0.1rem;
		padding-bottom: 0;
		border-top: 1px solid var(--border-soft);
	}

	.cg-guest-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		flex-shrink: 0;
	}

	.cg-guest-scroll {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 5px;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
		padding: 1px 0 0;
	}

	.cg-manage {
		flex-shrink: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--slate, #2f7778);
		text-decoration: none;
		white-space: nowrap;
	}

	.cg-manage:hover {
		text-decoration: underline;
	}

	.cg-chip {
		flex-shrink: 0;
	}

	.cg-chip--declined {
		opacity: 0.5;
	}

	.cg-chip-btn {
		position: relative;
		display: block;
		width: 30px;
		height: 30px;
		padding: 0;
		margin: 0;
		border-radius: 50%;
		border: 2px solid var(--border-soft);
		background: linear-gradient(135deg, var(--slate, #2f7778) 0%, var(--navy, #1d4d4e) 100%);
		overflow: visible;
		cursor: pointer;
		font: inherit;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}

	.cg-chip-btn--static {
		cursor: default;
	}

	.cg-chip--going .cg-chip-btn {
		border-color: rgba(47, 119, 120, 0.4);
	}

	.cg-chip-btn:hover:not(.cg-chip-btn--static) {
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	}

	.cg-chip-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
		display: block;
	}

	.cg-chip-initials {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: 0.625rem;
		font-weight: 700;
		color: white;
		border-radius: 50%;
	}

	.cg-chip-dot {
		position: absolute;
		right: -1px;
		bottom: -1px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.cg-chip-dot--yes {
		background: var(--slate, #2f7778);
	}

	.cg-chip-dot--no {
		background: #dc2626;
	}

	.cg-chip-dot--pending {
		background: var(--warm, #ce5612);
	}

	@media (max-width: 520px) {
		.cg-b-stats {
			padding: 0.35rem 0.15rem;
		}

		.cg-b-stat {
			padding: 0.15rem 0.2rem;
		}

		.cg-b-stat-label {
			font-size: 0.5625rem;
			letter-spacing: 0.03em;
		}

		.cg-b-stat-val {
			font-size: 0.8125rem;
		}
	}

	@media (max-width: 1100px) {
		.cg-hero-band {
			grid-template-columns: 1fr;
			padding: 0.85rem 0.65rem;
		}
		.cg-hero-divider {
			display: none;
		}
		.cg-hero-col {
			padding: 0.5rem 0;
			border-bottom: 1px solid rgba(29, 77, 78, 0.08);
		}
		.cg-hero-col:last-child {
			border-bottom: none;
			padding-bottom: 0;
		}

		.cg-fallback--split {
			flex-direction: column;
			align-items: stretch;
		}

		.cg-fallback-actions--rail {
			min-width: 0;
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: flex-start;
		}
	}
</style>
