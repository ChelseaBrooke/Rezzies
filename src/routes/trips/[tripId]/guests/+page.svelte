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
		if (!s) return row.type === 'invite' ? 'Pending' : '-';
		if (s === 'invited') return 'Invited';
		if (s === 'accepted') return 'Accepted';
		if (s === 'rsvp_yes') return 'Going';
		if (s === 'rsvp_no') return 'Not going';
		return '-';
	}

	function initials(name: string, email: string): string {
		if (name && name !== '-') {
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

	const guestOverview = $derived.by(() => {
		const s = data.summary;
		const onList = s?.totalInvited ?? 0;
		const rsvpYes = s?.goingCount ?? 0;
		const rsvpNo = s?.notGoingCount ?? 0;
		const awaiting = s?.unrespondedCount ?? 0;
		const peopleIn = s?.goingPartySize ?? 0;
		const cap = capacity;
		const openSlots = cap > 0 ? Math.max(0, cap - peopleIn) : null;
		const overCap = cap > 0 && peopleIn > cap;
		const expected = data.trip?.expectedPeopleCount ?? null;
		const targetPct =
			cap > 0 && expected != null && expected > 0
				? Math.min(100, (expected / cap) * 100)
				: null;
		const pct = (n: number) => (onList > 0 ? (n / onList) * 100 : 0);
		const headcountPct = cap > 0 ? Math.min(100, (peopleIn / cap) * 100) : 0;
		return {
			onList,
			rsvpYes,
			rsvpNo,
			awaiting,
			peopleIn,
			cap,
			openSlots,
			overCap,
			expected,
			targetPct,
			yesListPct: pct(rsvpYes),
			noListPct: pct(rsvpNo),
			waitListPct: pct(awaiting),
			headcountPct
		};
	});

	function toggleRsvpFilter(v: 'all' | 'yes' | 'no' | 'no-response') {
		if (filterRsvp === v) {
			filterRsvp = 'all';
		} else {
			filterRsvp = v;
			filterAssignment = 'all';
			filterDietary = 'all';
			filterPayment = 'all';
			filterApproval = 'all';
		}
	}

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
					r.rsvpStatus ?? '-',
					r.partySize,
					r.roomName ?? '-',
					r.bedType ?? '-',
					r.arrivalDate ?? '-',
					r.departureDate ?? '-',
					r.dietaryRestrictions ?? '-',
					r.allergies ?? '-'
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

	// ── Roster filter + section state ───────────────────────────────────

	let activeFilter = $state<'all' | 'confirmed' | 'pending' | 'declined' | 'unassigned' | 'unpaid'>('all');

	function setActiveFilter(f: typeof activeFilter) {
		activeFilter = f;
		filterRsvp = 'all';
		filterAssignment = 'all';
		filterDietary = 'all';
		filterPayment = 'all';
		filterApproval = 'all';
		if (f === 'confirmed') filterRsvp = 'yes';
		else if (f === 'pending') filterRsvp = 'no-response';
		else if (f === 'declined') filterRsvp = 'no';
		else if (f === 'unassigned') filterAssignment = 'unassigned';
		else if (f === 'unpaid') filterPayment = 'unpaid';
	}

	function scrollToSection(id: string, filter?: typeof activeFilter) {
		if (filter) setActiveFilter(filter);
		setTimeout(() => {
			document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 60);
	}

	// ── Inline invite panel ───────────────────────────────────────────────

	let invitePanelOpen = $state(false);

	function openInvitePanel() {
		invitePanelOpen = true;
		inviteTab = 'email';
		inviteError = '';
		inviteEmailWarning = '';
		inviteName = '';
		inviteEmail = '';
	}

	function closeInvitePanel() {
		invitePanelOpen = false;
		inviteName = '';
		inviteEmail = '';
		inviteRole = 'guest';
		inviteError = '';
		inviteEmailWarning = '';
		inviteFriendError = '';
	}

	function handleInvitePanelSubmit() {
		return async ({
			result
		}: {
			result: {
				type: string;
				data?: { createInviteError?: string; createInviteSuccess?: boolean; createInviteEmailWarning?: string };
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
					closeInvitePanel();
				}
			}
		};
	}

	// ── Attention queue derived ───────────────────────────────────────────

	const unassignedConfirmedCount = $derived(
		(data.guestRows ?? []).filter(
			(r) =>
				r.rsvpStatus === 'yes' &&
				r.yesSubstatus !== 'reconfirm_required' &&
				(r.assignedBedIds?.length ?? 0) === 0 &&
				r.type === 'member'
		).length
	);

	const reconfirmNeededCount = $derived(
		(data.guestRows ?? []).filter(
			(r) => r.rsvpStatus === 'yes' && r.yesSubstatus === 'reconfirm_required'
		).length
	);

	const unpaidConfirmedCount = $derived(
		(data.guestRows ?? []).filter(
			(r) => r.type === 'member' && r.userId && (r.toPayTotal ?? 0) > 0 && !r.invoicePaid
		).length
	);

	const joinRequestCount = $derived(
		(data.guestRows ?? []).filter((r) => r.memberTripState === 'requested').length
	);

	const showAttentionQueue = $derived(
		data.canManageGuests &&
			(unassignedConfirmedCount > 0 ||
				guestOverview.awaiting > 3 ||
				reconfirmNeededCount > 0 ||
				((data.trip as Record<string, unknown>)?.costSharingEnabled === true && unpaidConfirmedCount > 0) ||
				joinRequestCount > 0)
	);

	let nudgeAllLoading = $state(false);

	async function nudgeAllPending() {
		const ids = (data.guestRows ?? [])
			.filter((r) => r.type === 'member' && r.userId && r.role !== 'host' && !r.rsvpStatus)
			.map((r) => r.userId!);
		if (ids.length === 0) return;
		nudgeAllLoading = true;
		const base = typeof window !== 'undefined' ? window.location.origin : '';
		const tid = data.trip?.id ?? '';
		for (const uid of ids) {
			const fd = new FormData();
			fd.set('userId', uid);
			await fetch(`${base}/trips/${tid}/guests?/nudgeUnresponded`, { method: 'POST', body: fd }).catch(
				() => {}
			);
		}
		nudgeAllLoading = false;
		nudgeToast = true;
		setTimeout(() => (nudgeToast = false), 2500);
		await invalidateAll();
	}

	function primaryRoomName(row: GuestRow): string | null {
		const bedIds = row.assignedBedIds ?? [];
		if (bedIds.length === 0) return null;
		for (const room of data.rooms ?? []) {
			if (room.beds?.some((b) => bedIds.includes(b.id))) {
				return room.name?.trim() || `Room ${room.id}`;
			}
		}
		return null;
	}

	function primaryBedType(row: GuestRow): string | null {
		const bedIds = row.assignedBedIds ?? [];
		if (bedIds.length === 0) return null;
		for (const room of data.rooms ?? []) {
			for (const bed of room.beds ?? []) {
				if (bedIds.includes(bed.id)) return bed.bedType || null;
			}
		}
		return null;
	}

	const confirmedRows = $derived(filteredAndSorted.filter((r) => r.rsvpStatus === 'yes'));
	const pendingRows = $derived(
		filteredAndSorted.filter(
			(r) =>
				r.type === 'invite' ||
				(!r.rsvpStatus && r.type === 'member') ||
				r.rsvpStatus === 'no-response' ||
				(r.rsvpStatus === 'yes' && r.yesSubstatus === 'reconfirm_required')
		)
	);
	const declinedRows = $derived(filteredAndSorted.filter((r) => r.rsvpStatus === 'no'));

	const rsvpByDateFormatted = $derived(
		data.trip?.rsvpByDate
			? new Date(data.trip.rsvpByDate).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			: null
	);

	const headerSubLine = $derived.by(() => {
		const parts: string[] = [];
		if (guestOverview.rsvpYes > 0) parts.push(`${guestOverview.rsvpYes} confirmed`);
		if (guestOverview.awaiting > 0) parts.push(`${guestOverview.awaiting} pending`);
		if (guestOverview.rsvpNo > 0) parts.push(`${guestOverview.rsvpNo} declined`);
		const base = parts.join(' · ');
		if (rsvpByDateFormatted)
			return base ? `${base} · RSVP by ${rsvpByDateFormatted}` : `RSVP by ${rsvpByDateFormatted}`;
		return base;
	});

	const gapToMin = $derived(
		guestOverview.expected != null && guestOverview.expected > 0
			? Math.max(0, guestOverview.expected - guestOverview.rsvpYes)
			: null
	);

	const hasCostSharing = $derived((data.trip as Record<string, unknown>)?.costSharingEnabled === true);

</script>

<div class="gp-page">

	<!-- ── ZONE 1: COMMAND STRIP ─────────────────────────────────────── -->
	<div class="gp-cmd">
		<div class="gp-cmd__main">

			<!-- Stats -->
			<div class="gp-cmd__stats">
				<div class="gp-stat">
					<div class="gp-stat__num">{guestOverview.rsvpYes}</div>
					<div class="gp-stat__label">confirmed</div>
					{#if guestOverview.expected}
						<div class="gp-stat__sub">of {guestOverview.expected} expected</div>
					{/if}
				</div>
				<div class="gp-cmd__div" aria-hidden="true"></div>
				<div class="gp-stat">
					<div class="gp-stat__num gp-stat__num--carrot">{guestOverview.awaiting}</div>
					<div class="gp-stat__label">pending</div>
					<div class="gp-stat__sub">haven't responded</div>
				</div>
				<div class="gp-cmd__div" aria-hidden="true"></div>
				<div class="gp-stat">
					<div class="gp-stat__num gp-stat__num--dim">{guestOverview.onList}</div>
					<div class="gp-stat__label">on list</div>
					{#if guestOverview.cap > 0}
						<div class="gp-stat__sub">of {guestOverview.cap} max</div>
					{/if}
				</div>
			</div>

			<!-- Actions -->
			<div class="gp-cmd__actions">
				{#if data.canManageGuests}
					<button type="button" class="gp-invite-btn" onclick={openInvitePanel}>Invite guests</button>
				{/if}
				<div class="gp-cmd__links">
					<button type="button" class="gp-cmd-link" onclick={handleCopyInviteLink}>Copy invite link</button>
					<span class="gp-cmd-sep" aria-hidden="true">·</span>
					<button type="button" class="gp-cmd-link" onclick={exportCsv}>Export CSV</button>
				</div>
				{#if rsvpByDateFormatted}
					<div class="gp-cmd__rsvpby">RSVP by {rsvpByDateFormatted}</div>
				{/if}
			</div>
		</div>

		<!-- Progress bar -->
		{#if guestOverview.cap > 0}
			<div class="gp-cmd__bar-row">
				<div
					class="gp-cmd__track"
					role="img"
					aria-label="{guestOverview.rsvpYes} of {guestOverview.cap} confirmed"
				>
					<div
						class="gp-cmd__fill"
						style="width: {Math.min(100, guestOverview.cap > 0 ? (guestOverview.rsvpYes / guestOverview.cap) * 100 : 0)}%"
					></div>
					{#if guestOverview.expected && guestOverview.expected > 0 && guestOverview.cap > 0}
						<div
							class="gp-cmd__marker"
							style="left: {Math.min(100, (guestOverview.expected / guestOverview.cap) * 100)}%"
							aria-hidden="true"
						>
							<span class="gp-cmd__marker-lbl">min</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Inline invite panel -->
		{#if invitePanelOpen}
			<div class="gp-ipanel">
				<div class="gp-ipanel__tabs">
					<button
						type="button"
						class="gp-itab"
						class:gp-itab--active={inviteTab === 'email'}
						onclick={() => { inviteTab = 'email'; }}
					>By email</button>
					<button
						type="button"
						class="gp-itab"
						class:gp-itab--active={inviteTab === 'friends'}
						onclick={() => { inviteTab = 'friends'; fetchFriendsForInvite(); }}
					>From friends</button>
				</div>

				{#if inviteTab === 'email'}
					<form method="POST" action="?/createInvite" use:enhance={handleInvitePanelSubmit} class="gp-ipanel__form">
						{#if inviteError}
							<p class="gp-ipanel__err" role="alert">{inviteError}</p>
						{/if}
						{#if inviteEmailWarning}
							<p class="gp-ipanel__warn" role="status">{inviteEmailWarning}</p>
						{/if}
						<input
							id="iep-email"
							class="gp-ifield"
							type="email"
							name="email"
							placeholder="Email address"
							bind:value={inviteEmail}
							required
						/>
						<input
							id="iep-name"
							class="gp-ifield gp-ifield--sm"
							type="text"
							name="name"
							placeholder="Name (optional)"
							bind:value={inviteName}
						/>
						<div class="gp-rtoggle-wrap">
							<button
								type="button"
								class="gp-rtoggle"
								class:gp-rtoggle--active={inviteRole === 'guest'}
								onclick={() => (inviteRole = 'guest')}
							>Guest</button>
							<button
								type="button"
								class="gp-rtoggle"
								class:gp-rtoggle--active={inviteRole === 'co-host'}
								onclick={() => (inviteRole = 'co-host')}
							>Co-host</button>
						</div>
						<input type="hidden" name="role" value={inviteRole} />
						<button type="submit" class="gp-isubmit">Send invite</button>
					</form>
				{:else}
					<div class="gp-ifriends">
						{#if inviteFriendError}
							<p class="gp-ipanel__err" role="alert">{inviteFriendError}</p>
						{/if}
						{#if friendsLoading}
							<p class="gp-ipanel__hint">Loading friends...</p>
						{:else if invitableFriends.length === 0}
							<p class="gp-ipanel__hint">
								{friendsList.length === 0
									? "You don't have any friends yet. Invite by email instead."
									: 'All your friends are already on this trip.'}
							</p>
						{:else}
							<ul class="gp-ifriends__list">
								{#each invitableFriends as friend}
									<li class="gp-ifriends__row">
										<form
											method="POST"
											action="?/inviteFriend"
											use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success' && result.data?.inviteFriendSuccess) {
														await invalidateAll();
													}
													if (result.type === 'success' && result.data?.inviteFriendError) {
														inviteFriendError = String(result.data.inviteFriendError ?? '');
													}
												};
											}}
										>
											<input type="hidden" name="friendUserId" value={friend.id} />
											{#if friend.avatarUrl}
												<img src={friend.avatarUrl} alt="" class="gp-ifriends__av" />
											{:else}
												<span class="gp-ifriends__av gp-ifriends__av--init">
													{friend.name ? friend.name.slice(0, 2).toUpperCase() : '?'}
												</span>
											{/if}
											<span class="gp-ifriends__name">{friend.name ?? 'Traveler'}</span>
											<button type="submit" class="gp-ifriends__btn">Invite</button>
										</form>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}

				<div class="gp-ipanel__footer">
					{#if data.isHost}
						<button
							type="button"
							class="gp-ipanel__manual"
							onclick={() => { closeInvitePanel(); openAddManual(); }}
						>Add manually instead</button>
					{/if}
					<button type="button" class="gp-ipanel__cancel" onclick={closeInvitePanel}>Cancel</button>
				</div>
			</div>
		{/if}

		<!-- Toasts -->
		{#if copyToast}
			<div class="gp-cmd-toast" role="status">Link copied</div>
		{/if}
		{#if nudgeToast}
			<div class="gp-cmd-toast" role="status">Nudge sent</div>
		{/if}
	</div>

	<!-- ── ZONE 2: ATTENTION QUEUE ────────────────────────────────────── -->
	{#if showAttentionQueue}
		<div class="gp-attn">
			<div class="gp-attn__cards">

				{#if unassignedConfirmedCount > 0}
					<div class="gp-acard">
						<div class="gp-acard__hdr">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
							<span class="gp-acard__label">Unassigned</span>
						</div>
						<p class="gp-acard__text">
							{unassignedConfirmedCount} confirmed {unassignedConfirmedCount === 1 ? 'guest' : 'guests'} without a bed
						</p>
						<button
							type="button"
							class="gp-acard__btn"
							onclick={() => scrollToSection('section-confirmed', 'unassigned')}
						>Assign beds</button>
					</div>
				{/if}

				{#if guestOverview.awaiting > 3}
					<div class="gp-acard">
						<div class="gp-acard__hdr">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
							<span class="gp-acard__label">No response</span>
						</div>
						<p class="gp-acard__text">{guestOverview.awaiting} people haven't responded</p>
						<p class="gp-acard__sub">Tap Remind to send a nudge.</p>
						<button
							type="button"
							class="gp-acard__btn"
							onclick={nudgeAllPending}
							disabled={nudgeAllLoading}
						>{nudgeAllLoading ? 'Sending...' : 'Remind all'}</button>
					</div>
				{/if}

				{#if reconfirmNeededCount > 0}
					<div class="gp-acard">
						<div class="gp-acard__hdr">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg>
							<span class="gp-acard__label">Reconfirm needed</span>
						</div>
						<p class="gp-acard__text">
							{reconfirmNeededCount} {reconfirmNeededCount === 1 ? 'guest needs' : 'guests need'} to reconfirm
						</p>
						<button
							type="button"
							class="gp-acard__btn"
							onclick={() => scrollToSection('section-confirmed')}
						>Send reminder</button>
					</div>
				{/if}

				{#if hasCostSharing && unpaidConfirmedCount > 0}
					<div class="gp-acard">
						<div class="gp-acard__hdr">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
							<span class="gp-acard__label">Unpaid</span>
						</div>
						<p class="gp-acard__text">
							{unpaidConfirmedCount} {unpaidConfirmedCount === 1 ? 'guest has' : 'guests have'} an outstanding balance
						</p>
						<button
							type="button"
							class="gp-acard__btn"
							onclick={() => scrollToSection('section-roster', 'unpaid')}
						>View unpaid</button>
					</div>
				{/if}

				{#if joinRequestCount > 0}
					<div class="gp-acard">
						<div class="gp-acard__hdr">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
							<span class="gp-acard__label">Join requests</span>
						</div>
						<p class="gp-acard__text">
							{joinRequestCount} {joinRequestCount === 1 ? 'person wants' : 'people want'} to join
						</p>
						<button
							type="button"
							class="gp-acard__btn"
							onclick={() => scrollToSection('section-pending')}
						>Review</button>
					</div>
				{/if}

			</div>
		</div>
	{/if}

	<!-- ── ZONE 3: ROSTER ─────────────────────────────────────────────── -->
	<div class="gp-roster" id="section-roster">

		<!-- Filter pills -->
		<div class="gp-filters" role="group" aria-label="Filter guests">
			<button type="button" class="gp-fpill" class:gp-fpill--active={activeFilter === 'all'} onclick={() => setActiveFilter('all')}>Everyone</button>
			<button type="button" class="gp-fpill" class:gp-fpill--active={activeFilter === 'confirmed'} onclick={() => setActiveFilter('confirmed')}>Confirmed</button>
			<button type="button" class="gp-fpill" class:gp-fpill--active={activeFilter === 'pending'} onclick={() => setActiveFilter('pending')}>Pending</button>
			<button type="button" class="gp-fpill" class:gp-fpill--active={activeFilter === 'declined'} onclick={() => setActiveFilter('declined')}>Declined</button>
			<button type="button" class="gp-fpill" class:gp-fpill--active={activeFilter === 'unassigned'} onclick={() => setActiveFilter('unassigned')}>Unassigned</button>
			{#if hasCostSharing}
				<button type="button" class="gp-fpill" class:gp-fpill--active={activeFilter === 'unpaid'} onclick={() => setActiveFilter('unpaid')}>Unpaid</button>
			{/if}
		</div>

		{#if roomSaveError}
			<div class="gp-err-bar" role="alert">
				{roomSaveError}
				<button type="button" class="gp-err-dismiss" onclick={() => (roomSaveError = null)} aria-label="Dismiss">x</button>
			</div>
		{/if}

		<!-- Confirmed section -->
		<div class="gp-section" id="section-confirmed">
			<div class="gp-section__hdr">
				<h2 class="gp-section__title">Confirmed</h2>
				<span class="gp-section__badge">{confirmedRows.length}</span>
			</div>
			<div class="gp-section__rule" role="separator"></div>
			{#if confirmedRows.length === 0}
				<div class="gp-empty">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="gp-empty__icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					<h3 class="gp-empty__title">No one has confirmed yet</h3>
					<p class="gp-empty__sub">Share the invite link to start getting RSVPs.</p>
				</div>
			{:else}
				<div class="gp-rows">
					{#each confirmedRows as row (row.userId ?? row.inviteId)}
						{@render guestRow(row)}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Pending section -->
		<div class="gp-section" id="section-pending">
			<div class="gp-section__hdr">
				<h2 class="gp-section__title">Pending</h2>
				<span class="gp-section__badge">{pendingRows.length}</span>
			</div>
			<div class="gp-section__rule" role="separator"></div>
			{#if pendingRows.length === 0}
				<div class="gp-empty">
					<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="gp-empty__icon gp-empty__icon--green"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
					<h3 class="gp-empty__title">Everyone has responded.</h3>
				</div>
			{:else}
				<div class="gp-rows">
					{#each pendingRows as row (row.userId ?? row.inviteId)}
						{@render guestRow(row)}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Declined section (hidden when empty) -->
		{#if declinedRows.length > 0}
			<div class="gp-section" id="section-declined">
				<div class="gp-section__hdr">
					<h2 class="gp-section__title">Declined</h2>
					<span class="gp-section__badge">{declinedRows.length}</span>
				</div>
				<div class="gp-section__rule" role="separator"></div>
				<div class="gp-rows">
					{#each declinedRows as row (row.userId ?? row.inviteId)}
						{@render guestRow(row)}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Waitlist section -->
		{#if data.canManageGuests && (data.waitlistCount ?? 0) > 0}
			{@const waitlistEntries = data.waitlistEntries ?? []}
			<div class="gp-section">
				<div class="gp-section__hdr">
					<h2 class="gp-section__title">Waitlist ({data.waitlistCount})</h2>
				</div>
				<p class="gp-section__hint">Guests are notified automatically when a spot opens.</p>
				<div class="gp-section__rule" role="separator"></div>
				<div class="gp-rows">
					{#each waitlistEntries as entry, i (entry.userId)}
						<div class="gp-row">
							<div class="gp-row__av-wrap">
								<span class="gp-av gp-av--init">{initials(entry.name, entry.email)}</span>
							</div>
							<div class="gp-row__identity">
								<span class="gp-row__name">{entry.name}</span>
								{#if entry.email}<span class="gp-row__email">{entry.email}</span>{/if}
							</div>
							<div class="gp-row__status">
								<span class="gp-pill gp-pill--waitlist">#{entry.waitlistPosition ?? i + 1}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

	</div>

	<!-- ── LEGACY BOOKINGS ─────────────────────────────────────────────── -->
	{#if data.canManageGuests && ((data.legacyReservations?.length ?? 0) > 0 || (data.legacyStats?.totalReservations ?? 0) > 0)}
		<div class="gp-legacy-card">
			<div class="gp-legacy-card__head">
				<div>
					<h3 class="gp-legacy-title">Legacy bookings</h3>
					<p class="gp-hint-text">Bookings from the public trip link (before the RSVP flow). Read-only.</p>
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
						<button type="submit" class="gp-ghost-btn">Export CSV</button>
					</form>
				{/if}
			</div>
			{#if data.legacyStats && data.legacyStats.totalReservations > 0}
				<div class="gp-legacy-stats">
					<span class="gp-legacy-stat"><span class="gp-legacy-stat__lbl">Reservations</span><strong>{data.legacyStats.totalReservations}</strong></span>
					<span class="gp-legacy-stat"><span class="gp-legacy-stat__lbl">Revenue</span><strong>${data.legacyStats.totalRevenue.toFixed(2)}</strong></span>
					<span class="gp-legacy-stat"><span class="gp-legacy-stat__lbl">Nights</span><strong>{data.legacyStats.totalNights}</strong></span>
					<span class="gp-legacy-stat"><span class="gp-legacy-stat__lbl">Avg</span><strong>${data.legacyStats.averagePrice.toFixed(2)}</strong></span>
				</div>
			{/if}
			{#if (data.legacyReservations?.length ?? 0) === 0}
				<p class="gp-hint-text">No legacy bookings for this trip.</p>
			{:else}
				<ul class="gp-legacy-list" role="list">
					{#each data.legacyReservations ?? [] as r}
						<li class="gp-legacy-row" role="listitem">
							<span class="gp-legacy-row__name">{r.name}</span>
							<span class="gp-legacy-row__email">{r.email}</span>
							<span class="gp-legacy-row__meta">{r.roomName} · {r.nights} nights · ${r.calculatedPrice.toFixed(2)}</span>
							<span class="gp-legacy-row__date">{formatDate(r.checkInDate)}</span>
						</li>
					{/each}
					{#if data.legacyStats && data.legacyStats.totalReservations > 0}
						<li class="gp-legacy-row gp-legacy-row--total" role="listitem">
							<span class="gp-legacy-row__name"><strong>Total</strong></span>
							<span class="gp-legacy-row__meta"><strong>${data.legacyStats.totalRevenue.toFixed(2)}</strong></span>
						</li>
					{/if}
				</ul>
			{/if}
		</div>
	{/if}

	<!-- ── REMOVED GUESTS ──────────────────────────────────────────────── -->
	{#if data.canManageGuests && (data.removedRows?.length ?? 0) > 0}
		<div class="gp-removed-card">
			<h3 class="gp-legacy-title">Removed from trip</h3>
			<p class="gp-hint-text">These people were removed by a host. They no longer have access. You can restore them at any time.</p>
			<ul class="gp-removed-list" role="list">
				{#each data.removedRows as removed (removed.userId)}
					<li class="gp-removed-item" role="listitem">
						<span class="gp-av gp-av--init gp-av--sm">{initials(removed.name, removed.email)}</span>
						<div class="gp-removed-info">
							<span class="gp-removed-info__name">{removed.name}</span>
							<span class="gp-removed-info__email">{removed.email}</span>
						</div>
						{#if removed.role === 'co-host'}<span class="gp-role-chip">Co-host</span>{/if}
						<form method="POST" action="?/restoreGuest" use:enhance={() => invalidateAll()}>
							<input type="hidden" name="userId" value={removed.userId} />
							<button type="submit" class="gp-ghost-btn">Restore</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

</div>

<!-- ── GUEST ROW SNIPPET ─────────────────────────────────────────────── -->
{#snippet guestRow(row: GuestRow)}
	{@const roomName = primaryRoomName(row)}
	{@const bedType = primaryBedType(row)}
	{@const isConfirmed = row.rsvpStatus === 'yes' && row.yesSubstatus !== 'reconfirm_required'}
	{@const isReconfirm = row.rsvpStatus === 'yes' && row.yesSubstatus === 'reconfirm_required'}
	{@const isDeclined = row.rsvpStatus === 'no'}
	{@const isPendingApproval = row.type === 'member' && row.memberTripState === 'requested'}
	{@const isInvite = row.type === 'invite'}
	<div class="gp-row">

		<!-- Avatar -->
		<div class="gp-row__av-wrap">
			{#if row.avatarUrl}
				<img src={row.avatarUrl} alt="" class="gp-av gp-av--img" />
			{:else}
				<span class="gp-av gp-av--init">{initials(row.name, row.email)}</span>
			{/if}
			{#if row.role === 'co-host'}
				<span class="gp-av__star" aria-label="Co-host">
					<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
				</span>
			{/if}
		</div>

		<!-- Identity -->
		<div class="gp-row__identity">
			{#if row.userId}
				<ProfileTooltip userId={row.userId}>
					<button type="button" class="gp-row__name-btn" onclick={() => openProfileCard(row.userId!)}>
						<span class="gp-row__name">{row.name || row.email}</span>
					</button>
				</ProfileTooltip>
			{:else}
				<span class="gp-row__name">{row.name || row.email}</span>
			{/if}
			{#if row.partySize > 1 && isConfirmed}
				<span class="gp-party-chip">Party of {row.partySize}</span>
			{/if}
			{#if row.email && row.email !== '-' && row.name}
				<span class="gp-row__email">{row.email}</span>
			{/if}
		</div>

		<!-- Room and bed -->
		<div class="gp-row__room">
			{#if roomName}
				<span class="gp-row__room-name">{roomName}</span>
				{#if bedType}<span class="gp-row__bed-type">{bedType}</span>{/if}
			{:else if (isConfirmed || isReconfirm) && data.canManageGuests}
				<button type="button" class="gp-row__assign-link" onclick={() => (editModalRow = row)}>Assign bed</button>
			{:else}
				<span class="gp-row__dash">-</span>
			{/if}
		</div>

		<!-- Amount -->
		<div class="gp-row__amount">
			{#if (row.toPayTotal ?? 0) > 0}
				{#if data.canManageGuests && row.userId}
					<button
						type="button"
						class="gp-row__amount-val gp-row__amount-val--btn"
						onclick={() => (invoiceModalRow = row)}
						title="View invoice"
					>{formatCurrency(row.toPayTotal ?? 0)}</button>
				{:else}
					<span class="gp-row__amount-val">{formatCurrency(row.toPayTotal ?? 0)}</span>
				{/if}
				{#if row.type === 'member' && row.userId}
					{#if row.invoicePaid}
						<span class="gp-row__pay gp-row__pay--paid">Paid</span>
					{:else}
						<span class="gp-row__pay gp-row__pay--unpaid">Unpaid</span>
					{/if}
				{/if}
			{:else}
				<span class="gp-row__dash">-</span>
			{/if}
		</div>

		<!-- Status -->
		<div class="gp-row__status">
			{#if isReconfirm}
				<span class="gp-pill gp-pill--reconfirm">Needs reconfirm</span>
				{#if row.reconfirmDeadlineAt}
					<span class="gp-pill-sub">by {new Date(row.reconfirmDeadlineAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</span>
				{/if}
			{:else if isConfirmed}
				<span class="gp-pill gp-pill--yes">Going</span>
			{:else if isDeclined}
				<span class="gp-pill gp-pill--no">Declined</span>
			{:else if isPendingApproval}
				<span class="gp-pill gp-pill--requested">Requested to join</span>
			{:else if isInvite}
				<span class="gp-pill gp-pill--invited">Invited</span>
			{:else}
				<span class="gp-pill gp-pill--pending">No response</span>
			{/if}
		</div>

		<!-- Actions -->
		{#if data.canManageGuests}
			<div class="gp-row__actions">
				{#if isPendingApproval}
					<form method="POST" action="?/restoreGuest" use:enhance={() => invalidateAll()}>
						<input type="hidden" name="userId" value={row.userId ?? ''} />
						<button type="submit" class="gp-act gp-act--approve">Approve</button>
					</form>
					<button type="button" class="gp-act gp-act--decline" onclick={() => (removeTarget = row)}>Decline</button>
				{:else if isInvite && row.inviteId}
					{#if row.recipientUserId}
						<form method="POST" action="?/nudgeUnresponded" use:enhance={() => invalidateAll()}>
							<input type="hidden" name="userId" value={row.recipientUserId} />
							<button type="submit" class="gp-act">Remind</button>
						</form>
					{/if}
					<button type="button" class="gp-act" onclick={() => (editModalRow = row)}>Edit</button>
				{:else if isDeclined}
					<button type="button" class="gp-act" onclick={() => (editModalRow = row)}>Edit</button>
				{:else}
					{#if row.userId && row.role !== 'host'}
						<form method="POST" action="?/nudgeUnresponded" use:enhance={() => invalidateAll()}>
							<input type="hidden" name="userId" value={row.userId} />
							<button type="submit" class="gp-act">Remind</button>
						</form>
					{/if}
					<button type="button" class="gp-act" onclick={() => (editModalRow = row)}>Edit</button>
				{/if}
			</div>
		{/if}

	</div>
{/snippet}

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
	/* ────────────────────────────────────────────────────────────
	   GUESTS PAGE  prefix: gp-
	   ──────────────────────────────────────────────────────────── */

	/* Page shell */
	.gp-page {
		display: flex;
		flex-direction: column;
		min-height: 100%;
		background: var(--bg-warm);
	}

	/* ═══════════════════════════════════════════════════════════
	   ZONE 1 - COMMAND STRIP
	   ═══════════════════════════════════════════════════════════ */

	.gp-cmd {
		background: var(--navy);
		color: white;
		padding: 20px 36px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.gp-cmd__main {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
	}

	.gp-cmd__stats {
		display: flex;
		align-items: center;
		gap: 0;
		flex-wrap: wrap;
	}

	.gp-cmd__div {
		width: 1px;
		height: 56px;
		background: rgba(255, 255, 255, 0.2);
		margin: 0 28px;
		flex-shrink: 0;
		align-self: center;
	}

	.gp-stat { display: flex; flex-direction: column; gap: 2px; }

	.gp-stat__num {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 48px;
		font-weight: 600;
		color: white;
		line-height: 1;
		letter-spacing: -0.03em;
	}
	.gp-stat__num--carrot { color: var(--carrot); }
	.gp-stat__num--dim { color: rgba(255, 255, 255, 0.75); }

	.gp-stat__label {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
	}

	.gp-stat__sub {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.45);
	}

	.gp-cmd__actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		flex-shrink: 0;
	}

	.gp-invite-btn {
		height: 42px;
		padding: 0 20px;
		background: var(--warm);
		color: white;
		border: none;
		border-radius: var(--radius-lg);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: background 140ms;
		white-space: nowrap;
	}
	.gp-invite-btn:hover { background: var(--chocolate); }

	.gp-cmd__links { display: flex; align-items: center; gap: 8px; }

	.gp-cmd-link {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		transition: color 140ms;
	}
	.gp-cmd-link:hover { color: white; }

	.gp-cmd-sep { color: rgba(255, 255, 255, 0.3); font-size: 12px; }

	.gp-cmd__rsvpby {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
	}

	/* Progress bar */
	.gp-cmd__bar-row { width: 100%; }

	.gp-cmd__track {
		position: relative;
		height: 6px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.12);
		overflow: visible;
	}

	.gp-cmd__fill {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: white;
		border-radius: 3px;
		transition: width 0.4s ease;
		min-width: 0;
	}

	.gp-cmd__marker {
		position: absolute;
		top: -4px;
		width: 1.5px;
		height: 14px;
		background: rgba(255, 255, 255, 0.5);
		border-radius: 1px;
		transform: translateX(-50%);
	}

	.gp-cmd__marker-lbl {
		position: absolute;
		top: -16px;
		left: 50%;
		transform: translateX(-50%);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.4);
		font-weight: 500;
		white-space: nowrap;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	/* Inline invite panel */
	.gp-ipanel {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-top: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.gp-ipanel__tabs {
		display: flex;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 2px;
		width: fit-content;
	}

	.gp-itab {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		padding: 6px 14px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 140ms;
	}
	.gp-itab--active { background: white; color: var(--navy); }

	.gp-ipanel__form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 480px;
	}

	.gp-ifield {
		height: 44px;
		padding: 0 14px;
		background: white;
		border: none;
		border-radius: 10px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 14px;
		color: var(--navy);
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}
	.gp-ifield--sm { height: 38px; font-size: 13px; }
	.gp-ifield:focus { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4); }

	.gp-rtoggle-wrap {
		display: flex;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 2px;
		width: fit-content;
	}

	.gp-rtoggle {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 600;
		padding: 5px 14px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 140ms;
	}
	.gp-rtoggle--active { background: white; color: var(--navy); }

	.gp-isubmit {
		height: 44px;
		background: var(--warm);
		color: white;
		border: none;
		border-radius: 10px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: background 140ms;
		max-width: 480px;
	}
	.gp-isubmit:hover { background: var(--chocolate); }

	.gp-ifriends { display: flex; flex-direction: column; gap: 8px; max-width: 480px; }

	.gp-ifriends__list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 220px;
		overflow-y: auto;
	}

	.gp-ifriends__row form { display: flex; align-items: center; gap: 10px; }

	.gp-ifriends__av {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}
	.gp-ifriends__av--init {
		background: rgba(255, 255, 255, 0.15);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 12px;
		font-weight: 600;
	}

	.gp-ifriends__name { flex: 1; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: white; }

	.gp-ifriends__btn {
		height: 28px;
		padding: 0 12px;
		background: rgba(255, 255, 255, 0.12);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 6px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: background 140ms;
	}
	.gp-ifriends__btn:hover { background: rgba(255, 255, 255, 0.22); }

	.gp-ipanel__footer { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

	.gp-ipanel__cancel {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		transition: color 140ms;
	}
	.gp-ipanel__cancel:hover { color: white; }

	.gp-ipanel__manual {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.45);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		transition: color 140ms;
	}
	.gp-ipanel__manual:hover { color: rgba(255, 255, 255, 0.7); }

	.gp-ipanel__err { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: rgba(255, 140, 140, 1); margin: 0; }
	.gp-ipanel__warn { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--carrot); margin: 0; }
	.gp-ipanel__hint { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: rgba(255, 255, 255, 0.6); margin: 0; }

	.gp-cmd-toast {
		position: fixed;
		bottom: 24px;
		right: 24px;
		background: var(--navy);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		padding: 10px 16px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		z-index: 500;
		pointer-events: none;
	}

	/* ═══════════════════════════════════════════════════════════
	   ZONE 2 - ATTENTION QUEUE
	   ═══════════════════════════════════════════════════════════ */

	.gp-attn {
		background: var(--surface-attention);
		border-top: 1px solid rgba(247, 170, 41, 0.2);
		border-bottom: 2px solid rgba(247, 170, 41, 0.18);
		padding: 16px 36px;
	}

	.gp-attn__cards {
		display: flex;
		gap: 12px;
		overflow-x: auto;
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.gp-attn__cards::-webkit-scrollbar { display: none; }

	.gp-acard {
		background: white;
		border: 1px solid rgba(247, 170, 41, 0.3);
		border-radius: 12px;
		padding: 14px 16px;
		min-width: 200px;
		max-width: 260px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		box-shadow: 0 1px 4px rgba(247, 170, 41, 0.08);
	}

	.gp-acard__hdr { display: flex; align-items: center; gap: 5px; color: var(--amber-text); }

	.gp-acard__label {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--amber-text);
		margin-bottom: 6px;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.gp-acard__text {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 4px;
		line-height: 1.3;
	}

	.gp-acard__sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: var(--muted); margin: 0 0 10px; }

	.gp-acard__btn {
		height: 28px;
		padding: 0 12px;
		border: 1px solid rgba(206, 86, 18, 0.35);
		background: white;
		color: var(--warm);
		border-radius: 8px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: background 150ms, color 150ms;
		margin-top: 2px;
		align-self: flex-start;
	}
	.gp-acard__btn:hover { background: var(--warm); color: white; }
	.gp-acard__btn:disabled { opacity: 0.5; cursor: default; }

	/* ═══════════════════════════════════════════════════════════
	   ZONE 3 - ROSTER
	   ═══════════════════════════════════════════════════════════ */

	.gp-roster {
		background: var(--bg-warm);
		padding: 32px 36px;
		display: flex;
		flex-direction: column;
	}

	.gp-filters {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		-ms-overflow-style: none;
		scrollbar-width: none;
		margin-bottom: 32px;
		flex-wrap: nowrap;
	}
	.gp-filters::-webkit-scrollbar { display: none; }

	.gp-fpill {
		background: white;
		border: 1px solid var(--border);
		color: var(--muted);
		padding: 6px 14px;
		border-radius: 999px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: border-color 140ms, color 140ms, background 140ms;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.gp-fpill:hover { border-color: var(--navy); color: var(--navy); }
	.gp-fpill--active { background: var(--navy); color: white; border-color: var(--navy); font-weight: 700; }
	.gp-fpill--active:hover { background: var(--navy); }

	.gp-err-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(239, 68, 68, 0.07);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 8px;
		padding: 10px 14px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		color: var(--red-text);
		margin-bottom: 16px;
	}
	.gp-err-dismiss { background: none; border: none; cursor: pointer; color: inherit; font-size: 16px; padding: 0; }

	.gp-section { display: flex; flex-direction: column; margin-bottom: 48px; }
	.gp-section:last-child { margin-bottom: 0; }

	.gp-section__hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }

	.gp-section__title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 20px;
		font-weight: 600;
		color: var(--navy);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.gp-section__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		border-radius: 999px;
		padding: 0 7px;
		margin-left: 8px;
		vertical-align: middle;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 700;
		background: rgba(29, 77, 78, 0.08);
		color: var(--navy);
	}

	#section-confirmed .gp-section__badge {
		background: rgba(29, 158, 117, 0.14);
		color: var(--green-deep);
	}

	#section-pending .gp-section__badge {
		background: rgba(247, 170, 41, 0.16);
		color: var(--amber-text-dark);
	}

	#section-declined .gp-section__badge {
		background: rgba(239, 68, 68, 0.1);
		color: var(--red-text);
	}

	.gp-section__rule { height: 1px; background: var(--border); }

	.gp-section__hint { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--muted); margin: 0 0 8px; }

	/* Guest rows */
	.gp-rows { display: flex; flex-direction: column; }

	.gp-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 0;
		border-bottom: 1px solid var(--border);
		min-height: 64px;
	}
	.gp-row:last-child { border-bottom: none; }

	/* Avatar */
	.gp-row__av-wrap { position: relative; flex-shrink: 0; }

	.gp-av {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.gp-av--img { object-fit: cover; border: 1.5px solid rgba(29, 77, 78, 0.12); }

	.gp-av--init {
		background: linear-gradient(135deg, rgba(29, 77, 78, 0.1) 0%, rgba(47, 119, 120, 0.2) 100%);
		color: var(--navy);
		font-family: 'Fraunces', Georgia, serif;
		font-size: 15px;
		font-weight: 600;
		border: 1.5px solid rgba(29, 77, 78, 0.15);
	}

	.gp-av--sm { width: 32px; height: 32px; font-size: 11px; }

	.gp-av__star {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--carrot);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	/* Identity */
	.gp-row__identity { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }

	.gp-row__name-btn { background: none; border: none; padding: 0; cursor: pointer; text-align: left; width: fit-content; }

	.gp-row__name {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 14px;
		font-weight: 700;
		color: var(--navy);
		line-height: 1.2;
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.gp-row__name-btn:hover .gp-row__name { text-decoration: underline; }

	.gp-row__email {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 400;
		color: var(--muted);
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.gp-party-chip {
		display: inline-block;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 7px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 10px;
		color: var(--muted);
		width: fit-content;
		margin-top: 2px;
	}

	/* Room / bed */
	.gp-row__room { width: 120px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1px; }

	.gp-row__room-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 600; color: var(--text); }

	.gp-row__bed-type { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: var(--muted); }

	.gp-row__assign-link {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: var(--slate);
		text-align: left;
		text-decoration: none;
	}
	.gp-row__assign-link:hover { text-decoration: underline; color: var(--navy); }

	.gp-row__dash { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--muted); }

	/* Amount */
	.gp-row__amount { width: 88px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px; }

	.gp-row__amount-val {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 14px;
		font-weight: 600;
		color: var(--navy);
		letter-spacing: -0.01em;
		display: block;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
	}
	.gp-row__amount-val--btn { cursor: pointer; }
	.gp-row__amount-val--btn:hover { text-decoration: underline; }

	.gp-row__pay { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; font-weight: 600; margin-top: 2px; }
	.gp-row__pay--paid { color: var(--green-mid); }
	.gp-row__pay--unpaid { color: var(--warm); }

	/* Status pills */
	.gp-row__status { width: 110px; flex-shrink: 0; display: flex; flex-direction: column; gap: 3px; }

	.gp-pill {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 4px 10px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		font-weight: 700;
		white-space: nowrap;
		width: fit-content;
	}

	.gp-pill--yes { background: rgba(29, 158, 117, 0.12); color: var(--green-deep); border: 1px solid rgba(29, 158, 117, 0.25); }
	.gp-pill--reconfirm { background: rgba(247, 170, 41, 0.14); color: var(--amber-text-dark); border: 1px solid rgba(247, 170, 41, 0.35); }
	.gp-pill--pending { background: var(--bg); color: var(--muted); border: 1px solid var(--border); font-weight: 600; }
	.gp-pill--invited { background: var(--bg); color: var(--muted); border: 1px solid var(--border); font-weight: 600; }
	.gp-pill--requested { background: rgba(47, 119, 120, 0.08); color: var(--slate); border: 1px solid rgba(47, 119, 120, 0.2); }
	.gp-pill--no { background: rgba(239, 68, 68, 0.07); color: var(--red-text); border: 1px solid rgba(239, 68, 68, 0.15); }
	.gp-pill--waitlist { background: var(--bg); color: var(--muted); border: 1px solid var(--border); font-weight: 600; }

	.gp-pill-sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; color: var(--muted); margin-top: 3px; font-weight: 500; }

	/* Row action buttons */
	.gp-row__actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
	.gp-row__actions form { display: contents; }

	.gp-act {
		height: 28px;
		padding: 0 11px;
		border: 1px solid var(--border);
		background: white;
		color: var(--muted);
		border-radius: 8px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 120ms, color 120ms;
		white-space: nowrap;
	}
	.gp-act:hover { border-color: var(--navy); color: var(--navy); }

	.gp-act--approve { background: var(--navy); color: white; border-color: var(--navy); }
	.gp-act--approve:hover { opacity: 0.88; background: var(--navy); border-color: var(--navy); color: white; }

	.gp-act--decline { border: 1px solid rgba(206, 86, 18, 0.3); color: var(--warm); background: white; }
	.gp-act--decline:hover { background: rgba(206, 86, 18, 0.05); }

	/* Empty states */
	.gp-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 0; gap: 8px; text-align: center; }

	.gp-empty__icon { color: var(--muted); }
	.gp-empty__icon--green { color: var(--green-mid); }

	.gp-empty__title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 18px;
		font-weight: 600;
		color: var(--navy);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.gp-empty__sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: var(--muted); margin: 0; }

	/* ── Shared utilities ── */
	.gp-ghost-btn {
		height: 36px;
		padding: 0 14px;
		background: white;
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 140ms;
	}
	.gp-ghost-btn:hover { background: var(--bg); }

	.gp-role-chip {
		display: inline-flex;
		align-items: center;
		background: rgba(47, 119, 120, 0.08);
		color: var(--slate);
		border: 1px solid rgba(47, 119, 120, 0.2);
		border-radius: 999px;
		padding: 2px 8px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 10px;
		font-weight: 700;
	}

	.gp-hint-text { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--muted); margin: 0; }

	/* ── Legacy bookings ── */
	.gp-legacy-card {
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0 36px 24px;
	}

	.gp-legacy-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }

	.gp-legacy-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 16px;
		font-weight: 600;
		color: var(--navy);
		margin: 0 0 4px;
		letter-spacing: -0.01em;
	}

	.gp-legacy-stats { display: flex; gap: 20px; flex-wrap: wrap; }

	.gp-legacy-stat { display: flex; flex-direction: column; gap: 2px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--text); }

	.gp-legacy-stat__lbl { font-size: 11px; color: var(--muted); }

	.gp-legacy-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }

	.gp-legacy-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		flex-wrap: wrap;
	}
	.gp-legacy-row:last-child { border-bottom: none; }
	.gp-legacy-row--total { font-weight: 700; }
	.gp-legacy-row__name { min-width: 120px; font-weight: 600; color: var(--navy); }
	.gp-legacy-row__email { color: var(--muted); flex: 1; }
	.gp-legacy-row__meta { color: var(--text); }
	.gp-legacy-row__date { color: var(--muted); margin-left: auto; }

	/* ── Removed guests ── */
	.gp-removed-card {
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0 36px 24px;
	}

	.gp-removed-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }

	.gp-removed-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
	.gp-removed-item:last-child { border-bottom: none; }

	.gp-removed-info { display: flex; flex-direction: column; gap: 1px; flex: 1; }
	.gp-removed-info__name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); }
	.gp-removed-info__email { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: var(--muted); }

	/* ── Modals ── */
	.gp-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 200; }

	.gp-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		border-radius: 16px;
		padding: 28px;
		width: min(440px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		overflow-y: auto;
		z-index: 201;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
	}

	.gp-modal-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
	.gp-modal-icon--danger { background: rgba(239, 68, 68, 0.1); color: var(--red-text); }

	.gp-modal-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 22px;
		font-weight: 600;
		color: var(--navy);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.gp-modal-body { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; color: var(--muted); margin: 0; line-height: 1.5; }

	.gp-modal-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

	.gp-btn {
		height: 40px;
		padding: 0 18px;
		border-radius: var(--radius-lg);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: background 140ms, color 140ms;
	}

	.gp-btn--primary { background: var(--warm); color: white; }
	.gp-btn--primary:hover { background: var(--chocolate); }

	.gp-btn--ghost { background: white; color: var(--text); border: 1px solid var(--border); }
	.gp-btn--ghost:hover { background: var(--bg); }

	.gp-btn--danger { background: rgba(239, 68, 68, 0.9); color: white; }
	.gp-btn--danger:hover { background: var(--red-text); }

	/* Form fields */
	.gp-form-group { display: flex; flex-direction: column; gap: 4px; }

	.gp-label { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); }

	.gp-label-opt { font-weight: 400; color: var(--muted); }

	.gp-input {
		height: 40px;
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		color: var(--text);
		outline: none;
		transition: border-color 140ms;
		width: 100%;
		box-sizing: border-box;
		background: white;
	}
	.gp-input:focus { border-color: var(--slate); }

	.gp-form-error { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--red-text); margin: 0; }

	/* ── Responsive ── */
	@media (max-width: 640px) {
		.gp-cmd { padding: 20px; gap: 16px; }
		.gp-stat__num { font-size: 32px; }
		.gp-cmd__div { height: 40px; margin: 0 16px; }
		.gp-cmd__main { flex-direction: column; align-items: stretch; gap: 16px; }
		.gp-cmd__actions { align-items: stretch; }
		.gp-invite-btn { width: 100%; }
		.gp-cmd__links { justify-content: center; }
		.gp-attn { padding: 14px 20px; }
		.gp-attn__cards { flex-direction: column; overflow-x: unset; }
		.gp-acard { max-width: 100%; min-width: unset; }
		.gp-roster { padding: 20px; }
		.gp-row { flex-wrap: wrap; min-height: unset; }
		.gp-row__room { width: auto; min-width: 80px; }
		.gp-row__amount { width: auto; min-width: 60px; }
		.gp-row__status { width: auto; }
		.gp-row__actions { width: 100%; justify-content: flex-start; padding-top: 4px; }
		.gp-act { height: 32px; }
		.gp-legacy-card { margin: 0 16px 16px; }
		.gp-removed-card { margin: 0 16px 16px; }
	}

</style>
