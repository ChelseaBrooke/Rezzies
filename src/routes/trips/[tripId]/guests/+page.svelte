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
	let viewMode = $state<'list' | 'party'>('list');
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

	type PartyGroup = {
		id: string;
		title: string;
		rows: GuestRow[];
		extraNames: string[];
		size: number;
		isParty: boolean;
	};

	const partiesById = $derived(
		new Map((data.parties ?? []).map((p) => [p.id, p]))
	);

	const partyGroups = $derived.by<PartyGroup[]>(() => {
		const rows = filteredAndSorted;
		const grouped = new Map<string, GuestRow[]>();
		const solos: GuestRow[] = [];
		for (const r of rows) {
			if (r.householdId) {
				const arr = grouped.get(r.householdId) ?? [];
				arr.push(r);
				grouped.set(r.householdId, arr);
			} else {
				solos.push(r);
			}
		}
		const result: PartyGroup[] = [];
		for (const [hid, grpRows] of grouped) {
			const party = partiesById.get(hid);
			const lead =
				grpRows.find((r) => party && r.userId && r.userId === party.primaryUserId) ?? grpRows[0];
			const ordered = [lead, ...grpRows.filter((r) => r !== lead)];
			const claimedUserIds = new Set(grpRows.map((r) => r.userId).filter(Boolean));
			const extraNames = (party?.members ?? [])
				.filter((m) => !m.userId || !claimedUserIds.has(m.userId))
				.map((m) => [m.firstName, m.lastName].filter(Boolean).join(' '))
				.filter(Boolean);
			const firstName = (lead.name || lead.email || 'Guest').split(' ')[0];
			result.push({
				id: hid,
				title: party?.name?.trim() || `${firstName}'s party`,
				rows: ordered,
				extraNames,
				size: grpRows.length + extraNames.length,
				isParty: true
			});
		}
		for (const r of solos) {
			result.push({
				id: `solo:${getRowId(r)}`,
				title: r.name || r.email,
				rows: [r],
				extraNames: [],
				size: Math.max(1, r.partySize || 1),
				isParty: (r.partySize || 1) > 1
			});
		}
		result.sort((a, b) => {
			if (a.isParty !== b.isParty) return a.isParty ? -1 : 1;
			return a.title.localeCompare(b.title);
		});
		return result;
	});

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

	// ── Donut chart (RSVP split) ───────────────────────────────────────────
	const DONUT_RADIUS = 52;
	const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

	const donutSegments = $derived.by(() => {
		const o = guestOverview;
		const raw = [
			{ key: 'yes', label: 'Confirmed', value: o.rsvpYes, color: 'var(--green-mid)' },
			{ key: 'pending', label: 'Pending', value: o.awaiting, color: 'var(--carrot)' },
			{ key: 'no', label: 'Declined', value: o.rsvpNo, color: '#e0654f' }
		].filter((s) => s.value > 0);
		const total = raw.reduce((sum, s) => sum + s.value, 0) || 1;
		let offset = 0;
		return raw.map((s) => {
			const len = (s.value / total) * DONUT_CIRC;
			const seg = { ...s, dash: `${len} ${DONUT_CIRC - len}`, offset: -offset };
			offset += len;
			return seg;
		});
	});

	const openSlotsLabel = $derived.by(() => {
		const o = guestOverview;
		if (o.cap <= 0) return null;
		if (o.overCap) return 'Over capacity';
		if (o.openSlots === 0) return 'Full';
		return `${o.openSlots} open ${o.openSlots === 1 ? 'spot' : 'spots'}`;
	});

</script>

