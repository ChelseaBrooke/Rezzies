<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Mock profile (structured for later backend)
	type UserProfile = {
		handle: string;
		pronouns: string;
		avatarUrl: string | null;
		emailVerified: boolean;
		phoneVerified: boolean;
		emergencyContactName: string;
		emergencyContactPhone: string;
		shareEmergencyWithHosts: boolean;
		dietaryTags: string[];
		allergiesTags: string[];
		accessibilityNotes: string;
		roomingPreference: 'solo' | 'share_ok' | 'depends';
		bedPreference: string[];
		quietHoursStart: string;
		quietHoursEnd: string;
		vibe: 'early_bird' | 'flexible' | 'night_owl';
		needsRide: boolean;
		canDrive: boolean;
		hasCarSeats: boolean;
		defaultRsvp: 'ask' | 'likely';
		defaultCostSplit: 'per_person' | 'per_room' | 'per_bed';
		notifyItinerary: boolean;
		notifyMealPolls: boolean;
		notifyPayments: boolean;
		notifyMentions: boolean;
		notifyHostAnnouncements: boolean;
		loginMethods: { type: string; connected: boolean }[];
		socialLinks: { platform: string; url: string }[];
		whoCanInvite: 'everyone' | 'friends' | 'link_only';
		passwordLastChanged: string | null;
		mfaEnabled: boolean;
		sessions: { device: string; location: string; lastActive: string }[];
		profileVisibility: 'public' | 'trip_only' | 'private';
		hideEmail: boolean;
		hidePhone: boolean;
		hideStats: boolean;
		memberSince: string;
		roles: ('host' | 'cohost' | 'guest')[];
	};
	const MOCK_PROFILE: UserProfile = {
		handle: 'chelsea',
		pronouns: 'she/her',
		avatarUrl: null,
		emailVerified: true,
		phoneVerified: false,
		emergencyContactName: 'Jamie Smith',
		emergencyContactPhone: '+1 555 123 4567',
		shareEmergencyWithHosts: true,
		dietaryTags: ['Vegetarian', 'No dairy'],
		allergiesTags: ['Tree nuts'],
		accessibilityNotes: 'Prefer ground floor when possible.',
		roomingPreference: 'share_ok',
		bedPreference: ['Queen', 'Twin'],
		quietHoursStart: '22:00',
		quietHoursEnd: '07:00',
		vibe: 'flexible',
		needsRide: false,
		canDrive: true,
		hasCarSeats: false,
		defaultRsvp: 'ask',
		defaultCostSplit: 'per_person',
		notifyItinerary: true,
		notifyMealPolls: true,
		notifyPayments: true,
		notifyMentions: true,
		notifyHostAnnouncements: true,
		loginMethods: [
			{ type: 'Google', connected: true },
			{ type: 'Email', connected: true },
			{ type: 'Apple', connected: false }
		],
		socialLinks: [{ platform: 'Instagram', url: 'https://instagram.com/chelsea' }],
		whoCanInvite: 'everyone',
		passwordLastChanged: '2024-06-15',
		mfaEnabled: false,
		sessions: [
			{ device: 'Chrome on Windows', location: 'Seattle, WA', lastActive: 'Just now' },
			{ device: 'Safari on iPhone', location: 'Seattle, WA', lastActive: '2 hours ago' }
		],
		profileVisibility: 'public',
		hideEmail: false,
		hidePhone: true,
		hideStats: false,
		memberSince: data.user?.createdAt ? new Date(data.user.createdAt).toISOString().slice(0, 10) : '2023-03-01',
		roles: ['host', 'guest']
	};

	let profile = $state<UserProfile>({ ...MOCK_PROFILE });
	let activeTab = $state<'preferences' | 'saved' | 'history' | 'security'>('preferences');
	let savedSubTab = $state<'trips' | 'templates'>('trips');
	let toast = $state<{ message: string } | null>(null);
	let editModalOpen = $state(false);
	let deleteModalOpen = $state(false);
	let reportModalOpen = $state(false);
	let editForm = $state({
		displayName: data.user?.name ?? '',
		handle: MOCK_PROFILE.handle,
		pronouns: MOCK_PROFILE.pronouns,
		dietaryTags: MOCK_PROFILE.dietaryTags.join(', '),
		allergiesTags: MOCK_PROFILE.allergiesTags.join(', '),
		accessibilityNotes: MOCK_PROFILE.accessibilityNotes
	});

	const displayName = $derived(data.user?.name || 'Traveler');
	const memberSinceFormatted = $derived(
		profile.memberSince
			? new Date(profile.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
			: '—'
	);
	const stats = $derived(data.stats ?? {
		tripsHosted: 0,
		tripsJoined: 0,
		upcomingTrips: 0,
		pendingInvites: 0,
		pendingRsvps: 0,
		unreadNotifications: 0
	});

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2
			? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
			: name.slice(0, 2).toUpperCase();
	}

	function showToast(msg: string) {
		toast = { message: msg };
		setTimeout(() => (toast = null), 3000);
	}

	function copyShareLink() {
		const url = typeof window !== 'undefined' ? `${window.location.origin}/profile/${data.user?.id ?? 'me'}` : '';
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(url).then(() => showToast('Profile link copied!'));
		} else showToast('Link: ' + url);
	}

	function openEditModal() {
		editForm = {
			displayName: data.user?.name ?? '',
			handle: profile.handle,
			pronouns: profile.pronouns,
			dietaryTags: profile.dietaryTags.join(', '),
			allergiesTags: profile.allergiesTags.join(', '),
			accessibilityNotes: profile.accessibilityNotes
		};
		editModalOpen = true;
	}

	function saveEdit() {
		profile = {
			...profile,
			handle: editForm.handle,
			pronouns: editForm.pronouns,
			dietaryTags: editForm.dietaryTags ? editForm.dietaryTags.split(',').map((s) => s.trim()).filter(Boolean) : [],
			allergiesTags: editForm.allergiesTags ? editForm.allergiesTags.split(',').map((s) => s.trim()).filter(Boolean) : [],
			accessibilityNotes: editForm.accessibilityNotes
		};
		editModalOpen = false;
		showToast('Profile updated!');
	}

	function signOutAll() {
		deleteModalOpen = false;
		goto('/logout');
	}

	const statLinks: { label: string; href: string; value: number; icon: string }[] = [
		{ label: 'Trips hosted', href: '/trips?filter=hosted', value: stats.tripsHosted, icon: 'home' },
		{ label: 'Trips joined', href: '/trips?filter=joined', value: stats.tripsJoined, icon: 'users' },
		{ label: 'Upcoming trips', href: '/trips?filter=upcoming', value: stats.upcomingTrips, icon: 'calendar' },
		{ label: 'Pending invites', href: '/invites', value: stats.pendingInvites, icon: 'mail' },
		{ label: 'Pending RSVPs', href: '/trips', value: stats.pendingRsvps, icon: 'check-circle' },
		{ label: 'Unread notifications', href: '/notifications', value: stats.unreadNotifications, icon: 'bell' }
	];

	const hasPhotosFeature = $state(false);
