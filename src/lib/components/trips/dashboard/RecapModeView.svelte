<script lang="ts">
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

	interface Activity {
		id: string;
		title: string;
		date: Date | string;
		participants?: Array<{ user?: { id: string; name: string | null; avatarUrl?: string | null } | null }>;
	}
	interface MealSlot {
		id: string;
		date: Date | string;
		mealType: string;
		assignedUserId?: string | null;
		assignedUser?: { id: string; name: string | null; avatarUrl?: string | null } | null;
	}
	interface TrophyWinner {
		id: string;
		name: string | null;
		avatarUrl?: string | null;
		count: number;
	}

	let {
		tripId,
		isHost = false,
		trip = {},
		activities = [],
		mealSlots = [],
		members = [],
		userInvoices = [],
		totalCost = 0,
		rsvps = []
	}: {
		tripId: string;
		isHost?: boolean;
		trip?: {
			name?: string | null;
			checkInDate?: Date | string | null;
			checkOutDate?: Date | string | null;
			listingCoverPhoto?: string | null;
			location?: string | null;
		};
		activities?: Activity[];
		mealSlots?: MealSlot[];
		members?: Array<{ user?: { id: string; name: string | null; avatarUrl?: string | null } | null }>;
		userInvoices?: Array<{ status: string; totalAmount: number }>;
		totalCost?: number;
		rsvps?: Array<{ status: string; user?: { id: string; name: string | null; avatarUrl?: string | null } | null }>;
	} = $props();

	// ── Stats ────────────────────────────────────────────────────────────
	const nightsStayed = $derived.by(() => {
		if (!trip?.checkInDate || !trip?.checkOutDate) return 0;
		const s = new Date(trip.checkInDate), e = new Date(trip.checkOutDate);
		return Math.max(0, Math.ceil((e.getTime() - s.getTime()) / 86_400_000));
	});
	const finalAttendees = $derived(rsvps.filter((r) => r.status === 'yes'));
	const activitiesCount = $derived(activities.length);
	const mealsCookedCount = $derived(mealSlots.filter((m) => m.assignedUserId).length);
	const myPaid = $derived(userInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0));
	const myOwed = $derived(userInvoices.filter((i) => i.status === 'due').reduce((s, i) => s + i.totalAmount, 0));
	const coverPhoto = $derived(trip?.listingCoverPhoto ?? null);
	const tripLocation = $derived((trip?.location ?? '').trim());
	const displayTripName = $derived((trip?.name ?? '').trim() || 'Trip Recap');

	// ── Avatar lookup from rsvps (fallback for activity/meal data) ────────
	const avatarByUserId = $derived.by(() => {
		const m = new Map<string, string | null>();
		for (const r of rsvps) {
			if (r.user?.id) m.set(r.user.id, r.user.avatarUrl ?? null);
		}
		return m;
	});

	function topWinners(
		counts: Map<string, { name: string | null; avatarUrl?: string | null; count: number }>
	): TrophyWinner[] {
		if (counts.size === 0) return [];
		let max = 0;
		for (const v of counts.values()) if (v.count > max) max = v.count;
		if (max === 0) return [];
		const winners: TrophyWinner[] = [];
		for (const [id, v] of counts.entries()) {
			if (v.count === max) winners.push({ id, name: v.name, avatarUrl: v.avatarUrl ?? null, count: v.count });
		}
		return winners;
	}

	// ── Trophy winners from real data ────────────────────────────────────
	const activityWinners = $derived.by((): TrophyWinner[] => {
		const counts = new Map<string, { name: string | null; avatarUrl: string | null; count: number }>();
		for (const a of activities) {
			for (const p of a.participants ?? []) {
				if (!p.user?.id) continue;
				const prev = counts.get(p.user.id) ?? {
					name: p.user.name,
					avatarUrl: p.user.avatarUrl ?? avatarByUserId.get(p.user.id) ?? null,
					count: 0
				};
				counts.set(p.user.id, { ...prev, count: prev.count + 1 });
			}
		}
		return topWinners(counts);
	});

	const chefWinners = $derived.by((): TrophyWinner[] => {
		const counts = new Map<string, { name: string | null; avatarUrl: string | null; count: number }>();
		for (const m of mealSlots) {
			if (!m.assignedUser?.id) continue;
			const prev = counts.get(m.assignedUser.id) ?? {
				name: m.assignedUser.name,
				avatarUrl: m.assignedUser.avatarUrl ?? avatarByUserId.get(m.assignedUser.id) ?? null,
				count: 0
			};
			counts.set(m.assignedUser.id, { ...prev, count: prev.count + 1 });
		}
		return topWinners(counts);
	});

	// ── Date helpers ─────────────────────────────────────────────────────
	function toDateStr(val: Date | string | null | undefined) {
		if (!val) return '';
		const d = typeof val === 'string' ? new Date(val) : val;
		return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
	}
	const tripDateRange = $derived.by(() => {
		const sa = toDateStr(trip?.checkInDate), sb = toDateStr(trip?.checkOutDate);
		if (!sa && !sb) return '';
		if (!sa || !sb) {
			const d = new Date((sa || sb) + 'T12:00:00');
			return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		}
		const s = new Date(sa + 'T12:00:00'), e = new Date(sb + 'T12:00:00');
		return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	});

	// ── Activity & meal lists ─────────────────────────────────────────────
	const activityList = $derived(
		activities.slice(0, 8).map((a) => ({
			title: a.title,
			date: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
			count: a.participants?.length ?? 0
		}))
	);
	const mealsByType = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const m of mealSlots) counts[m.mealType] = (counts[m.mealType] ?? 0) + 1;
		return Object.entries(counts).sort((a, b) => b[1] - a[1]);
	});
	const mealLabel = (type: string) =>
		({ breakfast: 'Breakfasts', lunch: 'Lunches', dinner: 'Dinners', snack: 'Snacks' }[type] ?? type);

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}
</script>

