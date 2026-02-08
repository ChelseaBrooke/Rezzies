<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { GuestRow } from './+page.server';
	import pokeIcon from '$lib/assets/images/poke.png';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

	let { data }: { data: PageData } = $props();

	let inviteOpen = $state(false);
	let inviteName = $state('');
	let inviteEmail = $state('');
	let inviteRole = $state<'guest' | 'co-host'>('guest');
	let inviteError = $state('');
	let searchQuery = $state('');
	let filterRsvp = $state<'all' | 'yes' | 'no' | 'no-response'>('all');
	let filterAssignment = $state<'all' | 'assigned' | 'unassigned'>('all');
	let filterDietary = $state<'all' | 'has-flags'>('all');
	let sortBy = $state<'name' | 'rsvp' | 'party-size'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let removeTarget = $state<GuestRow | null>(null);
	let copyToast = $state(false);
	let nudgeToast = $state(false);
	let roomSaveError = $state<string | null>(null);
	/** Per-user room id for dropdown display. Seeded once from server; only we update it on user action. */
	let displayRoomIdByUserId = $state<Record<string, number | null>>({});
	$effect(() => {
		if (typeof window === 'undefined') return;
		const rows = data.guestRows ?? [];
		if (rows.length === 0 || Object.keys(displayRoomIdByUserId).length > 0) return;
		const next: Record<string, number | null> = {};
		for (const r of rows) {
			if (r.userId != null) next[r.userId] = r.roomId ?? null;
		}
		displayRoomIdByUserId = next;
	});

	const inviteLink = $derived(
		typeof window !== 'undefined' && data.trip?.inviteCode
			? `${window.location.origin}/trip/${data.trip.inviteCode}`
			: ''
	);

	function openInvite() {
		inviteOpen = true;
		inviteError = '';
	}
	function closeInvite() {
		inviteOpen = false;
		inviteName = '';
		inviteEmail = '';
		inviteRole = 'guest';
		inviteError = '';
	}
	function handleInviteSubmit() {
		return async ({ result }: { result: { type: string; data?: { createInviteError?: string; createInviteSuccess?: boolean } } }) => {
			if (result.type === 'success' && result.data?.createInviteError) {
				inviteError = result.data.createInviteError;
				return;
			}
			if (result.type === 'success' && result.data?.createInviteSuccess) {
				closeInvite();
				await invalidateAll();
			}
		};
	}

	function formatRsvpUpdated(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
		if (diffDays === 0) return 'updated today';
		if (diffDays === 1) return 'updated 1d ago';
		if (diffDays < 7) return `updated ${diffDays}d ago`;
		if (diffDays < 30) return `updated ${Math.floor(diffDays / 7)}w ago`;
		return d.toLocaleDateString();
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function initials(name: string, email: string): string {
		if (name && name !== '—') {
			const parts = name.trim().split(/\s+/);
			return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
		}
		return email ? email.slice(0, 2).toUpperCase() : '?';
	}

	/** Room label for display when roomName can be empty in DB */
	function roomLabel(row: GuestRow): string {
		if (row.roomName?.trim()) return row.roomName.trim();
		if (row.roomId == null) return '';
		const rooms = data.rooms ?? [];
		const idx = rooms.findIndex((r) => r.id === row.roomId);
		if (idx >= 0) return rooms[idx].name?.trim() || `Room ${idx + 1}`;
		return `Room ${row.roomId}`;
	}

	/** Display value for room dropdown: local state if set, else server row.roomId. */
	function roomDisplayValue(row: GuestRow): number | null {
		if (row.userId == null) return row.roomId ?? null;
		if (displayRoomIdByUserId[row.userId] !== undefined) return displayRoomIdByUserId[row.userId];
		return row.roomId ?? null;
	}

	/** Value for the room select: must match an option (room id in data.rooms) or '' for "Choose Room". */
	function roomSelectValue(row: GuestRow): string {
		const rooms = data.rooms ?? [];
		const displayVal = roomDisplayValue(row);
		if (displayVal == null) return '';
		const exists = rooms.some((r) => r.id === displayVal);
		return exists ? String(displayVal) : '';
	}

	const rsvpVisual = $derived.by(() => {
		const total = data.summary?.totalInvited ?? 0;
		const going = data.summary?.goingCount ?? 0;
		const notGoing = data.summary?.notGoingCount ?? 0;
		const unresponded = data.summary?.unrespondedCount ?? 0;
		return { total, going, notGoing, unresponded };
	});

	const filteredAndSorted = $derived.by(() => {
		let rows = [...(data.guestRows ?? [])];
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			rows = rows.filter(
				(r) =>
					r.name.toLowerCase().includes(q) ||
					r.email.toLowerCase().includes(q)
			);
		}
		if (filterRsvp === 'yes') rows = rows.filter((r) => r.rsvpStatus === 'yes');
		else if (filterRsvp === 'no') rows = rows.filter((r) => r.rsvpStatus === 'no');
		else if (filterRsvp === 'no-response') rows = rows.filter((r) => r.rsvpStatus !== 'yes' && r.rsvpStatus !== 'no');
		if (filterAssignment === 'assigned') rows = rows.filter((r) => r.roomName != null);
		else if (filterAssignment === 'unassigned') rows = rows.filter((r) => r.type === 'member' && r.roomName == null);
		if (filterDietary === 'has-flags') rows = rows.filter((r) => r.hasDietaryFlags);
		if (sortBy === 'name') rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
		else if (sortBy === 'rsvp') {
			const order = { yes: 0, maybe: 1, no: 2, null: 3 };
			rows.sort((a, b) => (order[a.rsvpStatus ?? 'null'] ?? 3) - (order[b.rsvpStatus ?? 'null'] ?? 3));
		} else if (sortBy === 'party-size') rows.sort((a, b) => a.partySize - b.partySize);
		if (sortDir === 'desc') rows.reverse();
		return rows;
	});

	function toggleSort(column: 'name' | 'rsvp' | 'party-size') {
		if (sortBy === column) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortBy = column;
			sortDir = column === 'party-size' ? 'desc' : 'asc';
		}
	}

	async function copyInviteLink() {
		if (!inviteLink) return;
		try {
			await navigator.clipboard.writeText(inviteLink);
			copyToast = true;
			setTimeout(() => (copyToast = false), 2000);
		} catch (_) {}
	}

	function exportCsv() {
		const headers = ['Name', 'Email', 'RSVP', 'Party size', 'Room', 'Bed', 'Arrival', 'Departure', 'Dietary', 'Allergies'];
		const lines = [
			headers.join(','),
			...filteredAndSorted.map((r) =>
				[
					`"${(r.name || '').replace(/"/g, '""')}"`,
					`"${(r.email || '').replace(/"/g, '""')}"`,
					r.rsvpStatus ?? '—',
					r.partySize,
					r.roomName ?? '—',
					r.bedType ?? '—',
					r.arrivalDate ?? '—',
					r.departureDate ?? '—',
					r.dietaryRestrictions ?? '—',
					r.allergies ?? '—'
				].join(',')
			)
		];
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `guests-${data.trip?.name ?? 'trip'}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	/** Room assign/clear use form POST only (assignRoom/clearRoom actions) — no fetch, so nothing can send a stray clear. */

	/** POST to form action so RSVP/party size persist (avoids form action URL issues) */
	async function updateGuestRsvp(userId: string, rsvpStatus: string, partySize: number) {
		if (!data.trip?.id) return;
		const formData = new FormData();
		formData.set('userId', userId);
		formData.set('rsvpStatus', rsvpStatus);
		formData.set('partySize', String(partySize));
		const url = `/trips/${data.trip.id}/guests?/updateGuestRsvp`;
		const res = await fetch(url, { method: 'POST', body: formData });
		if (res.ok) {
			await invalidateAll();
		}
	}
</script>

<div class="page">
	<div class="page-header">
		<div class="header-top">
			<h1>Guests</h1>
		</div>

		<!-- RSVP visual: stacked bar -->
		{#if rsvpVisual.total > 0}
			<div class="rsvp-visual" aria-label="RSVP breakdown">
				<div class="rsvp-bar">
					{#each [
						{ key: 'going', count: rsvpVisual.going, pct: rsvpVisual.total ? (100 * rsvpVisual.going / rsvpVisual.total) : 0, class: 'segment-going', label: 'Going' },
						{ key: 'notGoing', count: rsvpVisual.notGoing, pct: rsvpVisual.total ? (100 * rsvpVisual.notGoing / rsvpVisual.total) : 0, class: 'segment-no', label: 'Not going' },
						{ key: 'unresponded', count: rsvpVisual.unresponded, pct: rsvpVisual.total ? (100 * rsvpVisual.unresponded / rsvpVisual.total) : 0, class: 'segment-pending', label: 'No response' }
					] as seg (seg.key)}
						{#if seg.count > 0}
							<span
								class="rsvp-segment {seg.class}"
								style="width: {Math.max(seg.pct, 2)}%"
								title="{seg.label}: {seg.count}"
							></span>
						{/if}
					{/each}
				</div>
				<div class="rsvp-legend">
					<span class="legend-dot segment-going"></span><span class="legend-label">Going <strong>{rsvpVisual.going}</strong></span>
					<span class="legend-dot segment-no"></span><span class="legend-label">Not going <strong>{rsvpVisual.notGoing}</strong></span>
					<span class="legend-dot segment-pending"></span><span class="legend-label">No response <strong>{rsvpVisual.unresponded}</strong></span>
					<span class="legend-total">{rsvpVisual.total} invited</span>
				</div>
			</div>
		{/if}

		<!-- Summary + Nudge all -->
		<div class="summary-bar">
			{#if (data.summary?.goingPartySize ?? 0) > (data.summary?.goingCount ?? 0)}
				<span class="summary-sub"><strong>{data.summary?.goingPartySize}</strong> total with +1s</span>
			{/if}
			{#if data.trip?.rsvpByDate}
				<span class="summary-item rsvp-by">RSVP by <strong>{new Date(data.trip.rsvpByDate).toLocaleDateString()}</strong></span>
			{/if}
		</div>
	</div>

	<!-- Toolbar: actions (right, above) then search + filters (search on right) -->
	<div class="toolbar">
		{#if data.isHost}
			<div class="toolbar-actions-row">
				<button type="button" class="btn-secondary" onclick={copyInviteLink}>Copy link</button>
				<button type="button" class="btn-primary" onclick={openInvite}>Invite</button>
				{#if copyToast}
					<span class="toast">Link copied</span>
				{/if}
				{#if nudgeToast}
					<span class="toast">Nudge sent</span>
				{/if}
			</div>
		{/if}
		<div class="filters-row">
			<div class="filter-group">
				<label>RSVP</label>
				<select bind:value={filterRsvp} class="filter-select">
					<option value="all">All</option>
					<option value="yes">Going</option>
					<option value="no">Not going</option>
					<option value="no-response">No response</option>
				</select>
			</div>
			<div class="filter-group">
				<label>Assignment</label>
				<select bind:value={filterAssignment} class="filter-select">
					<option value="all">All</option>
					<option value="assigned">Has room/bed</option>
					<option value="unassigned">Needs assignment</option>
				</select>
			</div>
			<div class="filter-group">
				<label>Dietary</label>
				<select bind:value={filterDietary} class="filter-select">
					<option value="all">All</option>
					<option value="has-flags">Has dietary flags</option>
				</select>
			</div>
			<div class="search-wrap">
				<input
					type="search"
					class="search-input"
					placeholder="Search by name…"
					bind:value={searchQuery}
				/>
			</div>
		</div>
	</div>

	<div class="card">
		{#if roomSaveError}
			<div class="room-save-error" role="alert">
				{roomSaveError}
				<button type="button" class="btn-dismiss" onclick={() => (roomSaveError = null)} aria-label="Dismiss">×</button>
			</div>
		{/if}
		{#if data.isHost && (data.summary?.unrespondedCount ?? 0) > 0}
			<div class="card-header-row">
				<form method="POST" action="?/nudgeAllPending" class="card-header-nudge-form" use:enhance={async ({ result }) => {
					if (result.type === 'success') {
						nudgeToast = true;
						await invalidateAll();
						setTimeout(() => (nudgeToast = false), 2000);
					}
				}}>
					<button type="submit" class="btn-summary-nudge">Nudge All Pending RSVPs</button>
				</form>
			</div>
		{/if}
		<div class="card-body table-wrap">
			{#if filteredAndSorted.length > 0}
				<table class="table">
					<thead>
						<tr>
							<th class="th-sortable" onclick={() => toggleSort('name')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('name')}>
								Guest {#if sortBy === 'name'}<span class="sort-icon" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th class="th-sortable" onclick={() => toggleSort('rsvp')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('rsvp')}>
								RSVP {#if sortBy === 'rsvp'}<span class="sort-icon" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th class="th-sortable" onclick={() => toggleSort('party-size')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('party-size')}>
								Party size {#if sortBy === 'party-size'}<span class="sort-icon" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th>To Pay (Total)</th>
							<th>Room / bed</th>
							{#if data.trip?.allowPartialStays}
								<th>Arrival</th>
								<th>Departure</th>
							{/if}
							{#if data.isHost}
								<th class="th-actions">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each filteredAndSorted as row}
							<tr class="row-type-{row.type}">
								<td>
									{#if row.userId}
										<ProfileTooltip userId={row.userId}>
											<button type="button" class="guest-cell guest-cell-btn" onclick={() => openProfileCard(row.userId!)}>
												{#if row.avatarUrl}
													<img src={row.avatarUrl} alt="" class="avatar-img" />
												{:else}
													<span class="avatar">{initials(row.name, row.email)}</span>
												{/if}
												<div>
													<span class="guest-name">{row.name}</span>
													<span class="guest-email">{row.email}</span>
												</div>
											</button>
										</ProfileTooltip>
									{:else}
										<div class="guest-cell">
											{#if row.avatarUrl}
												<img src={row.avatarUrl} alt="" class="avatar-img" />
											{:else}
												<span class="avatar">{initials(row.name, row.email)}</span>
											{/if}
											<div>
												<span class="guest-name">{row.name}</span>
												<span class="guest-email">{row.email}</span>
											</div>
										</div>
									{/if}
								</td>
								<td>
									{#if data.canManageGuests && row.type === 'member' && row.userId}
										<select
											class="rsvp-select status-pill status-{row.rsvpStatus ?? 'pending'}"
											value={row.rsvpStatus || 'no-response'}
											onchange={async (e) => {
												const v = (e.currentTarget as HTMLSelectElement).value;
												await updateGuestRsvp(row.userId!, v, row.partySize || 1);
											}}
										>
											<option value="yes">Going</option>
											<option value="no">Not going</option>
											<option value="maybe">Maybe</option>
											<option value="no-response">No response</option>
										</select>
										{#if row.rsvpUpdatedAt}
											<span class="updated-hint">{formatRsvpUpdated(row.rsvpUpdatedAt)}</span>
										{/if}
									{:else}
										<span class="status-pill status-{row.rsvpStatus ?? 'pending'}">
											{row.rsvpStatus === 'yes' ? 'Going' : row.rsvpStatus === 'no' ? 'Not going' : row.rsvpStatus === 'maybe' ? 'Maybe' : 'No response'}
										</span>
										{#if row.rsvpUpdatedAt}
											<span class="updated-hint">{formatRsvpUpdated(row.rsvpUpdatedAt)}</span>
										{/if}
									{/if}
								</td>
								<td>
									{#if data.canManageGuests && row.type === 'member' && row.userId}
										<input
											type="number"
											min="1"
											max="20"
											value={row.partySize || 1}
											class="party-size-input"
											onchange={async (e) => {
												const n = Math.min(20, Math.max(1, parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1));
												await updateGuestRsvp(row.userId!, row.rsvpStatus || 'no-response', n);
											}}
										/>
									{:else}
										{#if row.partySize > 0}
											{row.partySize} {row.partySize > 1 ? '(+' + (row.partySize - 1) + ')' : ''}
										{:else}
											—
										{/if}
									{/if}
								</td>
								<td>
									{#if row.toPayTotal != null && row.toPayTotal > 0}
										{formatCurrency(row.toPayTotal)}
									{:else}
										—
									{/if}
								</td>
								<td>
									{#if row.type === 'member' && data.canManageGuests}
										<form method="POST" action="?/assignRoom" class="room-cell-form" use:enhance={() => invalidateAll()}>
											<input type="hidden" name="userId" value={row.userId ?? ''} />
											<input type="hidden" name="partySize" value={row.partySize || 1} />
											<select
												class="edit-select"
												name="roomId"
												value={roomSelectValue(row)}
												onchange={(e) => {
													const v = (e.currentTarget as HTMLSelectElement).value;
													const rid = v ? parseInt(v, 10) : null;
													if (row.userId == null) return;
													if (rid != null && !Number.isNaN(rid)) {
														displayRoomIdByUserId = { ...displayRoomIdByUserId, [row.userId]: rid };
														e.currentTarget.form?.requestSubmit();
													} else {
														displayRoomIdByUserId = { ...displayRoomIdByUserId, [row.userId]: row.roomId ?? null };
													}
												}}
											>
												<option value="">Choose Room</option>
												{#each (data.rooms ?? []) as room, i}
													<option value={String(room.id)}>{room.name?.trim() || `Room ${i + 1}`}</option>
												{/each}
											</select>
										</form>
										{#if roomDisplayValue(row) != null}
											<form method="POST" action="?/clearRoom" class="clear-room-form" use:enhance={() => {
												if (row.userId != null) displayRoomIdByUserId = { ...displayRoomIdByUserId, [row.userId]: null };
												return invalidateAll();
											}}>
												<input type="hidden" name="userId" value={row.userId ?? ''} />
												<input type="hidden" name="confirmClear" value="1" />
												<button type="submit" class="btn-link clear-room">Clear</button>
											</form>
										{/if}
										{#if roomLabel(row) && row.bedType}
											<span class="bed-type-hint">({row.bedType})</span>
										{/if}
									{:else}
										{#if row.roomId != null || row.roomName}
											{roomLabel(row) || row.roomName}{row.bedType ? ` (${row.bedType})` : ''}
										{:else}
											<span class="muted">Unassigned</span>
										{/if}
									{/if}
								</td>
								{#if data.trip?.allowPartialStays}
									<td>{row.arrivalDate ?? '—'}</td>
									<td>{row.departureDate ?? '—'}</td>
								{/if}
								{#if data.isHost}
									<td class="td-actions">
										<div class="action-buttons">
											{#if row.type === 'member' && (row.rsvpStatus !== 'yes' && row.rsvpStatus !== 'no')}
												<form method="POST" action="?/nudgeUnresponded" class="inline-form" use:enhance={async ({ result }) => {
													if (result.type === 'success') {
														nudgeToast = true;
														await invalidateAll();
														setTimeout(() => (nudgeToast = false), 2000);
													}
												}}>
													<input type="hidden" name="userId" value={row.userId ?? ''} />
													<button type="submit" class="btn-icon" title="Send a reminder to respond to the RSVP" aria-label="Nudge">
														<img src={pokeIcon} alt="" width="16" height="16" class="btn-icon-img" />
													</button>
												</form>
											{/if}
											{#if row.type === 'member' && row.userId}
												<button
													type="button"
													class="btn-icon btn-remove"
													title="Remove this guest from the trip (they will lose access and must be re-invited to join again)"
													aria-label="Remove guest"
													onclick={() => (removeTarget = row)}
												>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
												</button>
											{/if}
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty">No guests match your filters. {searchQuery || filterRsvp !== 'all' || filterAssignment !== 'all' || filterDietary !== 'all' ? 'Try changing filters.' : 'Use Invite to add people.'}</p>
			{/if}
		</div>
		{#if data.isHost}
			<div class="card-footer-row">
				<button type="button" class="btn-secondary" onclick={exportCsv}>Export CSV</button>
			</div>
		{/if}
	</div>
</div>

<!-- Remove confirm -->
{#if removeTarget}
	<div class="modal-backdrop" onclick={() => (removeTarget = null)} role="presentation"></div>
	<div class="modal" role="dialog" aria-labelledby="remove-modal-title">
		<h2 id="remove-modal-title">Are you sure?</h2>
		<p><strong>Remove</strong> will remove <strong>{removeTarget?.name}</strong> from this trip. They will lose access to the trip and would need to be re-invited to join again.</p>
		<form method="POST" action="?/removeGuest" use:enhance={() => invalidateAll().then(() => (removeTarget = null))}>
			<input type="hidden" name="userId" value={removeTarget?.userId ?? ''} />
			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={() => (removeTarget = null)}>Cancel</button>
				<button type="submit" class="btn-danger">Remove guest</button>
			</div>
		</form>
	</div>
{/if}

{#if inviteOpen}
	<div class="modal-backdrop" onclick={closeInvite} role="presentation"></div>
	<div class="modal" role="dialog">
		<h2>Invite someone</h2>
		<form method="POST" action="?/createInvite" use:enhance={handleInviteSubmit}>
			{#if inviteError}
				<p class="form-error" role="alert">{inviteError}</p>
			{/if}
			<div class="form-group">
				<label for="invite-name">Name (optional)</label>
				<input id="invite-name" type="text" name="name" bind:value={inviteName} placeholder="Full name" />
			</div>
			<div class="form-group">
				<label for="invite-email">Email *</label>
				<input id="invite-email" type="email" name="email" bind:value={inviteEmail} placeholder="email@example.com" required />
			</div>
			<div class="form-group">
				<label for="invite-role">Role</label>
				<select id="invite-role" name="role" bind:value={inviteRole}>
					<option value="guest">Guest</option>
					<option value="co-host">Co-host</option>
				</select>
			</div>
			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={closeInvite}>Cancel</button>
				<button type="submit" class="btn-primary">Send invite</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.page { padding: 0; }
	.room-save-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.75rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: var(--radius-md);
		color: #b91c1c;
		font-size: 0.875rem;
	}
	.room-save-error .btn-dismiss {
		background: none;
		border: none;
		color: inherit;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.25rem;
	}
	.page-header { margin-bottom: 1rem; }
	.header-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }

	.toolbar-actions-row { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
	.search-wrap { margin-left: auto; min-width: 20rem; max-width: 42rem; flex: 1; }

	.rsvp-visual { margin-top: 1rem; margin-bottom: 0.75rem; }
	.rsvp-bar { display: flex; height: 1.5rem; border-radius: var(--radius-md); overflow: hidden; background: var(--surface2); min-width: 12rem; max-width: 28rem; }
	.rsvp-segment { display: block; min-width: 4px; transition: width 0.2s ease; }
	.rsvp-segment.segment-going { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
	.rsvp-segment.segment-no { background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); }
	.rsvp-segment.segment-pending { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); }
	.rsvp-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; margin-top: 0.5rem; font-size: 0.8125rem; color: var(--muted); }
	.legend-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; flex-shrink: 0; }
	.legend-dot.segment-going { background: #22c55e; }
	.legend-dot.segment-no { background: #94a3b8; }
	.legend-dot.segment-pending { background: #fbbf24; }
	.legend-label { color: var(--text); }
	.legend-label strong { font-weight: 600; }
	.legend-total { margin-left: 0.25rem; font-weight: 500; color: var(--text); }

	.summary-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; font-size: 0.875rem; color: var(--muted); margin-top: 0.25rem; }
	.summary-nudge-form { display: inline; }
	.btn-summary-nudge { padding: 0.25rem 0.5rem; font-size: 0.8125rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; }
	.btn-summary-nudge:hover { background: var(--focusRing); }
	.summary-item { color: var(--text); }
	.summary-item.going { color: var(--success, #166534); }
	.summary-item.not-going { color: var(--muted); }
	.summary-item.unresponded { color: var(--warning, #92400e); }
	.summary-item.rsvp-by { margin-left: auto; }
	.summary-sub { font-size: 0.8125rem; color: var(--muted); }

	.toast { font-size: 0.8125rem; color: var(--success, #166534); }

	.toolbar { margin-bottom: 1rem; }
	.filters-row { display: flex; align-items: center; gap: 1rem; overflow-x: auto; flex-wrap: wrap; }
	.filter-group { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }
	.filter-group label { font-size: 0.8125rem; color: var(--muted); white-space: nowrap; }
	.filter-select { padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; min-width: 10rem; width: 10rem; box-sizing: border-box; }
	.search-input { padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.875rem; width: 100%; }
	.th-sortable { cursor: pointer; user-select: none; }
	.th-sortable:hover { color: var(--text); }
	.sort-icon { margin-left: 0.25rem; font-size: 0.75rem; opacity: 0.8; }

	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
	.card-header-row { display: flex; justify-content: flex-end; padding: 0.35rem 1rem 0; }
	.card-header-nudge-form { display: inline; }
	.card-body { padding: 1rem; }
	.card-footer-row { display: flex; justify-content: flex-end; padding: 0.75rem 1rem 1rem; border-top: 1px solid var(--border); }
	.table-wrap { overflow-x: auto; }
	.table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.table th, .table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); vertical-align: middle; }
	.table th { font-weight: 500; color: var(--muted); }
	.table tbody tr:hover { background: var(--surface2); }
	.th-actions, .td-actions { width: 1%; white-space: nowrap; }

	.guest-cell { display: flex; align-items: center; gap: 0.75rem; }
	.guest-cell-btn { width: 100%; text-align: left; background: none; border: none; font: inherit; cursor: pointer; padding: 0; }
	.guest-cell-btn:hover { opacity: 0.9; }
	.avatar { width: 2.25rem; height: 2.25rem; border-radius: 50%; background: var(--surface2); display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: var(--text); flex-shrink: 0; }
	.avatar-img { width: 2.25rem; height: 2.25rem; border-radius: 50%; object-fit: cover; }
	.guest-name { display: block; font-weight: 500; }
	.guest-email { font-size: 0.8125rem; color: var(--muted); }

	.status-pill { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; text-transform: capitalize; }
	.status-yes { background: #dcfce7; color: #166534; }
	.status-no { background: #f3f4f6; color: #6b7280; }
	.status-maybe { background: #fef3c7; color: #92400e; }
	.status-pending, .status-null { background: #fef3c7; color: #92400e; }
	.updated-hint { display: block; font-size: 0.75rem; color: var(--muted); margin-top: 0.125rem; }

	.inline-edit { display: flex; align-items: center; gap: 0.5rem; }
	.edit-select { padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; color: black; }
	.bed-type-hint { margin-left: 0.25rem; font-size: 0.8125rem; color: var(--muted); }
	.rsvp-form, .party-size-form { display: inline-flex; align-items: center; }
	.rsvp-select { padding: 0.25rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; cursor: pointer; }
	.party-size-input { width: 3rem; padding: 0.25rem 0.35rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; }
	.edit-link { margin-left: 0.5rem; font-size: 0.8125rem; }
	.btn-link { background: none; border: none; color: var(--primary); cursor: pointer; font-size: inherit; padding: 0; text-decoration: underline; }
	.btn-link:hover { color: var(--primaryHover); }
	.action-buttons { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
	.btn-icon { display: inline-flex; align-items: center; justify-content: center; padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface2); color: var(--text); cursor: pointer; }
	.btn-icon:hover { background: var(--focusRing); }
	.btn-icon svg { display: block; }
	.btn-icon-img { display: block; object-fit: contain; }
	.btn-icon.btn-remove { border: 1px solid rgba(185, 28, 28, 0.4); color: #b91c1c; }
	.btn-icon.btn-remove:hover { background: rgba(185, 28, 28, 0.08); }
	.inline-form { display: inline; }
	.room-cell-form, .clear-room-form { display: inline; }
	.clear-room-form .clear-room { margin-left: 0.25rem; }

	.muted { color: var(--muted); }
	.empty { color: var(--muted); margin: 0; padding: 1rem 0; }

	.btn-primary { padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-md); font-weight: 500; cursor: pointer; }
	.btn-secondary { padding: 0.5rem 1rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; }
	.btn-danger { padding: 0.5rem 1rem; background: var(--error, #b91c1c); color: white; border: none; border-radius: var(--radius-md); font-weight: 500; cursor: pointer; }

	.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 27, 46, 0.3); z-index: 100; }
	.modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: var(--shadow-xl); z-index: 101; min-width: 20rem; }
	.modal h2 { margin: 0 0 0.75rem 0; font-size: 1.25rem; }
	.modal p { margin: 0 0 1rem 0; font-size: 0.875rem; }
	.form-error { color: var(--error, #b91c1c); font-size: 0.875rem; margin: 0 0 1rem 0; }
	.form-group { margin-bottom: 1rem; }
	.form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
	.form-group input, .form-group select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.875rem; }
	.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
</style>
