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
	import CapacitySnapshot from '$lib/components/trips/CapacitySnapshot.svelte';
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
	let inviteTab = $state<'email' | 'friends'>('email');
	let inviteName = $state('');
	let inviteEmail = $state('');
	let inviteRole = $state<'guest' | 'co-host'>('guest');
	let inviteError = $state('');
	let inviteEmailWarning = $state('');
	let friendsList = $state<{ id: string; name: string | null; avatarUrl: string | null }[]>([]);
	let friendsLoading = $state(false);
	let inviteFriendError = $state('');
	let addManualOpen = $state(false);
	let addManualName = $state('');
	let addManualEmail = $state('');
	let addManualDietary = $state('');
	let addManualAllergies = $state('');
	let addManualError = $state('');
	let filterRsvp = $state<'all' | 'yes' | 'no' | 'no-response' | 'reconfirm'>('all');
	let filterAssignment = $state<'all' | 'assigned' | 'unassigned'>('all');
	let filterDietary = $state<'all' | 'has-flags'>('all');
	let filterPayment = $state<'all' | 'unpaid'>('all');
	let filterApproval = $state<'all' | 'not-approved'>('all');
	let sortBy = $state<'name' | 'rsvp' | 'party-size'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let removeTarget = $state<GuestRow | null>(null);
	let pendingInviteDeleteTarget = $state<GuestRow | null>(null);
	let pendingInviteDeleteError = $state('');
	let selectedRowIds = $state<Set<string>>(new Set());
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
		typeof window !== 'undefined' && data.trip?.id
			? `${window.location.origin}/trips/${data.trip.id}`
			: ''
	);

	function openInvite() {
		inviteOpen = true;
		inviteError = '';
		inviteEmailWarning = '';
	}
	function closeInvite() {
		inviteOpen = false;
		inviteTab = 'email';
		inviteName = '';
		inviteEmail = '';
		inviteRole = 'guest';
		inviteError = '';
		inviteEmailWarning = '';
		inviteFriendError = '';
	}
	// User IDs already on the trip (members or pending invites with account)
	const guestUserIds = $derived(
		new Set(
			(data.guestRows ?? []).map((r) => r.userId ?? r.recipientUserId).filter(Boolean) as string[]
		)
	);
	const invitableFriends = $derived(friendsList.filter((f) => !guestUserIds.has(f.id)));
	async function fetchFriendsForInvite() {
		friendsLoading = true;
		inviteFriendError = '';
		try {
			const res = await fetch('/api/users/me/friends');
			const json = await res.json().catch(() => ({}));
			friendsList = json.friends ?? [];
		} finally {
			friendsLoading = false;
		}
	}
	$effect(() => {
		if (inviteOpen && inviteTab === 'friends') {
			fetchFriendsForInvite();
		}
	});
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
		return async ({
			result
		}: {
			result: {
				type: string;
				data?: {
					createInviteError?: string;
					createInviteSuccess?: boolean;
					createInviteEmailWarning?: string;
				};
			};
		}) => {
			if (result.type === 'success' && result.data?.createInviteError) {
				inviteError = result.data.createInviteError;
				return;
			}
			if (result.type === 'success' && result.data?.createInviteSuccess) {
				await invalidateAll();
				if (result.data.createInviteEmailWarning) {
					inviteEmailWarning = result.data.createInviteEmailWarning;
					inviteError = '';
				} else {
					closeInvite();
				}
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

	const totalBedCapacity = $derived(
		(data.rooms ?? []).reduce((sum, r) => sum + (r.beds?.length ?? 0), 0)
	);
	const capacity = $derived(
		data.maxOccupancy != null && data.maxOccupancy > 0 ? data.maxOccupancy : totalBedCapacity
	);

	const rsvpVisual = $derived.by(() => {
		const going = data.summary?.goingPartySize ?? 0;
		const notGoing = data.summary?.notGoingCount ?? 0;
		const unresponded = data.summary?.unrespondedCount ?? 0;
		const total = going + notGoing + unresponded;
		return { total, going, notGoing, unresponded };
	});

	const attentionCounts = $derived.by(() => {
		const rows = data.guestRows ?? [];
		let noResponse = 0;
		let reconfirm = 0;
		let unpaid = 0;
		let noRoom = 0;
		let notApproved = 0;
		for (const r of rows) {
			if (r.rsvpStatus !== 'yes' && r.rsvpStatus !== 'no') noResponse++;
			if (r.rsvpStatus === 'yes' && r.yesSubstatus === 'reconfirm_required') reconfirm++;
			if (r.type === 'member' && r.userId && (r.toPayTotal ?? 0) > 0 && !r.invoicePaid) unpaid++;
			if (r.type === 'member' && (r.assignedBedIds?.length ?? 0) === 0) noRoom++;
			if (r.type === 'member' && r.userId && r.rsvpStatus === 'yes' && r.priceApproved === false) notApproved++;
		}
		return { noResponse, reconfirm, unpaid, noRoom, notApproved };
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
		if (filterPayment === 'unpaid') rows = rows.filter((r) => r.type === 'member' && r.userId && (r.toPayTotal ?? 0) > 0 && !r.invoicePaid);
		if (filterApproval === 'not-approved') rows = rows.filter((r) => r.type === 'member' && r.userId && r.rsvpStatus === 'yes' && r.priceApproved === false);
		if (sortBy === 'name') rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
		else if (sortBy === 'rsvp') {
			const order = { yes: 0, no: 1, null: 2 };
			rows.sort((a, b) => (order[a.rsvpStatus ?? 'null'] ?? 3) - (order[b.rsvpStatus ?? 'null'] ?? 3));
		} else if (sortBy === 'party-size') rows.sort((a, b) => a.partySize - b.partySize);
		if (sortDir === 'desc') rows.reverse();
		return rows;
	});

	function getRowId(row: GuestRow): string {
		return row.userId ?? row.inviteId ?? '';
	}

	function toggleRowSelection(row: GuestRow) {
		const id = getRowId(row);
		if (!id) return;
		const next = new Set(selectedRowIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedRowIds = next;
	}

	function toggleSelectAll() {
		if (selectedRowIds.size === filteredAndSorted.length) {
			selectedRowIds = new Set();
		} else {
			selectedRowIds = new Set(filteredAndSorted.map((r) => getRowId(r)).filter(Boolean));
		}
	}

	function clearSelection() {
		selectedRowIds = new Set();
	}

	const selectedRows = $derived(filteredAndSorted.filter((r) => selectedRowIds.has(getRowId(r))));
	const selectedMemberUserIds = $derived(selectedRows.filter((r) => r.type === 'member' && r.userId && r.role !== 'host').map((r) => r.userId!));
	const canBulkNudge = $derived(selectedMemberUserIds.length > 0);
	const canBulkApprove = $derived(selectedRows.some((r) => r.type === 'member' && r.userId && r.rsvpStatus === 'yes' && r.priceApproved === false));

	let bulkActionPending = $state(false);
	let bulkActionError = $state<string | null>(null);

	async function bulkNudge() {
		if (selectedMemberUserIds.length === 0) return;
		bulkActionError = null;
		bulkActionPending = true;
		const tripId = data.trip?.id ?? '';
		const base = typeof window !== 'undefined' ? window.location.origin : '';
		let errors: string[] = [];
		for (const userId of selectedMemberUserIds) {
			const formData = new FormData();
			formData.set('userId', userId);
			const res = await fetch(`${base}/trips/${tripId}/guests?/nudgeUnresponded`, { method: 'POST', body: formData });
			if (!res.ok) errors.push(userId);
		}
		bulkActionPending = false;
		if (errors.length > 0) bulkActionError = `${errors.length} failed`;
		else {
			nudgeToast = true;
			setTimeout(() => (nudgeToast = false), 2000);
			clearSelection();
			await invalidateAll();
		}
	}

	async function bulkApprove() {
		const toApprove = selectedRows.filter((r) => r.type === 'member' && r.userId && r.rsvpStatus === 'yes' && r.priceApproved === false);
		if (toApprove.length === 0) return;
		bulkActionError = null;
		bulkActionPending = true;
		const tripId = data.trip?.id ?? '';
		const base = typeof window !== 'undefined' ? window.location.origin : '';
		let errors = 0;
		for (const row of toApprove) {
			const formData = new FormData();
			formData.set('userId', row.userId!);
			formData.set('approved', 'true');
			const res = await fetch(`${base}/trips/${tripId}/guests?/updatePriceApproved`, { method: 'POST', body: formData });
			if (!res.ok) errors++;
		}
		bulkActionPending = false;
		if (errors > 0) bulkActionError = `${errors} failed`;
		else {
			clearSelection();
			await invalidateAll();
		}
	}

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

	function handleSendInvite() {
		openInvite();
		closeAddGuestDropdown();
	}

	function handleAddManual() {
		openAddManual();
		closeAddGuestDropdown();
	}

	function handleCopyInviteLink() {
		copyInviteLink();
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

<div class="gp">

	<!-- ── PAGE HEADER ──────────────────────────────────────────────────── -->
	<div class="gp-header">
		<div class="gp-header-left">
			<h1 class="gp-title">Guests</h1>
			{#if data.trip?.rsvpByDate}
				<span class="gp-rsvp-by">RSVP by <strong>{new Date(data.trip.rsvpByDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
			{/if}
		</div>
	</div>

	<!-- ── STAT CARDS ──────────────────────────────────────────────────── -->
	<div class="gp-stats-row">
		<div class="gp-stat-card">
			<span class="gp-stat-value gp-stat-value--going">{rsvpVisual.going}</span>
			<span class="gp-stat-label">Going</span>
			{#if rsvpVisual.total > 0}
				<span class="gp-stat-pct">{Math.round(100 * rsvpVisual.going / rsvpVisual.total)}%</span>
			{/if}
		</div>
		<div class="gp-stat-card">
			<span class="gp-stat-value gp-stat-value--no">{rsvpVisual.notGoing}</span>
			<span class="gp-stat-label">Not going</span>
			{#if rsvpVisual.total > 0}
				<span class="gp-stat-pct">{Math.round(100 * rsvpVisual.notGoing / rsvpVisual.total)}%</span>
			{/if}
		</div>
		<div class="gp-stat-card">
			<span class="gp-stat-value gp-stat-value--pending">{rsvpVisual.unresponded}</span>
			<span class="gp-stat-label">No response</span>
			{#if rsvpVisual.total > 0}
				<span class="gp-stat-pct">{Math.round(100 * rsvpVisual.unresponded / rsvpVisual.total)}%</span>
			{/if}
		</div>
		<div class="gp-stat-card gp-stat-card--total">
			<span class="gp-stat-value">{rsvpVisual.total}</span>
			<span class="gp-stat-label">Invited</span>
			{#if (data.summary?.goingPartySize ?? 0) > rsvpVisual.going}
				<span class="gp-stat-pct">{data.summary?.goingPartySize} people total</span>
			{/if}
		</div>
	</div>

	<!-- ── CAPACITY SNAPSHOT ────────────────────────────────────────────── -->
	{#if data.canManageGuests}
		<CapacitySnapshot
			capacity={capacity}
			confirmedCount={rsvpVisual.going}
			pendingCount={rsvpVisual.unresponded}
			declinedCount={rsvpVisual.notGoing}
			invitedTotal={rsvpVisual.total}
		/>
	{/if}

	<!-- ── WAITLIST PANEL (host/co-host only) ───────────────────────────── -->
	{#if data.canManageGuests && (data.waitlistCount ?? 0) > 0}
		{@const waitlistEntries = data.waitlistEntries ?? []}
		<div class="gp-card gp-waitlist-card">
			<div class="gp-waitlist-header">
				<span class="gp-waitlist-title">Waitlist</span>
				<span class="gp-waitlist-badge">{data.waitlistCount}</span>
				{#if data.maxCapacity}
					<span class="gp-waitlist-cap">Cap: {data.maxCapacity}</span>
				{/if}
			</div>
			<p class="gp-waitlist-hint">All waitlisted guests are notified simultaneously when a spot opens — first come, first served.</p>
			<div class="gp-waitlist-list" role="list">
				{#each waitlistEntries as entry, i (entry.userId)}
					<div class="gp-waitlist-row" role="listitem">
						<span class="gp-waitlist-pos">#{entry.waitlistPosition ?? i + 1}</span>
						<div class="gp-waitlist-info">
							<span class="gp-waitlist-name">{entry.name}</span>
							<span class="gp-waitlist-email">{entry.email}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ── NEEDS ATTENTION (host only) ───────────────────────────────────── -->
	{#if data.canManageGuests && (data.guestRows?.length ?? 0) > 0}
		{@const attention = attentionCounts}
		{#if attention.noResponse > 0 || attention.reconfirm > 0 || attention.unpaid > 0 || attention.noRoom > 0 || attention.notApproved > 0}
			<div class="gp-card gp-card--attention">
				<div class="gp-attention-head">
					<span class="gp-attention-title">Needs Attention</span>
					<span class="gp-attention-sub">Click to filter; click again to clear</span>
				</div>
				<div class="gp-attention-chips">
					{#if attention.noResponse > 0}
						<button
							type="button"
							class="gp-attention-chip"
							class:gp-attention-chip--active={filterRsvp === 'no-response'}
							onclick={() => {
								if (filterRsvp === 'no-response') filterRsvp = 'all';
								else { filterRsvp = 'no-response'; filterAssignment = 'all'; filterDietary = 'all'; filterPayment = 'all'; filterApproval = 'all'; }
							}}
						>
							No response ({attention.noResponse})
						</button>
					{/if}
					{#if attention.reconfirm > 0}
						<button
							type="button"
							class="gp-attention-chip"
							class:gp-attention-chip--active={filterRsvp === 'reconfirm'}
							onclick={() => {
								if (filterRsvp === 'reconfirm') filterRsvp = 'all';
								else { filterRsvp = 'reconfirm'; filterAssignment = 'all'; filterDietary = 'all'; filterPayment = 'all'; filterApproval = 'all'; }
							}}
						>
							Needs reconfirm ({attention.reconfirm})
						</button>
					{/if}
					{#if attention.unpaid > 0}
						<button
							type="button"
							class="gp-attention-chip"
							class:gp-attention-chip--active={filterPayment === 'unpaid'}
							onclick={() => {
								if (filterPayment === 'unpaid') filterPayment = 'all';
								else { filterPayment = 'unpaid'; filterRsvp = 'all'; filterAssignment = 'all'; filterDietary = 'all'; filterApproval = 'all'; }
							}}
						>
							Unpaid ({attention.unpaid})
						</button>
					{/if}
					{#if attention.noRoom > 0}
						<button
							type="button"
							class="gp-attention-chip"
							class:gp-attention-chip--active={filterAssignment === 'unassigned'}
							onclick={() => {
								if (filterAssignment === 'unassigned') filterAssignment = 'all';
								else { filterAssignment = 'unassigned'; filterRsvp = 'all'; filterDietary = 'all'; filterPayment = 'all'; filterApproval = 'all'; }
							}}
						>
							No room/bed ({attention.noRoom})
						</button>
					{/if}
					{#if attention.notApproved > 0}
						<button
							type="button"
							class="gp-attention-chip"
							class:gp-attention-chip--active={filterApproval === 'not-approved'}
							onclick={() => {
								if (filterApproval === 'not-approved') filterApproval = 'all';
								else { filterApproval = 'not-approved'; filterRsvp = 'all'; filterAssignment = 'all'; filterDietary = 'all'; filterPayment = 'all'; }
							}}
						>
							Not approved ({attention.notApproved})
						</button>
					{/if}
				</div>
			</div>
		{/if}
	{/if}

	<!-- ── GUEST TABLE CARD ──────────────────────────────────────────────── -->
	<div class="gp-card">
		<!-- Filters row -->
		<div class="gp-controls">
			<div class="gp-filters-row">
				<label class="gp-filter-label">
					<span class="gp-filter-label-txt">RSVP</span>
					<select bind:value={filterRsvp} class="gp-select" aria-label="Filter by RSVP">
						<option value="all">All</option>
						<option value="yes">Going</option>
						<option value="no">Not going</option>
						<option value="no-response">No response</option>
						<option value="reconfirm">Needs reconfirm</option>
					</select>
				</label>
				<label class="gp-filter-label">
					<span class="gp-filter-label-txt">Room</span>
					<select bind:value={filterAssignment} class="gp-select" aria-label="Filter by assignment">
						<option value="all">All</option>
						<option value="assigned">Has room/bed</option>
						<option value="unassigned">Needs assignment</option>
					</select>
				</label>
				<label class="gp-filter-label">
					<span class="gp-filter-label-txt">Dietary</span>
					<select bind:value={filterDietary} class="gp-select" aria-label="Filter by dietary">
						<option value="all">All</option>
						<option value="has-flags">Has flags</option>
					</select>
				</label>
			</div>
			{#if data.canManageGuests}
				<div class="gp-controls-actions">
					{#if selectedRowIds.size > 0}
						<span class="gp-bulk-count">{selectedRowIds.size} selected</span>
						{#if bulkActionError}
							<span class="gp-bulk-error" role="alert">{bulkActionError}</span>
						{/if}
						{#if canBulkNudge}
							<button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" onclick={bulkNudge} disabled={bulkActionPending} aria-label="Send reminder to selected">
								<img src={pokeIcon} alt="" width="14" height="14" />
								Send reminder
							</button>
						{/if}
						{#if canBulkApprove}
							<button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" onclick={bulkApprove} disabled={bulkActionPending} aria-label="Approve selected">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Approve
							</button>
						{/if}
						<button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" onclick={clearSelection} disabled={bulkActionPending}>
							Clear selection
						</button>
					{:else}
						<button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" onclick={() => (showActivityLog = true)}>
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 15"/></svg>
							Activity
						</button>
						<div class="gp-add-wrap">
						<button
							type="button"
							class="gp-btn gp-btn--primary gp-btn--sm"
							bind:this={addGuestTriggerEl}
							onmouseenter={onAddGuestMouseEnter}
							onmouseleave={scheduleAddGuestClose}
							onclick={onAddGuestClick}
							aria-expanded={addGuestOpen}
							aria-haspopup="menu"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
							<span>Add Guest</span>
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
						</button>
						{#if addGuestOpen}
							<div use:portal class="add-guest-portal" role="presentation">
								<div class="add-guest-backdrop" aria-hidden="true" onclick={closeAddGuestDropdown} role="button" tabindex="-1"></div>
								<div
									bind:this={addGuestMenuEl}
									class="add-guest-menu"
									role="menu"
									style={addGuestMenuStyle ? 'top: ' + addGuestMenuStyle.top + '; left: ' + addGuestMenuStyle.left + ';' : ''}
									onmouseenter={clearAddGuestClose}
									onmouseleave={scheduleAddGuestClose}
								>
									<button type="button" class="add-guest-item" role="menuitem" onclick={handleSendInvite}>
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
										Send invite
									</button>
									<button type="button" class="add-guest-item" role="menuitem" onclick={handleCopyInviteLink}>
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
										Copy invite link
									</button>
									{#if data.isHost}
										<button type="button" class="add-guest-item" role="menuitem" onclick={handleAddManual}>
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
											Add manually
										</button>
									{/if}
								</div>
							</div>
						{/if}
					</div>
					{#if copyToast}
						<span class="gp-toast gp-toast--success">
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
							Link copied
						</span>
					{/if}
					{#if nudgeToast}
						<span class="gp-toast gp-toast--success">
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
							Nudge sent
						</span>
					{/if}
					{/if}
				</div>
			{:else}
				<span class="gp-result-count">{filteredAndSorted.length} guest{filteredAndSorted.length === 1 ? '' : 's'}</span>
			{/if}
		</div>

		{#if roomSaveError}
			<div class="gp-error-bar" role="alert">
				{roomSaveError}
				<button type="button" class="gp-dismiss" onclick={() => (roomSaveError = null)} aria-label="Dismiss">×</button>
			</div>
		{/if}

		<div class="gp-table-wrap">
			{#if filteredAndSorted.length > 0}
				<table class="gp-table">
					<thead>
						<tr>
							{#if data.canManageGuests}
								<th class="gp-th gp-th--check" scope="col">
									<button type="button" class="gp-checkbox-wrap" onclick={toggleSelectAll} aria-label={selectedRowIds.size === filteredAndSorted.length ? 'Deselect all' : 'Select all'}>
										<span class="gp-checkbox" class:gp-checkbox--checked={selectedRowIds.size === filteredAndSorted.length && filteredAndSorted.length > 0} aria-hidden="true"></span>
									</button>
								</th>
							{/if}
							<th class="gp-th gp-th--sortable" onclick={() => toggleSort('name')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('name')}>
								Guest {#if sortBy === 'name'}<span class="gp-sort-arrow" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th class="gp-th gp-th--sortable" onclick={() => toggleSort('rsvp')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('rsvp')}>
								RSVP {#if sortBy === 'rsvp'}<span class="gp-sort-arrow" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th class="gp-th gp-th--sortable" onclick={() => toggleSort('party-size')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort('party-size')}>
								Party {#if sortBy === 'party-size'}<span class="gp-sort-arrow" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>{/if}
							</th>
							<th class="gp-th">Room / Bed</th>
							<th class="gp-th">Amount</th>
							<th class="gp-th gp-th--center">Approved</th>
							<th class="gp-th gp-th--center">Paid</th>
							{#if data.trip?.allowPartialStays}
								<th class="gp-th">Arrival</th>
								<th class="gp-th">Departure</th>
							{/if}
							{#if data.canManageGuests}
								<th class="gp-th gp-th--actions"></th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each filteredAndSorted as row}
							{@const rowId = getRowId(row)}
							{@const isSelectable = data.canManageGuests && rowId && row.type === 'member' && row.role !== 'host'}
							<tr class="gp-row gp-row--{row.type}" class:gp-row--selected={selectedRowIds.has(rowId)}>
								{#if data.canManageGuests}
									<td class="gp-td gp-td--check">
										{#if isSelectable}
											<button type="button" class="gp-checkbox-wrap" onclick={() => toggleRowSelection(row)} aria-label={selectedRowIds.has(rowId) ? 'Deselect' : 'Select'}>
												<span class="gp-checkbox" class:gp-checkbox--checked={selectedRowIds.has(rowId)} aria-hidden="true"></span>
											</button>
										{:else}
											<span class="gp-checkbox-wrap gp-checkbox-wrap--disabled"><span class="gp-checkbox" aria-hidden="true"></span></span>
										{/if}
									</td>
								{/if}
								<!-- Guest -->
								<td class="gp-td gp-td--guest">
									{#if row.userId}
										<ProfileTooltip userId={row.userId}>
											<button type="button" class="gp-guest-btn" onclick={() => openProfileCard(row.userId!)}>
												<span class="gp-guest-avatar-wrap">
													{#if row.avatarUrl}
														<img src={row.avatarUrl} alt="" class="gp-avatar gp-avatar--img" />
													{:else}
														<span class="gp-avatar">{initials(row.name, row.email)}</span>
													{/if}
													{#if row.userId !== data.user?.id}
														<a href="/messages?with={row.userId}" class="gp-avatar-msg" onclick={(e) => e.stopPropagation()} aria-label="Message">Message</a>
													{/if}
												</span>
												<div class="gp-guest-info">
													<span class="gp-guest-name">{row.name}</span>
													{#if row.email && row.email !== '—'}<span class="gp-guest-email">{row.email}</span>{/if}
												</div>
											</button>
										</ProfileTooltip>
									{:else}
										<div class="gp-guest-btn" style="cursor:default">
											<span class="gp-avatar">{initials(row.name, row.email)}</span>
											<div class="gp-guest-info">
												<span class="gp-guest-name">{row.name}</span>
												{#if row.email && row.email !== '—'}<span class="gp-guest-email">{row.email}</span>{/if}
											</div>
										</div>
									{/if}
								</td>
								<!-- RSVP -->
								<td class="gp-td">
									{#if row.rsvpStatus === 'yes' && row.yesSubstatus === 'reconfirm_required'}
										<span class="gp-pill gp-pill--reconfirm" title="Needs to reconfirm">Going</span>
										<span class="gp-badge gp-badge--reconfirm">Reconfirm</span>
									{:else if row.rsvpStatus === 'yes'}
										<span class="gp-pill gp-pill--yes">Going</span>
									{:else if row.rsvpStatus === 'no'}
										<span class="gp-pill gp-pill--no">Not going</span>
									{:else}
										<span class="gp-pill gp-pill--pending">No response</span>
									{/if}
									{#if row.rsvpStatus === 'yes' && row.yesSubstatus !== 'confirmed' && row.reconfirmDeadlineAt}
										<span class="gp-hint">by {new Date(row.reconfirmDeadlineAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</span>
									{:else if row.rsvpUpdatedAt && row.rsvpStatus !== 'yes'}
										<span class="gp-hint">{formatRsvpUpdated(row.rsvpUpdatedAt)}</span>
									{/if}
								</td>
								<!-- Party size -->
								<td class="gp-td gp-td--center">
									{row.partySize > 0 ? row.partySize : '—'}
								</td>
								<!-- Room/bed -->
								<td class="gp-td">
									{#if (row.assignedBedIds?.length ?? 0) > 0}
										<span class="gp-room-label">{bedsLabel(row)}</span>
									{:else if row.type === 'member'}
										<span class="gp-room-unassigned" title="No room or bed assigned">Unassigned</span>
									{:else}
										<span class="gp-muted">—</span>
									{/if}
								</td>
								<!-- Amount + Payment status -->
								<td class="gp-td">
									{#if row.toPayTotal != null && row.toPayTotal > 0}
										<div class="gp-amount-cell">
											{#if data.canManageGuests && row.userId}
												<button type="button" class="gp-amount-btn" onclick={() => (invoiceModalRow = row)} title="View invoice breakdown">
													{formatCurrency(row.toPayTotal)}
													<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
												</button>
											{:else}
												<span class="gp-amount-plain">{formatCurrency(row.toPayTotal)}</span>
											{/if}
											{#if row.type === 'member' && row.userId}
												{#if row.invoicePaid}
													<span class="gp-payment-badge gp-payment-badge--paid">Paid</span>
												{:else}
													<span class="gp-payment-badge gp-payment-badge--unpaid">Unpaid</span>
												{/if}
											{/if}
										</div>
									{:else if row.type === 'member' && row.userId}
										<span class="gp-payment-badge gp-payment-badge--none">—</span>
									{:else}
										<span class="gp-muted">—</span>
									{/if}
								</td>
								<!-- Price approved -->
								<td class="gp-td gp-td--center">
									{#if row.type === 'member' && row.userId && (row.rsvpStatus === 'yes' || row.priceApproved != null)}
										{#if row.priceApproved}
											<span class="gp-check" aria-label="Approved">
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
											</span>
										{:else}
											<span class="gp-cross" aria-label="Not approved">
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
											</span>
										{/if}
									{:else}
										<span class="gp-muted">—</span>
									{/if}
								</td>
								<!-- Paid (redundant with Amount cell; keep for column header) -->
								<td class="gp-td gp-td--center">
									{#if row.type === 'member' && row.userId && (row.toPayTotal != null || row.invoicePaid)}
										{#if row.invoicePaid}
											<span class="gp-check" aria-label="Paid">
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
											</span>
										{:else}
											<span class="gp-cross" aria-label="Unpaid">
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
											</span>
										{/if}
									{:else}
										<span class="gp-muted">—</span>
									{/if}
								</td>
								<!-- Partial stay dates -->
								{#if data.trip?.allowPartialStays}
									<td class="gp-td">{row.arrivalDate ?? '—'}</td>
									<td class="gp-td">{row.departureDate ?? '—'}</td>
								{/if}
								<!-- Actions -->
								{#if data.canManageGuests}
									<td class="gp-td gp-td--actions">
										<div class="gp-actions">
											{#if row.type === 'member' && row.userId}
												<button type="button" class="gp-icon-btn gp-icon-btn--edit" title="Edit guest" aria-label="Edit guest" onclick={() => (editModalRow = row)}>
													<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
												</button>
											{/if}
											{#if row.type === 'invite' && row.inviteId}
												<button type="button" class="gp-icon-btn gp-icon-btn--remove" title="Remove invite" aria-label="Remove invite" onclick={() => { pendingInviteDeleteError = ''; pendingInviteDeleteTarget = row; }}>
													<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
				<p class="gp-empty">No guests match your filters. {filterRsvp !== 'all' || filterAssignment !== 'all' || filterDietary !== 'all' || filterPayment !== 'all' || filterApproval !== 'all' ? 'Try clearing filters.' : 'Use Add Guest to invite people.'}</p>
			{/if}
		</div>

		{#if data.canManageGuests}
			<div class="gp-card-footer">
				<button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" onclick={exportCsv}>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
					Export CSV
				</button>
			</div>
		{/if}
	</div>

	<!-- ── LEGACY BOOKINGS ─────────────────────────────────────────────── -->
	{#if data.canManageGuests && ((data.legacyReservations?.length ?? 0) > 0 || (data.legacyStats?.totalReservations ?? 0) > 0)}
		<div class="gp-card gp-card--legacy">
			<div class="gp-section-header">
				<div>
					<h3 class="gp-section-title">Legacy bookings</h3>
					<p class="gp-section-hint">Bookings from the public trip link (before the RSVP flow). Read-only.</p>
				</div>
				{#if (data.legacyReservations?.length ?? 0) > 0}
					<form method="POST" action="?/exportLegacyBookings" use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success' && result.data?.exportLegacyCsv) {
								triggerCsvDownload(result.data.exportLegacyCsv, result.data.exportLegacyFilename ?? 'legacy_bookings.csv');
								await invalidateAll();
							}
						};
					}}>
						<button type="submit" class="gp-btn gp-btn--ghost gp-btn--sm">Export CSV</button>
					</form>
				{/if}
			</div>
			{#if data.legacyStats && data.legacyStats.totalReservations > 0}
				<div class="gp-legacy-stats">
					<span class="gp-legacy-stat"><span class="gp-legacy-stat-lbl">Reservations</span><strong>{data.legacyStats.totalReservations}</strong></span>
					<span class="gp-legacy-stat"><span class="gp-legacy-stat-lbl">Revenue</span><strong>${data.legacyStats.totalRevenue.toFixed(2)}</strong></span>
					<span class="gp-legacy-stat"><span class="gp-legacy-stat-lbl">Nights</span><strong>{data.legacyStats.totalNights}</strong></span>
					<span class="gp-legacy-stat"><span class="gp-legacy-stat-lbl">Avg</span><strong>${data.legacyStats.averagePrice.toFixed(2)}</strong></span>
				</div>
			{/if}
			{#if (data.legacyReservations?.length ?? 0) === 0}
				<p class="gp-empty">No legacy bookings for this trip.</p>
			{:else}
				<div class="gp-table-wrap">
					<table class="gp-table gp-table--legacy">
						<thead>
							<tr>
								<th class="gp-th">Name</th>
								<th class="gp-th">Email</th>
								<th class="gp-th">Room</th>
								<th class="gp-th">Bed</th>
								<th class="gp-th">Check-in</th>
								<th class="gp-th">Check-out</th>
								<th class="gp-th">Nights</th>
								<th class="gp-th">Guests</th>
								<th class="gp-th">Total</th>
								<th class="gp-th">Submitted</th>
							</tr>
						</thead>
						<tbody>
							{#each data.legacyReservations ?? [] as r}
								<tr class="gp-row">
									<td class="gp-td">{r.name}</td>
									<td class="gp-td">{r.email}</td>
									<td class="gp-td">{r.roomName}</td>
									<td class="gp-td">{r.bedType ? r.bedType.toUpperCase() : '—'}</td>
									<td class="gp-td">{formatDate(r.checkInDate)}</td>
									<td class="gp-td">{formatDate(r.checkOutDate)}</td>
									<td class="gp-td">{r.nights}</td>
									<td class="gp-td">{r.numberOfGuests}</td>
									<td class="gp-td">${r.calculatedPrice.toFixed(2)}</td>
									<td class="gp-td">{formatDate(r.submittedAt)}</td>
								</tr>
							{/each}
						</tbody>
						{#if data.legacyStats && data.legacyStats.totalReservations > 0}
							<tfoot>
								<tr class="gp-row gp-row--total">
									<td class="gp-td" colspan="8"><strong>Total</strong></td>
									<td class="gp-td"><strong>${data.legacyStats.totalRevenue.toFixed(2)}</strong></td>
									<td class="gp-td"></td>
								</tr>
							</tfoot>
						{/if}
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── REMOVED GUESTS ──────────────────────────────────────────────── -->
	{#if data.canManageGuests && (data.removedRows?.length ?? 0) > 0}
		<div class="gp-card gp-card--removed">
			<div class="gp-section-header">
				<div>
					<h3 class="gp-section-title">Removed from trip</h3>
					<p class="gp-section-hint">These people were removed by a host. They no longer have access. You can restore them at any time.</p>
				</div>
			</div>
			<ul class="gp-removed-list">
				{#each data.removedRows as removed (removed.userId)}
					<li class="gp-removed-item">
						<span class="gp-avatar gp-avatar--sm">{initials(removed.name, removed.email)}</span>
						<span class="gp-removed-name">{removed.name}</span>
						<span class="gp-removed-email">{removed.email}</span>
						{#if removed.role === 'co-host'}<span class="gp-role-chip">Co-host</span>{/if}
						<form method="POST" action="?/restoreGuest" class="gp-inline-form gp-removed-restore" use:enhance={() => invalidateAll()}>
							<input type="hidden" name="userId" value={removed.userId} />
							<button type="submit" class="gp-btn gp-btn--ghost gp-btn--sm">Restore</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<!-- ── REMOVE CONFIRM MODAL ──────────────────────────────────────────── -->
{#if removeTarget}
	<div class="gp-backdrop" onclick={() => (removeTarget = null)} role="presentation"></div>
	<div class="gp-modal" role="dialog" aria-labelledby="remove-modal-title">
		<div class="gp-modal-icon gp-modal-icon--danger" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
		</div>
		<h2 id="remove-modal-title" class="gp-modal-title">Remove {removeTarget?.name}?</h2>
		<p class="gp-modal-body">They'll lose access to this trip and would need to be re-invited to rejoin.</p>
		<form method="POST" action="?/removeGuest" use:enhance={() => invalidateAll().then(() => (removeTarget = null))}>
			<input type="hidden" name="userId" value={removeTarget?.userId ?? ''} />
			<div class="gp-modal-actions">
				<button type="button" class="gp-btn gp-btn--ghost" onclick={() => (removeTarget = null)}>Cancel</button>
				<button type="submit" class="gp-btn gp-btn--danger">Remove guest</button>
			</div>
		</form>
	</div>
{/if}

<!-- ── REMOVE PENDING INVITE MODAL ─────────────────────────────────────── -->
{#if pendingInviteDeleteTarget}
	<div class="gp-backdrop" onclick={() => { pendingInviteDeleteTarget = null; pendingInviteDeleteError = ''; }} role="presentation"></div>
	<div class="gp-modal" role="dialog" aria-labelledby="remove-invite-modal-title">
		<div class="gp-modal-icon gp-modal-icon--danger" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
		</div>
		<h2 id="remove-invite-modal-title" class="gp-modal-title">Remove invite for {pendingInviteDeleteTarget.name}?</h2>
		<p class="gp-modal-body">They have not joined this trip yet. This revokes their invite for this trip.</p>
		<form method="POST" action="?/deletePendingInvite" use:enhance={() => {
			return async ({ result }) => {
				await invalidateAll();
				if (result.type === 'success') {
					pendingInviteDeleteTarget = null;
					pendingInviteDeleteError = '';
				} else if (result.type === 'failure' && result.data && typeof result.data === 'object' && 'deletePendingInviteError' in result.data) {
					pendingInviteDeleteError = String((result.data as { deletePendingInviteError?: string }).deletePendingInviteError ?? 'Could not remove invite.');
				}
			};
		}}>
			{#if pendingInviteDeleteError}
				<p class="gp-form-error" role="alert">{pendingInviteDeleteError}</p>
			{/if}
			<input type="hidden" name="inviteId" value={pendingInviteDeleteTarget.inviteId ?? ''} />
			<div class="gp-modal-actions">
				<button type="button" class="gp-btn gp-btn--ghost" onclick={() => { pendingInviteDeleteTarget = null; pendingInviteDeleteError = ''; }}>Cancel</button>
				<button type="submit" class="gp-btn gp-btn--danger">Remove invite</button>
			</div>
		</form>
	</div>
{/if}

<!-- ── INVITE MODAL ───────────────────────────────────────────────────── -->
{#if inviteOpen}
	<div class="gp-backdrop" onclick={closeInvite} role="presentation"></div>
	<div class="gp-modal" role="dialog">
		<h2 class="gp-modal-title">Invite someone</h2>
		<div class="gp-invite-tabs">
			<button type="button" class="gp-invite-tab" class:active={inviteTab === 'email'} onclick={() => { inviteTab = 'email'; inviteError = ''; inviteEmailWarning = ''; }}>By email</button>
			<button type="button" class="gp-invite-tab" class:active={inviteTab === 'friends'} onclick={() => { inviteTab = 'friends'; inviteFriendError = ''; inviteEmailWarning = ''; }}>From friends</button>
		</div>
		{#if inviteTab === 'email'}
			<form method="POST" action="?/createInvite" use:enhance={handleInviteSubmit}>
				{#if inviteEmailWarning}
					<p class="gp-form-warn" role="status">{inviteEmailWarning}</p>
				{/if}
				{#if inviteError}
					<p class="gp-form-error" role="alert">{inviteError}</p>
				{/if}
				<div class="gp-form-group">
					<label class="gp-label" for="invite-name">Name <span class="gp-label-opt">(optional)</span></label>
					<input id="invite-name" class="gp-input" type="text" name="name" bind:value={inviteName} placeholder="Full name" />
				</div>
				<div class="gp-form-group">
					<label class="gp-label" for="invite-email">Email *</label>
					<input id="invite-email" class="gp-input" type="email" name="email" bind:value={inviteEmail} placeholder="email@example.com" required />
				</div>
				<div class="gp-form-group">
					<label class="gp-label" for="invite-role">Role</label>
					<select id="invite-role" class="gp-input" name="role" bind:value={inviteRole}>
						<option value="guest">Guest</option>
						<option value="co-host">Co-host</option>
					</select>
				</div>
				<div class="gp-modal-actions">
					<button type="button" class="gp-btn gp-btn--ghost" onclick={closeInvite}>Cancel</button>
					<button type="submit" class="gp-btn gp-btn--primary">Send invite</button>
				</div>
			</form>
		{:else}
			<div class="gp-invite-friends">
				{#if inviteFriendError}
					<p class="gp-form-error" role="alert">{inviteFriendError}</p>
				{/if}
				{#if friendsLoading}
					<p class="gp-muted">Loading friends…</p>
				{:else if invitableFriends.length === 0}
					<p class="gp-muted">{friendsList.length === 0 ? "You don't have any friends yet. Add friends from their profiles, or invite by email above." : 'All your friends are already invited or on this trip.'}</p>
				{:else}
					<ul class="gp-friends-invite-list">
						{#each invitableFriends as friend}
							<li>
								<form method="POST" action="?/inviteFriend" use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success' && result.data?.inviteFriendSuccess) { await invalidateAll(); inviteFriendError = ''; }
										if (result.type === 'success' && result.data?.inviteFriendError) { inviteFriendError = result.data.inviteFriendError; }
									};
								}}>
									<input type="hidden" name="friendUserId" value={friend.id} />
									<div class="gp-friend-invite-row">
										{#if friend.avatarUrl}
											<img src={friend.avatarUrl} alt="" class="gp-friend-avatar" />
										{:else}
											<span class="gp-friend-initials">{friend.name ? (friend.name.slice(0, 2).toUpperCase()) : '?'}</span>
										{/if}
										<span class="gp-friend-name">{friend.name ?? 'Traveler'}</span>
										<button type="submit" class="gp-btn gp-btn--primary gp-btn--sm">Invite</button>
									</div>
								</form>
							</li>
						{/each}
					</ul>
				{/if}
				<div class="gp-modal-actions">
					<button type="button" class="gp-btn gp-btn--ghost" onclick={closeInvite}>Done</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- ── ADD MANUALLY MODAL ─────────────────────────────────────────────── -->
{#if addManualOpen}
	<div class="gp-backdrop" onclick={closeAddManual} role="presentation"></div>
	<div class="gp-modal" role="dialog" aria-labelledby="add-manual-title">
		<h2 id="add-manual-title" class="gp-modal-title">Add guest manually</h2>
		<p class="gp-modal-body">For someone who doesn't go online much. They'll appear on the guest list so you can assign a room, set their RSVP, and account for their cost.</p>
		<form method="POST" action="?/addManualGuest" use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success' && result.data?.addManualGuestSuccess) { closeAddManual(); await invalidateAll(); }
				if (result.type === 'failure' && result.data?.addManualGuestError) { addManualError = result.data.addManualGuestError; }
			};
		}}>
			{#if addManualError}<p class="gp-form-error">{addManualError}</p>{/if}
			<div class="gp-form-group">
				<label class="gp-label" for="add-manual-name">Name *</label>
				<input id="add-manual-name" class="gp-input" type="text" name="name" bind:value={addManualName} placeholder="e.g. Jane Smith" required />
			</div>
			<div class="gp-form-group">
				<label class="gp-label" for="add-manual-email">Email <span class="gp-label-opt">(optional)</span></label>
				<input id="add-manual-email" class="gp-input" type="email" name="email" bind:value={addManualEmail} placeholder="Links to existing account if found" />
			</div>
			<div class="gp-form-group">
				<label class="gp-label" for="add-manual-dietary">Dietary restrictions <span class="gp-label-opt">(optional)</span></label>
				<input id="add-manual-dietary" class="gp-input" type="text" name="dietaryRestrictions" bind:value={addManualDietary} placeholder="e.g. vegetarian, gluten-free" />
			</div>
			<div class="gp-form-group">
				<label class="gp-label" for="add-manual-allergies">Allergies <span class="gp-label-opt">(optional)</span></label>
				<input id="add-manual-allergies" class="gp-input" type="text" name="allergies" bind:value={addManualAllergies} placeholder="e.g. peanuts, shellfish" />
			</div>
			<div class="gp-modal-actions">
				<button type="button" class="gp-btn gp-btn--ghost" onclick={closeAddManual}>Cancel</button>
				<button type="submit" class="gp-btn gp-btn--primary">Add guest</button>
			</div>
		</form>
	</div>
{/if}

<GuestEditModal
	open={!!editModalRow}
	row={editModalRow}
	rooms={data.rooms ?? []}
	tripId={data.trip?.id ?? ''}
	isHostViewer={data.isHost}
	checkInDate={data.trip?.checkInDate ?? undefined}
	checkOutDate={data.trip?.checkOutDate ?? undefined}
	allowPartialStays={data.trip?.allowPartialStays ?? false}
	onClose={() => (editModalRow = null)}
	onRemove={() => { if (editModalRow) { removeTarget = editModalRow; editModalRow = null; } }}
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

<style lang="css">
	/* ── Shell ── */
	.gp { display: flex; flex-direction: column; gap: 1.25rem; padding: 0; }

	/* ── Page header ── */
	.gp-header {
		display: flex; align-items: flex-start; justify-content: space-between;
		flex-wrap: wrap; gap: 0.75rem;
	}
	.gp-header-left { display: flex; flex-direction: column; gap: 0.25rem; }
	.gp-header-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.gp-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.75rem; font-weight: 700; letter-spacing: -0.03em;
		color: var(--navy, var(--text)); margin: 0;
	}
	.gp-rsvp-by { font-size: 0.8125rem; color: var(--muted); }
	.gp-rsvp-by strong { color: var(--text); }

	/* ── Buttons ── */
	.gp-btn {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.5rem 0.875rem; font-size: 0.875rem; font-weight: 600;
		border-radius: 8px; cursor: pointer; text-decoration: none;
		transition: background 140ms, transform 140ms, box-shadow 140ms;
		border: none; font-family: inherit;
	}
	.gp-btn--primary {
		background: var(--warm); color: #fff;
		box-shadow: 0 3px 12px rgba(206,86,18,0.22);
	}
	.gp-btn--primary:hover { background: var(--chocolate); transform: translateY(-1px); }
	.gp-btn--ghost {
		background: var(--surfaceSolid); color: var(--text);
		border: 1px solid var(--border-soft);
	}
	.gp-btn--ghost:hover { background: var(--surface2); }
	.gp-btn--danger { background: #dc2626; color: #fff; }
	.gp-btn--danger:hover { background: #b91c1c; }
	.gp-btn--sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }

	/* Add guest dropdown */
	.gp-add-wrap { position: relative; display: inline-flex; }
	.add-guest-portal { position: fixed; inset: 0; z-index: 10000; pointer-events: none; }
	.add-guest-portal .add-guest-backdrop { position: fixed; inset: 0; z-index: 9998; pointer-events: auto; cursor: default; }
	.add-guest-portal .add-guest-menu { pointer-events: auto; }
	.add-guest-menu {
		position: fixed; top: 0; left: 0;
		background: var(--surfaceSolid);
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		box-shadow: 0 10px 30px rgba(0,0,0,0.12);
		min-width: 11rem; z-index: 9999; overflow: hidden;
	}
	.add-guest-item {
		display: flex; align-items: center; gap: 0.5rem;
		width: 100%; padding: 0.625rem 0.875rem;
		border: none; background: none; text-align: left;
		font-size: 0.875rem; color: var(--text);
		cursor: pointer; font-family: inherit;
	}
	.add-guest-item:hover { background: rgba(206,86,18,0.07); }

	/* Toasts */
	.gp-toast {
		display: inline-flex; align-items: center; gap: 0.35rem;
		font-size: 0.8125rem; font-weight: 600; padding: 0.35rem 0.625rem;
		border-radius: 9999px;
	}
	.gp-toast--success { background: rgba(34,197,94,0.1); color: #16a34a; }

	/* ── Stat cards row ── */
	.gp-stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.875rem;
	}
	.gp-stat-card {
		background: var(--surfaceSolid);
		border: 1px solid var(--border-soft);
		border-radius: 14px;
		padding: 1.125rem 1.25rem 1rem;
		display: flex; flex-direction: column; gap: 0.2rem;
		box-shadow: 0 2px 8px rgba(0,0,0,0.04);
	}
	.gp-stat-card--total {
		background: linear-gradient(140deg, rgba(47,119,120,0.06) 0%, var(--surfaceSolid) 100%);
		border-color: rgba(47,119,120,0.2);
	}
	.gp-stat-value {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2rem; font-weight: 800; line-height: 1;
		letter-spacing: -0.04em; color: var(--navy, var(--text));
	}
	.gp-stat-value--going  { color: #16a34a; }
	.gp-stat-value--no     { color: var(--muted); }
	.gp-stat-value--pending { color: #b45309; }
	.gp-stat-label {
		font-size: 0.8125rem; font-weight: 600; color: var(--muted);
		text-transform: uppercase; letter-spacing: 0.04em;
	}
	.gp-stat-pct { font-size: 0.75rem; color: var(--muted); margin-top: 0.1rem; }

	/* ── Needs Attention panel ── */
	.gp-card--attention {
		padding: 1rem 1.25rem;
	}
	.gp-attention-head {
		display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem 1rem;
		margin-bottom: 0.75rem;
	}
	.gp-attention-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem; font-weight: 700; color: var(--navy, var(--text));
	}
	.gp-attention-sub { font-size: 0.75rem; color: var(--muted); }
	.gp-attention-chips {
		display: flex; flex-wrap: wrap; gap: 0.5rem;
	}
	.gp-attention-chip {
		display: inline-flex; align-items: center;
		padding: 0.4rem 0.75rem;
		font-size: 0.8125rem; font-weight: 600;
		border-radius: 9999px;
		border: 1px solid var(--border-soft);
		background: var(--surfaceSolid);
		color: var(--text);
		cursor: pointer;
		transition: background 120ms, border-color 120ms, color 120ms;
	}
	.gp-attention-chip:hover {
		background: var(--surface2);
		border-color: var(--slate);
	}
	.gp-attention-chip--active {
		background: var(--slate);
		border-color: var(--slate);
		color: #fff;
	}
	.gp-attention-chip--active:hover {
		background: var(--navy);
		border-color: var(--navy);
	}

	/* ── Bulk selection (in controls row) ── */
	.gp-bulk-count { font-size: 0.875rem; font-weight: 600; color: var(--navy, var(--text)); }
	.gp-bulk-error { font-size: 0.8125rem; color: #dc2626; }

	/* ── Checkbox column ── */
	.gp-th--check, .gp-td--check { width: 2.5rem; padding-right: 0.5rem; vertical-align: middle; }
	.gp-checkbox-wrap {
		display: inline-flex; align-items: center; justify-content: center;
		background: none; border: none; padding: 0.25rem; cursor: pointer;
		border-radius: 4px;
	}
	.gp-checkbox-wrap:hover:not(.gp-checkbox-wrap--disabled) .gp-checkbox { border-color: var(--slate); }
	.gp-checkbox-wrap--disabled { cursor: default; opacity: 0.4; }
	.gp-checkbox {
		display: inline-block;
		width: 1.125rem; height: 1.125rem;
		border: 2px solid var(--border-soft);
		border-radius: 4px;
		background: var(--surfaceSolid);
		transition: border-color 120ms, background 120ms;
	}
	.gp-checkbox--checked {
		background: var(--slate);
		border-color: var(--slate);
	}
	.gp-checkbox--checked::after {
		content: '✓';
		display: block;
		font-size: 0.7rem; font-weight: 700; color: #fff; line-height: 1;
		text-align: center; margin-top: -0.05rem;
	}

	/* ── Card ── */
	.gp-card {
		background: var(--surfaceSolid);
		border-radius: 14px; border: 1px solid var(--border-soft);
		overflow: hidden;
		box-shadow: 0 2px 12px rgba(0,0,0,0.05);
	}
	.gp-card + .gp-card { margin-top: 0; }
	.gp-card--legacy, .gp-card--removed { margin-top: 0; }

	/* Controls bar, filters */
	.gp-controls {
		display: flex; align-items: center; justify-content: space-between;
		gap: 1rem; flex-wrap: nowrap;
		padding: 0.75rem 1.25rem;
		background: var(--surface2);
		border-bottom: 1px solid var(--border-soft);
	}
	.gp-filters-row {
		display: flex; align-items: center; gap: 0 1rem;
		flex-wrap: nowrap;
	}
	.gp-filter-label {
		display: inline-flex; align-items: center; gap: 0.5rem;
		margin: 0; cursor: pointer; flex-shrink: 0;
	}
	.gp-filter-label-txt {
		font-size: 0.75rem; font-weight: 600;
		text-transform: uppercase; letter-spacing: 0.04em;
		color: var(--muted); white-space: nowrap;
		min-width: 4rem;
	}
	.gp-select {
		padding: 0.4rem 1.75rem 0.4rem 0.6rem; font-size: 0.8125rem;
		background: var(--surfaceSolid); border: 1px solid var(--border-soft);
		border-radius: 7px; color: var(--text); cursor: pointer;
		font-family: inherit; min-width: 8rem;
	}
	.gp-select:hover { border-color: var(--slate); }
	.gp-controls-actions {
		display: flex; align-items: center; gap: 0.5rem;
		flex-shrink: 0; flex-wrap: wrap;
	}
	.gp-result-count { font-size: 0.8125rem; font-weight: 600; color: var(--muted); flex-shrink: 0; }

	/* Error bar */
	.gp-error-bar {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.5rem 1.25rem; background: #fef2f2; border-bottom: 1px solid #fecaca;
		color: #b91c1c; font-size: 0.875rem;
	}
	.gp-dismiss { background: none; border: none; color: inherit; font-size: 1.25rem; cursor: pointer; padding: 0 0.25rem; line-height: 1; }

	/* ── Table ── */
	.gp-table-wrap { overflow-x: auto; }
	.gp-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.gp-th {
		padding: 0.75rem 1rem; text-align: left;
		font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;
		text-transform: uppercase; color: var(--muted);
		border-bottom: 1px solid var(--border-soft);
		background: var(--surface2); white-space: nowrap;
	}
	.gp-th--sortable { cursor: pointer; user-select: none; }
	.gp-th--sortable:hover { color: var(--text); }
	.gp-th--center { text-align: center; }
	.gp-th--actions { width: 1%; white-space: nowrap; }
	.gp-sort-arrow { margin-left: 0.2rem; font-size: 0.7rem; }
	.gp-row { background: var(--surfaceSolid); transition: background 120ms; }
	.gp-row:hover { background: var(--surface2); }
	.gp-row--selected { background: rgba(47,119,120,0.06); }
	.gp-row--selected:hover { background: rgba(47,119,120,0.1); }
	.gp-row--invite { opacity: 0.8; }
	.gp-row--total { background: var(--surface2); }
	.gp-td {
		padding: 0.875rem 1rem; vertical-align: middle;
		border-bottom: 1px solid var(--border-soft);
		color: var(--text);
	}
	.gp-td--guest { min-width: 14rem; }
	.gp-td--center { text-align: center; }
	.gp-td--actions { white-space: nowrap; }

	/* Guest cell */
	.gp-guest-btn {
		display: flex; align-items: center; gap: 0.75rem;
		background: none; border: none; padding: 0;
		text-align: left; cursor: pointer; font: inherit; width: 100%;
	}
	.gp-guest-btn:hover .gp-guest-name { color: var(--warm); }
	.gp-avatar {
		width: 1.75rem; height: 1.75rem; border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--navy));
		color: #fff; font-size: 0.5625rem; font-weight: 600;
		display: inline-flex; align-items: center; justify-content: center;
		flex-shrink: 0; overflow: hidden;
	}
	.gp-avatar--img {
		background: none;
		width: 1.75rem !important; height: 1.75rem !important;
		min-width: 1.75rem; min-height: 1.75rem; max-width: 1.75rem; max-height: 1.75rem;
		object-fit: cover; border-radius: 50%;
	}
	.gp-avatar--sm { width: 1.375rem; height: 1.375rem; font-size: 0.5rem; }
	.gp-guest-avatar-wrap {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
	}
	.gp-avatar-msg {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		font-size: 0.625rem;
		font-weight: 600;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease;
	}
	.gp-guest-avatar-wrap:hover .gp-avatar-msg {
		opacity: 1;
		pointer-events: auto;
	}
	.gp-guest-info { min-width: 0; }
	.gp-guest-name { display: block; font-weight: 600; color: var(--text); }
	.gp-guest-email { display: block; font-size: 0.75rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 14rem; }

	/* RSVP pills & badges */
	.gp-pill {
		display: inline-block; padding: 0.25rem 0.6rem;
		border-radius: 6px; font-size: 0.8125rem; font-weight: 600;
	}
	.gp-pill--yes        { background: rgba(34,197,94,0.14); color: #15803d; }
	.gp-pill--no         { background: var(--surface2); color: var(--muted); }
	.gp-pill--pending,
	.gp-pill--null       { background: #f1f5f9; color: #64748b; }
	.gp-pill--reconfirm  { background: rgba(245,158,11,0.15); color: #b45309; }
	.gp-badge {
		display: inline-block;
		margin-left: 0.35rem;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.6875rem; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.03em;
	}
	.gp-badge--reconfirm { background: rgba(245,158,11,0.2); color: #b45309; }
	.gp-hint { display: block; font-size: 0.7rem; color: var(--muted); margin-top: 0.15rem; }

	/* Room label */
	.gp-room-label { font-size: 0.8125rem; color: var(--text); }
	.gp-room-unassigned {
		font-size: 0.8125rem; font-weight: 500;
		color: #b45309;
	}
	.gp-muted { color: var(--muted); font-size: 0.8125rem; }

	/* Amount cell + payment badges */
	.gp-amount-cell { display: flex; flex-direction: column; gap: 0.2rem; }
	.gp-amount-plain { font-weight: 600; color: var(--text); }
	.gp-payment-badge {
		display: inline-block;
		font-size: 0.6875rem; font-weight: 600;
		text-transform: uppercase; letter-spacing: 0.03em;
	}
	.gp-payment-badge--paid   { color: #16a34a; }
	.gp-payment-badge--unpaid { color: #b45309; }
	.gp-payment-badge--none   { color: var(--muted); }

	/* Amount button */
	.gp-amount-btn {
		display: inline-flex; align-items: center; gap: 0.3rem;
		background: none; border: none; padding: 0; font: inherit;
		color: var(--slate); cursor: pointer; font-weight: 600;
		text-decoration: underline; text-underline-offset: 2px;
	}
	.gp-amount-btn:hover { color: var(--warm); }

	/* Check/cross */
	.gp-check {
		display: inline-flex; align-items: center; justify-content: center;
		width: 22px; height: 22px; border-radius: 50%;
		background: rgba(34,197,94,0.12); color: #16a34a;
	}
	.gp-cross {
		display: inline-flex; align-items: center; justify-content: center;
		width: 22px; height: 22px; border-radius: 50%;
		background: var(--surface2); color: var(--muted);
	}

	/* Action icon buttons */
	.gp-actions { display: flex; align-items: center; gap: 0.3rem; justify-content: flex-end; }
	.gp-icon-btn {
		display: inline-flex; align-items: center; justify-content: center;
		width: 30px; height: 30px; border-radius: 7px;
		border: 1px solid var(--border-soft); background: var(--surfaceSolid);
		color: var(--muted); cursor: pointer; text-decoration: none;
		transition: background 130ms, color 130ms, border-color 130ms;
	}
	.gp-icon-btn:hover { background: var(--surface2); color: var(--text); }
	.gp-icon-btn--edit:hover { color: var(--slate); border-color: var(--slate); }
	.gp-icon-btn--msg  { color: #2563eb; border-color: rgba(37,99,235,0.3); }
	.gp-icon-btn--msg:hover { background: rgba(37,99,235,0.08); }
	.gp-icon-btn--nudge { color: var(--warm); border-color: rgba(206,86,18,0.4); }
	.gp-icon-btn--nudge:hover:not(:disabled) { background: rgba(206,86,18,0.1); }
	.gp-icon-btn--nudge img { display: block; }
	.gp-icon-btn--disabled,
	.gp-icon-btn--nudge:disabled { color: var(--muted); border-color: var(--border-soft); cursor: default; opacity: 0.5; }
	.gp-icon-btn--remove { color: #dc2626; border-color: rgba(220,38,38,0.3); }
	.gp-icon-btn--remove:hover { background: rgba(220,38,38,0.08); color: #b91c1c; }

	/* Card footer */
	.gp-card-footer {
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--border-soft);
	}
	.gp-empty { color: var(--muted); font-size: 0.875rem; padding: 1.5rem 1.25rem; margin: 0; }
	.gp-inline-form { display: inline; }

	/* ── Waitlist panel ── */
	.gp-waitlist-card { padding: 1rem 1.25rem; }
	.gp-waitlist-header {
		display: flex; align-items: center; gap: 0.625rem;
		margin-bottom: 0.875rem;
	}
	.gp-waitlist-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 0.95rem; font-weight: 600; color: var(--text);
	}
	.gp-waitlist-badge {
		background: #1a3a4a; color: #fff;
		font-size: 0.72rem; font-weight: 700;
		border-radius: 99px; padding: 1px 8px;
	}
	.gp-waitlist-cap {
		font-size: 0.75rem; color: var(--muted);
		background: var(--surface2); border-radius: 6px; padding: 1px 8px;
	}
	.gp-waitlist-list { display: flex; flex-direction: column; gap: 0.375rem; }
	.gp-waitlist-row {
		display: flex; align-items: center; gap: 0.75rem;
		background: var(--surface2); border-radius: 8px; padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-soft);
	}
	.gp-waitlist-row--active {
		background: #f0fbf5; border-color: #a8d8b8;
	}
	.gp-waitlist-pos {
		font-size: 0.825rem; font-weight: 700; color: #1a3a4a;
		min-width: 2rem; text-align: center;
	}
	.gp-waitlist-info { flex: 1; min-width: 0; }
	.gp-waitlist-name { font-size: 0.875rem; font-weight: 600; color: var(--text); display: block; }
	.gp-waitlist-email { font-size: 0.775rem; color: var(--muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.gp-waitlist-claim-badge { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; flex-shrink: 0; }
	.gp-waitlist-claim-label {
		font-size: 0.72rem; font-weight: 700; color: #1a4a2e;
		background: #d1f0e0; border-radius: 6px; padding: 1px 8px;
		white-space: nowrap;
	}
	.gp-waitlist-claim-exp { font-size: 0.7rem; color: #5a7a63; }

	/* ── Section header (legacy / removed) ── */
	.gp-section-header {
		display: flex; align-items: flex-start; justify-content: space-between;
		flex-wrap: wrap; gap: 0.75rem;
		padding: 1.125rem 1.25rem 0.875rem;
		border-bottom: 1px solid var(--border-soft);
	}
	.gp-section-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem; font-weight: 600; margin: 0; color: var(--text);
	}
	.gp-section-hint { font-size: 0.8125rem; color: var(--muted); margin: 0.2rem 0 0; }

	/* Legacy stats */
	.gp-legacy-stats {
		display: flex; gap: 1.25rem; flex-wrap: wrap;
		padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-soft);
	}
	.gp-legacy-stat { display: flex; flex-direction: column; gap: 0.1rem; font-size: 0.875rem; }
	.gp-legacy-stat-lbl { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
	.gp-legacy-stat strong { font-size: 1.125rem; font-weight: 700; color: var(--text); }
	.gp-table--legacy .gp-th { font-size: 0.6875rem; }

	/* ── Removed list ── */
	.gp-removed-list { list-style: none; padding: 0.25rem 1.25rem 1.25rem; margin: 0; display: flex; flex-direction: column; gap: 0; }
	.gp-removed-item {
		display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
		padding: 0.625rem 0; border-bottom: 1px solid var(--border-soft);
	}
	.gp-removed-item:last-child { border-bottom: none; }
	.gp-removed-name { font-weight: 600; font-size: 0.875rem; }
	.gp-removed-email { font-size: 0.8125rem; color: var(--muted); }
	.gp-role-chip { font-size: 0.6875rem; font-weight: 600; padding: 0.15rem 0.45rem; background: var(--surface2); border-radius: 9999px; color: var(--muted); }
	.gp-removed-restore { margin-left: auto; }

	/* ── Modals ── */
	.gp-backdrop { position: fixed; inset: 0; background: rgba(10,20,40,0.35); z-index: 100; backdrop-filter: blur(2px); }
	.gp-modal {
		position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
		background: var(--surfaceSolid); padding: 1.75rem;
		border-radius: 16px; border: 1px solid var(--border-soft);
		box-shadow: 0 20px 60px rgba(0,0,0,0.18);
		z-index: 101; min-width: 22rem; max-width: 90vw; width: 28rem;
		display: flex; flex-direction: column; gap: 0;
	}
	.gp-modal-icon {
		width: 44px; height: 44px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		margin-bottom: 0.875rem; flex-shrink: 0;
	}
	.gp-modal-icon--danger { background: rgba(220,38,38,0.1); color: #dc2626; }
	.gp-modal-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem; color: var(--text);
	}
	.gp-modal-body { font-size: 0.875rem; color: var(--muted); margin: 0 0 1.25rem; line-height: 1.6; }
	.gp-modal-actions { display: flex; gap: 0.625rem; justify-content: flex-end; margin-top: 1.25rem; }
	.gp-form-group { margin-bottom: 1rem; }
	.gp-label { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text); }
	.gp-label-opt { font-weight: 400; color: var(--muted); }
	.gp-input {
		width: 100%; padding: 0.55rem 0.875rem;
		border: 1px solid var(--border-soft); border-radius: 8px;
		font-size: 0.875rem; font-family: inherit;
		background: var(--surfaceSolid); color: var(--text);
	}
	.gp-input:focus { outline: none; border-color: var(--slate); box-shadow: 0 0 0 3px rgba(47,119,120,0.12); }
	.gp-form-error { font-size: 0.875rem; color: #dc2626; margin: 0 0 1rem; }
	.gp-form-warn {
		font-size: 0.875rem;
		color: #92400e;
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(217, 119, 6, 0.35);
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
		margin: 0 0 1rem;
		line-height: 1.5;
	}
	.gp-muted { font-size: 0.875rem; color: var(--muted); margin: 0 0 1rem; }
	.gp-invite-tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; }
	.gp-invite-tab {
		padding: 0.4rem 0.75rem; border-radius: 8px; border: 1px solid var(--border);
		background: var(--bg); color: var(--muted); font-size: 0.875rem; cursor: pointer;
	}
	.gp-invite-tab:hover { background: var(--border-soft); color: var(--text); }
	.gp-invite-tab.active { background: var(--copper); color: white; border-color: var(--copper); }
	.gp-invite-friends { min-height: 8rem; }
	.gp-friends-invite-list { list-style: none; padding: 0; margin: 0 0 1rem; }
	.gp-friends-invite-list li { margin-bottom: 0.5rem; }
	.gp-friends-invite-list form { margin: 0; }
	.gp-friend-invite-row {
		display: flex; align-items: center; gap: 0.75rem;
		padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid var(--border);
		background: var(--surfaceSolid);
	}
	.gp-friend-avatar { width: 2rem; height: 2rem; border-radius: 50%; object-fit: cover; }
	.gp-friend-initials {
		width: 2rem; height: 2rem; border-radius: 50%;
		background: var(--copper); color: white; display: flex; align-items: center; justify-content: center;
		font-size: 0.75rem; font-weight: 600;
	}
	.gp-friend-name { flex: 1; font-size: 0.9375rem; color: var(--text); }
	.gp-btn--sm { padding: 0.35rem 0.75rem; font-size: 0.8125rem; }

	/* ── Responsive ── */
	@media (max-width: 900px) {
		.gp-stats-row { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 768px) {
		.gp-stats-row { grid-template-columns: repeat(2, 1fr); }
		.gp-controls { flex-wrap: wrap; }
		.gp-filters-row { flex-wrap: wrap; gap: 0.5rem; }
		.gp-modal { width: calc(100vw - 2rem); min-width: 0; }
	}
	@media (max-width: 560px) {
		.gp-stats-row { grid-template-columns: repeat(2, 1fr); }
		.gp-filter-label { min-width: 0; }
		.gp-select { min-width: 7rem; }
	}
</style>