</script>

<svelte:head>
	<title>Profile – Divvi</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="profile-page">
	<div class="profile-container">
		<!-- Left column: identity + quick actions -->
		<aside class="profile-left">
			<!-- Profile header card -->
			<section class="card card-header" aria-labelledby="profile-identity">
				<div class="card-header-tint"></div>
				<div class="card-body">
					<div class="avatar-wrap">
						{#if profile.avatarUrl}
							<img src={profile.avatarUrl} alt="" class="avatar-img" />
						{:else}
							<span class="avatar-initials">{initials(data.user?.name)}</span>
						{/if}
					</div>
					<h1 id="profile-identity" class="profile-name">{displayName}</h1>
					{#if profile.handle}
						<p class="profile-handle">@{profile.handle}</p>
					{/if}
					{#if profile.pronouns}
						<p class="profile-pronouns">{profile.pronouns}</p>
					{/if}
					<p class="profile-meta">Member since {memberSinceFormatted}</p>
					<div class="badges-row">
						{#each profile.roles as role}
							<span class="pill pill-role">{role === 'cohost' ? 'Co-host' : role}</span>
						{/each}
						{#if profile.emailVerified}
							<span class="pill pill-verified">Verified email</span>
						{/if}
						{#if profile.phoneVerified}
							<span class="pill pill-verified">Verified phone</span>
						{/if}
					</div>
					<div class="cta-row">
						<button type="button" class="btn btn-primary" onclick={openEditModal}>
							<span class="icon" aria-hidden="true">✏️</span>
							Edit profile
						</button>
						<button type="button" class="btn btn-secondary" onclick={copyShareLink}>
							<span class="icon" aria-hidden="true">🔗</span>
							Share profile
						</button>
					</div>
					<div class="cta-row secondary">
						<a href="#security-privacy" class="link-soft">Privacy & security →</a>
					</div>
				</div>
			</section>

			<!-- Quick stats card -->
			<section class="card card-stats" aria-labelledby="quick-stats-title">
				<h2 id="quick-stats-title" class="card-title">
					<span class="icon-sm" aria-hidden="true">📊</span>
					Quick stats
				</h2>
				<div class="stats-grid">
					{#each statLinks as stat}
						<a href={stat.href} class="stat-tile">
							<span class="stat-icon" aria-hidden="true">{stat.icon === 'home' ? '🏠' : stat.icon === 'users' ? '👥' : stat.icon === 'calendar' ? '📅' : stat.icon === 'mail' ? '✉️' : stat.icon === 'check-circle' ? '✓' : '🔔'}</span>
							<span class="stat-label">{stat.label}</span>
							<span class="stat-value">{stat.value}</span>
						</a>
					{/each}
				</div>
			</section>
		</aside>

		<!-- Right column: tabs + sections -->
		<div class="profile-right">
			<div class="tabs-row" role="tablist">
				<button
					type="button"
					role="tab"
					class="tab"
					class:active={activeTab === 'preferences'}
					onclick={() => (activeTab = 'preferences')}
				>
					Preferences
				</button>
				<button type="button" role="tab" class="tab" class:active={activeTab === 'saved'} onclick={() => (activeTab = 'saved')}>
					Saved
				</button>
				<button type="button" role="tab" class="tab" class:active={activeTab === 'history'} onclick={() => (activeTab = 'history')}>
					History
				</button>
				<button type="button" role="tab" class="tab" class:active={activeTab === 'security'} onclick={() => (activeTab = 'security')}>
					Security
				</button>
			</div>

			{#if activeTab === 'preferences'}
				<!-- Basics -->
				<section class="card section-card" aria-labelledby="basics-title">
					<h2 id="basics-title" class="card-title card-title-tint">
						<span class="icon-sm">👤</span>
						Basics
					</h2>
					<div class="card-body">
						<div class="field-row">
							<span class="field-label">Email</span>
							<span class="field-value">{data.user?.email ?? '—'}</span>
							{#if profile.emailVerified}
								<span class="pill pill-verified">Verified</span>
							{/if}
							<button type="button" class="btn-ghost btn-sm" onclick={openEditModal}>Edit</button>
						</div>
						<div class="field-row">
							<span class="field-label">Phone</span>
							<span class="field-value">{data.user?.phone ?? 'Not set'}</span>
							{#if profile.phoneVerified}
								<span class="pill pill-verified">Verified</span>
							{/if}
						</div>
						<div class="field-row">
							<span class="field-label">Emergency contact</span>
							<span class="field-value">{profile.emergencyContactName} · {profile.emergencyContactPhone}</span>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Share emergency with trip hosts</span>
							<button
								type="button"
								class="toggle"
								class:on={profile.shareEmergencyWithHosts}
								onclick={() => (profile = { ...profile, shareEmergencyWithHosts: !profile.shareEmergencyWithHosts })}
								aria-pressed={profile.shareEmergencyWithHosts}
							>
								<span class="toggle-thumb"></span>
							</button>
						</div>
						<div class="field-row">
							<span class="field-label">Dietary</span>
							<div class="tags">
								{#each profile.dietaryTags as tag}
									<span class="pill pill-tag">{tag}</span>
								{/each}
								{#if profile.dietaryTags.length === 0}
									<span class="muted">None set</span>
								{/if}
							</div>
						</div>
						<div class="field-row">
							<span class="field-label">Allergies</span>
							<div class="tags">
								{#each profile.allergiesTags as tag}
									<span class="pill pill-tag">{tag}</span>
								{/each}
								{#if profile.allergiesTags.length === 0}
									<span class="muted">None set</span>
								{/if}
							</div>
						</div>
						<div class="field-row">
							<span class="field-label">Accessibility notes</span>
							<span class="field-value">{profile.accessibilityNotes || '—'}</span>
						</div>
					</div>
				</section>

				<!-- Travel preferences -->
				<section class="card section-card" aria-labelledby="prefs-title">
					<h2 id="prefs-title" class="card-title card-title-tint">
						<span class="icon-sm">✈️</span>
						Preferences
					</h2>
					<div class="card-body">
						<div class="field-row">
							<span class="field-label">Rooming</span>
							<div class="radio-group">
								{#each ['solo', 'share_ok', 'depends'] as opt}
									<label class="radio-label">
										<input type="radio" name="rooming" value={opt} checked={profile.roomingPreference === opt} onchange={() => (profile = { ...profile, roomingPreference: opt as UserProfile['roomingPreference'] })} />
										{opt === 'solo' ? 'Solo' : opt === 'share_ok' ? 'Share OK' : 'Depends'}
									</label>
								{/each}
							</div>
						</div>
						<div class="field-row">
							<span class="field-label">Bed preference</span>
							<div class="pills-select">
								{#each ['King', 'Queen', 'Twin', 'Sofa bed OK'] as bed}
									<button
										type="button"
										class="pill pill-select"
										class:active={profile.bedPreference.includes(bed)}
										onclick={() => {
											const next = profile.bedPreference.includes(bed)
												? profile.bedPreference.filter((b) => b !== bed)
												: [...profile.bedPreference, bed];
											profile = { ...profile, bedPreference: next };
										}}
									>
										{bed}
									</button>
								{/each}
							</div>
						</div>
						<div class="field-row">
							<span class="field-label">Quiet hours</span>
							<span class="field-value">{profile.quietHoursStart} – {profile.quietHoursEnd}</span>
						</div>
						<div class="field-row">
							<span class="field-label">Vibe</span>
							<div class="segmented">
								<button type="button" class="seg" class:active={profile.vibe === 'early_bird'} onclick={() => (profile = { ...profile, vibe: 'early_bird' })}>Early bird</button>
								<button type="button" class="seg" class:active={profile.vibe === 'flexible'} onclick={() => (profile = { ...profile, vibe: 'flexible' })}>Flexible</button>
								<button type="button" class="seg" class:active={profile.vibe === 'night_owl'} onclick={() => (profile = { ...profile, vibe: 'night_owl' })}>Night owl</button>
							</div>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Needs a ride</span>
							<button type="button" class="toggle" class:on={profile.needsRide} onclick={() => (profile = { ...profile, needsRide: !profile.needsRide })} aria-pressed={profile.needsRide}><span class="toggle-thumb"></span></button>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Can drive</span>
							<button type="button" class="toggle" class:on={profile.canDrive} onclick={() => (profile = { ...profile, canDrive: !profile.canDrive })} aria-pressed={profile.canDrive}><span class="toggle-thumb"></span></button>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Has car seats</span>
							<button type="button" class="toggle" class:on={profile.hasCarSeats} onclick={() => (profile = { ...profile, hasCarSeats: !profile.hasCarSeats })} aria-pressed={profile.hasCarSeats}><span class="toggle-thumb"></span></button>
						</div>
					</div>
				</section>

				<!-- Defaults -->
				<section class="card section-card" aria-labelledby="defaults-title">
					<h2 id="defaults-title" class="card-title card-title-tint">
						<span class="icon-sm">⚙️</span>
						Defaults
					</h2>
					<div class="card-body">
						<div class="field-row">
							<span class="field-label">Default RSVP</span>
							<div class="segmented">
								<button type="button" class="seg" class:active={profile.defaultRsvp === 'ask'} onclick={() => (profile = { ...profile, defaultRsvp: 'ask' })}>Ask me every time</button>
								<button type="button" class="seg" class:active={profile.defaultRsvp === 'likely'} onclick={() => (profile = { ...profile, defaultRsvp: 'likely' })}>Auto-set to Likely</button>
							</div>
						</div>
						<div class="field-row">
							<span class="field-label">Cost split preference</span>
							<div class="segmented">
								<button type="button" class="seg" class:active={profile.defaultCostSplit === 'per_person'} onclick={() => (profile = { ...profile, defaultCostSplit: 'per_person' })}>Per person</button>
								<button type="button" class="seg" class:active={profile.defaultCostSplit === 'per_room'} onclick={() => (profile = { ...profile, defaultCostSplit: 'per_room' })}>Per room</button>
								<button type="button" class="seg" class:active={profile.defaultCostSplit === 'per_bed'} onclick={() => (profile = { ...profile, defaultCostSplit: 'per_bed' })}>Per bed</button>
							</div>
						</div>
						<div class="field-row">
							<span class="field-label">Notifications</span>
							<div class="check-list">
								<label class="check-label"><input type="checkbox" bind:checked={profile.notifyItinerary} /> Itinerary changes</label>
								<label class="check-label"><input type="checkbox" bind:checked={profile.notifyMealPolls} /> Meal polls</label>
								<label class="check-label"><input type="checkbox" bind:checked={profile.notifyPayments} /> Payment reminders</label>
								<label class="check-label"><input type="checkbox" bind:checked={profile.notifyMentions} /> @mentions</label>
								<label class="check-label"><input type="checkbox" bind:checked={profile.notifyHostAnnouncements} /> Host announcements</label>
							</div>
						</div>
					</div>
				</section>

				<!-- Connections -->
				<section class="card section-card" aria-labelledby="connections-title">
					<h2 id="connections-title" class="card-title card-title-tint">
						<span class="icon-sm">🔗</span>
						Connections
					</h2>
					<div class="card-body">
						<div class="field-row">
							<span class="field-label">Login methods</span>
							<div class="pills-row">
								{#each profile.loginMethods as method}
									<span class="pill" class:connected={method.connected}>{method.type} {method.connected ? '✓' : ''}</span>
								{/each}
							</div>
						</div>
						<div class="field-row">
							<span class="field-label">Social links</span>
							{#each profile.socialLinks as link}
								<span class="field-value"><a href={link.url} target="_blank" rel="noopener noreferrer">{link.platform}</a></span>
							{/each}
							{#if profile.socialLinks.length === 0}
								<span class="muted">None added</span>
							{/if}
						</div>
						<div class="field-row">
							<span class="field-label">Who can invite me</span>
							<select
								class="select"
								value={profile.whoCanInvite}
								onchange={(e) => (profile = { ...profile, whoCanInvite: (e.currentTarget.value as UserProfile['whoCanInvite']) })}
							>
								<option value="everyone">Everyone</option>
								<option value="friends">Friends of friends</option>
								<option value="link_only">Only people with link</option>
							</select>
						</div>
						<div class="button-row">
							<a href="/settings/blocked" class="btn btn-ghost">Block list</a>
							<button type="button" class="btn btn-ghost" onclick={() => (reportModalOpen = true)}>Report issue</button>
						</div>
					</div>
				</section>
			{/if}

			{#if activeTab === 'saved'}
				<section class="card section-card" aria-labelledby="saved-title">
					<h2 id="saved-title" class="card-title card-title-tint">
						<span class="icon-sm">⭐</span>
						Saved
					</h2>
					<div class="sub-tabs">
						<button type="button" class="sub-tab" class:active={savedSubTab === 'trips'} onclick={() => (savedSubTab = 'trips')}>Saved trips</button>
						<button type="button" class="sub-tab" class:active={savedSubTab === 'templates'} onclick={() => (savedSubTab = 'templates')}>Templates</button>
					</div>
					<div class="card-body">
						{#if savedSubTab === 'trips'}
							<div class="empty-state">
								<span class="empty-icon" aria-hidden="true">📌</span>
								<p>No saved trips yet.</p>
								<p class="muted">When you save a trip, it’ll show up here.</p>
								<a href="/trips" class="btn btn-secondary">Browse trips</a>
							</div>
						{:else}
							<div class="empty-state">
								<span class="empty-icon" aria-hidden="true">📋</span>
								<p>No templates yet.</p>
								<p class="muted">Room choice, packing list, and dietary presets will appear here.</p>
							</div>
						{/if}
					</div>
				</section>
			{/if}

			{#if activeTab === 'history'}
				<section class="card section-card" aria-labelledby="history-title">
					<h2 id="history-title" class="card-title card-title-tint">
						<span class="icon-sm">📅</span>
						Trip history
					</h2>
					<div class="card-body">
						<div class="timeline">
							<div class="timeline-year">2024</div>
							<div class="timeline-item">
								<div class="timeline-content">
									<strong>Lake weekend</strong>
									<span class="muted">Jun 14 – 16 · Tahoe</span>
									<span class="pill pill-role">Guest</span>
									<button type="button" class="btn-ghost btn-sm">View recap</button>
								</div>
							</div>
							<div class="timeline-year">2023</div>
							<div class="timeline-item">
								<div class="timeline-content">
									<strong>Beach house</strong>
									<span class="muted">Aug 1 – 7 · Oregon Coast</span>
									<span class="pill pill-role">Host</span>
									<button type="button" class="btn-ghost btn-sm">View recap</button>
								</div>
							</div>
						</div>
						{#if hasPhotosFeature}
							<div class="field-row">
								<span class="field-label">Photo highlights you’re tagged in</span>
								<span class="muted">Coming soon</span>
							</div>
						{:else}
							<div class="empty-state small">
								<span class="empty-icon">📷</span>
								<p class="muted">Photo highlights (coming soon)</p>
							</div>
						{/if}
					</div>
				</section>
			{/if}

			{#if activeTab === 'security'}
				<section id="security-privacy" class="card section-card" aria-labelledby="security-title">
					<h2 id="security-title" class="card-title card-title-tint">
						<span class="icon-sm">🔒</span>
						Security & privacy
					</h2>
					<div class="card-body">
						<div class="field-row">
							<span class="field-label">Password</span>
							<span class="field-value">Last changed {profile.passwordLastChanged ?? 'never'}</span>
							<a href="/settings" class="btn btn-ghost btn-sm">Change password</a>
						</div>
						<div class="field-row">
							<span class="field-label">Two-factor auth</span>
							<span class="field-value">{profile.mfaEnabled ? 'On' : 'Off'}</span>
							<button type="button" class="btn btn-ghost btn-sm">{profile.mfaEnabled ? 'Manage MFA' : 'Set up MFA'}</button>
						</div>
						<div class="field-row">
							<span class="field-label">Active sessions</span>
							<ul class="sessions-list">
								{#each profile.sessions as session}
									<li class="session-item">
										<span>{session.device}</span>
										<span class="muted">{session.location} · {session.lastActive}</span>
										<button type="button" class="btn-ghost btn-sm">Sign out</button>
									</li>
								{/each}
							</ul>
							<button type="button" class="btn btn-ghost" onclick={() => showToast('Signed out of other sessions')}>Sign out all others</button>
						</div>
						<hr class="card-divider" />
						<div class="field-row">
							<span class="field-label">Profile visibility</span>
							<select class="select" value={profile.profileVisibility} onchange={(e) => (profile = { ...profile, profileVisibility: e.currentTarget.value as UserProfile['profileVisibility'] })}>
								<option value="public">Public</option>
								<option value="trip_only">Trip-only</option>
								<option value="private">Private</option>
							</select>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Hide email</span>
							<button type="button" class="toggle" class:on={profile.hideEmail} onclick={() => (profile = { ...profile, hideEmail: !profile.hideEmail })} aria-pressed={profile.hideEmail}><span class="toggle-thumb"></span></button>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Hide phone</span>
							<button type="button" class="toggle" class:on={profile.hidePhone} onclick={() => (profile = { ...profile, hidePhone: !profile.hidePhone })} aria-pressed={profile.hidePhone}><span class="toggle-thumb"></span></button>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Hide stats</span>
							<button type="button" class="toggle" class:on={profile.hideStats} onclick={() => (profile = { ...profile, hideStats: !profile.hideStats })} aria-pressed={profile.hideStats}><span class="toggle-thumb"></span></button>
						</div>
						<hr class="card-divider" />
						<div class="button-row">
							<button type="button" class="btn btn-secondary">Export data</button>
							<button type="button" class="btn btn-destructive" onclick={() => (deleteModalOpen = true)}>Delete account</button>
						</div>
					</div>
				</section>
			{/if}
		</div>
	</div>
</div>

<!-- Edit profile modal -->
{#if editModalOpen}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
		<div class="modal">
			<h2 id="edit-modal-title" class="modal-title">Edit profile</h2>
			<form onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
				<div class="form-group">
					<label for="edit-name">Display name</label>
					<input id="edit-name" type="text" bind:value={editForm.displayName} />
				</div>
				<div class="form-group">
					<label for="edit-handle">Handle</label>
					<input id="edit-handle" type="text" bind:value={editForm.handle} placeholder="@username" />
				</div>
				<div class="form-group">
					<label for="edit-pronouns">Pronouns</label>
					<input id="edit-pronouns" type="text" bind:value={editForm.pronouns} placeholder="she/her" />
				</div>
				<div class="form-group">
					<label for="edit-dietary">Dietary (comma-separated)</label>
					<input id="edit-dietary" type="text" bind:value={editForm.dietaryTags} />
				</div>
				<div class="form-group">
					<label for="edit-allergies">Allergies (comma-separated)</label>
					<input id="edit-allergies" type="text" bind:value={editForm.allergiesTags} />
				</div>
				<div class="form-group">
					<label for="edit-accessibility">Accessibility notes</label>
					<textarea id="edit-accessibility" bind:value={editForm.accessibilityNotes} rows="2"></textarea>
				</div>
				<div class="modal-actions">
					<button type="button" class="btn btn-ghost" onclick={() => (editModalOpen = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary">Save</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete account modal -->
{#if deleteModalOpen}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
		<div class="modal">
			<h2 id="delete-modal-title" class="modal-title">Delete account?</h2>
			<p class="modal-text">This will permanently delete your account and all data. This cannot be undone.</p>
			<div class="modal-actions">
				<button type="button" class="btn btn-ghost" onclick={() => (deleteModalOpen = false)}>Cancel</button>
				<button type="button" class="btn btn-destructive" onclick={signOutAll}>Delete account</button>
			</div>
		</div>
	</div>
{/if}

<!-- Report issue modal -->
{#if reportModalOpen}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
		<div class="modal">
			<h2 id="report-modal-title" class="modal-title">Report an issue</h2>
			<p class="modal-text">Describe what went wrong and we’ll look into it.</p>
			<form onsubmit={(e) => { e.preventDefault(); reportModalOpen = false; showToast('Report submitted. Thanks!'); }}>
				<div class="form-group">
					<textarea rows="3" placeholder="Details…"></textarea>
				</div>
				<div class="modal-actions">
					<button type="button" class="btn btn-ghost" onclick={() => (reportModalOpen = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary">Submit</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if toast}
	<div class="toast" role="status">{toast.message}</div>
{/if}

<style>
	/* Sleek profile theme: neutral grays, soft blue accent, Plus Jakarta Sans */
	.profile-page {
		font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
		background: #f8fafc;
		min-height: calc(100vh - 80px);
		width: 100%;
		max-width: 100vw;
		overflow-x: hidden;
		box-sizing: border-box;
		padding: clamp(0.75rem, 2vw, 1.5rem) clamp(0.5rem, 4vw, 1.5rem);
	}
	@media (min-width: 768px) {
		.profile-page {
			padding: clamp(1rem, 3vw, 2rem) clamp(1rem, 5vw, 2.5rem);
		}
	}

	.profile-container {
		width: 100%;
		max-width: 100%;
		margin: 0 auto;
		display: grid;
		gap: clamp(1rem, 2vw, 1.5rem);
		box-sizing: border-box;
	}
	@media (min-width: 900px) {
		.profile-container {
			grid-template-columns: minmax(260px, 320px) 1fr;
			align-items: start;
		}
	}

	.profile-left {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	@media (min-width: 900px) {
		.profile-left {
			position: sticky;
			top: 6rem;
		}
	}

	.card {
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
		border: 1px solid #e2e8f0;
		overflow: hidden;
		min-width: 0;
	}
	.card-body {
		padding: clamp(1rem, 3vw, 1.25rem) clamp(1rem, 4vw, 1.5rem);
	}
	.card-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #0f172a;
		margin: 0 0 0.75rem 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		letter-spacing: -0.01em;
	}
	.card-title-tint {
		background: #f8fafc;
		padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 3vw, 1.25rem);
		margin: -1px -1px 0 -1px;
		border-radius: 12px 12px 0 0;
		border-bottom: 1px solid #e2e8f0;
	}
	.icon-sm {
		font-size: 1.125rem;
		opacity: 0.85;
	}
	.card-header-tint {
		height: 3px;
		background: linear-gradient(90deg, #3b82f6 0%, #94a3b8 100%);
		opacity: 0.35;
	}
	.card-header .card-body {
		text-align: center;
	}
	.avatar-wrap {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: #f1f5f9;
		margin: 0 auto 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar-initials {
		font-size: 1.75rem;
		font-weight: 600;
		color: #2563eb;
		letter-spacing: -0.02em;
	}
	.profile-name {
		font-size: 1.25rem;
		font-weight: 600;
		color: #0f172a;
		margin: 0 0 0.25rem 0;
		letter-spacing: -0.02em;
	}
	.profile-handle {
		font-size: 0.875rem;
		color: #64748b;
		margin: 0 0 0.125rem 0;
	}
	.profile-pronouns {
		font-size: 0.8125rem;
		color: #64748b;
		margin: 0 0 0.5rem 0;
	}
	.profile-meta {
		font-size: 0.75rem;
		color: #94a3b8;
		margin: 0 0 0.75rem 0;
	}
	.badges-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		justify-content: center;
		margin-bottom: 1rem;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 6px;
		background: #f1f5f9;
		color: #475569;
		letter-spacing: 0.02em;
	}
	.pill-role {
		background: #eff6ff;
		color: #2563eb;
	}
	.pill-verified {
		background: #ecfdf5;
		color: #059669;
	}
	.pill-tag {
		background: #f1f5f9;
		color: #334155;
	}
	.pill-select {
		border: none;
		cursor: pointer;
		font-family: inherit;
	}
	.pill-select.active {
		background: #2563eb;
		color: white;
	}
	.pill.connected {
		background: #ecfdf5;
		color: #059669;
	}
	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-bottom: 0.5rem;
	}
	.cta-row.secondary {
		margin-bottom: 0;
	}
	.cta-row .btn {
		font-size: 0.875rem;
		padding: 0.5rem 1rem;
		font-weight: 500;
	}
	.cta-row .icon {
		margin-right: 0.25rem;
	}
	.profile-page .cta-row .btn-primary {
		background: #2563eb;
		color: white;
		border: none;
	}
	.profile-page .cta-row .btn-primary:hover {
		background: #1d4ed8;
	}
	.profile-page .cta-row .btn-secondary {
		background: #ffffff;
		color: #475569;
		border: 1px solid #e2e8f0;
	}
	.profile-page .cta-row .btn-secondary:hover {
		background: #f8fafc;
		border-color: #cbd5e1;
	}
	.link-soft {
		font-size: 0.8125rem;
		color: #64748b;
		text-decoration: none;
	}
	.link-soft:hover {
		color: #2563eb;
	}
	.card-stats .card-title {
		margin-bottom: 0.75rem;
		padding: 0 0.25rem;
	}
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}
	.stat-tile {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: clamp(0.5rem, 2vw, 0.75rem);
		background: #ffffff;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		text-decoration: none;
		color: #0f172a;
		transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
		min-width: 0;
	}
	.stat-tile:hover {
		background: #f8fafc;
		border-color: #cbd5e1;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}
	.stat-icon {
		font-size: 1.25rem;
	}
	.stat-label {
		font-size: 0.6875rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.stat-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: #0f172a;
	}

	.profile-right {
		min-width: 0;
	}
	.tabs-row {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		border-bottom: 1px solid #e2e8f0;
		padding-bottom: 0.5rem;
	}
	.tab {
		padding: clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.75rem, 2vw, 1rem);
		font-size: clamp(0.8125rem, 2vw, 0.875rem);
		font-weight: 500;
		background: transparent;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		color: #64748b;
		transition: color 0.15s ease, background 0.15s ease;
		min-height: 44px;
		touch-action: manipulation;
	}
	.tab:hover {
		color: #0f172a;
		background: #f1f5f9;
	}
	.tab.active {
		background: #eff6ff;
		color: #2563eb;
		border: none;
		box-shadow: none;
	}

	.section-card {
		margin-bottom: 1rem;
	}
	.section-card .card-body {
		padding: clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.25rem);
	}
	.field-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		margin-bottom: 0.75rem;
	}
	.field-row:last-child {
		margin-bottom: 0;
	}
	.field-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #64748b;
		min-width: 0;
		flex: 1 1 100%;
	}
	@media (min-width: 480px) {
		.field-label {
			flex: 0 0 auto;
			min-width: 7.5rem;
		}
	}
	.field-value {
		font-size: 0.875rem;
		color: #0f172a;
		flex: 1;
		min-width: 0;
		overflow-wrap: break-word;
		word-break: break-word;
	}
	.switch-row .field-label {
		flex: 1;
	}
	.toggle {
		width: 44px;
		min-width: 44px;
		height: 24px;
		min-height: 24px;
		border-radius: 9999px;
		background: #e2e8f0;
		border: 1px solid #cbd5e1;
		cursor: pointer;
		padding: 2px;
		flex-shrink: 0;
		transition: background 0.15s ease, border-color 0.15s ease;
		touch-action: manipulation;
	}
	.toggle.on {
		background: #2563eb;
		border-color: #2563eb;
	}
	.toggle-thumb {
		display: block;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		transition: transform 0.15s ease;
	}
	.toggle.on .toggle-thumb {
		transform: translateX(20px);
	}
	.radio-group, .pills-select, .pills-row, .tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.segmented {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}
	.seg {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		background: #f1f5f9;
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		color: #64748b;
		transition: all 0.15s ease;
	}
	.seg:hover {
		color: #0f172a;
		background: #e2e8f0;
	}
	.seg.active {
		background: #2563eb;
		color: white;
		border-color: #2563eb;
	}
	.select {
		padding: 0.35rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background: #ffffff;
		color: #0f172a;
		min-width: 0;
		max-width: 100%;
		width: 100%;
	}
	@media (min-width: 480px) {
		.select {
			width: auto;
			min-width: 10rem;
		}
	}
	.check-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.check-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.button-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.btn-sm {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}
	.card-divider {
		border: none;
		height: 1px;
		background: #e2e8f0;
		margin: 1rem 0;
	}
	.sessions-list {
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}
	.session-item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #e2e8f0;
		font-size: 0.875rem;
	}
	.session-item:last-child {
		border-bottom: none;
	}
	.sub-tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
	}
	.sub-tab {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: #f1f5f9;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		color: #64748b;
	}
	.sub-tab.active {
		background: #eff6ff;
		color: #2563eb;
		border: 1px solid #bfdbfe;
	}
	.empty-state {
		text-align: center;
		padding: 2rem 1rem;
	}
	.empty-state.small {
		padding: 1rem;
	}
	.empty-icon {
		font-size: 2rem;
		display: block;
		margin-bottom: 0.5rem;
		opacity: 0.6;
	}
	.empty-state p {
		margin: 0 0 0.25rem 0;
	}
	.empty-state .btn {
		margin-top: 1rem;
	}
	.timeline {
		margin-bottom: 1rem;
	}
	.timeline-year {
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0.75rem 0 0.25rem 0;
	}
	.timeline-year:first-child {
		margin-top: 0;
	}
	.timeline-item {
		margin-bottom: 0.5rem;
	}
	.timeline-content {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.timeline-content strong {
		flex-shrink: 0;
	}
	.muted {
		font-size: 0.875rem;
		color: #64748b;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: clamp(0.5rem, 5vw, 1rem);
		overflow-y: auto;
		box-sizing: border-box;
	}
	.modal {
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
		border: 1px solid #e2e8f0;
		max-width: min(440px, calc(100vw - 2rem));
		width: 100%;
		padding: clamp(1rem, 4vw, 1.5rem);
		max-height: min(90vh, calc(100dvh - 2rem));
		overflow-y: auto;
		margin: auto;
		flex-shrink: 0;
		box-sizing: border-box;
	}
	.modal-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #0f172a;
		margin: 0 0 1rem 0;
		letter-spacing: -0.02em;
	}
	.modal-text {
		font-size: 0.875rem;
		color: #64748b;
		margin: 0 0 1rem 0;
	}
	.form-group {
		margin-bottom: 1rem;
	}
	.form-group label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: #64748b;
		margin-bottom: 0.25rem;
	}
	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background: #ffffff;
		color: #0f172a;
	}
	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}

	.profile-page .btn-primary {
		background: #2563eb;
		color: white;
		border: none;
	}
	.profile-page .btn-primary:hover {
		background: #1d4ed8;
	}
	.profile-page .btn-ghost {
		background: transparent;
		color: #64748b;
		border: none;
	}
	.profile-page .btn-ghost:hover {
		background: #f1f5f9;
		color: #0f172a;
	}
	.profile-page .btn-secondary {
		background: #ffffff;
		color: #475569;
		border: 1px solid #e2e8f0;
	}
	.profile-page .btn-secondary:hover {
		background: #f8fafc;
		border-color: #cbd5e1;
	}
	.profile-page .btn-destructive {
		background: #dc2626;
		color: white;
		border: none;
	}
	.profile-page .btn-destructive:hover {
		background: #b91c1c;
	}
	.toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: #0f172a;
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.15);
		z-index: 101;
		animation: toastIn 0.2s ease;
	}
	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
