<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';

	let conversations = $state<Array<{
		otherUserId: string;
		otherUser: { id: string; name: string | null; email: string; avatarUrl: string | null };
		lastMessage: string;
		lastAt: string;
	}>>([]);
	let messages = $state<Array<{
		id: string;
		message: string;
		senderId: string;
		senderName: string;
		chatBubbleColor: string | null;
		createdAt: string;
	}>>([]);
	let otherUser = $state<{ id: string; name: string | null; email: string; avatarUrl: string | null } | null>(null);
	let selectedWith = $state<string | null>(null);
	let newMessage = $state('');
	let loading = $state(true);
	let sending = $state(false);

	$effect(() => {
		selectedWith = $page.url.searchParams.get('with');
	});
	let currentUserId = $state<string | null>(null);
	$effect(() => {
		currentUserId = $page.data?.user?.id ?? null;
	});

	function initials(name: string | null, email: string): string {
		if (name?.trim()) {
			const parts = name.trim().split(/\s+/);
			return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
		}
		return email ? email.slice(0, 2).toUpperCase() : '?';
	}

	async function loadConversations() {
		loading = true;
		try {
			const res = await fetch('/api/messages/conversations');
			if (!res.ok) return;
			const data = await res.json();
			conversations = data.conversations ?? [];
		} finally {
			loading = false;
		}
	}

	async function loadMessages(withUserId: string) {
		loading = true;
		try {
			const res = await fetch(`/api/messages/${withUserId}`);
			if (!res.ok) {
				otherUser = null;
				messages = [];
				return;
			}
			const data = await res.json();
			otherUser = data.otherUser;
			messages = data.messages ?? [];
		} finally {
			loading = false;
		}
	}

	async function selectConversation(withUserId: string) {
		selectedWith = withUserId;
		goto(`/messages?with=${withUserId}`, { replaceState: true });
		await loadMessages(withUserId);
	}

	async function sendMessage() {
		const text = newMessage.trim();
		if (!text || !selectedWith || sending) return;
		sending = true;
		try {
			const res = await fetch(`/api/messages/${selectedWith}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text })
			});
			if (!res.ok) return;
			const data = await res.json();
			messages = [...messages, data.message];
			newMessage = '';
			await loadConversations();
		} finally {
			sending = false;
		}
	}

	$effect(() => {
		const withParam = $page.url.searchParams.get('with');
		if (withParam && withParam !== selectedWith) {
			selectedWith = withParam;
			loadMessages(withParam);
		}
	});

	onMount(() => {
		loadConversations();
		if (selectedWith) loadMessages(selectedWith);
	});
</script>

<svelte:head>
	<title>Messages - Divvi</title>
</svelte:head>

<div class="messages-page">
	<div class="messages-topbar">
		<button type="button" class="messages-back-btn" onclick={() => history.back()} aria-label="Go back">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			Back
		</button>
		<h1 class="messages-heading">Messages</h1>
	</div>
	<div class="messages-layout">
		<aside class="conversations-panel">
			{#if loading && conversations.length === 0}
				<p class="muted">Loading...</p>
			{:else if conversations.length === 0}
				<p class="muted">No conversations yet. Message someone from a trip's guest list.</p>
			{:else}
			<ul class="conversation-list">
				{#each conversations as conv}
					<li class="conversation-item" class:active={selectedWith === conv.otherUserId}>
						<ProfileTooltip
							userId={conv.otherUserId}
							name={conv.otherUser.name}
							avatarUrl={conv.otherUser.avatarUrl}
						>
							<button
								type="button"
								class="conv-avatar-btn"
								aria-label="View {conv.otherUser.name || conv.otherUser.email}'s profile"
								onclick={() => openProfileCard(conv.otherUserId)}
							>
								{#if conv.otherUser.avatarUrl}
									<img src={conv.otherUser.avatarUrl} alt="" class="conv-avatar" />
								{:else}
									<span class="conv-avatar-initials">{initials(conv.otherUser.name, conv.otherUser.email)}</span>
								{/if}
							</button>
						</ProfileTooltip>
						<button
							type="button"
							class="conv-info-btn"
							onclick={() => selectConversation(conv.otherUserId)}
						>
							<span class="conv-name">{conv.otherUser.name || conv.otherUser.email}</span>
							<span class="conv-preview">{conv.lastMessage.slice(0, 50)}{conv.lastMessage.length > 50 ? '…' : ''}</span>
						</button>
					</li>
				{/each}
			</ul>
			{/if}
		</aside>
		<main class="chat-panel">
			{#if selectedWith}
				{#if otherUser}
				<div class="chat-header">
					<div class="chat-header-user">
						<ProfileTooltip
							userId={otherUser.id}
							name={otherUser.name}
							avatarUrl={otherUser.avatarUrl}
						>
							<button
								type="button"
								class="chat-avatar-btn"
								aria-label="View {otherUser.name || otherUser.email}'s profile"
								onclick={() => openProfileCard(otherUser.id)}
							>
								{#if otherUser.avatarUrl}
									<img src={otherUser.avatarUrl} alt="" class="chat-avatar" />
								{:else}
									<span class="chat-avatar-initials">{initials(otherUser.name, otherUser.email)}</span>
								{/if}
							</button>
						</ProfileTooltip>
						<button
							type="button"
							class="chat-header-name-btn"
							onclick={() => openProfileCard(otherUser.id)}
						>
							{otherUser.name || otherUser.email}
						</button>
					</div>
				</div>
					<div class="messages-container">
						{#if loading && messages.length === 0}
							<p class="muted">Loading...</p>
						{:else if messages.length === 0}
							<p class="muted">No messages yet. Say hi!</p>
						{:else}
							{#each messages as msg}
								<div class="message" class:own={msg.senderId === currentUserId}>
									<div
										class="message-bubble"
										class:has-color={!!msg.chatBubbleColor}
										style={msg.chatBubbleColor ? `--bubble-color: ${msg.chatBubbleColor}` : ''}
									>
										<div class="message-text">{msg.message}</div>
										<time class="message-time">{new Date(msg.createdAt).toLocaleString()}</time>
									</div>
								</div>
							{/each}
						{/if}
					</div>
					<form class="message-form" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
						<input
							type="text"
							class="message-input"
							placeholder="Type a message..."
							bind:value={newMessage}
							disabled={sending}
							aria-label="Message"
						/>
						<button type="submit" class="send-btn" disabled={sending || !newMessage.trim()}>Send</button>
					</form>
				{:else if loading}
					<p class="muted">Loading conversation...</p>
				{:else}
					<p class="muted">User not found.</p>
				{/if}
			{:else}
				<div class="chat-empty">
					<p>Select a conversation or use the message button on a trip's guest list to start one.</p>
				</div>
			{/if}
		</main>
	</div>
</div>

<style>
	.messages-page {
		min-height: calc(100vh - 80px);
		background: var(--bg, #f9fafb);
	}
	.messages-topbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		max-width: 900px;
		margin: 0 auto;
		padding: 1rem 0 0.5rem;
	}
	.messages-back-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.75rem;
		border: 1.5px solid var(--border, #e5e7eb);
		border-radius: 8px;
		background: white;
		color: var(--text, #111827);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		font: inherit;
	}
	.messages-back-btn:hover {
		background: var(--bg, #f9fafb);
		border-color: var(--slate, #2f7778);
		color: var(--slate, #2f7778);
	}
	.messages-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--navy, #1d4d4e);
		margin: 0;
	}
	.messages-layout {
		display: flex;
		height: calc(100vh - 80px);
		max-width: 900px;
		margin: 0 auto;
		background: white;
		box-shadow: 0 0 1px rgba(0,0,0,0.1);
	}
	.conversations-panel {
		width: 280px;
		border-right: 1px solid var(--border, #e5e7eb);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.conversations-panel h2 {
		padding: 1rem;
		margin: 0;
		font-size: 1.125rem;
		border-bottom: 1px solid var(--border, #e5e7eb);
	}
	.conversation-list {
		list-style: none;
		padding: 0;
		margin: 0;
		overflow-y: auto;
	}
	.conversation-item {
		display: flex;
		align-items: center;
		gap: 0;
		width: 100%;
		border-bottom: 1px solid var(--border, #e5e7eb);
		background: none;
	}
	.conversation-item:hover { background: #f3f4f6; }
	.conversation-item.active { background: #eff6ff; }
	.conv-avatar-btn {
		flex-shrink: 0;
		padding: 0.75rem 0 0.75rem 1rem;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: 0;
		display: flex;
		align-items: center;
	}
	.conv-avatar-btn:hover .conv-avatar,
	.conv-avatar-btn:hover .conv-avatar-initials {
		outline: 2px solid var(--copper, #bf4e30);
		outline-offset: 2px;
	}
	.conv-info-btn {
		flex: 1;
		min-width: 0;
		padding: 0.75rem 1rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		font: inherit;
	}
	.conv-avatar, .conv-avatar-initials, .chat-avatar, .chat-avatar-initials {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.conv-avatar-initials, .chat-avatar-initials {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface2, #e5e7eb);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
	}
	.conv-avatar, .chat-avatar { object-fit: cover; }
	.conv-name { display: block; font-weight: 500; }
	.conv-preview { display: block; font-size: 0.8125rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.chat-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
	.chat-header {
		padding: 1rem;
		border-bottom: 1px solid var(--border, #e5e7eb);
	}
	.chat-header-user { display: flex; align-items: center; gap: 0.75rem; }
	.chat-avatar-btn {
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		border-radius: 50%;
		display: flex;
	}
	.chat-avatar-btn:hover .chat-avatar,
	.chat-avatar-btn:hover .chat-avatar-initials {
		outline: 2px solid var(--copper, #bf4e30);
		outline-offset: 2px;
	}
	.chat-header-name-btn {
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		font: inherit;
		font-weight: 600;
		color: var(--text);
		text-decoration: underline;
		text-decoration-color: transparent;
		transition: text-decoration-color 0.15s;
	}
	.chat-header-name-btn:hover {
		text-decoration-color: var(--copper, #bf4e30);
		color: var(--copper, #bf4e30);
	}
	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.message { display: flex; justify-content: flex-start; }
	.message.own { justify-content: flex-end; }
	.message.own .message-bubble { background: var(--primary, #2563eb); color: white; }
	.message-bubble {
		max-width: 75%;
		padding: 0.5rem 0.75rem;
		border-radius: 12px;
		background: var(--surface2, #e5e7eb);
	}
	.message-bubble.has-color { background: var(--bubble-color); color: white; }
	.message-time { display: block; font-size: 0.7rem; opacity: 0.8; margin-top: 0.25rem; }
	.message-form {
		display: flex;
		gap: 0.5rem;
		padding: 1rem;
		border-top: 1px solid var(--border, #e5e7eb);
	}
	.message-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 8px;
		font-size: 1rem;
	}
	.send-btn {
		padding: 0.5rem 1rem;
		background: var(--primary, #2563eb);
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
	}
	.send-btn:hover:not(:disabled) { opacity: 0.9; }
	.send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.chat-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		color: var(--muted);
	}
	.muted { color: var(--muted); font-size: 0.875rem; }
</style>
