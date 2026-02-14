<script lang="ts">
	/**
	 * Guest-only: summary of the current user's RSVP — current price, headcount, room/bed choices, and link to edit.
	 * Single card format: uses room photo when available, or a polished no-photo header so the card always looks good.
	 */
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
	}

	let { tripId, userRsvp, myAssignments, userReservationPrice }: Props = $props();

	const peopleCount = $derived((userRsvp?.adultsCount ?? 0) + (userRsvp?.kidsCount ?? 0));
	const hasAccepted = $derived(userRsvp?.status === 'yes');
	const rsvpEditHref = $derived(`/trips/${tripId}/rsvp`);

	const heroPhotoUrl = $derived.by(() => {
		for (const a of myAssignments) {
			const urls = a.room?.photoUrls;
			if (urls?.length) return urls[0];
		}
		return null;
	});

	const roomBedItems = $derived(
		myAssignments.map((a) => {
			const roomName = a.room?.name?.trim() || 'Room';
			const bedLabel = a.bed?.bedType?.trim();
			return { line: bedLabel ? `${roomName} – ${bedLabel}` : roomName, roomName };
		})
	);

	// Header label: room name when no photo, or "Your room" when there is a photo
	const headerLabel = $derived(
		roomBedItems.length > 0 ? roomBedItems[0].roomName : 'Your RSVP'
	);
</script>

<div class="card">
	<!-- Top section: same height with or without photo -->
	<div class="card-head" class:has-photo={!!heroPhotoUrl}>
		{#if heroPhotoUrl}
			<img src={heroPhotoUrl} alt="" class="card-head-img" />
			<div class="card-head-shade"></div>
		{:else}
			<div class="card-head-no-photo">
				<svg class="card-head-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M2 4v16"/>
					<path d="M2 8h20a2 2 0 0 1 2 2v10"/>
					<path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>
					<rect x="6" y="12" width="8" height="4"/>
				</svg>
				<span class="card-head-text">{headerLabel}</span>
			</div>
		{/if}
		<span class="card-head-label">{heroPhotoUrl ? 'Your room' : (roomBedItems.length > 0 ? headerLabel : 'Your RSVP')}</span>
	</div>

	<div class="card-body">
		{#if userReservationPrice != null}
			<div class="block price-block">
				<span class="block-label">Current price</span>
				<span class="price-value">${userReservationPrice.toFixed(2)}</span>
				<p class="block-note">This estimate may change as more people RSVP.</p>
			</div>
		{:else}
			<p class="block-note price-unset">Price will appear after you select a room and bed.</p>
		{/if}

		{#if hasAccepted && peopleCount > 0}
			<div class="block">
				<span class="block-label">Party size</span>
				<span class="block-value">{peopleCount} {peopleCount === 1 ? 'person' : 'people'}</span>
				<span class="block-detail">
					({userRsvp?.adultsCount ?? 0} adult{(userRsvp?.adultsCount ?? 0) === 1 ? '' : 's'}
					{#if (userRsvp?.kidsCount ?? 0) > 0}
						, {userRsvp?.kidsCount} kid{(userRsvp?.kidsCount ?? 0) === 1 ? '' : 's'}
					{/if})
				</span>
			</div>
		{/if}

		{#if roomBedItems.length > 0}
			<div class="block">
				<span class="block-label">Room & bed</span>
				<ul class="room-list">
					{#each roomBedItems as { line }}
						<li>{line}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<a href={rsvpEditHref} class="card-cta">Edit your RSVP</a>
	</div>
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		overflow: hidden;
		background: var(--surface, #fff);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
		border: 1px solid var(--border-soft, rgba(0, 0, 0, 0.06));
		font-size: 0.875rem;
	}

	/* ----- Header: fixed height, photo or no-photo ----- */
	.card-head {
		position: relative;
		height: 112px;
		min-height: 112px;
		display: flex;
		align-items: flex-end;
		padding: 0 1rem 0.75rem;
		overflow: hidden;
		background: linear-gradient(165deg, #e8e6e3 0%, #d4d1cc 100%);
	}

	.card-head.has-photo {
		background: #e0e0e0;
	}

	.card-head-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-head-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.1) 45%, transparent 70%);
		pointer-events: none;
	}

	.card-head-no-photo {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.card-head-icon {
		opacity: 0.5;
		color: #6b635b;
	}

	.card-head-text {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #5c534a;
		text-align: center;
		max-width: 85%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-head-label {
		position: relative;
		z-index: 1;
		font-size: 0.8125rem;
		font-weight: 600;
		color: white;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}

	.card-head:not(.has-photo) .card-head-label {
		color: #5c534a;
		text-shadow: none;
	}

	/* ----- Body ----- */
	.card-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.25rem 1.5rem;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.block-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted, #6b7280);
	}

	.block-value,
	.price-value {
		font-weight: 600;
		color: var(--text, #111827);
	}

	.price-value {
		font-size: 1.375rem;
		line-height: 1.2;
	}

	.block-detail,
	.block-note {
		font-size: 0.8125rem;
		color: var(--muted, #6b7280);
		line-height: 1.4;
		margin: 0;
	}

	.price-unset {
		margin: 0;
	}

	.room-list {
		margin: 0;
		padding-left: 1.15rem;
		line-height: 1.5;
		color: var(--text, #111827);
	}

	.room-list li {
		margin: 0.15em 0;
	}

	.card-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.25rem;
		padding: 0.625rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		background: var(--primary, #6366f1);
		color: white;
		transition: background 0.2s ease, transform 0.15s ease;
		width: 100%;
		box-sizing: border-box;
	}

	.card-cta:hover {
		background: var(--primaryHover, #4f46e5);
		transform: translateY(-1px);
	}
</style>
