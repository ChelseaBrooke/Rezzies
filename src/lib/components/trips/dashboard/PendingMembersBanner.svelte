<script lang="ts">
	let {
		tripId,
		initialCount = 0
	}: {
		tripId: string;
		initialCount?: number;
	} = $props();

	type PendingMember = {
		memberId: string;
		userId: string;
		name: string;
		email: string;
		avatarUrl: string | null;
		requestedAt: string;
	};

	let expanded = $state(false);
	let members = $state<PendingMember[]>([]);
	let count = $state(initialCount);
	let loading = $state(false);
	let processingIds = $state(new Set<string>());

	async function loadPending() {
		if (loading) return;
		loading = true;
		try {
			const res = await fetch(`/trips/${tripId}/members/pending`);
			if (res.ok) {
				const data = await res.json();
				members = data.members ?? [];
				count = members.length;
			}
		} finally {
			loading = false;
		}
	}

	function toggle() {
		if (!expanded) {
			expanded = true;
			loadPending();
		} else {
			expanded = false;
		}
	}

	async function approve(memberId: string) {
		processingIds = new Set([...processingIds, memberId]);
		try {
			await fetch(`/trips/${tripId}/members/${memberId}/approve`, { method: 'POST' });
			members = members.filter((m) => m.memberId !== memberId);
			count = members.length;
		} finally {
			processingIds = new Set([...processingIds].filter((id) => id !== memberId));
		}
	}

	async function deny(memberId: string) {
		processingIds = new Set([...processingIds, memberId]);
		try {
			await fetch(`/trips/${tripId}/members/${memberId}/deny`, { method: 'POST' });
			members = members.filter((m) => m.memberId !== memberId);
			count = members.length;
		} finally {
			processingIds = new Set([...processingIds].filter((id) => id !== memberId));
		}
	}

	function initials(name: string): string {
		return name
			.split(' ')
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('');
	}
</script>

{#if count > 0}
	<div class="pmb">
		<button class="pmb-trigger" onclick={toggle} type="button">
			<span class="pmb-badge">{count}</span>
			<span class="pmb-label">
				{count === 1 ? '1 person wants to join' : `${count} people want to join`}
			</span>
			<svg class="pmb-chevron" class:open={expanded} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
		</button>

		{#if expanded}
			<div class="pmb-list">
				{#if loading}
					<p class="pmb-empty">Loading…</p>
				{:else if members.length === 0}
					<p class="pmb-empty">No pending requests.</p>
				{:else}
					{#each members as member (member.memberId)}
						<div class="pmb-row">
							<div class="pmb-avatar">
								{#if member.avatarUrl}
									<img src={member.avatarUrl} alt={member.name} />
								{:else}
									<span>{initials(member.name)}</span>
								{/if}
							</div>
							<div class="pmb-info">
								<span class="pmb-name">{member.name}</span>
								<span class="pmb-email">{member.email}</span>
							</div>
							<div class="pmb-actions">
								<button
									class="pmb-btn approve"
									onclick={() => approve(member.memberId)}
									disabled={processingIds.has(member.memberId)}
									type="button"
									title="Approve"
								>
									<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
									Approve
								</button>
								<button
									class="pmb-btn deny"
									onclick={() => deny(member.memberId)}
									disabled={processingIds.has(member.memberId)}
									type="button"
									title="Deny"
								>
									<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
									Deny
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.pmb {
		background: var(--surface, #fff);
		border: 1px solid var(--border-soft, rgba(0, 0, 0, 0.08));
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.pmb-trigger {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.875rem 1.25rem;
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text, #1a1a1a);
		cursor: pointer;
		text-align: left;
	}

	.pmb-trigger:hover {
		background: var(--bgHover, rgba(0, 0, 0, 0.02));
	}

	.pmb-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 100px;
		background: var(--copper, #bf4e30);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.pmb-label {
		flex: 1;
	}

	.pmb-chevron {
		transition: transform 0.2s;
		flex-shrink: 0;
		color: var(--textMuted, #6b7280);
	}

	.pmb-chevron.open {
		transform: rotate(180deg);
	}

	.pmb-list {
		border-top: 1px solid var(--border-soft, rgba(0, 0, 0, 0.06));
		padding: 0.5rem 0;
	}

	.pmb-empty {
		padding: 1rem 1.25rem;
		color: var(--textMuted, #6b7280);
		font-size: 0.875rem;
	}

	.pmb-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1.25rem;
	}

	.pmb-row:hover {
		background: var(--bgHover, rgba(0, 0, 0, 0.02));
	}

	.pmb-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--copper, #bf4e30);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8125rem;
		font-weight: 600;
		flex-shrink: 0;
		overflow: hidden;
	}

	.pmb-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pmb-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.pmb-name {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text, #1a1a1a);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pmb-email {
		font-size: 0.8125rem;
		color: var(--textMuted, #6b7280);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pmb-actions {
		display: flex;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.pmb-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.375rem 0.75rem;
		border-radius: 8px;
		border: 1px solid;
		font-size: 0.8125rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.pmb-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pmb-btn.approve {
		color: #16a34a;
		border-color: #16a34a;
		background: rgba(22, 163, 74, 0.05);
	}

	.pmb-btn.approve:hover:not(:disabled) {
		background: #16a34a;
		color: #fff;
	}

	.pmb-btn.deny {
		color: #dc2626;
		border-color: #dc2626;
		background: rgba(220, 38, 38, 0.05);
	}

	.pmb-btn.deny:hover:not(:disabled) {
		background: #dc2626;
		color: #fff;
	}

	@media (max-width: 480px) {
		.pmb-btn span:last-child { display: none; }
	}
</style>
