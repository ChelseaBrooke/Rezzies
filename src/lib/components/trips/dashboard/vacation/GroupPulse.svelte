<script lang="ts">
	import { browser } from '$app/environment';

	export type PulseLine = {
		id: string;
		initials: string;
		/** Full first line (name + action) or legacy split */
		line: string;
	};

	let { items = [] as PulseLine[] }: { items?: PulseLine[] } = $props();

	function openChat() {
		if (browser) window.dispatchEvent(new CustomEvent('open-trip-chat'));
	}
</script>

{#if items.length >= 2}
	<section class="pulse" aria-labelledby="pulse-title">
		<h2 id="pulse-title" class="pulse-title">Group Pulse</h2>
		<ul class="pulse-list">
			{#each items as item (item.id)}
				<li class="pulse-row">
					<span class="av" aria-hidden="true">{item.initials}</span>
					<span class="line">{item.line}</span>
				</li>
			{/each}
		</ul>
		<button type="button" class="chat-link" onclick={openChat}>Trip chat →</button>
	</section>
{/if}

<style>
	.pulse {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		background: #fff;
		border-radius: 14px;
		border: 1px solid rgba(15, 23, 42, 0.08);
		box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
		padding: 1rem 1.15rem 1.1rem;
		margin-bottom: 1.5rem;
		animation: pulse-in 200ms ease-out;
	}
	@keyframes pulse-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.pulse-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 17px;
		font-weight: 700;
		margin: 0 0 0.75rem;
		color: #0f172a;
	}
	.pulse-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.pulse-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 14px;
		color: #334155;
		line-height: 1.35;
	}
	.av {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #2f7778;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.line {
		min-width: 0;
	}
	.chat-link {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		margin-top: 0.75rem;
		padding: 0;
		border: none;
		background: none;
		font-size: 14px;
		font-weight: 600;
		color: #2f7778;
		cursor: pointer;
		text-align: left;
	}
	.chat-link:hover {
		text-decoration: underline;
	}
</style>
