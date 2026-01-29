<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let inviteOpen = $state(false);
	let inviteName = $state('');
	let inviteEmail = $state('');
	let inviteRole = $state<'guest' | 'co-host'>('guest');

	function openInvite() {
		inviteOpen = true;
	}
	function closeInvite() {
		inviteOpen = false;
		inviteName = '';
		inviteEmail = '';
		inviteRole = 'guest';
	}
	function submitInvite() {
		// Stub: would call API to send invite
		closeInvite();
	}
</script>

<div class="page">
	<div class="page-header">
		<h1>Guests</h1>
		<p class="subtitle">Manage who’s invited and their roles</p>
		<button type="button" class="btn-primary" onclick={openInvite}>Invite</button>
	</div>

	<div class="card">
		<div class="card-body">
			{#if data.members?.length > 0}
				<table class="table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th>Role</th>
						</tr>
					</thead>
					<tbody>
						{#each data.members as member}
							<tr>
								<td>{member.user?.name ?? '—'}</td>
								<td>{member.user?.email ?? '—'}</td>
								<td><span class="role-pill">{member.role}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty">No guests yet. Use Invite to add people.</p>
			{/if}
		</div>
	</div>
</div>

{#if inviteOpen}
	<div class="modal-backdrop" onclick={closeInvite} role="presentation"></div>
	<div class="modal" role="dialog">
		<h2>Invite someone</h2>
		<form onsubmit={(e) => { e.preventDefault(); submitInvite(); }}>
			<div class="form-group">
				<label for="invite-name">Name (optional)</label>
				<input id="invite-name" type="text" bind:value={inviteName} placeholder="Full name" />
			</div>
			<div class="form-group">
				<label for="invite-email">Email *</label>
				<input id="invite-email" type="email" bind:value={inviteEmail} placeholder="email@example.com" required />
			</div>
			<div class="form-group">
				<label for="invite-role">Role</label>
				<select id="invite-role" bind:value={inviteRole}>
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
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0 0 1rem 0; }
	.btn-primary { padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 0.5rem; font-weight: 500; cursor: pointer; }
	.card { background: white; border-radius: 1rem; border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.table th, .table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
	.table th { font-weight: 500; color: var(--muted); }
	.role-pill { display: inline-block; padding: 0.25rem 0.5rem; background: var(--bg); border-radius: 9999px; font-size: 0.75rem; text-transform: capitalize; }
	.empty { color: var(--muted); margin: 0; }
	.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; }
	.modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 1.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); z-index: 101; min-width: 20rem; }
	.modal h2 { margin: 0 0 1rem 0; font-size: 1.25rem; }
	.form-group { margin-bottom: 1rem; }
	.form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
	.form-group input, .form-group select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; font-size: 0.875rem; }
	.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }
	.btn-secondary { padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer; }
</style>
