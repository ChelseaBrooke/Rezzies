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
		onInvite
	}: {
		tripId: string;
		members: Member[];
		rsvps: RsvpRow[];
		data: CostAtMaxParticipation;
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

	const acceptedRsvpCount = $derived(rsvps.filter((r) => r.status === 'yes').length);
	const maxHeadcount = $derived(Math.max(1, data.maxHeadcount));

	const maxCostPerPerson = $derived.by(() => {
		if (data.perPersonAtMax != null) return data.perPersonAtMax;
		if (data.perPersonAverageAtMax != null) return data.perPersonAverageAtMax;
		return null;
	});

	const currentCostPerPerson = $derived.by(() => {
		if (acceptedRsvpCount < 1) return maxCostPerPerson;
		const n = Math.max(acceptedRsvpCount, 1);
		return Math.round((data.totalCost / n) * 100) / 100;
	});

	const sliderPct = $derived(Math.min(100, (acceptedRsvpCount / maxHeadcount) * 100));

	const showPricingBar = $derived(
		data.totalCost > 0 && maxHeadcount > 0 && maxCostPerPerson != null && currentCostPerPerson != null
	);

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
</script>

<div class="cg-root">
	<div class="cg-header">
		<div class="cg-header-left">
			<h2 class="cg-title">Capacity &amp; Guests</h2>
			<span class="cg-subtitle">{acceptedRsvpCount} of {maxHeadcount} confirmed</span>
		</div>
		{#if onInvite}
			<button type="button" class="cg-invite" onclick={onInvite}>
				<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
				Invite
			</button>
		{/if}
	</div>

	{#if showPricingBar && currentCostPerPerson != null && maxCostPerPerson != null}
		<div class="cg-bar-wrap">
			<div class="cg-track-row">
				<div class="cg-track">
					<div class="cg-fill" style="width: {sliderPct}%"></div>
					<div class="cg-dot" style="left: {sliderPct}%">
						<span class="cg-dot-tip">{acceptedRsvpCount} guest{acceptedRsvpCount === 1 ? '' : 's'}</span>
					</div>
				</div>
			</div>
			<div class="cg-endpoints">
				<div class="cg-end">
					<span class="cg-price cg-price--now">${currentCostPerPerson.toLocaleString()}</span>
					<span class="cg-sublabel">{acceptedRsvpCount} guest{acceptedRsvpCount === 1 ? '' : 's'} · now</span>
				</div>
				<div class="cg-end cg-end--right">
					<span class="cg-price cg-price--max">${maxCostPerPerson.toLocaleString()}</span>
					<span class="cg-sublabel">{maxHeadcount} guests · if full</span>
				</div>
			</div>
		</div>
	{:else if maxCostPerPerson != null}
		<div class="cg-price-full">
			<span class="cg-price-full-amount">${maxCostPerPerson.toLocaleString()}</span>
			<span class="cg-price-full-label">per person at full capacity</span>
		</div>
	{:else}
		<p class="cg-placeholder">Add rooms and a trip total to see how price per person changes as more guests join.</p>
		<a href="/trips/{tripId}/rooms" class="cg-placeholder-link">Set up rooms →</a>
	{/if}

	<div class="cg-guest-row">
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
		<a href="/trips/{tripId}/guests" class="cg-manage">Guests →</a>
	</div>
</div>

<style>
	.cg-root {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
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
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.cg-title {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
		line-height: 1.2;
	}

	.cg-subtitle {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 400;
	}

	.cg-invite {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		background: var(--slate, #2f7778);
		color: white;
		font-size: 0.8125rem;
		font-weight: 600;
		border: none;
		cursor: pointer;
		font-family: inherit;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.cg-invite:hover {
		background: var(--navy, #1d4d4e);
	}

	.cg-bar-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.cg-track-row {
		padding: 0.5rem 0 0.15rem;
	}

	.cg-track {
		position: relative;
		height: 6px;
		background: rgba(0, 0, 0, 0.09);
		border-radius: 999px;
		overflow: visible;
	}

	.cg-fill {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: linear-gradient(90deg, var(--warm, #ce5612) 0%, var(--slate, #2f7778) 100%);
		border-radius: 999px;
		transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.cg-dot {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--slate, #2f7778);
		border: 2px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
		transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.cg-dot-tip {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		background: var(--slate, #2f7778);
		color: white;
		font-size: 0.5rem;
		font-weight: 700;
		padding: 0.12rem 0.35rem;
		border-radius: 4px;
		white-space: nowrap;
		pointer-events: none;
	}

	.cg-dot-tip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: var(--slate, #2f7778);
	}

	.cg-endpoints {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.cg-end {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.cg-end--right {
		align-items: flex-end;
		text-align: right;
	}

	.cg-price {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.35rem;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.cg-price--now {
		color: var(--warm, #ce5612);
	}

	.cg-price--max {
		color: var(--slate, #2f7778);
	}

	.cg-sublabel {
		font-size: 0.6rem;
		color: var(--muted);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.cg-price-full {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.cg-price-full-amount {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.75rem;
		font-weight: 800;
		color: var(--slate, #2f7778);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.cg-price-full-label {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.cg-placeholder {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.4;
	}

	.cg-placeholder-link {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--slate, #2f7778);
		text-decoration: none;
	}

	.cg-placeholder-link:hover {
		text-decoration: underline;
	}

	.cg-guest-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-height: 0;
		padding-top: 0.25rem;
	}

	.cg-guest-scroll {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--border-soft) transparent;
		padding: 2px 0;
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
		opacity: 0.55;
	}

	.cg-chip-btn {
		position: relative;
		display: block;
		width: 36px;
		height: 36px;
		padding: 0;
		margin: 0;
		border-radius: 50%;
		border: 2px solid var(--border-soft);
		background: linear-gradient(135deg, var(--slate, #2f7778) 0%, var(--navy, #1d4d4e) 100%);
		overflow: visible;
		cursor: pointer;
		font: inherit;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}

	.cg-chip-btn--static {
		cursor: default;
	}

	.cg-chip--going .cg-chip-btn {
		border-color: rgba(47, 119, 120, 0.45);
	}

	.cg-chip-btn:hover:not(.cg-chip-btn--static) {
		transform: scale(1.06);
		box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
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
		font-size: 0.6875rem;
		font-weight: 700;
		color: white;
		border-radius: 50%;
	}

	.cg-chip-dot {
		position: absolute;
		right: -1px;
		bottom: -1px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
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
</style>
