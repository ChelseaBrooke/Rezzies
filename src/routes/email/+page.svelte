<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let sendResult = $derived(form?.sendPreview);
	let sendingId = $state<string | null>(null);

	/** Full HTML documents break attribute parsing; set srcdoc in JS. */
	function emailIframe(node: HTMLIFrameElement, html: string) {
		node.srcdoc = html;
		return {
			update(next: string) {
				node.srcdoc = next;
			}
		};
	}
</script>

<svelte:head>
	<title>Email previews · Divvi</title>
</svelte:head>

<div class="ep-shell">
	<header class="ep-header">
		<h1 class="ep-title">Transactional email previews</h1>
		<p class="ep-hint">
			Live HTML from <code>src/lib/server/email/render/</code>. Links use placeholder URLs. Available in
			<strong>development</strong> or when <code>EMAIL_PREVIEW_ENABLED=true</code> in server env.
			Use <strong>Send test</strong> to deliver the sample to <code>{data.previewRecipient}</code> via Resend.
		</p>
	</header>

	<nav class="ep-nav" aria-label="Email types">
		{#each data.previews as p (p.id)}
			<a class="ep-nav-link" href="#{p.id}">{p.label}</a>
		{/each}
	</nav>

	<main class="ep-main">
		{#each data.previews as p (p.id)}
			<section class="ep-section" id={p.id}>
				<div class="ep-section-head">
					<div class="ep-section-meta">
						<h2 class="ep-section-title">{p.label}</h2>
						<p class="ep-section-id"><code>{p.id}</code></p>
					</div>
					<form
						method="POST"
						action="?/sendPreview"
						class="ep-send-form"
						use:enhance={() => {
							sendingId = p.id;
							return async ({ update }) => {
								await update({ reset: false });
								sendingId = null;
							};
						}}
					>
						<input type="hidden" name="previewId" value={p.id} />
						<button type="submit" class="ep-send-btn" disabled={sendingId === p.id}>
							{sendingId === p.id ? 'Sending…' : 'Send test → chelsea.nilon@gmail.com'}
						</button>
					</form>
				</div>
				{#if sendResult?.previewId === p.id}
					{#if sendResult.success}
						<p class="ep-send-ok" role="status">Sent to {data.previewRecipient}.</p>
					{:else if sendResult.error}
						<p class="ep-send-err" role="alert">{sendResult.error}</p>
					{/if}
				{/if}
				<div class="ep-frame-wrap">
					<iframe
						class="ep-frame"
						title={`Email preview: ${p.label}`}
						sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
						use:emailIframe={p.html}
					></iframe>
				</div>
			</section>
		{/each}
	</main>
</div>

<style>
	.ep-shell {
		min-height: 100vh;
		background: #f4f5f7;
		color: #111827;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		padding: 1.5rem 1.25rem 3rem;
		box-sizing: border-box;
	}
	.ep-header {
		max-width: 960px;
		margin: 0 auto 1.25rem;
	}
	.ep-title {
		font-family: Fraunces, Georgia, serif;
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0 0 0.5rem;
		letter-spacing: -0.02em;
	}
	.ep-hint {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.55;
		color: #374151;
		max-width: 52rem;
	}
	.ep-hint code {
		font-size: 0.8125rem;
		background: rgba(47, 119, 120, 0.1);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}
	.ep-nav {
		max-width: 960px;
		margin: 0 auto 1.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.65rem;
		padding: 0.75rem 0;
		border-top: 1px solid rgba(47, 119, 120, 0.15);
		border-bottom: 1px solid rgba(47, 119, 120, 0.15);
	}
	.ep-nav-link {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #2f7778;
		text-decoration: none;
		padding: 0.25rem 0;
	}
	.ep-nav-link:hover {
		text-decoration: underline;
		color: #1d4d4e;
	}
	.ep-main {
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}
	.ep-section {
		scroll-margin-top: 1rem;
	}
	.ep-section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		margin-bottom: 0.75rem;
	}
	.ep-section-meta {
		min-width: 0;
	}
	.ep-section-title {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
		color: #111827;
	}
	.ep-section-id {
		margin: 0;
		font-size: 0.75rem;
		color: #6b7280;
	}
	.ep-send-form {
		margin: 0;
		flex-shrink: 0;
	}
	.ep-send-btn {
		border: 1px solid rgba(206, 86, 18, 0.35);
		background: #ce5612;
		color: #fff;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0.45rem 0.85rem;
		border-radius: 10px;
		cursor: pointer;
		white-space: nowrap;
		box-shadow: 0 4px 14px rgba(206, 86, 18, 0.25);
	}
	.ep-send-btn:hover:not(:disabled) {
		background: #a5440e;
	}
	.ep-send-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}
	.ep-send-ok {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		color: #1f5e3a;
		background: #e6f4ec;
		border: 1px solid #b6dcc4;
		border-radius: 8px;
		padding: 0.4rem 0.65rem;
	}
	.ep-send-err {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		color: #9a1f1f;
		background: #fdecec;
		border: 1px solid #f0b4b4;
		border-radius: 8px;
		padding: 0.4rem 0.65rem;
	}
	.ep-frame-wrap {
		background: #e5e7eb;
		border-radius: 12px;
		padding: 12px;
		border: 1px solid rgba(17, 24, 39, 0.08);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.ep-frame {
		display: block;
		width: 100%;
		min-height: 520px;
		border: none;
		border-radius: 8px;
		background: #fff;
	}
</style>
