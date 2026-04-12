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
		platformFeePerPerson?: number;
		tripCheckInDate?: string;
		costSharingEnabled?: boolean;
	}

	let {
		tripId,
		userRsvp,
		myAssignments,
		userReservationPrice,
		platformFeePerPerson = 0,
		tripCheckInDate = '',
		costSharingEnabled = true
	}: Props = $props();

	const rsvpEditHref = $derived(`/trips/${tripId}/rsvp`);
	const roomsBrowseHref = $derived(`/trips/${tripId}/rooms`);

	const totalGuestPrice = $derived(
		userReservationPrice != null ? userReservationPrice + platformFeePerPerson : null
	);

	const peopleCount = $derived((userRsvp?.adultsCount ?? 0) + (userRsvp?.kidsCount ?? 0));
	const hasAccepted = $derived(userRsvp?.status === 'yes');
	const hasDeclined = $derived(userRsvp?.status === 'no');

	const primaryAssignment = $derived(myAssignments[0] ?? null);
	const roomName = $derived(primaryAssignment?.room?.name?.trim() || null);
	const bedLabel = $derived(primaryAssignment?.bed?.bedType?.trim() || null);
	const roomPhotoUrl = $derived(
		myAssignments.find((a) => a.room?.photoUrls && a.room.photoUrls.length > 0)?.room?.photoUrls?.[0] ??
			null
	);

	const hasRoom = $derived(Boolean(roomName));
	const hasBed = $derived(Boolean(bedLabel));

	/** Confirmed RSVP = going + room + bed (product rule: no “confirmed” without both). */
	const rsvpFullyComplete = $derived(hasAccepted && hasRoom && hasBed);

	const daysUntil = $derived.by(() => {
		if (!tripCheckInDate) return null;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const checkIn = new Date(tripCheckInDate);
		checkIn.setHours(0, 0, 0, 0);
		const diff = Math.round((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return diff > 0 ? diff : null;
	});

	const partyLine = $derived.by(() => {
		if (peopleCount <= 0) return null;
		return peopleCount === 1 ? '1 guest' : `${peopleCount} guests`;
	});

	/** Going but data missing room/bed — surface as incomplete, not “confirmed”. */
	const acceptedNeedsRoomBed = $derived(hasAccepted && (!hasRoom || !hasBed));

	const statusHeadline = $derived.by(() => {
		if (hasDeclined) return 'You’ve declined this trip';
		if (rsvpFullyComplete) return 'RSVP confirmed';
		if (acceptedNeedsRoomBed) return 'Room and bed selection required';
		return 'Finish your RSVP';
	});

	const statusSubline = $derived.by(() => {
		if (hasDeclined) return 'You can update your RSVP any time before the trip.';
		if (rsvpFullyComplete) return 'You’re going';
		if (acceptedNeedsRoomBed)
			return 'Choose your room and bed to complete your RSVP.';
		return 'Let your host know you’re joining, then pick your room and bed.';
	});

	const roomDisplay = $derived(hasRoom ? roomName! : 'Not selected');
	const bedDisplay = $derived(hasBed ? bedLabel! : 'Not selected');

	const incompletePrimaryLabel = $derived(hasAccepted ? 'Choose room & bed' : 'Complete RSVP');
</script>

<!-- Premium guest RSVP panel (planning dashboard sticky card). -->
<div class="grsvp">
	<header class="grsvp-header">
		<div class="grsvp-header-text">
			<h2 class="grsvp-title">Your RSVP</h2>
			<p class="grsvp-statusline">{statusHeadline}</p>
			<p class="grsvp-subline">{statusSubline}</p>
		</div>
		{#if daysUntil != null && !hasDeclined}
			<span class="grsvp-pill" aria-label="{daysUntil} days until the trip">{daysUntil}d away</span>
		{/if}
		{#if rsvpFullyComplete}
			<span class="grsvp-confirm-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
					<polyline points="22 4 12 14.01 9 11.01" />
				</svg>
			</span>
		{/if}
	</header>

	{#if hasDeclined}
		<section class="grsvp-panel grsvp-panel--muted" aria-label="RSVP status">
			<p class="grsvp-panel-copy">If plans change, you can RSVP again from the trip page.</p>
		</section>
		<div class="grsvp-actions">
			<a href={rsvpEditHref} class="cta-btn cta-ghost">Update RSVP</a>
		</div>
	{:else}
		<!-- Reservation-style summary (always shown; placeholder when incomplete). -->
		<section class="grsvp-reservation" aria-label="Room and bed">
			<div class="grsvp-res-thumb">
				{#if rsvpFullyComplete && roomPhotoUrl}
					<img src={roomPhotoUrl} alt="" class="grsvp-res-img" />
				{:else}
					<div class="grsvp-res-placeholder" class:grsvp-res-placeholder--dim={!rsvpFullyComplete}>
						<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
							<polyline points="9 22 9 12 15 12 15 22" />
						</svg>
					</div>
				{/if}
			</div>
			<div class="grsvp-res-body">
				<p class="grsvp-res-label">Your stay</p>
				<p class="grsvp-res-room">{roomDisplay}</p>
				<p class="grsvp-res-bed">
					<span class="grsvp-res-bed-k">Bed</span>
					<span class="grsvp-res-bed-v">{bedDisplay}</span>
				</p>
				{#if partyLine}
					<p class="grsvp-res-party">
						<span class="grsvp-res-bed-k">Party size</span>
						<span class="grsvp-res-bed-v">{partyLine}</span>
					</p>
				{:else if rsvpFullyComplete}
					<p class="grsvp-res-party">
						<span class="grsvp-res-bed-k">Party size</span>
						<span class="grsvp-res-bed-v">—</span>
					</p>
				{:else}
					<p class="grsvp-res-party">
						<span class="grsvp-res-bed-k">Party size</span>
						<span class="grsvp-res-bed-v">Add when you RSVP</span>
					</p>
				{/if}
			</div>
		</section>

		<!-- Compact detail chips -->
		<div class="grsvp-chips" aria-label="RSVP details">
			<span class="grsvp-chip">
				<span class="grsvp-chip-k">Party</span>{partyLine ?? (rsvpFullyComplete ? '—' : 'Add when you RSVP')}
			</span>
			<span class="grsvp-chip"><span class="grsvp-chip-k">Room</span>{roomDisplay}</span>
			<span class="grsvp-chip"><span class="grsvp-chip-k">Bed</span>{bedDisplay}</span>
		</div>

		{#if costSharingEnabled && totalGuestPrice != null && rsvpFullyComplete}
			<p class="grsvp-estimate">
				<span class="grsvp-estimate-k">Current estimate</span>
				<span class="grsvp-estimate-v">${totalGuestPrice.toFixed(2)}</span>
				{#if platformFeePerPerson > 0}
					<span class="grsvp-estimate-note">
						Includes ${platformFeePerPerson.toFixed(2)} Divvi fee
						{#if userReservationPrice != null}
							· ${userReservationPrice.toFixed(2)} trip share
						{/if}
					</span>
				{:else}
					<span class="grsvp-estimate-note">May change slightly as the guest list fills in.</span>
				{/if}
			</p>
		{/if}

		<!-- Next step / reassurance -->
		{#if rsvpFullyComplete}
			<div class="grsvp-footnote grsvp-footnote--ok" role="status">
				Your room and bed are reserved. You’re all set for this trip.
			</div>
		{:else}
			<div class="grsvp-footnote" role="status">
				Choose your room and bed to finish your RSVP — it only takes a minute.
			</div>
		{/if}

		<div class="grsvp-actions">
			{#if rsvpFullyComplete}
				<a href={rsvpEditHref} class="cta-btn cta-primary">Edit my RSVP</a>
			{:else}
				<a href={rsvpEditHref} class="cta-btn cta-primary">{incompletePrimaryLabel}</a>
				<a href={roomsBrowseHref} class="grsvp-secondary-link">View room options</a>
			{/if}
		</div>
	{/if}
</div>

<style>
	.grsvp {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
		color: rgba(255, 255, 255, 0.94);
	}

	.grsvp-header {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		align-items: start;
		gap: 0.35rem 0.5rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.14);
	}

	.grsvp-header-text {
		grid-column: 1;
		min-width: 0;
	}

	.grsvp-title {
		margin: 0 0 0.2rem;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.55);
	}

	.grsvp-statusline {
		margin: 0;
		font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
		font-size: 1.125rem;
		font-weight: 650;
		line-height: 1.25;
		letter-spacing: -0.02em;
		color: #fff;
	}

	.grsvp-subline {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.78);
		font-weight: 450;
	}

	.grsvp-pill {
		grid-column: 2;
		grid-row: 1;
		align-self: start;
		font-size: 0.625rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
		background: rgba(255, 255, 255, 0.16);
		border: 1px solid rgba(255, 255, 255, 0.28);
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		white-space: nowrap;
		line-height: 1.2;
	}

	.grsvp-confirm-icon {
		grid-column: 2;
		grid-row: 2;
		justify-self: end;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.14);
		border: 1px solid rgba(255, 255, 255, 0.22);
		color: rgba(186, 240, 220, 0.95);
	}

	.grsvp-confirm-icon svg {
		width: 15px;
		height: 15px;
	}

	/* Inset reservation module */
	.grsvp-reservation {
		display: grid;
		grid-template-columns: 4.25rem 1fr;
		gap: 0.75rem;
		align-items: center;
		padding: 0.65rem 0.7rem;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.12);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.grsvp-res-thumb {
		width: 4.25rem;
		height: 4.25rem;
		border-radius: 10px;
		overflow: hidden;
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.grsvp-res-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.grsvp-res-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.45);
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
	}

	.grsvp-res-placeholder--dim {
		color: rgba(255, 255, 255, 0.35);
	}

	.grsvp-res-body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.grsvp-res-label {
		margin: 0;
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255, 255, 255, 0.5);
	}

	.grsvp-res-room {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 650;
		line-height: 1.25;
		color: #fff;
	}

	.grsvp-res-bed,
	.grsvp-res-party {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.35;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: baseline;
	}

	.grsvp-res-bed-k,
	.grsvp-chip-k {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(255, 255, 255, 0.48);
		margin-right: 0.15rem;
	}

	.grsvp-res-bed-v {
		color: rgba(255, 255, 255, 0.92);
		font-weight: 500;
	}

	.grsvp-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.grsvp-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.92);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.grsvp-estimate {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.72);
	}

	.grsvp-estimate-k {
		display: block;
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: rgba(255, 255, 255, 0.45);
		margin-bottom: 0.1rem;
	}

	.grsvp-estimate-v {
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
		margin-right: 0.35rem;
	}

	.grsvp-estimate-note {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.58);
	}

	.grsvp-footnote {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.78);
		padding: 0.5rem 0.65rem;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.grsvp-footnote--ok {
		color: rgba(230, 250, 245, 0.92);
		background: rgba(122, 206, 211, 0.1);
		border-color: rgba(122, 206, 211, 0.22);
	}

	.grsvp-panel {
		padding: 0.65rem 0.75rem;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(0, 0, 0, 0.1);
	}

	.grsvp-panel--muted {
		background: rgba(0, 0, 0, 0.08);
	}

	.grsvp-panel-copy {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.75);
	}

	.grsvp-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 0.25rem;
	}

	.grsvp-secondary-link {
		align-self: center;
		font-size: 0.8125rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.82);
		text-decoration: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.25);
		padding-bottom: 1px;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.grsvp-secondary-link:hover {
		color: #fff;
		border-color: rgba(255, 255, 255, 0.5);
	}

	/* CTAs — class names kept for TripDashboardGrid :global(...) overrides on teal card */
	.cta-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
		width: 100%;
		box-sizing: border-box;
	}

	.cta-btn svg {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
	}

	.cta-primary {
		background: var(--copper, #bf4e30);
		color: white;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
	}

	.cta-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
	}

	.cta-ghost {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.28);
	}

	.cta-ghost:hover {
		background: rgba(255, 255, 255, 0.14);
		border-color: rgba(255, 255, 255, 0.4);
	}
</style>
