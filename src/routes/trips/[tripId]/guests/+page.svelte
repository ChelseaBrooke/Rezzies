<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import type { PageData } from './$types';
	import type { GuestRow, RemovedRow } from './+page.server';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import ActivityLogModal from '$lib/components/trips/dashboard/ActivityLogModal.svelte';
	import GuestEditModal from '$lib/components/trips/GuestEditModal.svelte';
	import GuestInvoiceModal from '$lib/components/trips/GuestInvoiceModal.svelte';
	import { buildTripActivityLog } from '$lib/trip-activity-log.js';
	import pokeIcon from '$lib/assets/images/poke.png';

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	let { data }: { data: PageData } = $props();

	const allActivityItems = $derived(
		buildTripActivityLog(data.trip ?? null).map((item) => ({ text: item.text, at: item.at.toISOString() }))
	);
	let showActivityLog = $state(false);

	let inviteOpen = $state(false);
	let inviteName = $state('');
	let inviteEmail = $state('');
	let inviteRole = $state<'guest' | 'co-host'>('guest');
	let inviteError = $state('');
	let addManualOpen = $state(false);
	let addManualName = $state('');
	let addManualEmail = $state('');
	let addManualDietary = $state('');
	let addManualAllergies = $state('');
	let addManualError = $state('');
	let filterRsvp = $state<'all' | 'yes' | 'no' | 'no-response' | 'reconfirm'>('all');
	let filterAssignment = $state<'all' | 'assigned' | 'unassigned'>('all');
	let filterDietary = $state<'all' | 'has-flags'>('all');
	let sortBy = $state<'name' | 'rsvp' | 'party-size'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let removeTarget = $state<GuestRow | null>(null);
	let copyToast = $state(false);
	let nudgeToast = $state(false);
	let roomSaveError = $state<string | null>(null);

	// Add Guest dropdown (Share-style hover/click)
	let addGuestOpen = $state(false);
	let addGuestTriggerEl: HTMLButtonElement | null = $state(null);
	let addGuestMenuEl: HTMLDivElement | null = $state(null);
	let addGuestMenuStyle = $state<{ top: string; left: string } | null>(null);
	const ADD_GUEST_CLOSE_DELAY_MS = 250;
	let addGuestCloseTimeoutId: ReturnType<typeof setTimeout> | null = null;
	function clearAddGuestClose() {
		if (addGuestCloseTimeoutId != null) {
			clearTimeout(addGuestCloseTimeoutId);
			addGuestCloseTimeoutId = null;
		}
	}
	function scheduleAddGuestClose() {
		clearAddGuestClose();
		addGuestCloseTimeoutId = setTimeout(() => {
			addGuestOpen = false;
			addGuestMenuStyle = null;
			addGuestCloseTimeoutId = null;
		}, ADD_GUEST_CLOSE_DELAY_MS);
	}
	function positionAddGuestMenu() {
		if (!addGuestTriggerEl) return;
		const rect = addGuestTriggerEl.getBoundingClientRect();
		addGuestMenuStyle = { top: `${rect.bottom}px`, left: `${rect.left}px` };
	}
	function openAddGuestDropdown() {
		clearAddGuestClose();
		addGuestOpen = true;
		positionAddGuestMenu();
		requestAnimationFrame(positionAddGuestMenu);
	}
	function onAddGuestMouseEnter() {
		clearAddGuestClose();
		openAddGuestDropdown();
	}
	function onAddGuestClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (addGuestOpen) {
			addGuestOpen = false;
			addGuestMenuStyle = null;
			return;
		}
		openAddGuestDropdown();
	}
	function handleAddGuestDocClick(e: MouseEvent) {
		const target = e.target as Node;
		if (addGuestOpen && addGuestTriggerEl && !addGuestTriggerEl.contains(target) && addGuestMenuEl && !addGuestMenuEl.contains(target)) {
			addGuestOpen = false;
			addGuestMenuStyle = null;
		}
	}
	let addGuestDocClickBound = false;
	function bindAddGuestDocClick() {
		if (addGuestDocClickBound) return;
		addGuestDocClickBound = true;
		document.addEventListener('click', handleAddGuestDocClick, true);
	}
	function unbindAddGuestDocClick() {
		if (!addGuestDocClickBound) return;
		addGuestDocClickBound = false;
		document.removeEventListener('click', handleAddGuestDocClick, true);
	}
	$effect(() => {
		if (addGuestOpen) bindAddGuestDocClick();
		else unbindAddGuestDocClick();
	});
	onDestroy(unbindAddGuestDocClick);
	let invoiceModalRow = $state<GuestRow | null>(null);
	let editModalRow = $state<GuestRow | null>(null);

	function clickOutside(
		node: HTMLElement,
		opts: { onOutside: () => void; active: boolean } | (() => void)
	) {
		const onOutside = typeof opts === 'function' ? opts : opts.onOutside;
		let active = typeof opts === 'function' ? true : opts.active;
		function handleClick(e: MouseEvent) {
			if (active && node && !node.contains(e.target as Node)) onOutside();
		}
		function addListener() {
			setTimeout(() => document.addEventListener('click', handleClick), 0);
		}
		if (active) addListener();
		return {
			update(newOpts: { onOutside: () => void; active: boolean } | (() => void)) {
				const newActive = typeof newOpts === 'function' ? true : newOpts.active;
				if (newActive && !active) addListener();
				else if (!newActive && active) document.removeEventListener('click', handleClick);
				active = newActive;
			},
			destroy() {
				document.removeEventListener('click', handleClick);
			}
		};
	}

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
	function openAddManual() {
		addManualOpen = true;
		addManualName = '';
		addManualEmail = '';
		addManualDietary = '';
		addManualAllergies = '';
		addManualError = '';
	}
	function closeAddManual() {
		addManualOpen = false;
		addManualName = '';
		addManualEmail = '';
		addManualDietary = '';
		addManualAllergies = '';
		addManualError = '';
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
	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString();
	}
	function triggerCsvDownload(csv: string, filename: string) {
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}

	function stateLabel(row: GuestRow): string {
		const s = row.memberTripState;
		if (!s) return row.type === 'invite' ? 'Pending' : '—';
		if (s === 'invited') return 'Invited';
		if (s === 'accepted') return 'Accepted';
		if (s === 'rsvp_yes') return 'Going';
		if (s === 'rsvp_no') return 'Not going';
		return '—';
	}

	function initials(name: string, email: string): string {
		if (name && name !== '—') {
			const parts = name.trim().split(/\s+/);
			return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
		}
		return email ? email.slice(0, 2).toUpperCase() : '?';
	}

	/** Label for assigned beds: "Room 1: King, Twin; Room 2: Queen" */
	function bedsLabel(row: GuestRow): string {
		const bedIds = row.assignedBedIds ?? [];
		if (bedIds.length === 0) return '';
		const rooms = data.rooms ?? [];
		const byRoom: Record<string, string[]> = {};
		for (const bedId of bedIds) {
			for (const room of rooms) {
				const bed = room.beds?.find((b) => b.id === bedId);
				if (bed) {
					const name = room.name?.trim() || `Room ${room.id}`;
					if (!byRoom[name]) byRoom[name] = [];
					byRoom[name].push(bed.bedType || 'bed');
					break;
				}
			}
		}
		return Object.entries(byRoom)
			.map(([roomName, types]) => `${roomName}: ${types.join(', ')}`)
			.join('; ');
	}

	const rsvpVisual = $derived.by(() => {
		const going = data.summary?.goingPartySize ?? 0;
		const notGoing = data.summary?.notGoingCount ?? 0;
		const unresponded = data.summary?.unrespondedCount ?? 0;
		const total = going + notGoing + unresponded;
		return { total, going, notGoing, unresponded };
	});

	const filteredAndSorted = $derived.by(() => {
		let rows = [...(data.guestRows ?? [])];
		if (filterRsvp === 'yes') rows = rows.filter((r) => r.rsvpStatus === 'yes');
		else if (filterRsvp === 'no') rows = rows.filter((r) => r.rsvpStatus === 'no');
		else if (filterRsvp === 'no-response') rows = rows.filter((r) => r.rsvpStatus !== 'yes' && r.rsvpStatus !== 'no');
		else if (filterRsvp === 'reconfirm') rows = rows.filter((r) => r.rsvpStatus === 'yes' && r.yesSubstatus === 'reconfirm_required');
		if (filterAssignment === 'assigned') rows = rows.filter((r) => (r.assignedBedIds?.length ?? 0) > 0);
		else if (filterAssignment === 'unassigned') rows = rows.filter((r) => r.type === 'member' && (r.assignedBedIds?.length ?? 0) === 0);
		if (filterDietary === 'has-flags') rows = rows.filter((r) => r.hasDietaryFlags);
		if (sortBy === 'name') rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
		else if (sortBy === 'rsvp') {
			const order = { yes: 0, no: 1, null: 2 };
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
		addGuestOpen = false;
		addGuestMenuStyle = null;
	}
	function closeAddGuestDropdown() {
		addGuestOpen = false;
		addGuestMenuStyle = null;
	}

	/** Half-donut segment path (semicircle, 0% = left, 100% = right). Top arc visible in viewBox. */
	function halfDonutSegmentPath(cx: number, cy: number, rOuter: number, rInner: number, startPct: number, endPct: number): string {
		const toRad = (d: number) => (d * Math.PI) / 180;
		const x = (r: number, deg: number) => cx + r * Math.cos(toRad(deg));
		const y = (r: number, deg: number) => cy - r * Math.sin(toRad(deg));
		const startDeg = 180 - (endPct / 100) * 180;
		const endDeg = 180 - (startPct / 100) * 180;
		const sweep = endDeg - startDeg;
		const largeArc = sweep >= 180 ? 1 : 0;
		return `M ${x(rInner, startDeg)} ${y(rInner, startDeg)} L ${x(rOuter, startDeg)} ${y(rOuter, startDeg)} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${x(rOuter, endDeg)} ${y(rOuter, endDeg)} L ${x(rInner, endDeg)} ${y(rInner, endDeg)} A ${rInner} ${rInner} 0 ${largeArc} 1 ${x(rInner, startDeg)} ${y(rInner, startDeg)} Z`;
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

</script>

<div class="page">
	<div class="page-header">
		<div class="header-top">
			<h1>Guests</h1>
		</div>

		<!-- RSVP visual: donut chart -->
		{#if rsvpVisual.total > 0}
			{@const segments = [
				{ key: 'going', count: rsvpVisual.going, pct: rsvpVisual.total ? (100 * rsvpVisual.going / rsvpVisual.total) : 0, class: 'segment-going', label: 'Going' },
				{ key: 'notGoing', count: rsvpVisual.notGoing, pct: rsvpVisual.total ? (100 * rsvpVisual.notGoing / rsvpVisual.total) : 0, class: 'segment-no', label: 'Not going' },
				{ key: 'unresponded', count: rsvpVisual.unresponded, pct: rsvpVisual.total ? (100 * rsvpVisual.unresponded / rsvpVisual.total) : 0, class: 'segment-pending', label: 'No response' }
			]}
			{@const filteredSegs = segments.filter((s) => s.count > 0)}
			<div class="rsvp-visual" aria-label="RSVP breakdown">
				<div class="rsvp-pie-wrap">
					<svg class="rsvp-half-donut" viewBox="0 0 64 40" role="img" aria-label="RSVP breakdown">
						{#each filteredSegs as seg, i}
							{@const startPct = filteredSegs.slice(0, i).reduce((sum, s) => sum + s.pct, 0)}
							{@const endPct = startPct + seg.pct}
							<path
								class="rsvp-segment {seg.class}"
								d={halfDonutSegmentPath(32, 40, 32, 14, startPct, endPct)}
								title="{seg.label}: {seg.count}"
							/>
						{/each}
					</svg>
				</div>
				<div class="rsvp-legend">
					<span class="legend-dot segment-going"></span><span class="legend-label">Going <strong>{rsvpVisual.going}</strong></span>
					<span class="legend-dot segment-no"></span><span class="legend-label">Not going <strong>{rsvpVisual.notGoing}</strong></span>
					<span class="legend-dot segment-pending"></span><span class="legend-label">No response <strong>{rsvpVisual.unresponded}</strong></span>
					<span class="legend-total">{rsvpVisual.total} total</span>
				</div>
			</div>
		{/if}

		<!-- Summary + Nudge all -->
		<div class="summary-bar">
			{#if data.trip?.rsvpByDate}
				<span class="summary-item rsvp-by">RSVP by <strong>{new Date(data.trip.rsvpByDate).toLocaleDateString()}</strong></span>
			{/if}
		</div>
	</div>

	<div class="card">
		<div class="controls-row">
			<div class="filters-left">
				<select bind:value={filterRsvp} class="control-select" aria-label="Filter by RSVP">
					<option value="all">All RSVP</option>
					<option value="yes">Going</option>
					<option value="no">Not going</option>
					<option value="no-response">No response</option>
					<option value="reconfirm">Needs reconfirmation</option>
				</select>
				<select bind:value={filterAssignment} class="control-select" aria-label="Filter by assignment">
					<option value="all">All assignments</option>
					<option value="assigned">Has room/bed</option>
					<option value="unassigned">Needs assignment</option>
				</select>
				<select bind:value={filterDietary} class="control-select" aria-label="Filter by dietary">
					<option value="all">All dietary</option>
					<option value="has-flags">Has dietary flags</option>
				</select>
			</div>
			<div class="actions-right">
				{#if data.canManageGuests}
					<button type="button" class="btn-secondary-header" onclick={() => (showActivityLog = true)}>Recent activity</button>
					<div class="add-guest-dropdown-wrap">
						<button
							type="button"
							class="btn-primary-invite add-guest-trigger"
							title="Add guest"
							bind:this={addGuestTriggerEl}
							onmouseenter={onAddGuestMouseEnter}
							onmouseleave={scheduleAddGuestClose}
							onclick={onAddGuestClick}
							aria-expanded={addGuestOpen}
							aria-haspopup="menu"
						>
							<span class="add-guest-content">+ Add Guest</span>
						</button>
						{#if addGuestOpen}
							<div use:portal class="add-guest-portal" role="presentation">
								<div
									class="add-guest-backdrop"
									aria-hidden="true"
									onclick={closeAddGuestDropdown}
									role="button"
									tabindex="-1"
								></div>
								<div
									bind:this={addGuestMenuEl}
									class="add-guest-menu"
									role="menu"
									style={addGuestMenuStyle ? `top: ${addGuestMenuStyle.top}; left: ${addGuestMenuStyle.left};` : ''}
									onmouseenter={clearAddGuestClose}
									onmouseleave={scheduleAddGuestClose}
								>
									<button type="button" class="add-guest-item" role="menuitem" onclick={() => { openInvite(); closeAddGuestDropdown(); }}>Invite</button>
									<button type="button" class="add-guest-item" role="menuitem" onclick={() => { copyInviteLink(); }}>Copy link</button>
									{#if data.isHost}
										<button type="button" class="add-guest-item" role="menuitem" onclick={() => { openAddManual(); closeAddGuestDropdown(); }}>Add manual</button>
									{/if}
								</div>
							</div>
						{/if}
					</div>
					{#if copyToast}
						<span class="toast">Link copied</span>
					{/if}
					{#if nudgeToast}
						<span class="toast">Nudge sent</span>
					{/if}
				{/if}
			</div>
		</div>
		{#if roomSaveError}
			<div class="room-save-error" role="alert">
				{roomSaveError}
				<button type="button" class="btn-dismiss" onclick={() => (roomSaveError = null)} aria-label="Dismiss">×</button>
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
							<th colspan="3" class="th-section">RSVP</th>
							<th colspan="3" class="th-section">Payments</th>
							{#if data.trip?.allowPartialStays}
								<th>Arrival</th>
								<th>Departure</th>
							{/if}
							{#if data.canManageGuests}
								<th class="th-actions">Actions</th>
							{/if}
						</tr>
						<tr class="subheader-row">
							<th></th>
							<th class="th-sub th-sortable" onclick={() => toggleSort('rsvp')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('rsvp')}>
								Status {#if sortBy === 'rsvp'}<span class="sort-icon" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th class="th-sub th-sortable" onclick={() => toggleSort('party-size')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('party-size')}>
								Party size {#if sortBy === 'party-size'}<span class="sort-icon" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th class="th-sub">Room / bed</th>
							<th class="th-sub">To Pay (Total)</th>
							<th class="th-sub">Approved</th>
							<th class="th-sub">Paid</th>
							{#if data.trip?.allowPartialStays}
								<th></th>
								<th></th>
							{/if}
							{#if data.canManageGuests}
								<th></th>
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
									<span class="status-pill status-{row.rsvpStatus ?? 'pending'}">
										{row.rsvpStatus === 'yes'
											? (row.yesSubstatus === 'confirmed' ? 'Going (Confirmed)' : 'Going (Reconfirm required)')
											: row.rsvpStatus === 'no'
												? 'Not going'
													: 'No response'}
									</span>
									{#if row.rsvpStatus === 'yes' && row.yesSubstatus !== 'confirmed' && row.reconfirmDeadlineAt}
										<span class="updated-hint">By {new Date(row.reconfirmDeadlineAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
									{:else if row.rsvpUpdatedAt}
										<span class="updated-hint">{formatRsvpUpdated(row.rsvpUpdatedAt)}</span>
									{/if}
								</td>
								<td>
									{#if row.partySize > 0}
										{row.partySize} {row.partySize > 1 ? '(+' + (row.partySize - 1) + ')' : ''}
									{:else}
										—
									{/if}
								</td>
								<td>
									{#if (row.assignedBedIds?.length ?? 0) > 0}
										{bedsLabel(row)}
									{:else}
										<span class="muted">No beds selected</span>
									{/if}
								</td>
								<td>
									{#if row.toPayTotal != null && row.toPayTotal > 0}
										{#if data.canManageGuests && row.userId}
											<button
												type="button"
												class="to-pay-btn"
												onclick={() => (invoiceModalRow = row)}
												title="View invoice"
											>
												{formatCurrency(row.toPayTotal)}
											</button>
										{:else}
											{formatCurrency(row.toPayTotal)}
										{/if}
									{:else}
										—
									{/if}
								</td>
								<td class="approved-cell">
									{#if row.type === 'member' && row.userId && (row.rsvpStatus === 'yes' || row.priceApproved != null)}
										{#if row.priceApproved}
											<span class="check" aria-hidden="true">✓</span>
										{:else}
											<span class="cross" aria-hidden="true">✗</span>
										{/if}
									{:else}
										—
									{/if}
								</td>
								<td class="paid-cell">
									{#if row.type === 'member' && row.userId && (row.toPayTotal != null || row.invoicePaid)}
										{#if row.invoicePaid}
											<span class="check" aria-hidden="true">✓</span>
										{:else}
											<span class="cross" aria-hidden="true">✗</span>
										{/if}
									{:else}
										—
									{/if}
								</td>
								{#if data.trip?.allowPartialStays}
									<td>{row.arrivalDate ?? '—'}</td>
									<td>{row.departureDate ?? '—'}</td>
								{/if}
								{#if data.canManageGuests}
									<td class="td-actions">
										<div class="action-buttons">
											{#if row.type === 'member' && row.userId}
												<button
													type="button"
													class="btn-icon btn-edit"
													title="Edit guest"
													aria-label="Edit guest"
													onclick={() => (editModalRow = row)}
												>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
												</button>
											{/if}
											{#if row.type === 'member' && row.userId && row.userId !== data.user?.id}
												<a href="/messages?with={row.userId}" class="btn-icon btn-message" title="Message {row.name || row.email}" aria-label="Message">
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
												</a>
											{/if}
											{#if row.type === 'member' && row.userId && row.role !== 'host'}
												{@const nudgeDisabled = (row.rsvpStatus === 'yes' && row.priceApproved) || row.rsvpStatus === 'no'}
												<form method="POST" action="?/nudgeUnresponded" class="inline-form" use:enhance={async ({ result }) => {
													if (result.type === 'success') {
														nudgeToast = true;
														await invalidateAll();
														setTimeout(() => (nudgeToast = false), 2000);
													}
												}}>
													<input type="hidden" name="userId" value={row.userId ?? ''} />
													<button type="submit" class="btn-icon btn-nudge" class:btn-nudge-disabled={nudgeDisabled} disabled={nudgeDisabled} title={nudgeDisabled ? 'RSVP and cost approved' : 'Send a reminder to respond to the RSVP'} aria-label="Nudge">
														<img src={pokeIcon} alt="" width="20" height="20" class="btn-icon-img nudge-icon-img" />
													</button>
												</form>
											{/if}
											{#if row.type === 'member' && row.userId && row.role !== 'host'}
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
				<p class="empty">No guests match your filters. {filterRsvp !== 'all' || filterAssignment !== 'all' || filterDietary !== 'all' ? 'Try changing filters.' : 'Use Add Guest to add people.'}</p>
			{/if}
		</div>
		<div class="card-footer-row card-footer-export">
			<button type="button" class="btn-export" onclick={exportCsv}>Export All Data</button>
		</div>
	</div>

	{#if data.canManageGuests && ((data.legacyReservations?.length ?? 0) > 0 || (data.legacyStats?.totalReservations ?? 0) > 0)}
		<div class="card legacy-card">
			<div class="card-body">
				<div class="legacy-header">
					<div>
						<h3 class="section-title">Legacy bookings</h3>
						<p class="legacy-hint">Bookings from the public trip link (before the RSVP flow). Read-only.</p>
					</div>
					{#if (data.legacyReservations?.length ?? 0) > 0}
						<form
							method="POST"
							action="?/exportLegacyBookings"
							use:enhance={async ({ result }) => {
								if (result.type === 'success' && result.data?.exportLegacyCsv) {
									triggerCsvDownload(result.data.exportLegacyCsv, result.data.exportLegacyFilename ?? 'legacy_bookings.csv');
									await invalidateAll();
								}
							}}
						>
							<button type="submit" class="btn-secondary btn-small">Export CSV</button>
						</form>
					{/if}
				</div>
				{#if data.legacyStats && data.legacyStats.totalReservations > 0}
					<div class="legacy-stats">
						<span class="legacy-stat">Reservations: <strong>{data.legacyStats.totalReservations}</strong></span>
						<span class="legacy-stat">Revenue: <strong>${data.legacyStats.totalRevenue.toFixed(2)}</strong></span>
						<span class="legacy-stat">Nights: <strong>{data.legacyStats.totalNights}</strong></span>
						<span class="legacy-stat">Avg: <strong>${data.legacyStats.averagePrice.toFixed(2)}</strong></span>
					</div>
				{/if}
				{#if (data.legacyReservations?.length ?? 0) === 0}
					<p class="empty">No legacy bookings for this trip.</p>
				{:else}
					<div class="table-wrap">
						<table class="legacy-table">
							<thead>
								<tr>
									<th>Name</th>
									<th>Email</th>
									<th>Room</th>
									<th>Bed</th>
									<th>Check-in</th>
									<th>Check-out</th>
									<th>Nights</th>
									<th>Guests</th>
									<th>Total</th>
									<th>Submitted</th>
								</tr>
							</thead>
							<tbody>
								{#each data.legacyReservations ?? [] as r}
									<tr>
										<td>{r.name}</td>
										<td>{r.email}</td>
										<td>{r.roomName}</td>
										<td>{r.bedType ? r.bedType.toUpperCase() : '—'}</td>
										<td>{formatDate(r.checkInDate)}</td>
										<td>{formatDate(r.checkOutDate)}</td>
										<td>{r.nights}</td>
										<td>{r.numberOfGuests}</td>
										<td>${r.calculatedPrice.toFixed(2)}</td>
										<td>{formatDate(r.submittedAt)}</td>
									</tr>
								{/each}
							</tbody>
							{#if data.legacyStats && data.legacyStats.totalReservations > 0}
								<tfoot>
									<tr class="total-row">
										<td colspan="8"><strong>Total</strong></td>
										<td><strong>${data.legacyStats.totalRevenue.toFixed(2)}</strong></td>
										<td></td>
									</tr>
								</tfoot>
							{/if}
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if data.canManageGuests && (data.removedRows?.length ?? 0) > 0}
		<div class="card removed-section">
			<h3 class="removed-section-title">Removed from trip</h3>
			<p class="removed-section-hint">These people were removed by a host. They no longer have access. You can restore them to the guest list.</p>
			<ul class="removed-list">
				{#each data.removedRows as removed (removed.userId)}
					<li class="removed-item">
						<span class="removed-name">{removed.name}</span>
						<span class="removed-email">{removed.email}</span>
						{#if removed.role === 'co-host'}<span class="removed-role">Co-host</span>{/if}
						<form method="POST" action="?/restoreGuest" class="inline-form" use:enhance={() => invalidateAll()}>
							<input type="hidden" name="userId" value={removed.userId} />
							<button type="submit" class="btn-secondary btn-small">Restore</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
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

<!-- Add guest manually modal -->
{#if addManualOpen}
	<div class="modal-backdrop" onclick={closeAddManual} role="presentation"></div>
	<div class="modal" role="dialog" aria-labelledby="add-manual-title">
		<h2 id="add-manual-title">Add guest manually</h2>
		<p class="modal-hint">For someone who doesn't go online much. They'll appear on the guest list so you can assign a room, set RSVP, and account for their cost.</p>
		<form method="POST" action="?/addManualGuest" use:enhance={async ({ result }) => {
			if (result.type === 'success' && result.data?.addManualGuestSuccess) {
				closeAddManual();
				await invalidateAll();
			}
			if (result.type === 'failure' && result.data?.addManualGuestError) {
				addManualError = result.data.addManualGuestError;
			}
		}}>
			{#if addManualError}
				<p class="form-error">{addManualError}</p>
			{/if}
			<div class="form-group">
				<label for="add-manual-name">Name *</label>
				<input id="add-manual-name" type="text" name="name" bind:value={addManualName} placeholder="e.g. Jane Smith" required />
			</div>
		<div class="form-group">
			<label for="add-manual-email">Email (optional)</label>
			<input id="add-manual-email" type="email" name="email" bind:value={addManualEmail} placeholder="If they have an account, add them by email" />
		</div>
		<div class="form-group">
			<label for="add-manual-dietary">Dietary restrictions <span class="label-optional">(optional)</span></label>
			<input id="add-manual-dietary" type="text" name="dietaryRestrictions" bind:value={addManualDietary} placeholder="e.g. vegetarian, gluten-free" />
		</div>
		<div class="form-group">
			<label for="add-manual-allergies">Allergies <span class="label-optional">(optional)</span></label>
			<input id="add-manual-allergies" type="text" name="allergies" bind:value={addManualAllergies} placeholder="e.g. peanuts, shellfish" />
		</div>
		<div class="modal-actions">
			<button type="button" class="btn-secondary" onclick={closeAddManual}>Cancel</button>
			<button type="submit" class="btn-primary">Add guest</button>
		</div>
	</form>
</div>
{/if}

<GuestEditModal
	open={!!editModalRow}
	row={editModalRow}
	rooms={data.rooms ?? []}
	tripId={data.trip?.id ?? ''}
	checkInDate={data.trip?.checkInDate ?? undefined}
	checkOutDate={data.trip?.checkOutDate ?? undefined}
	allowPartialStays={data.trip?.allowPartialStays ?? false}
	onClose={() => (editModalRow = null)}
/>

<GuestInvoiceModal
	open={!!invoiceModalRow}
	guestName={invoiceModalRow?.name ?? ''}
	breakdown={invoiceModalRow?.invoiceBreakdown ?? null}
	total={invoiceModalRow?.toPayTotal ?? 0}
	tripId={data.trip?.id ?? ''}
	userId={invoiceModalRow?.userId ?? ''}
	canMarkAsPaid={!!(data.canManageGuests && invoiceModalRow?.userId && (invoiceModalRow?.toPayTotal ?? 0) > 0)}
	onClose={() => (invoiceModalRow = null)}
/>

<ActivityLogModal
	open={showActivityLog}
	items={allActivityItems}
	onClose={() => (showActivityLog = false)}
/>

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

	.rsvp-visual { margin-top: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: center; align-items: center; gap: 1rem; flex-wrap: wrap; width: 100%; overflow: visible; }
	.rsvp-pie-wrap { flex-shrink: 0; min-width: 6rem; overflow: visible; }
	.rsvp-half-donut { width: 6rem; height: 3.75rem; display: block; overflow: visible; }
	.rsvp-segment { transition: opacity 0.2s ease; }
	.rsvp-segment:hover { opacity: 0.9; }
	.rsvp-segment.segment-going { fill: #22c55e; }
	.rsvp-segment.segment-no { fill: #94a3b8; }
	.rsvp-segment.segment-pending { fill: #fbbf24; }
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

	.btn-export {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		background: #fff;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		color: #374151;
		cursor: pointer;
	}
	.btn-export:hover { background: #f9fafb; border-color: #9ca3af; }
	.btn-secondary-header {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		background: #fff;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		color: #374151;
		cursor: pointer;
	}
	.btn-secondary-header:hover { background: #f9fafb; border-color: #9ca3af; }
	.btn-primary-invite {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		background: #e85d04;
		border: none;
		border-radius: 8px;
		color: #fff;
		cursor: pointer;
	}
	.btn-primary-invite:hover { background: #d45203; }

	.add-guest-dropdown-wrap { position: relative; display: inline-flex; }
	.add-guest-content { pointer-events: none; }
	.add-guest-portal {
		position: fixed;
		inset: 0;
		z-index: 10000;
		pointer-events: none;
	}
	.add-guest-portal .add-guest-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9998;
		pointer-events: auto;
		cursor: default;
	}
	.add-guest-portal .add-guest-menu { pointer-events: auto; }
	.add-guest-menu {
		position: fixed;
		top: 0;
		left: 0;
		margin-top: 0;
		background: white;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 8px;
		box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
		min-width: 10rem;
		z-index: 9999;
		overflow: hidden;
	}
	.add-guest-item {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: none;
		text-align: left;
		font-size: 0.875rem;
		color: var(--text, #374151);
		cursor: pointer;
		font-family: inherit;
	}
	.add-guest-item:hover { background: rgba(232, 93, 4, 0.1); }
	.controls-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.75rem 1.25rem;
		background: #f3f4f6;
		border-bottom: 1px solid #e5e7eb;
	}
	.filters-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}
	.actions-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-left: auto;
	}
	.control-select {
		padding: 0.5rem 2rem 0.5rem 0.75rem;
		font-size: 0.875rem;
		background: #fff;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		color: #374151;
		cursor: pointer;
		width: auto;
		min-width: 10rem;
	}
	.control-select:hover { border-color: #9ca3af; }
	.th-sortable { cursor: pointer; user-select: none; }
	.th-sortable:hover { color: var(--text); }
	.sort-icon { margin-left: 0.25rem; font-size: 0.75rem; opacity: 0.8; }

	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1rem; }
	.card-footer-row { display: flex; justify-content: flex-end; padding: 0.75rem 1rem 1rem; border-top: 1px solid var(--border); }
	.card-footer-export { justify-content: flex-start; }
	.table-wrap { overflow-x: auto; }
	.table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.table th, .table td { padding: 0.75rem 1rem; text-align: center; border-bottom: 1px solid var(--border); vertical-align: middle; }
	.table th:first-child, .table td:first-child { text-align: left; }
	.table thead { background: #f3f4f6; }
	.table th { font-weight: 600; color: #374151; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.025em; }
	.table tbody tr { background: #fff; height: 5rem; }
	.table tbody tr td { height: 5rem; vertical-align: middle; }
	.table tbody tr:hover { background: #f9fafb; }
	.th-actions, .td-actions { width: 1%; white-space: nowrap; }
	.table th.th-section {
		font-weight: 600;
		color: var(--text);
		text-align: center;
		border-left: 1px solid rgba(0, 0, 0, 0.08);
		border-right: 1px solid rgba(0, 0, 0, 0.08);
	}
	.th-sub { font-weight: 500; font-size: 0.6875rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
	.subheader-row th { padding-top: 0.5rem; padding-bottom: 0.25rem; border-top: none; }

	.guest-cell { display: flex; align-items: center; justify-content: flex-start; gap: 0.75rem; }
	.guest-cell-btn { width: 100%; text-align: left; background: none; border: none; font: inherit; cursor: pointer; padding: 0; }
	.guest-cell-btn:hover { opacity: 0.9; }
	.avatar { width: 2.25rem; height: 2.25rem; border-radius: 50%; background: var(--surface2); display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: var(--text); flex-shrink: 0; }
	.avatar-img { width: 2.25rem; height: 2.25rem; border-radius: 50%; object-fit: cover; }
	.guest-name { display: block; font-weight: 500; }
	.guest-email { font-size: 0.8125rem; color: var(--muted); }

	.status-pill { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; text-transform: capitalize; }
	.status-yes { background: #dcfce7; color: #166534; }
	.status-no { background: #f3f4f6; color: #6b7280; }
	.status-pending, .status-null { background: #fef3c7; color: #92400e; }
	.updated-hint { display: block; font-size: 0.75rem; color: var(--muted); margin-top: 0.125rem; }

	.inline-edit { display: flex; align-items: center; gap: 0.5rem; }
	.edit-select { padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; color: black; }
	.bed-type-hint { margin-left: 0.25rem; font-size: 0.8125rem; color: var(--muted); }
	.rsvp-form, .party-size-form { display: inline-flex; align-items: center; }
	.state-pill { display: inline-block; padding: 0.2rem 0.5rem; border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 500; }
	.state-pill.state-invited { background: #fef3c7; color: #92400e; }
	.state-pill.state-accepted { background: #e0e7ff; color: #3730a3; }
	.state-pill.state-rsvp_yes { background: #dcfce7; color: #166534; }
	.state-pill.state-rsvp_no { background: #f3f4f6; color: #6b7280; }
	.state-pill.state-invite { background: #f3f4f6; color: #6b7280; }
	.rsvp-select { padding: 0.25rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; cursor: pointer; }
	.party-size-input { width: 3rem; padding: 0.25rem 0.35rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; }
	.edit-link { margin-left: 0.5rem; font-size: 0.8125rem; }
	.btn-link { background: none; border: none; color: var(--primary); cursor: pointer; font-size: inherit; padding: 0; text-decoration: underline; }
	.btn-link:hover { color: var(--primaryHover); }
	.action-buttons {
		display: grid;
		grid-template-columns: repeat(2, auto);
		gap: 0.35rem;
		align-items: center;
		justify-content: center;
		justify-items: center;
	}
	.btn-icon { display: inline-flex; align-items: center; justify-content: center; padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface2); color: var(--text); cursor: pointer; }
	.btn-icon:hover { background: var(--focusRing); }
	.btn-icon svg { display: block; }
	.btn-icon-img { display: block; object-fit: contain; }
	.btn-icon.btn-edit { color: var(--muted, #6b7280); }
	.btn-icon.btn-edit:hover { color: var(--text, #222); background: var(--focusRing); }
	.btn-icon.btn-remove { border: 1px solid rgba(185, 28, 28, 0.4); color: #b91c1c; }
	.btn-icon.btn-remove:hover { background: rgba(185, 28, 28, 0.08); }
	.btn-icon.btn-nudge { color: #e85d04; border: 1.5px solid #e85d04; background: var(--surface2); padding: 0.2rem; }
	.btn-icon.btn-nudge .nudge-icon-img { width: 20px; height: 20px; }
	.btn-icon.btn-nudge:hover:not(:disabled) { background: rgba(232, 93, 4, 0.12); color: #d45203; border-color: #d45203; }
	.btn-icon.btn-nudge.btn-nudge-disabled,
	.btn-icon.btn-nudge:disabled { color: #9ca3af; border: 1.5px solid #d1d5db; background: #f3f4f6; cursor: default; opacity: 0.6; }
	.btn-icon.btn-message { color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.5); background: var(--surface2); text-decoration: none; }
	.btn-icon.btn-message:hover { background: rgba(37, 99, 235, 0.1); color: #1d4ed8; }
	.to-pay-btn {
		background: none;
		border: none;
		font: inherit;
		color: var(--primary, #2563eb);
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}
	.to-pay-btn:hover { color: var(--primaryHover, #1d4ed8); }

	.approved-cell, .paid-cell { text-align: center; }
	.approved-form, .paid-form { display: inline; }
	.approved-toggle, .paid-toggle {
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		width: 2rem;
		height: 2rem;
		padding: 0;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s, border-color 0.15s;
	}
	.approved-toggle:hover, .paid-toggle:hover { background: var(--surface2); }
	.approved-cell .check, .paid-cell .check { color: var(--success, #16a34a); font-weight: 700; }
	.approved-cell .cross, .paid-cell .cross { color: var(--muted); }
	.approved-toggle .check, .paid-toggle .check { color: var(--success, #16a34a); }
	.approved-toggle .cross, .paid-toggle .cross { color: var(--muted); }

	.legacy-card { margin-top: 1.5rem; }
	.legacy-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
	.legacy-hint { font-size: 0.8125rem; color: var(--muted); margin: 0.25rem 0 0 0; }
	.legacy-stats { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; font-size: 0.875rem; }
	.legacy-stat { color: var(--muted); }
	.legacy-stat strong { color: var(--text); }
	.legacy-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.legacy-table th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); font-weight: 600; color: var(--muted); }
	.legacy-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
	.legacy-table tbody tr:hover { background: var(--surface2); }
	.legacy-table .total-row { font-weight: 600; }
	.removed-section { margin-top: 1.5rem; }
	.removed-section-title { font-size: 1.125rem; margin: 0 0 0.25rem 0; color: var(--text); }
	.removed-section-hint { font-size: 0.875rem; color: var(--muted); margin: 0 0 1rem 0; }
	.removed-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.removed-item { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
	.removed-item:last-child { border-bottom: none; }
	.removed-name { font-weight: 500; }
	.removed-email { font-size: 0.875rem; color: var(--muted); }
	.removed-role { font-size: 0.75rem; padding: 0.1rem 0.4rem; background: var(--surface2); border-radius: var(--radius-sm); }
	.inline-form { display: inline; }
	.room-cell-form, .clear-room-form { display: inline; }
	.clear-room-form .clear-room { margin-left: 0.25rem; }
	.beds-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; }
	.beds-dropdown-wrap { position: relative; }
	.beds-dropdown-trigger {
		display: block;
		width: 100%;
		min-width: 10rem;
		text-align: left;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border-color, #ccc);
		border-radius: 4px;
		background: var(--input-bg, #fff);
		cursor: pointer;
		font: inherit;
	}
	.beds-dropdown-trigger:hover { border-color: var(--border-hover, #888); }
	.beds-dropdown-panel {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 2px;
		min-width: 12rem;
		max-height: 16rem;
		overflow-y: auto;
		background: var(--input-bg, #fff);
		border: 1px solid var(--border-color, #ccc);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		z-index: 20;
		padding: 0.5rem;
	}
	.beds-dropdown-room { margin-bottom: 0.5rem; }
	.beds-dropdown-room:last-of-type { margin-bottom: 0.25rem; }
	.beds-dropdown-room-name {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted, #666);
		margin-bottom: 0.25rem;
	}
	.beds-dropdown-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.beds-dropdown-option input { margin: 0; }
	.beds-hidden-select { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
	.beds-form-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
	.btn-small { padding: 0.25rem 0.5rem; font-size: 0.8125rem; }

	.muted { color: var(--muted); }
	.empty { color: var(--muted); margin: 0; padding: 1rem 0; }

	.btn-primary { padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-md); font-weight: 500; cursor: pointer; }
	.btn-secondary { padding: 0.5rem 1rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; }
	.btn-danger { padding: 0.5rem 1rem; background: var(--error, #b91c1c); color: white; border: none; border-radius: var(--radius-md); font-weight: 500; cursor: pointer; }

	.modal-backdrop { position: fixed; inset: 0; background: rgba(20, 56, 41, 0.3); z-index: 100; }
	.modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: var(--shadow-xl); z-index: 101; min-width: 20rem; }
	.modal h2 { margin: 0 0 0.75rem 0; font-size: 1.25rem; }
	.modal p { margin: 0 0 1rem 0; font-size: 0.875rem; }
	.modal-hint { color: var(--muted); font-size: 0.8125rem; margin: 0 0 1rem 0; }
	.form-error { color: var(--error, #b91c1c); font-size: 0.875rem; margin: 0 0 1rem 0; }
	.form-group { margin-bottom: 1rem; }
	.form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
	.form-group input, .form-group select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.875rem; }
	.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
</style>
