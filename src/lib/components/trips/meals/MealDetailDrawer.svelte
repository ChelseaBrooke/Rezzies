<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Meal, MealAttendance } from './types.js';
	import { MEAL_LABELS, OPT_OUT_REASONS } from './types.js';

	interface Props {
		meal: Meal | null;
		open: boolean;
		currentUserId: string;
		isHost: boolean;
		onClose: () => void;
		onUpdate: () => void;
	}

	let { meal, open, currentUserId, isHost, onClose, onUpdate }: Props = $props();

	let attendeeListExpanded = $state(false);
	let allergyDetailExpanded = $state(false);
	let optOutReason = $state('');

	const myAttendance = $derived(meal?.attendance.find((a) => a.guestId === currentUserId));
	const isCook = $derived(meal?.cookIds.includes(currentUserId) ?? false);
	const canEdit = $derived(isHost || isCook);
	const attending = $derived(meal?.attendance.filter((a) => !a.optedOut) ?? []);
	const optedOut = $derived(meal?.attendance.filter((a) => a.optedOut) ?? []);
	const allergyEntries = $derived(meal ? Object.entries(meal.allergySummary) : []);
</script>

{#if open && meal}
	<div
		class="drawer-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="drawer-meal-title"
		onclick={(e) => e.target === e.currentTarget && onClose()}
	>
		<div class="drawer" onclick={(e) => e.stopPropagation()}>
			<div class="drawer-header">
				<div class="drawer-title-row">
					<h2 id="drawer-meal-title">{meal.title || MEAL_LABELS[meal.mealType]}</h2>
					<button type="button" class="drawer-close" onclick={onClose} aria-label="Close">×</button>
				</div>
				<p class="drawer-meta">
					{new Date(meal.startAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
					{#if meal.time}
						· {meal.time}
					{/if}
					· {MEAL_LABELS[meal.mealType]}
				</p>
				{#if meal.cooks.length > 0}
					<div class="drawer-cooks">
						{#each meal.cooks as c}
							<span class="cook-avatar" title={c.name}>{c.name.charAt(0).toUpperCase()}</span>
						{/each}
						<span class="cook-names">{meal.cooks.map((c) => c.name).join(', ')}</span>
					</div>
				{/if}
			</div>

			<div class="drawer-body">
				<!-- Opt-out (guest) -->
				<div class="drawer-section">
					<form method="POST" action="?/setMealAttendance" use:enhance={() => async ({ update }) => { await update(); onUpdate(); }} class="opt-out-form">
						<input type="hidden" name="slotId" value={meal.id} />
						<input type="hidden" name="optedOut" value={myAttendance?.optedOut ? 'false' : 'true'} />
						<input type="hidden" name="optOutReason" value={myAttendance?.optOutReason ?? ''} />
						<input type="hidden" name="dietaryNote" value={myAttendance?.dietaryNote ?? ''} />
						<label class="toggle-row">
							<span class="toggle-label">I'm not attending this meal</span>
							<input
								type="checkbox"
								checked={myAttendance?.optedOut}
								onchange={(e) => {
									const form = (e.target as HTMLInputElement).form;
									const hidden = form?.querySelector('input[name="optedOut"]') as HTMLInputElement;
									if (hidden) hidden.value = (e.target as HTMLInputElement).checked ? 'true' : 'false';
									form?.requestSubmit();
								}}
							/>
						</label>
					</form>
					{#if myAttendance?.optedOut}
						<form method="POST" action="?/setMealAttendance" use:enhance={() => async ({ update }) => { await update(); onUpdate(); }} class="opt-reason-form">
							<input type="hidden" name="slotId" value={meal.id} />
							<input type="hidden" name="optedOut" value="true" />
							<input type="hidden" name="dietaryNote" value={myAttendance?.dietaryNote ?? ''} />
							<label class="label">Reason (optional)</label>
							<select name="optOutReason">
								<option value="">Select…</option>
								{#each OPT_OUT_REASONS as r}
									<option value={r.value} selected={myAttendance?.optOutReason === r.value}>{r.label}</option>
								{/each}
							</select>
							<button type="submit" class="btn-sm">Save</button>
						</form>
					{/if}
				</div>

				<!-- Dietary note (per meal) -->
				<div class="drawer-section">
					<label class="label">Dietary needs for this meal (optional)</label>
					<form method="POST" action="?/setMealAttendance" use:enhance={() => async ({ update }) => { await update(); onUpdate(); }} class="dietary-form">
						<input type="hidden" name="slotId" value={meal.id} />
						<input type="hidden" name="optedOut" value={myAttendance?.optedOut ? 'true' : 'false'} />
						<input type="hidden" name="optOutReason" value={myAttendance?.optOutReason ?? ''} />
						<input type="text" name="dietaryNote" value={myAttendance?.dietaryNote ?? ''} placeholder="e.g. No dairy" />
						<button type="submit" class="btn-sm">Save</button>
					</form>
				</div>

				<!-- What we're making -->
				{#if meal.description || meal.tags?.length}
					<div class="drawer-section">
						<h3 class="section-title">What we're making</h3>
						{#if meal.description}
							<p class="description">{meal.description}</p>
						{/if}
						{#if meal.tags?.length}
							<div class="tag-list">
								{#each meal.tags as t}
									<span class="tag">{t.replace(/_/g, ' ')}</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Headcount + Attendees -->
				<div class="drawer-section">
					<h3 class="section-title">Headcount</h3>
					<p class="headcount-big">Cooking for <strong>{meal.attendingCount}</strong></p>
					<p class="headcount-breakdown">
						Attending: {meal.attendingCount} · Opted out: {meal.optedOutCount}
					</p>
					<button
						type="button"
						class="expand-btn"
						onclick={() => (attendeeListExpanded = !attendeeListExpanded)}
						aria-expanded={attendeeListExpanded}
					>
						{attendeeListExpanded ? 'Hide' : 'Show'} attendee list
					</button>
					{#if attendeeListExpanded}
						<div class="attendee-lists">
							<div class="attendee-group">
								<span class="group-label">Attending</span>
								<ul>
									{#each attending as a}
										<li>
											{a.guest?.name ?? 'Guest'}
											{#if a.dietaryNote}
												<span class="allergy-dot" title={a.dietaryNote}>⚠</span>
											{/if}
											{#if a.guest?.allergies || a.guest?.dietaryRestrictions}
												<span class="allergy-dot" title="Dietary/allergy on profile">⚠</span>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
							{#if optedOut.length > 0}
								<div class="attendee-group">
									<span class="group-label">Opted out</span>
									<ul>
										{#each optedOut as a}
											<li>{a.guest?.name ?? 'Guest'}{#if a.optOutReason}, {a.optOutReason}{/if}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Allergies summary (cook-focused) -->
				{#if allergyEntries.length > 0}
					<div class="drawer-section">
						<h3 class="section-title">Allergy / dietary flags</h3>
						<p class="allergy-summary">Allergy flags: {allergyEntries.length}</p>
						<div class="allergy-chips">
							{#each allergyEntries as [label, count]}
								<span class="chip">{label} ({count})</span>
							{/each}
						</div>
						<button
							type="button"
							class="expand-btn"
							onclick={() => (allergyDetailExpanded = !allergyDetailExpanded)}
							aria-expanded={allergyDetailExpanded}
						>
							{allergyDetailExpanded ? 'Hide' : 'View'} per-person details
						</button>
						{#if allergyDetailExpanded}
							<ul class="allergy-detail-list">
								{#each attending as a}
									{#if a.dietaryNote || a.guest?.allergies || a.guest?.dietaryRestrictions}
										<li>
											<strong>{a.guest?.name ?? 'Guest'}</strong>:
											{a.dietaryNote || [a.guest?.allergies, a.guest?.dietaryRestrictions].filter(Boolean).join('; ') || '—'}
										</li>
									{/if}
								{/each}
							</ul>
						{/if}
					</div>
				{/if}

				{#if canEdit}
					<div class="drawer-section">
						<h3 class="section-title">Reminders</h3>
						<p class="muted">Remind cooks 24h before (MVP: coming soon)</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		z-index: 1100;
		display: flex;
		justify-content: flex-end;
	}
	.drawer {
		width: 100%;
		max-width: 420px;
		height: 100%;
		background: var(--surfaceSolid);
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	.drawer-header {
		padding: 1.25rem;
		border-bottom: 1px solid var(--border-soft);
	}
	.drawer-title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.drawer-title-row h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
	}
	.drawer-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: 0.25rem;
	}
	.drawer-meta {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0.5rem 0 0 0;
	}
	.drawer-cooks {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.cook-avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--primary);
		color: white;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.cook-names {
		font-size: 0.875rem;
		color: var(--text);
	}
	.drawer-body {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.drawer-section .label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text);
		margin-bottom: 0.35rem;
	}
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		cursor: pointer;
	}
	.toggle-label {
		font-size: 0.9375rem;
		color: var(--text);
	}
	.toggle-row input[type="checkbox"] {
		width: auto;
	}
	.opt-reason-form {
		margin-top: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: flex-end;
	}
	.opt-reason-form select {
		padding: 0.4rem 0.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		font-size: 0.875rem;
		min-width: 10rem;
	}
	.btn-sm {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.5rem 0;
	}
	.description {
		font-size: 0.9375rem;
		color: var(--text);
		margin: 0;
		line-height: 1.45;
		white-space: pre-wrap;
	}
	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.5rem;
	}
	.tag {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: var(--surface2);
		color: var(--muted);
	}
	.headcount-big {
		font-size: 1.125rem;
		margin: 0;
		color: var(--text);
	}
	.headcount-breakdown {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.25rem 0 0 0;
	}
	.expand-btn {
		background: none;
		border: none;
		font-size: 0.8125rem;
		color: var(--primary);
		cursor: pointer;
		padding: 0.25rem 0;
		margin-top: 0.5rem;
	}
	.attendee-lists {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.attendee-group .group-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.attendee-group ul {
		margin: 0.25rem 0 0 0;
		padding-left: 1.25rem;
		font-size: 0.875rem;
		color: var(--text);
	}
	.allergy-dot {
		margin-left: 0.25rem;
		color: var(--muted);
		font-size: 0.75rem;
	}
	.allergy-summary {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0 0 0.5rem 0;
	}
	.allergy-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.allergy-chips .chip {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-md);
		background: var(--surface2);
		color: var(--text);
	}
	.allergy-detail-list {
		margin: 0.5rem 0 0 0;
		padding-left: 1.25rem;
		font-size: 0.875rem;
		color: var(--text);
	}
	.muted {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
	}
</style>