<div class="gp-page">

	<!-- ── ZONE 1: COMMAND STRIP ─────────────────────────────────────── -->
	<div class="gp-cmd">
		<!-- Header -->
		<div class="gp-head">
			<div class="gp-head__titles">
				<h1 class="gp-head__title">Guests</h1>
				{#if headerSubLine}<p class="gp-head__sub">{headerSubLine}</p>{/if}
			</div>
			<div class="gp-head__actions">
				<button type="button" class="gp-hbtn" onclick={handleCopyInviteLink}>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
					Copy link
				</button>
				<button type="button" class="gp-hbtn" onclick={exportCsv}>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
					Export
				</button>
				{#if data.canManageGuests}
					<button type="button" class="gp-hbtn gp-hbtn--primary" onclick={openInvitePanel}>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						Invite guests
					</button>
				{/if}
			</div>
		</div>

		<!-- Stat cards -->
		<div class="gp-stats">
			<div class="gp-statcard">
				<span class="gp-statcard__icon gp-statcard__icon--green" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
				</span>
				<div class="gp-statcard__num">{guestOverview.rsvpYes}</div>
				<div class="gp-statcard__label">Confirmed</div>
				<div class="gp-statcard__sub">
					{#if guestOverview.expected}of {guestOverview.expected} expected{:else}{guestOverview.peopleIn} {guestOverview.peopleIn === 1 ? 'person' : 'people'} going{/if}
				</div>
			</div>

			<div class="gp-statcard">
				<span class="gp-statcard__icon gp-statcard__icon--amber" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
				</span>
				<div class="gp-statcard__num">{guestOverview.awaiting}</div>
				<div class="gp-statcard__label">Pending</div>
				<div class="gp-statcard__sub">haven't responded</div>
			</div>

			<div class="gp-statcard">
				<span class="gp-statcard__icon gp-statcard__icon--navy" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
				</span>
				<div class="gp-statcard__num">{guestOverview.onList}</div>
				<div class="gp-statcard__label">On the list</div>
				<div class="gp-statcard__sub">
					{#if guestOverview.rsvpNo > 0}{guestOverview.rsvpNo} declined{:else}invited so far{/if}
				</div>
			</div>

			<div class="gp-statcard">
				<span class="gp-statcard__icon gp-statcard__icon--teal" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
				</span>
				<div class="gp-statcard__num">{guestOverview.peopleIn}</div>
				<div class="gp-statcard__label">Headcount</div>
				<div class="gp-statcard__sub">
					{#if openSlotsLabel}<span class:gp-statcard__sub--warn={guestOverview.overCap}>{openSlotsLabel}</span>{:else}people with a bed{/if}
				</div>
			</div>
		</div>

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
						<span class="gp-acard__ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg></span>
						<div class="gp-acard__main">
							<span class="gp-acard__label">Unassigned</span>
							<p class="gp-acard__text">{unassignedConfirmedCount} confirmed {unassignedConfirmedCount === 1 ? 'guest' : 'guests'} without a bed</p>
						</div>
						<button type="button" class="gp-acard__btn" onclick={() => scrollToSection('section-roster', 'unassigned')}>Assign</button>
					</div>
				{/if}

				{#if guestOverview.awaiting > 3}
					<div class="gp-acard">
						<span class="gp-acard__ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
						<div class="gp-acard__main">
							<span class="gp-acard__label">No response</span>
							<p class="gp-acard__text">{guestOverview.awaiting} haven't responded</p>
						</div>
						<button type="button" class="gp-acard__btn" onclick={nudgeAllPending} disabled={nudgeAllLoading}>{nudgeAllLoading ? '…' : 'Remind all'}</button>
					</div>
				{/if}

				{#if reconfirmNeededCount > 0}
					<div class="gp-acard">
						<span class="gp-acard__ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg></span>
						<div class="gp-acard__main">
							<span class="gp-acard__label">Reconfirm needed</span>
							<p class="gp-acard__text">{reconfirmNeededCount} {reconfirmNeededCount === 1 ? 'guest needs' : 'guests need'} to reconfirm</p>
						</div>
						<button type="button" class="gp-acard__btn" onclick={() => scrollToSection('section-roster')}>Remind</button>
					</div>
				{/if}

				{#if hasCostSharing && unpaidConfirmedCount > 0}
					<div class="gp-acard">
						<span class="gp-acard__ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
						<div class="gp-acard__main">
							<span class="gp-acard__label">Unpaid</span>
							<p class="gp-acard__text">{unpaidConfirmedCount} {unpaidConfirmedCount === 1 ? 'guest has' : 'guests have'} a balance</p>
						</div>
						<button type="button" class="gp-acard__btn" onclick={() => scrollToSection('section-roster', 'unpaid')}>View</button>
					</div>
				{/if}

				{#if joinRequestCount > 0}
					<div class="gp-acard">
						<span class="gp-acard__ic" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></span>
						<div class="gp-acard__main">
							<span class="gp-acard__label">Join requests</span>
							<p class="gp-acard__text">{joinRequestCount} {joinRequestCount === 1 ? 'person wants' : 'people want'} to join</p>
						</div>
						<button type="button" class="gp-acard__btn" onclick={() => scrollToSection('section-roster', 'pending')}>Review</button>
					</div>
				{/if}

			</div>
		</div>
	{/if}

	<!-- ── ZONE 3: ROSTER + SUMMARY ─────────────────────────────────────────────── -->
	<div class="gp-grid">

		<!-- Left: guest table -->
		<section class="gp-card gp-tablecard" id="section-roster">
			<div class="gp-tablecard__head">
				<h2 class="gp-card__title">Guest list</h2>
				<div class="gp-head-controls">
					<div class="gp-viewtoggle" role="group" aria-label="View mode">
						<button type="button" class="gp-viewtoggle__btn" class:gp-viewtoggle__btn--active={viewMode === 'list'} onclick={() => (viewMode = 'list')}>List</button>
						<button type="button" class="gp-viewtoggle__btn" class:gp-viewtoggle__btn--active={viewMode === 'party'} onclick={() => (viewMode = 'party')}>Parties</button>
					</div>
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
				</div>
			</div>

			{#if roomSaveError}
				<div class="gp-err-bar" role="alert">
					{roomSaveError}
					<button type="button" class="gp-err-dismiss" onclick={() => (roomSaveError = null)} aria-label="Dismiss">x</button>
				</div>
			{/if}

			<div class="gp-table" class:gp-table--cost={hasCostSharing}>
				<div class="gp-tr gp-tr--head">
					<span class="gp-cell gp-cell--guest">Guest</span>
					<span class="gp-cell gp-cell--status">Status</span>
					<span class="gp-cell gp-cell--room">Room &amp; bed</span>
					{#if hasCostSharing}<span class="gp-cell gp-cell--amount">Balance</span>{/if}
					<span class="gp-cell gp-cell--actions"></span>
				</div>

				{#if filteredAndSorted.length === 0}
					<div class="gp-empty">
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="gp-empty__icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
						<h3 class="gp-empty__title">{activeFilter === 'all' ? 'No guests yet' : 'No guests match this filter'}</h3>
						<p class="gp-empty__sub">
							{activeFilter === 'all' ? 'Invite people or share your trip link to start getting RSVPs.' : 'Try a different filter above.'}
						</p>
						{#if data.canManageGuests && activeFilter === 'all'}
							<button type="button" class="gp-btn gp-btn--primary" onclick={openInvitePanel}>Invite guests</button>
						{/if}
					</div>
				{:else if viewMode === 'party'}
					{#each partyGroups as group (group.id)}
						<div class="gp-party">
							<div class="gp-party__head">
								<span class="gp-party__name">{group.title}</span>
								<span class="gp-party__size">{group.size === 1 ? 'Just them' : `Party of ${group.size}`}</span>
							</div>
							{#each group.rows as row (row.userId ?? row.inviteId)}
								{@render guestRow(row)}
							{/each}
							{#each group.extraNames as nm (nm)}
								<div class="gp-party__extra">
									<span class="gp-party__extra-av" aria-hidden="true">{initials(nm, '')}</span>
									<span class="gp-party__extra-name">{nm}</span>
									<span class="gp-tag">No account yet</span>
								</div>
							{/each}
						</div>
					{/each}
				{:else}
					{#each filteredAndSorted as row (row.userId ?? row.inviteId)}
						{@render guestRow(row)}
					{/each}
				{/if}
			</div>
		</section>

		<!-- Right: summary -->
		<aside class="gp-side">

			<!-- RSVP overview -->
			<div class="gp-card gp-panel">
				<div class="gp-panel__head">
					<h3 class="gp-card__title">RSVP overview</h3>
					{#if rsvpByDateFormatted}<span class="gp-panel__meta">by {rsvpByDateFormatted}</span>{/if}
				</div>
				<div class="gp-donut">
					<svg class="gp-donut__svg" viewBox="0 0 140 140" role="img" aria-label="{guestOverview.rsvpYes} confirmed, {guestOverview.awaiting} pending, {guestOverview.rsvpNo} declined">
						<circle class="gp-donut__track" cx="70" cy="70" r="52" fill="none" stroke-width="16" />
						{#each donutSegments as seg (seg.key)}
							<circle cx="70" cy="70" r="52" fill="none" stroke={seg.color} stroke-width="16" stroke-dasharray={seg.dash} stroke-dashoffset={seg.offset} transform="rotate(-90 70 70)" />
						{/each}
					</svg>
					<div class="gp-donut__center">
						<span class="gp-donut__num">{guestOverview.onList}</span>
						<span class="gp-donut__lbl">on the list</span>
					</div>
				</div>
				<div class="gp-legend">
					<div class="gp-legend__item"><span class="gp-legend__dot gp-legend__dot--green"></span><span class="gp-legend__txt">Confirmed</span><b>{guestOverview.rsvpYes}</b></div>
					<div class="gp-legend__item"><span class="gp-legend__dot gp-legend__dot--amber"></span><span class="gp-legend__txt">Pending</span><b>{guestOverview.awaiting}</b></div>
					{#if guestOverview.rsvpNo > 0}
						<div class="gp-legend__item"><span class="gp-legend__dot gp-legend__dot--red"></span><span class="gp-legend__txt">Declined</span><b>{guestOverview.rsvpNo}</b></div>
					{/if}
				</div>
				{#if guestOverview.cap > 0}
					<div class="gp-capbar">
						<div class="gp-capbar__track">
							<div class="gp-capbar__fill gp-capbar__fill--green" style="width: {Math.min(100, (guestOverview.rsvpYes / guestOverview.cap) * 100)}%"></div>
							<div class="gp-capbar__fill gp-capbar__fill--amber" style="left: {Math.min(100, (guestOverview.rsvpYes / guestOverview.cap) * 100)}%; width: {Math.min(Math.max(0, 100 - (guestOverview.rsvpYes / guestOverview.cap) * 100), (guestOverview.awaiting / guestOverview.cap) * 100)}%"></div>
						</div>
						<div class="gp-capbar__line">
							<span><b>{guestOverview.peopleIn}</b> of {guestOverview.cap} max headcount</span>
							{#if openSlotsLabel}<span class:gp-capbar__warn={guestOverview.overCap}>{openSlotsLabel}</span>{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Waitlist -->
			{#if data.canManageGuests && (data.waitlistCount ?? 0) > 0}
				{@const waitlistEntries = data.waitlistEntries ?? []}
				<div class="gp-card gp-panel">
					<div class="gp-panel__head">
						<h3 class="gp-card__title">Waitlist</h3>
						<span class="gp-panel__count">{data.waitlistCount}</span>
					</div>
					<p class="gp-panel__hint">Guests are notified automatically when a spot opens.</p>
					<ul class="gp-wl">
						{#each waitlistEntries as entry, i (entry.userId)}
							<li class="gp-wl__row">
								<span class="gp-wl__pos">#{entry.waitlistPosition ?? i + 1}</span>
								{#if entry.avatarUrl}
									<img src={entry.avatarUrl} alt="" class="gp-av gp-av--img gp-av--sm" />
								{:else}
									<span class="gp-av gp-av--init gp-av--sm">{initials(entry.name, entry.email)}</span>
								{/if}
								<span class="gp-wl__name">{entry.name}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

		</aside>

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
	<div class="gp-tr">

		<!-- Guest (avatar + identity) -->
		<div class="gp-cell gp-cell--guest">
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
			<div class="gp-row__identity">
				<div class="gp-row__name-line">
					{#if row.userId}
						<ProfileTooltip userId={row.userId}>
							<button type="button" class="gp-row__name-btn" onclick={() => openProfileCard(row.userId!)}>
								<span class="gp-row__name">{row.name || row.email}</span>
							</button>
						</ProfileTooltip>
					{:else}
						<span class="gp-row__name">{row.name || row.email}</span>
					{/if}
					{#if row.role === 'co-host'}<span class="gp-tag gp-tag--cohost">Co-host</span>{/if}
					{#if row.partySize > 1 && isConfirmed}<span class="gp-tag">+{row.partySize - 1}</span>{/if}
					{#if row.hasDietaryFlags}
						<span class="gp-tag gp-tag--diet" title={[row.dietaryRestrictions, row.allergies].filter(Boolean).join(' · ')}>Dietary</span>
					{/if}
				</div>
				{#if row.email && row.email !== '-' && row.name}
					<span class="gp-row__email">{row.email}</span>
				{/if}
			</div>
		</div>

		<!-- Status -->
		<div class="gp-cell gp-cell--status">
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
				<span class="gp-pill gp-pill--requested">Requested</span>
			{:else if isInvite}
				<span class="gp-pill gp-pill--invited">Invited</span>
			{:else}
				<span class="gp-pill gp-pill--pending">No response</span>
			{/if}
		</div>

		<!-- Room and bed -->
		<div class="gp-cell gp-cell--room">
			{#if roomName}
				<span class="gp-row__room-name">{roomName}</span>
				{#if bedType}<span class="gp-row__bed-type">{bedType}</span>{/if}
			{:else if (isConfirmed || isReconfirm) && data.canManageGuests}
				<button type="button" class="gp-row__assign-link" onclick={() => (editModalRow = row)}>Assign bed</button>
			{:else}
				<span class="gp-row__dash">—</span>
			{/if}
		</div>

		<!-- Amount -->
		{#if hasCostSharing}
			<div class="gp-cell gp-cell--amount">
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
					<span class="gp-row__dash">—</span>
				{/if}
			</div>
		{/if}

		<!-- Actions -->
		<div class="gp-cell gp-cell--actions">
			{#if data.canManageGuests}
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
			{/if}
		</div>

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
		gap: 20px;
		min-height: 100%;
		padding: 26px 32px 40px;
		box-sizing: border-box;
		background: var(--bg);
	}

	/* ═══════════════════════════════════════════════════════════
	   ZONE 1 - HEADER + STAT CARDS
	   ═══════════════════════════════════════════════════════════ */

	.gp-cmd {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.gp-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.gp-head__title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 30px;
		font-weight: 600;
		color: var(--navy);
		margin: 0;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.gp-head__sub {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		color: var(--muted);
		margin: 4px 0 0;
	}

	.gp-head__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

	.gp-hbtn {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 38px;
		padding: 0 14px;
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 140ms, border-color 140ms, color 140ms;
		white-space: nowrap;
	}
	.gp-hbtn:hover { border-color: var(--navy); color: var(--navy); }
	.gp-hbtn svg { opacity: 0.7; }

	.gp-hbtn--primary { background: var(--warm); color: white; border-color: var(--warm); }
	.gp-hbtn--primary:hover { background: var(--chocolate); border-color: var(--chocolate); color: white; }
	.gp-hbtn--primary svg { opacity: 1; }

	/* Stat cards */
	.gp-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}

	.gp-statcard {
		background: var(--surfaceSolid);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-shadow: var(--shadow-sm);
	}

	.gp-statcard__icon {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 10px;
	}
	.gp-statcard__icon--green { background: rgba(29, 158, 117, 0.12); color: var(--green-deep); }
	.gp-statcard__icon--amber { background: rgba(247, 170, 41, 0.16); color: var(--amber-text-dark); }
	.gp-statcard__icon--navy { background: rgba(29, 77, 78, 0.1); color: var(--navy); }
	.gp-statcard__icon--teal { background: rgba(47, 119, 120, 0.12); color: var(--slate); }

	.gp-statcard__num {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 36px;
		font-weight: 600;
		color: var(--navy);
		line-height: 1.05;
		letter-spacing: -0.03em;
	}

	.gp-statcard__label {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		margin-top: 4px;
	}

	.gp-statcard__sub {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		color: var(--muted);
		margin-top: 1px;
	}
	.gp-statcard__sub--warn { color: var(--warm); font-weight: 600; }

	/* Inline invite panel (light card) */
	.gp-ipanel {
		background: var(--surfaceSolid);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-shadow: var(--shadow-sm);
	}

	.gp-ipanel__tabs {
		display: flex;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 2px;
		width: fit-content;
	}

	.gp-itab {
		background: none;
		border: none;
		color: var(--muted);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		padding: 6px 14px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 140ms;
	}
	.gp-itab--active { background: var(--navy); color: white; }

	.gp-ipanel__form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 480px;
	}

	.gp-ifield {
		height: 44px;
		padding: 0 14px;
		background: var(--surfaceSolid);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 14px;
		color: var(--navy);
		outline: none;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 140ms;
	}
	.gp-ifield--sm { height: 38px; font-size: 13px; }
	.gp-ifield:focus { border-color: var(--slate); box-shadow: 0 0 0 3px rgba(47, 119, 120, 0.12); }

	.gp-rtoggle-wrap {
		display: flex;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 2px;
		width: fit-content;
	}

	.gp-rtoggle {
		background: none;
		border: none;
		color: var(--muted);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 600;
		padding: 5px 14px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 140ms;
	}
	.gp-rtoggle--active { background: var(--navy); color: white; }

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
		background: linear-gradient(135deg, rgba(29, 77, 78, 0.1), rgba(47, 119, 120, 0.2));
		color: var(--navy);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 12px;
		font-weight: 600;
	}

	.gp-ifriends__name { flex: 1; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: var(--text); }

	.gp-ifriends__btn {
		height: 28px;
		padding: 0 12px;
		background: var(--surfaceSolid);
		color: var(--navy);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: background 140ms, border-color 140ms;
	}
	.gp-ifriends__btn:hover { background: var(--bg); border-color: var(--navy); }

	.gp-ipanel__footer { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

	.gp-ipanel__cancel {
		background: none;
		border: none;
		color: var(--muted);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		transition: color 140ms;
	}
	.gp-ipanel__cancel:hover { color: var(--navy); }

	.gp-ipanel__manual {
		background: none;
		border: none;
		color: var(--muted);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		transition: color 140ms;
	}
	.gp-ipanel__manual:hover { color: var(--navy); }

	.gp-ipanel__err { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--red-text); margin: 0; }
	.gp-ipanel__warn { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--amber-text-dark); margin: 0; }
	.gp-ipanel__hint { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: var(--muted); margin: 0; }

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
		border: 1px solid rgba(247, 170, 41, 0.25);
		border-radius: 12px;
		padding: 8px;
	}

	.gp-attn__cards {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.gp-attn__cards::-webkit-scrollbar { display: none; }

	.gp-acard {
		background: white;
		border: 1px solid rgba(247, 170, 41, 0.3);
		border-radius: 10px;
		padding: 8px 10px;
		flex: 1 1 0;
		min-width: 210px;
		display: flex;
		align-items: center;
		gap: 9px;
		box-shadow: 0 1px 3px rgba(247, 170, 41, 0.07);
	}

	.gp-acard__ic {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 8px;
		background: var(--surface-attention);
		color: var(--amber-text);
	}

	.gp-acard__main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }

	.gp-acard__label {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--amber-text);
	}

	.gp-acard__text {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.gp-acard__btn {
		height: 26px;
		padding: 0 11px;
		border: 1px solid rgba(206, 86, 18, 0.35);
		background: white;
		color: var(--warm);
		border-radius: 7px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: background 150ms, color 150ms;
		flex-shrink: 0;
		white-space: nowrap;
	}
	.gp-acard__btn:hover { background: var(--warm); color: white; }
	.gp-acard__btn:disabled { opacity: 0.5; cursor: default; }

	/* ═══════════════════════════════════════════════════════════
	   ZONE 3 - ROSTER
	   ═══════════════════════════════════════════════════════════ */

	.gp-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 16px;
		align-items: start;
	}

	/* Cards */
	.gp-card {
		background: var(--surfaceSolid);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: var(--shadow-sm);
	}

	.gp-card__title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 17px;
		font-weight: 600;
		color: var(--navy);
		margin: 0;
		letter-spacing: -0.01em;
	}

	/* Table card */
	.gp-tablecard { padding: 4px 6px 8px; }

	.gp-tablecard__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 14px 12px;
		flex-wrap: wrap;
	}

	.gp-filters {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		-ms-overflow-style: none;
		scrollbar-width: none;
		flex-wrap: nowrap;
	}
	.gp-filters::-webkit-scrollbar { display: none; }

	.gp-fpill {
		background: var(--surfaceSolid);
		border: 1px solid var(--border);
		color: var(--muted);
		padding: 5px 12px;
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

	.gp-head-controls {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.gp-viewtoggle {
		display: inline-flex;
		padding: 2px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
		flex-shrink: 0;
	}
	.gp-viewtoggle__btn {
		border: none;
		background: transparent;
		color: var(--muted);
		padding: 4px 12px;
		border-radius: 999px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 140ms, color 140ms;
	}
	.gp-viewtoggle__btn--active { background: var(--surfaceSolid); color: var(--navy); box-shadow: var(--shadow-sm); }

	/* Party groups */
	.gp-party {
		border: 1px solid var(--border);
		border-radius: 12px;
		margin: 0 6px 10px;
		overflow: hidden;
	}
	.gp-party__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 9px 14px;
		background: var(--bg-warm);
		border-bottom: 1px solid var(--border);
	}
	.gp-party__name {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 14px;
		font-weight: 600;
		color: var(--navy);
		letter-spacing: -0.01em;
	}
	.gp-party__size {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.gp-party .gp-tr { border-radius: 0; }
	.gp-party__extra {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 14px;
		border-top: 1px dashed var(--border);
	}
	.gp-party__extra-av {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: var(--bg);
		color: var(--muted);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 11px;
		font-weight: 700;
	}
	.gp-party__extra-name {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
		flex: 1;
		min-width: 0;
	}

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
		margin: 0 8px 8px;
	}
	.gp-err-dismiss { background: none; border: none; cursor: pointer; color: inherit; font-size: 16px; padding: 0; }

	/* Table */
	.gp-table { display: flex; flex-direction: column; }

	.gp-tr {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 124px 136px 150px;
		align-items: center;
		gap: 14px;
		padding: 11px 12px;
		border-radius: 10px;
	}
	.gp-table--cost .gp-tr {
		grid-template-columns: minmax(0, 1fr) 124px 136px 104px 150px;
	}
	.gp-table .gp-tr:not(.gp-tr--head) { transition: background 120ms; }
	.gp-table .gp-tr:not(.gp-tr--head):hover { background: var(--bg-warm); }

	.gp-tr--head {
		padding-top: 6px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border);
		border-radius: 0;
		margin-bottom: 2px;
	}
	.gp-tr--head .gp-cell {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.gp-cell { min-width: 0; }
	.gp-cell--guest { display: flex; align-items: center; gap: 12px; }
	.gp-cell--status { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
	.gp-cell--room { display: flex; flex-direction: column; gap: 1px; }
	.gp-cell--amount { display: flex; flex-direction: column; gap: 2px; }
	.gp-cell--actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
	.gp-cell--actions form { display: contents; }

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
	.gp-row__identity { min-width: 0; display: flex; flex-direction: column; gap: 1px; }

	.gp-row__name-line { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }

	.gp-row__name-btn { background: none; border: none; padding: 0; cursor: pointer; text-align: left; min-width: 0; }

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

	/* Inline tags next to name */
	.gp-tag {
		display: inline-flex;
		align-items: center;
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--muted);
		border-radius: 999px;
		padding: 1px 7px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 10px;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.gp-tag--cohost { background: rgba(47, 119, 120, 0.08); color: var(--slate); border-color: rgba(47, 119, 120, 0.2); }
	.gp-tag--diet { background: rgba(247, 170, 41, 0.12); color: var(--amber-text-dark); border-color: rgba(247, 170, 41, 0.3); cursor: default; }

	/* Room / bed */
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

	.gp-row__pay { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; font-weight: 600; }
	.gp-row__pay--paid { color: var(--green-mid); }
	.gp-row__pay--unpaid { color: var(--warm); }

	/* Status pills */
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

	.gp-pill-sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; color: var(--muted); font-weight: 500; }

	/* Action buttons */
	.gp-act {
		height: 28px;
		padding: 0 11px;
		border: 1px solid var(--border);
		background: var(--surfaceSolid);
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

	.gp-act--decline { border: 1px solid rgba(206, 86, 18, 0.3); color: var(--warm); background: var(--surfaceSolid); }
	.gp-act--decline:hover { background: rgba(206, 86, 18, 0.05); }

	/* Empty states */
	.gp-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; gap: 8px; text-align: center; }

	.gp-empty__icon { color: var(--muted); }

	.gp-empty__title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 18px;
		font-weight: 600;
		color: var(--navy);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.gp-empty__sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: var(--muted); margin: 0; }
	.gp-empty .gp-btn { margin-top: 10px; }

	/* ── Side column (summary / waitlist) ── */
	.gp-side { display: flex; flex-direction: column; gap: 16px; }

	.gp-panel { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }

	.gp-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.gp-panel__meta { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: var(--muted); }
	.gp-panel__hint { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--muted); margin: 0; }
	.gp-panel__count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 7px;
		border-radius: 999px;
		background: rgba(29, 77, 78, 0.08);
		color: var(--navy);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 12px;
		font-weight: 700;
	}

	/* Donut */
	.gp-donut { position: relative; width: 150px; height: 150px; margin: 4px auto 0; }
	.gp-donut__svg { width: 100%; height: 100%; display: block; }
	.gp-donut__track { stroke: var(--border); }
	.gp-donut__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
	.gp-donut__num { font-family: 'Fraunces', Georgia, serif; font-size: 32px; font-weight: 600; color: var(--navy); line-height: 1; letter-spacing: -0.02em; }
	.gp-donut__lbl { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: var(--muted); margin-top: 2px; }

	/* Legend */
	.gp-legend { display: flex; flex-direction: column; gap: 9px; }
	.gp-legend__item { display: flex; align-items: center; gap: 9px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: var(--text); }
	.gp-legend__dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
	.gp-legend__dot--green { background: var(--green-mid); }
	.gp-legend__dot--amber { background: var(--carrot); }
	.gp-legend__dot--red { background: #e0654f; }
	.gp-legend__txt { flex: 1; }
	.gp-legend__item b { font-weight: 700; color: var(--navy); }

	/* Capacity mini-bar */
	.gp-capbar { display: flex; flex-direction: column; gap: 7px; padding-top: 14px; border-top: 1px solid var(--border); }
	.gp-capbar__track { position: relative; height: 8px; border-radius: 999px; background: var(--bg-warm); overflow: hidden; }
	.gp-capbar__fill { position: absolute; top: 0; height: 100%; border-radius: 999px; transition: width 400ms ease; }
	.gp-capbar__fill--green { left: 0; background: var(--green-mid); z-index: 2; }
	.gp-capbar__fill--amber { background: rgba(247, 170, 41, 0.5); z-index: 1; }
	.gp-capbar__line { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: var(--muted); }
	.gp-capbar__line b { color: var(--navy); }
	.gp-capbar__warn { color: var(--warm); font-weight: 600; }

	/* Waitlist */
	.gp-wl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
	.gp-wl__row { display: flex; align-items: center; gap: 10px; }
	.gp-wl__pos { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 700; color: var(--muted); min-width: 22px; }
	.gp-wl__name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

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
		margin: 0;
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
		margin: 0;
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

	/* Stack the summary column under the table on narrower viewports */
	@media (max-width: 1080px) {
		.gp-grid { grid-template-columns: minmax(0, 1fr); }
		.gp-side { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; align-items: start; }
	}

	@media (max-width: 900px) {
		.gp-stats { grid-template-columns: repeat(2, 1fr); }
	}

	@media (max-width: 720px) {
		.gp-side { grid-template-columns: minmax(0, 1fr); }
	}

	@media (max-width: 640px) {
		.gp-page { padding: 18px 16px 32px; }
		.gp-head__title { font-size: 25px; }
		.gp-statcard__num { font-size: 30px; }
		.gp-attn__cards { flex-direction: column; overflow-x: unset; }
		.gp-acard { max-width: 100%; min-width: unset; }

		/* Collapse table rows into stacked cards */
		.gp-tr--head { display: none; }
		.gp-tr,
		.gp-table--cost .gp-tr {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'guest actions'
				'status status'
				'room room'
				'amount amount';
			row-gap: 8px;
			padding: 14px 12px;
			border-bottom: 1px solid var(--border);
			border-radius: 0;
		}
		.gp-table .gp-tr:not(.gp-tr--head):hover { background: transparent; }
		.gp-cell--guest { grid-area: guest; }
		.gp-cell--actions { grid-area: actions; align-items: flex-start; }
		.gp-cell--status { grid-area: status; }
		.gp-cell--room { grid-area: room; flex-direction: row; gap: 6px; align-items: center; }
		.gp-cell--amount { grid-area: amount; flex-direction: row; gap: 6px; align-items: center; }
		.gp-act { height: 32px; }
	}

</style>
