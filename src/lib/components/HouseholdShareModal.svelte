<script lang="ts">
	import { generateHouseholdLink } from '$lib/utils/householdLink.js';

	let {
		open = $bindable(false),
		tripId,
		householdId,
		unclaimedFirstNames,
		primaryLabel
	}: {
		open: boolean;
		tripId: string;
		householdId: string;
		unclaimedFirstNames: string[];
		/** e.g. "your plus ones" or first names */
		primaryLabel: string;
	} = $props();

	let copyState = $state<'idle' | 'copied'>('idle');
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	const link = $derived(
		typeof window !== 'undefined' ? generateHouseholdLink(tripId, householdId, window.location.origin) : ''
	);

	const namePhrase = $derived(formatNames(unclaimedFirstNames));

	function formatNames(names: string[]): string {
		if (names.length === 0) return 'your plus ones';
		if (names.length === 1) return names[0]!;
		if (names.length === 2) return `${names[0]!} and ${names[1]!}`;
		return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]!}`;
	}

	function close() {
		open = false;
	}

	async function copy() {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			copyState = 'copied';
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copyState = 'idle'), 2000);
		} catch {
			// ignore
		}
	}

	async function shareNative() {
		if (typeof navigator === 'undefined' || !navigator.share) {
			await copy();
			return;
		}
		try {
			await navigator.share({ title: 'Join our trip', text: "You're invited — open this link to join.", url: link });
		} catch {
			// user cancel or error
		}
	}
</script>

{#if open}
	<div
		class="hsm-backdrop"
		role="button"
		tabindex="-1"
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		aria-label="Close"
	></div>
	<div class="hsm-modal" role="dialog" aria-modal="true" aria-labelledby="hsm-title">
		<button type="button" class="hsm-x" onclick={close} aria-label="Close">×</button>
		<h2 id="hsm-title" class="hsm-title">Invite your plus ones</h2>
		<p class="hsm-sub">Share this link with {namePhrase}. They'll use it to join the trip portal.</p>
		<div class="hsm-row">
			<input class="hsm-input" type="text" readonly value={link} />
			<button type="button" class="hsm-copy" onclick={copy}
				>{copyState === 'copied' ? 'Copied ✓' : 'Copy link'}</button
			>
		</div>
		{#if typeof navigator !== 'undefined' && typeof navigator.share === 'function'}
			<div class="hsm-row2">
				<span class="hsm-send">Send via…</span>
				<button type="button" class="hsm-native" onclick={shareNative}>Share</button>
			</div>
		{/if}
		<p class="hsm-foot">
			This link is specific to your household. Only {primaryLabel} should use it.
		</p>
		<!-- TODO: add link expiry after all members claimed -->
	</div>
{/if}

<style>
	.hsm-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		z-index: 20000;
	}
	.hsm-modal {
		position: fixed;
		z-index: 20001;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(32rem, calc(100vw - 2rem));
		background: var(--surfaceSolid, #fff);
		border-radius: 16px;
		padding: 1.5rem 1.5rem 1.25rem;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.18);
	}
	.hsm-x {
		position: absolute;
		top: 0.65rem;
		right: 0.75rem;
		border: none;
		background: none;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		color: var(--muted, #64748b);
	}
	.hsm-title {
		margin: 0 2rem 0.5rem 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--navy, #1e293b);
	}
	.hsm-sub {
		margin: 0 0 1rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--muted, #64748b);
	}
	.hsm-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}
	.hsm-input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.6rem;
		font-family: 'Plus Jakarta Sans', ui-monospace, monospace;
		font-size: 0.8125rem;
		border: 1px solid var(--border-soft, #e2e8f0);
		border-radius: 8px;
		background: var(--surface2, #f8fafc);
	}
	.hsm-copy {
		flex-shrink: 0;
		padding: 0.5rem 0.85rem;
		font-weight: 600;
		font-size: 0.8125rem;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		background: #2f7778;
		color: #fff;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
	}
	.hsm-row2 {
		margin-top: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.hsm-send {
		font-size: 0.75rem;
		color: var(--muted, #94a3b8);
		font-weight: 600;
	}
	.hsm-native {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--border-soft, #e2e8f0);
		background: var(--surfaceSolid, #fff);
		cursor: pointer;
	}
	.hsm-foot {
		margin: 1rem 0 0;
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--muted, #94a3b8);
	}
</style>