<!-- ════════════════ TEMPLATE ════════════════ -->
<div class="r">

	<!-- ── CELEBRATION BANNER ──────────────────────────────────────────── -->
	<div class="r-banner">
		<div class="r-banner-inner">
			{#if coverPhoto}
				<img src={coverPhoto} alt="" class="r-banner-bg" />
			{:else}
				<div class="r-banner-bg r-banner-bg--gradient" aria-hidden="true"></div>
			{/if}
			<div class="r-banner-overlay" aria-hidden="true"></div>

			<!-- Confetti dots -->
			<div class="r-confetti" aria-hidden="true">
				{#each [['#f59e0b','12%','18%'],['#2f7778','20%','72%'],['#ce5612','40%','10%'],['#e8c87c','60%','85%'],['#b0c4d8','75%','20%'],['#f97316','85%','60%'],['#22c55e','55%','40%'],['#6366f1','90%','30%'],['#f59e0b','30%','90%']] as [col,top,left]}
					<span class="r-cdot" style="background:{col};top:{top};left:{left}"></span>
				{/each}
			</div>

			<!-- Content -->
			<div class="r-banner-content">
				<div class="r-banner-text">
					<h1 class="r-banner-title">{displayTripName}</h1>
					<p class="r-banner-sub">
						{#if tripLocation}{tripLocation}{#if tripDateRange} · {/if}{/if}{tripDateRange}
					</p>
					<div class="r-wrap-chip">That's a wrap! 🎉</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ── SCOREBOARD (stat row) ─────────────────────────────────────────── -->
	<div class="r-scoreboard">
		<div class="r-score">
			<span class="r-score-num">{nightsStayed}</span>
			<span class="r-score-lbl">nights</span>
		</div>
		<div class="r-score-sep" aria-hidden="true"></div>
		<div class="r-score">
			<span class="r-score-num">{finalAttendees.length}</span>
			<span class="r-score-lbl">guests</span>
		</div>
		<div class="r-score-sep" aria-hidden="true"></div>
		<div class="r-score">
			<span class="r-score-num">{activitiesCount}</span>
			<span class="r-score-lbl">activities</span>
		</div>
		<div class="r-score-sep" aria-hidden="true"></div>
		<div class="r-score">
			<span class="r-score-num">{mealsCookedCount}</span>
			<span class="r-score-lbl">meals cooked</span>
		</div>
	</div>

	<!-- ── MAIN GRID ──────────────────────────────────────────────────────── -->
	<div class="r-grid">

		<!-- GALLERY (full width) -->
		<section class="r-card r-card--full r-card--gallery">
			<div class="r-card-head">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
				<h3>Photo &amp; video gallery</h3>
				<span class="r-badge r-badge--muted">Coming soon</span>
			</div>
			<div class="r-gallery-grid">
				{#each Array(8) as _, i}
					<div class="r-photo-slot" style="animation-delay:{i * 0.06}s" aria-hidden="true">
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
					</div>
				{/each}
			</div>
			<p class="r-gallery-note">Upload and relive your trip memories here. Gallery feature launching soon.</p>
		</section>

		<!-- TROPHY CASE (full width) -->
		<section class="r-card r-card--full r-card--trophy">
			<div class="r-card-head">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
				<h3>Trophy case</h3>
			</div>
			<div class="r-trophies">
				<!-- Most active -->
				<div class="r-trophy r-trophy--gold">
					<span class="r-trophy-medal">🥇</span>
					<span class="r-trophy-cat">Most Active</span>
					{#if activityWinners.length > 0}
						<div class="r-trophy-avatars">
							{#each activityWinners.slice(0, 4) as w}
								<span class="r-trophy-avatar" title={w.name ?? ''}>
									{#if w.avatarUrl}<img src={w.avatarUrl} alt="" />{:else}{initials(w.name)}{/if}
								</span>
							{/each}
						</div>
						{#if activityWinners.length === 1}
							<span class="r-trophy-name">{activityWinners[0].name ?? 'Unknown'}</span>
						{:else}
							<span class="r-trophy-name">{activityWinners[0].name ?? 'Unknown'} <span class="r-trophy-tie">& {activityWinners.length - 1} other{activityWinners.length > 2 ? 's' : ''} tied</span></span>
						{/if}
						<span class="r-trophy-stat">{activityWinners[0].count} activit{activityWinners[0].count === 1 ? 'y' : 'ies'}</span>
					{:else}
						<span class="r-trophy-avatar r-trophy-avatar--empty" aria-hidden="true">?</span>
						<span class="r-trophy-name r-trophy-name--empty">—</span>
						<span class="r-trophy-stat">No data yet</span>
					{/if}
				</div>

				<!-- Top chef -->
				<div class="r-trophy r-trophy--copper">
					<span class="r-trophy-medal">👨‍🍳</span>
					<span class="r-trophy-cat">Top Chef</span>
					{#if chefWinners.length > 0}
						<div class="r-trophy-avatars">
							{#each chefWinners.slice(0, 4) as w}
								<span class="r-trophy-avatar" title={w.name ?? ''}>
									{#if w.avatarUrl}<img src={w.avatarUrl} alt="" />{:else}{initials(w.name)}{/if}
								</span>
							{/each}
						</div>
						{#if chefWinners.length === 1}
							<span class="r-trophy-name">{chefWinners[0].name ?? 'Unknown'}</span>
						{:else}
							<span class="r-trophy-name">{chefWinners[0].name ?? 'Unknown'} <span class="r-trophy-tie">& {chefWinners.length - 1} other{chefWinners.length > 2 ? 's' : ''} tied</span></span>
						{/if}
						<span class="r-trophy-stat">{chefWinners[0].count} meal{chefWinners[0].count === 1 ? '' : 's'} cooked</span>
					{:else}
						<span class="r-trophy-avatar r-trophy-avatar--empty" aria-hidden="true">?</span>
						<span class="r-trophy-name r-trophy-name--empty">—</span>
						<span class="r-trophy-stat">No data yet</span>
					{/if}
				</div>

				<!-- Game champion -->
				<div class="r-trophy r-trophy--teal">
					<span class="r-trophy-medal">🎮</span>
					<span class="r-trophy-cat">Game Champion</span>
					<span class="r-trophy-avatar r-trophy-avatar--empty" aria-hidden="true">?</span>
					<span class="r-trophy-name r-trophy-name--empty">—</span>
					<a href="/trips/{tripId}/games" class="r-trophy-link">View game results →</a>
				</div>

				<!-- Photographer -->
				<div class="r-trophy r-trophy--indigo">
					<span class="r-trophy-medal">📸</span>
					<span class="r-trophy-cat">Photographer</span>
					<span class="r-trophy-avatar r-trophy-avatar--empty" aria-hidden="true">?</span>
					<span class="r-trophy-name r-trophy-name--empty">—</span>
					<span class="r-trophy-stat">Gallery coming soon</span>
				</div>
			</div>
		</section>

		<!-- WHO WAS THERE (left half) -->
		<section class="r-card r-card--who">
			<div class="r-card-head">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
				<h3>Who was there</h3>
				<span class="r-count-badge">{finalAttendees.length}</span>
			</div>
			<div class="r-who-grid">
				{#each finalAttendees as att}
					{#if att.user?.id}
						<ProfileTooltip userId={att.user.id}>
							<button type="button" class="r-guest" onclick={() => openProfileCard(att.user!.id)}>
								<span class="r-guest-avatar">
									{#if att.user.avatarUrl}
										<img src={att.user.avatarUrl} alt="" />
									{:else}
										{initials(att.user.name)}
									{/if}
								</span>
								<span class="r-guest-name">{att.user.name ?? 'Guest'}</span>
							</button>
						</ProfileTooltip>
					{:else}
						<span class="r-guest">
							<span class="r-guest-avatar">{initials(att.user?.name)}</span>
							<span class="r-guest-name">{att.user?.name ?? 'Guest'}</span>
						</span>
					{/if}
				{/each}
				{#if finalAttendees.length === 0}
					<p class="r-empty">No attendees recorded.</p>
				{/if}
			</div>
		</section>

		<!-- COST SUMMARY (right half) -->
		<section class="r-card r-card--cost">
			<div class="r-card-head">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v.5"/><path d="M12 6v.5"/></svg>
				<h3>Cost summary</h3>
			</div>
			<div class="r-receipt">
				<div class="r-receipt-row">
					<span>You owed</span>
					<span class="r-receipt-val">{myOwed > 0 ? `$${myOwed.toFixed(2)}` : '—'}</span>
				</div>
				<div class="r-receipt-line"></div>
				<div class="r-receipt-row">
					<span>You paid</span>
					<span class="r-receipt-val r-receipt-paid">{myPaid > 0 ? `$${myPaid.toFixed(2)}` : '—'}</span>
				</div>
				{#if isHost && totalCost > 0}
					<div class="r-receipt-line r-receipt-line--thick"></div>
					<div class="r-receipt-row r-receipt-row--total">
						<span>Total trip cost</span>
						<span class="r-receipt-val">${totalCost.toFixed(2)}</span>
					</div>
				{/if}
			</div>
			<a href="/trips/{tripId}/guests" class="r-card-link">Full payment details →</a>
		</section>

		<!-- ACTIVITIES (left half) -->
		<section class="r-card r-card--activities">
			<div class="r-card-head">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
				<h3>Activities</h3>
				{#if activitiesCount > 0}<span class="r-count-badge">{activitiesCount}</span>{/if}
			</div>
			{#if activityList.length > 0}
				<ul class="r-list">
					{#each activityList as a}
						<li class="r-list-item">
							<span class="r-dot" aria-hidden="true"></span>
							<div class="r-list-body">
								<span class="r-list-title">{a.title}</span>
								<span class="r-list-sub">{a.date}{a.count > 0 ? ` · ${a.count} going` : ''}</span>
							</div>
						</li>
					{/each}
					{#if activities.length > 8}
						<li class="r-list-more">+{activities.length - 8} more</li>
					{/if}
				</ul>
			{:else}
				<p class="r-empty">No activities were added.</p>
			{/if}
			<a href="/trips/{tripId}/itinerary" class="r-card-link">View full itinerary →</a>
		</section>

		<!-- MEALS (right half) -->
		<section class="r-card r-card--meals">
			<div class="r-card-head">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
				<h3>Meals</h3>
			</div>
			{#if mealsByType.length > 0}
				<ul class="r-meals">
					{#each mealsByType as [type, count]}
						<li class="r-meals-row">
							<span class="r-meals-emoji">
								{#if type === 'breakfast'}🌅{:else if type === 'lunch'}☀️{:else if type === 'dinner'}🌙{:else}🍿{/if}
							</span>
							<span class="r-meals-label">{mealLabel(type)}</span>
							<span class="r-meals-count">{count}</span>
						</li>
					{/each}
				</ul>
				{#if mealsCookedCount > 0}
					<p class="r-meals-note">{mealsCookedCount} meal{mealsCookedCount === 1 ? '' : 's'} had an assigned cook.</p>
				{/if}
			{:else}
				<p class="r-empty">No meals were planned.</p>
			{/if}
		</section>

		<!-- POLLS + CTAs (full width) -->
		<div class="r-card r-card--full r-bottom-row">
			<div class="r-polls">
				<div class="r-polls-icon" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
				</div>
				<div>
					<p class="r-polls-heading">Post-trip polls</p>
					<p class="r-polls-sub">Favorite moment? Best meal? Would you do it again?</p>
				</div>
				<a href="/trips/{tripId}/polls" class="r-polls-link">View polls</a>
			</div>
			<div class="r-ctas">
				<a href="/trips/new" class="r-cta r-cta--primary">
					<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
					Trip with this group again
				</a>
				<a href="/trips/new" class="r-cta r-cta--ghost">
					<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
					Plan a new trip
				</a>
			</div>
		</div>

	</div>
</div>

<!-- ════════════════ STYLES ════════════════ -->
<style>
	/* ── Tokens ── */
	.r {
		--r-gold: #d4a017;
		--r-gold-bg: rgba(212,160,23,0.1);
		--r-copper-bg: rgba(191,78,48,0.1);
		--r-teal-bg: rgba(47,119,120,0.1);
		--r-indigo-bg: rgba(99,102,241,0.1);
		--r-radius: 14px;
		--r-lift: 0 2px 12px rgba(0,0,0,0.06);
		--r-lift-hover: 0 6px 24px rgba(0,0,0,0.11);
		padding-top: 3.75rem;
		width: 100%;
	}

	/* ── Banner ── */
	.r-banner {
		margin-bottom: 1.25rem;
	}
	.r-banner-inner {
		position: relative;
		border-radius: 20px;
		overflow: hidden;
		min-height: 200px;
		display: flex;
		align-items: center;
		box-shadow: 0 8px 32px rgba(0,0,0,0.14);
	}
	.r-banner-bg {
		position: absolute; inset: 0;
		width: 100%; height: 100%; object-fit: cover;
	}
	.r-banner-bg--gradient {
		background: linear-gradient(135deg, #1a3045 0%, #2f7778 60%, #ce5612 100%);
	}
	.r-banner-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%);
		pointer-events: none;
	}

	/* Confetti */
	.r-confetti { position: absolute; inset: 0; pointer-events: none; }
	.r-cdot {
		position: absolute;
		width: 7px; height: 7px; border-radius: 50%; opacity: 0.45;
	}

	/* Banner content */
	.r-banner-content {
		position: relative;
		padding: 2.25rem 1.75rem;
		display: flex; align-items: center; justify-content: center;
		width: 100%;
	}
	.r-banner-text {
		display: flex; flex-direction: column;
		align-items: center; text-align: center; gap: 0.35rem;
	}
	.r-banner-title {
		font-family: 'Fraunces', Georgia, serif;
		margin: 0; font-size: clamp(1.625rem, 3.5vw, 2.25rem);
		font-weight: 700; letter-spacing: -0.03em; line-height: 1.2;
		color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.25);
	}
	.r-banner-sub {
		margin: 0; font-size: 0.9375rem;
		color: rgba(255,255,255,0.8);
	}
	.r-wrap-chip {
		display: inline-flex; align-items: center;
		background: rgba(255,255,255,0.18);
		backdrop-filter: blur(6px);
		border: 1px solid rgba(255,255,255,0.3);
		color: #fff; font-size: 0.8125rem; font-weight: 700;
		padding: 0.35rem 0.875rem; border-radius: 9999px;
		letter-spacing: 0.01em; margin-top: 0.15rem;
	}

	/* ── Scoreboard ── */
	.r-scoreboard {
		display: flex; align-items: stretch;
		background: var(--surfaceSolid);
		border-radius: var(--r-radius);
		border: 1px solid var(--border-soft);
		box-shadow: var(--r-lift);
		overflow: hidden;
		margin-bottom: 1.25rem;
	}
	.r-score {
		flex: 1; display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		gap: 0.15rem; padding: 1.125rem 0.5rem;
	}
	.r-score-num {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2.25rem; font-weight: 800; line-height: 1;
		letter-spacing: -0.04em; color: var(--warm);
	}
	.r-score-lbl {
		font-size: 0.625rem; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.08em;
		color: var(--muted);
	}
	.r-score-sep {
		width: 1px; background: var(--border-soft);
		margin: 0.875rem 0; flex-shrink: 0;
	}

	/* ── Grid ── */
	.r-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.125rem;
	}
	.r-card--full { grid-column: 1 / -1; }

	/* ── Cards ── */
	.r-card {
		background: var(--surfaceSolid);
		border-radius: var(--r-radius);
		padding: 1.25rem;
		border: 1px solid var(--border-soft);
		box-shadow: var(--r-lift);
		transition: transform 180ms ease, box-shadow 180ms ease;
		display: flex; flex-direction: column; gap: 0.75rem;
	}
	.r-card:hover { transform: translateY(-2px); box-shadow: var(--r-lift-hover); }
	.r-card-head {
		display: flex; align-items: center; gap: 0.5rem;
		color: var(--text);
	}
	.r-card-head h3 {
		margin: 0; font-size: 0.9375rem; font-weight: 600;
		font-family: 'Fraunces', Georgia, serif;
	}
	.r-card-link {
		font-size: 0.8125rem; font-weight: 600; color: var(--slate);
		text-decoration: none; margin-top: auto;
	}
	.r-card-link:hover { text-decoration: underline; }
	.r-empty { margin: 0; font-size: 0.875rem; color: var(--muted); }

	/* Badges */
	.r-badge {
		margin-left: auto; font-size: 0.6875rem; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.05em;
		padding: 0.2rem 0.5rem; border-radius: 9999px;
	}
	.r-badge--muted { color: var(--muted); background: var(--surface2); }
	.r-count-badge {
		font-size: 0.6875rem; font-weight: 700;
		background: var(--surface2); color: var(--muted);
		padding: 0.15rem 0.4rem; border-radius: 9999px;
	}

	/* ── Gallery ── */
	.r-card--gallery { border-style: dashed; }
	.r-gallery-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 0.5rem;
	}
	.r-photo-slot {
		aspect-ratio: 1; border-radius: 8px;
		background: var(--surface2);
		display: flex; align-items: center; justify-content: center;
		animation: r-fadein 0.35s ease both;
	}
	@keyframes r-fadein {
		from { opacity: 0; transform: scale(0.92); }
		to   { opacity: 1; transform: scale(1); }
	}
	.r-gallery-note {
		margin: 0; text-align: center;
		font-size: 0.8125rem; color: var(--muted);
	}

	/* ── Trophy case ── */
	.r-card--trophy {
		background: linear-gradient(135deg, rgba(248,244,221,0.55) 0%, rgba(255,255,255,0.9) 100%);
		border-color: rgba(212,160,23,0.25);
	}
	.r-trophies {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
	}
	.r-trophy {
		display: flex; flex-direction: column;
		align-items: center; text-align: center;
		gap: 0.2rem;
		padding: 1rem 0.75rem;
		border-radius: 12px;
		border: 1px solid transparent;
		transition: transform 160ms ease;
	}
	.r-trophy:hover { transform: translateY(-3px); }
	.r-trophy--gold    { background: var(--r-gold-bg);   border-color: rgba(212,160,23,0.2); }
	.r-trophy--copper  { background: var(--r-copper-bg); border-color: rgba(191,78,48,0.2); }
	.r-trophy--teal    { background: var(--r-teal-bg);   border-color: rgba(47,119,120,0.2); }
	.r-trophy--indigo  { background: var(--r-indigo-bg); border-color: rgba(99,102,241,0.2); }
	.r-trophy-medal { font-size: 1.75rem; line-height: 1; }
	.r-trophy-cat {
		font-size: 0.6875rem; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.06em;
		color: var(--muted); margin-top: 0.2rem;
	}
	.r-trophy-avatars {
		display: flex; align-items: center; justify-content: center;
		gap: -0.25rem; flex-wrap: nowrap; margin-top: 0.25rem;
	}
	.r-trophy-avatars .r-trophy-avatar { margin-left: -6px; }
	.r-trophy-avatars .r-trophy-avatar:first-child { margin-left: 0; }
	.r-trophy-avatar {
		width: 36px; height: 36px; border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--navy));
		color: #fff; font-size: 0.6875rem; font-weight: 600;
		display: inline-flex; align-items: center; justify-content: center;
		overflow: hidden; flex-shrink: 0;
		border: 2px solid var(--surfaceSolid);
		box-shadow: 0 1px 4px rgba(0,0,0,0.12);
	}
	.r-trophy-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.r-trophy-avatar--empty {
		background: var(--surface2); color: var(--muted);
		margin-top: 0.25rem;
	}
	.r-trophy-name {
		font-size: 0.875rem; font-weight: 700; color: var(--text);
		line-height: 1.25; text-align: center;
	}
	.r-trophy-name--empty { color: var(--muted); font-weight: 400; }
	.r-trophy-tie { font-size: 0.75rem; font-weight: 500; color: var(--muted); }
	.r-trophy-stat { font-size: 0.75rem; color: var(--muted); }
	.r-trophy-link {
		font-size: 0.75rem; font-weight: 600;
		color: var(--slate); text-decoration: none; margin-top: 0.15rem;
	}
	.r-trophy-link:hover { text-decoration: underline; }

	/* ── Who was there ── */
	.r-who-grid {
		display: flex; flex-wrap: wrap; gap: 0.5rem;
	}
	.r-guest {
		display: flex; flex-direction: column; align-items: center;
		gap: 0.25rem; width: 56px;
		border: none; padding: 0; background: none;
		cursor: pointer; font: inherit;
	}
	.r-guest-avatar {
		width: 38px; height: 38px; border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--navy));
		color: #fff; font-size: 0.6875rem; font-weight: 600;
		display: flex; align-items: center; justify-content: center;
		overflow: hidden;
	}
	.r-guest-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.r-guest-name {
		font-size: 0.625rem; color: var(--muted);
		text-align: center; white-space: nowrap;
		overflow: hidden; text-overflow: ellipsis; max-width: 56px;
	}

	/* ── Receipt ── */
	.r-receipt { display: flex; flex-direction: column; gap: 0; flex: 1; }
	.r-receipt-row {
		display: flex; justify-content: space-between; align-items: center;
		font-size: 0.875rem; color: var(--text);
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border-soft);
	}
	.r-receipt-row:last-child { border-bottom: none; }
	.r-receipt-row--total { font-weight: 700; }
	.r-receipt-val { font-weight: 600; }
	.r-receipt-paid { color: #22c55e; }
	.r-receipt-line { border: none; border-top: 1px dashed var(--border); margin: 0.2rem 0; }
	.r-receipt-line--thick { border-top: 2px dashed var(--border); }

	/* ── Activities list ── */
	.r-list { list-style: none; margin: 0; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 0; }
	.r-list-item {
		display: flex; align-items: flex-start; gap: 0.5rem;
		padding: 0.375rem 0; border-bottom: 1px solid var(--border-soft);
	}
	.r-list-item:last-child { border-bottom: none; }
	.r-dot {
		width: 7px; height: 7px; border-radius: 50%;
		background: var(--slate); flex-shrink: 0; margin-top: 0.35rem;
	}
	.r-list-body { min-width: 0; display: flex; flex-direction: column; }
	.r-list-title { font-size: 0.875rem; font-weight: 600; color: var(--text); }
	.r-list-sub { font-size: 0.75rem; color: var(--muted); }
	.r-list-more { font-size: 0.75rem; color: var(--muted); font-style: italic; padding: 0.25rem 0; }

	/* ── Meals ── */
	.r-meals { list-style: none; margin: 0; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 0; }
	.r-meals-row {
		display: flex; align-items: center; gap: 0.625rem;
		padding: 0.375rem 0; border-bottom: 1px solid var(--border-soft);
	}
	.r-meals-row:last-child { border-bottom: none; }
	.r-meals-emoji { font-size: 1rem; line-height: 1; flex-shrink: 0; }
	.r-meals-label { font-size: 0.875rem; font-weight: 500; color: var(--text); flex: 1; }
	.r-meals-count {
		font-size: 0.8125rem; font-weight: 700; color: var(--slate);
		background: rgba(47,119,120,0.08); padding: 0.1rem 0.45rem; border-radius: 9999px;
	}
	.r-meals-note { margin: 0; font-size: 0.75rem; color: var(--muted); font-style: italic; }

	/* ── Bottom row (polls + CTAs) ── */
	.r-bottom-row {
		flex-direction: column; gap: 1rem;
		background: linear-gradient(135deg, rgba(248,244,221,0.35) 0%, rgba(255,255,255,0.9) 100%);
		border-color: rgba(227,206,170,0.5);
	}
	.r-polls {
		display: flex; align-items: center; gap: 0.875rem;
	}
	.r-polls-icon {
		width: 36px; height: 36px; border-radius: 50%;
		background: rgba(47,119,120,0.1); color: var(--slate);
		display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	}
	.r-polls-heading { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--text); }
	.r-polls-sub { margin: 0; font-size: 0.8125rem; color: var(--muted); }
	.r-polls-link {
		margin-left: auto; flex-shrink: 0;
		font-size: 0.8125rem; font-weight: 600; color: var(--slate); text-decoration: none;
		padding: 0.4rem 0.875rem; border-radius: 9999px; border: 1.5px solid var(--slate);
		transition: background 150ms, color 150ms;
	}
	.r-polls-link:hover { background: var(--slate); color: #fff; }
	.r-ctas { display: flex; gap: 0.75rem; }
	.r-cta {
		flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
		padding: 0.75rem 1.25rem;
		font-size: 0.875rem; font-weight: 600;
		border-radius: var(--r-radius); text-decoration: none;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}
	.r-cta--primary {
		background: var(--warm); color: #fff;
		box-shadow: 0 4px 14px rgba(206,86,18,0.22);
	}
	.r-cta--primary:hover { background: var(--chocolate); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(206,86,18,0.3); }
	.r-cta--ghost {
		background: var(--surfaceSolid); color: var(--text);
		border: 1px solid var(--border-soft); box-shadow: var(--r-lift);
	}
	.r-cta--ghost:hover { background: var(--surface2); transform: translateY(-1px); }

	/* ── Responsive ── */
	@media (max-width: 900px) {
		.r-grid { grid-template-columns: 1fr; }
		.r-trophies { grid-template-columns: repeat(2, 1fr); }
		.r-gallery-grid { grid-template-columns: repeat(4, 1fr); }
		.r-ctas { flex-direction: column; }
	}
	@media (max-width: 560px) {
		.r-scoreboard { flex-wrap: wrap; }
		.r-score { min-width: 80px; }
		.r-trophies { grid-template-columns: 1fr 1fr; }
	}
</style>
