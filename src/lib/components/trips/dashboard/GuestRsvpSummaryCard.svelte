<script lang="ts">
	interface Assignment {
		room?: { id: number; name: string | null; photoUrls?: string[] } | null;
		bed?: { id: string; bedType: string | null } | null;
		partySize?: number;
	}
	interface Props {
		tripId: string;
		userRsvp?: { status?: string; adultsCount?: number; kidsCount?: number } | null;
		myAssignments: Assignment[];
		userReservationPrice: number | null;
		tripCheckInDate?: string;
	}

	let { tripId, userRsvp, myAssignments, userReservationPrice, tripCheckInDate = '' }: Props = $props();

	const peopleCount = $derived((userRsvp?.adultsCount ?? 0) + (userRsvp?.kidsCount ?? 0));
	const hasAccepted = $derived(userRsvp?.status === 'yes');
	const hasDeclined = $derived(userRsvp?.status === 'no');
	const rsvpEditHref = $derived(`/trips/${tripId}/rsvp`);

	const daysUntil = $derived.by(() => {
		if (!tripCheckInDate) return null;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const checkIn = new Date(tripCheckInDate);
		checkIn.setHours(0, 0, 0, 0);
		const diff = Math.round((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return diff > 0 ? diff : null;
	});

	const roomBedItems = $derived(
		myAssignments.map((a) => {
			const roomName = a.room?.name?.trim() || 'Room';
			const bedLabel = a.bed?.bedType?.trim();
			return { line: bedLabel ? `${roomName} – ${bedLabel}` : roomName };
		})
	);
</script>

<div class="rsvp-card">
	<!-- Status header -->
	{#if hasAccepted}
		<div class="status-banner accepted">
			<span class="status-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="20 6 9 17 4 12"/>
				</svg>
			</span>
			<span class="status-text">You're going!</span>
			{#if daysUntil !== null}
				<span class="status-days">{daysUntil}d away</span>
			{/if}
		</div>
	{:else if hasDeclined}
		<div class="status-banner declined">
			<span class="status-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</span>
			<span class="status-text">You declined</span>
		</div>
	{:else}
		<div class="status-banner pending">
			<span class="status-icon pending-dot" aria-hidden="true"></span>
			<span class="status-text">Haven't RSVP'd yet</span>
		</div>
	{/if}

	<!-- Content -->
	<div class="rsvp-body">
		{#if !hasAccepted && !hasDeclined}
			<!-- Not RSVP'd: nudge them -->
			<p class="nudge-text">Let your host know if you're joining the trip.</p>
			<a href={rsvpEditHref} class="cta-btn cta-primary">
				RSVP Now
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
				</svg>
			</a>
		{:else if hasDeclined}
			<p class="nudge-text">Changed your mind? Update your RSVP.</p>
			<a href={rsvpEditHref} class="cta-btn cta-ghost">Update RSVP</a>
		{:else}
			<!-- Accepted: show details -->
			{#if userReservationPrice != null}
				<div class="detail-block">
					<span class="detail-label">Price estimate</span>
					<div class="detail-price-row">
						<span class="detail-price">${userReservationPrice.toFixed(2)}</span>
						<span class="detail-note">may change</span>
					</div>
				</div>
			{/if}

			{#if roomBedItems.length > 0}
				<div class="detail-block">
					<span class="detail-label">Room & bed</span>
					<div class="detail-values">
						{#each roomBedItems as { line }}
							<span class="detail-value">{line}</span>
						{/each}
					</div>
				</div>
			{:else}
				<div class="detail-block">
					<span class="detail-label">Room & bed</span>
					<span class="detail-empty">No room assigned yet</span>
				</div>
			{/if}

			{#if peopleCount > 0}
				<div class="detail-block">
					<span class="detail-label">Party size</span>
					<span class="detail-value">
						{peopleCount} {peopleCount === 1 ? 'person' : 'people'}
						{#if (userRsvp?.adultsCount ?? 0) > 0}
							<span class="detail-sub">
								({userRsvp?.adultsCount} adult{(userRsvp?.adultsCount ?? 0) === 1 ? '' : 's'}{(userRsvp?.kidsCount ?? 0) > 0 ? `, ${userRsvp?.kidsCount} kid${(userRsvp?.kidsCount ?? 0) === 1 ? '' : 's'}` : ''})
							</span>
						{/if}
					</span>
				</div>
			{/if}

			<a href={rsvpEditHref} class="cta-btn cta-ghost">Edit my RSVP</a>
		{/if}
	</div>
</div>

<style>
	.rsvp-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	/* ── Status row ── same neutral base, copper accent for active state ── */
	.status-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-bottom: 0.75rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-soft);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}

	.status-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--copper, #BF4E30);
	}

	.status-banner.declined .status-icon {
		color: var(--muted);
	}

	.status-icon svg {
		width: 100%;
		height: 100%;
	}

	.status-text {
		flex: 1;
	}

	.status-banner.declined .status-text {
		color: var(--muted);
	}

	.status-days {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--copper, #BF4E30);
		background: rgba(191, 78, 48, 0.08);
		border: 1px solid rgba(191, 78, 48, 0.15);
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
	}

	.pending-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--copper, #BF4E30);
		flex-shrink: 0;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.35; }
	}

	/* ── Body ── */
	.rsvp-body {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.nudge-text {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.5;
	}

	/* ── Detail blocks ── */
	.detail-block {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-soft, rgba(0,0,0,0.06));
	}

	.detail-block:last-of-type {
		border-bottom: none;
		padding-bottom: 0;
	}

	.detail-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	.detail-price-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}

	.detail-price {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--text);
		line-height: 1.1;
	}

	.detail-note {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.detail-values {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.detail-value {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		line-height: 1.4;
	}

	.detail-sub {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--muted);
	}

	.detail-empty {
		font-size: 0.875rem;
		color: var(--muted);
		font-style: italic;
	}

	/* ── CTA buttons ── */
	.cta-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.625rem 1rem;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.15s ease;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.25rem;
	}

	.cta-btn svg {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
	}

	.cta-primary {
		background: var(--copper, #bf4e30);
		color: white;
	}

	.cta-primary:hover {
		background: #a63d25;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(191, 78, 48, 0.35);
	}

	.cta-ghost {
		background: transparent;
		color: var(--text);
		border: 1px solid var(--border-soft, rgba(0,0,0,0.1));
	}

	.cta-ghost:hover {
		background: rgba(0, 0, 0, 0.04);
		border-color: var(--muted);
	}
</style>
