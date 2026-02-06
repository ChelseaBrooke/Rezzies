<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		tripId: string;
		userId: string;
	}

	let { tripId, userId }: Props = $props();

	let isOpen = $state(false);
	let messages = $state<Array<{
		id: string;
		message: string;
		userId: string;
		userName: string | null;
		createdAt: string;
	}>>([]);
	let newMessage = $state('');
	let isLoading = $state(false);
	let unreadCount = $state(0);
	let lastMessageId: string | null = $state(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	async function loadMessages() {
		try {
			const response = await fetch(`/api/trips/${tripId}/chat/messages`);
			if (!response.ok) {
				if (response.status === 403) {
					// User doesn't have access (no RSVP), hide chat
					return;
				}
				return;
			}
			const data = await response.json();
			const newMessages = data.messages || [];
			
			// Check if there are actually new messages
			const hadMessages = messages.length > 0;
			const lastMessageBefore = messages.length > 0 ? messages[messages.length - 1] : null;
			
			const previousLength = messages.length;
			messages = newMessages;
			
			// Auto-scroll if chat is open and new messages arrived
			if (isOpen && messages.length > previousLength) {
				setTimeout(() => {
					const messagesContainer = document.querySelector('.messages-container');
					if (messagesContainer) {
						messagesContainer.scrollTop = messagesContainer.scrollHeight;
					}
				}, 100);
			}
			
			// Update unread count (messages after last seen)
			if (!isOpen) {
				if (lastMessageId && messages.length > 0) {
					const lastSeenIndex = messages.findIndex(m => m.id === lastMessageId);
					if (lastSeenIndex >= 0 && lastSeenIndex < messages.length - 1) {
						unreadCount = messages.length - lastSeenIndex - 1;
					} else if (lastSeenIndex < 0) {
						// Last seen message not found, count all as unread
						unreadCount = messages.length;
					} else {
						unreadCount = 0;
					}
				} else if (messages.length > 0) {
					// First time loading, if we had messages before, don't count them as unread
					if (!hadMessages) {
						unreadCount = 0;
					} else if (lastMessageBefore && messages.length > 0) {
						// Check if there's a new message
						const newLastMessage = messages[messages.length - 1];
						if (newLastMessage.id !== lastMessageBefore.id) {
							unreadCount += 1;
						}
					}
				} else {
					unreadCount = 0;
				}
			}
		} catch (err) {
			console.error('Failed to load messages:', err);
		}
	}

	async function sendMessage() {
		if (!newMessage.trim() || isLoading) return;
		
		isLoading = true;
		try {
			const response = await fetch(`/api/trips/${tripId}/chat/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: newMessage.trim() })
			});
			
			if (response.ok) {
				newMessage = '';
				await loadMessages();
				// Mark as read when sending
				if (messages.length > 0) {
					lastMessageId = messages[messages.length - 1].id;
					unreadCount = 0;
				}
			}
		} catch (err) {
			console.error('Failed to send message:', err);
		} finally {
			isLoading = false;
		}
	}

	function toggleChat() {
		isOpen = !isOpen;
		if (isOpen) {
			// Mark messages as read when opening
			if (messages.length > 0) {
				lastMessageId = messages[messages.length - 1].id;
				unreadCount = 0;
			}
			// Scroll to bottom
			setTimeout(() => {
				const messagesContainer = document.querySelector('.messages-container');
				if (messagesContainer) {
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
				}
			}, 100);
		} else {
			// When closing, mark current messages as read
			if (messages.length > 0) {
				lastMessageId = messages[messages.length - 1].id;
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function formatTime(dateStr: string) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
		return date.toLocaleDateString();
	}

	onMount(() => {
		loadMessages();
		// Poll for new messages every 5 seconds
		pollInterval = setInterval(() => {
			if (!isOpen) {
				loadMessages();
			} else {
				// When open, poll more frequently
				loadMessages();
			}
		}, isOpen ? 2000 : 5000);
	});

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	// Update polling interval when isOpen changes
	$effect(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
		pollInterval = setInterval(() => {
			if (!isOpen) {
				loadMessages();
			} else {
				loadMessages();
			}
		}, isOpen ? 2000 : 5000);
	});
</script>

<div class="chat-widget" class:open={isOpen}>
	{#if !isOpen}
		<button class="chat-toggle" onclick={toggleChat} aria-label="Open chat">
			<div class="chat-toggle-content">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
				<span class="chat-toggle-text">Trip Chat</span>
				{#if unreadCount > 0}
					<span class="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
				{/if}
			</div>
		</button>
	{:else}
		<div class="chat-window">
			<div class="chat-header">
				<div class="chat-header-content">
					<h3>Trip Chat</h3>
					<p class="chat-subtitle">Group chat for RSVP'd guests</p>
				</div>
				<button class="chat-close" onclick={toggleChat} aria-label="Close chat">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
			
			<div class="messages-container">
				{#if messages.length === 0}
					<div class="empty-state">
						<p>No messages yet. Start the conversation!</p>
					</div>
				{:else}
					{#each messages as message}
						<div class="message" class:own={message.userId === userId}>
							<div class="message-content">
								<div class="message-header">
									<span class="message-author">{message.userName || 'Guest'}</span>
									<span class="message-time">{formatTime(message.createdAt)}</span>
								</div>
								<p class="message-text">{message.message}</p>
							</div>
						</div>
					{/each}
				{/if}
			</div>
			
			<div class="chat-input-container">
				<textarea
					class="chat-input"
					placeholder="Type a message..."
					bind:value={newMessage}
					onkeydown={handleKeydown}
					rows="1"
					disabled={isLoading}
				></textarea>
				<button
					class="send-button"
					onclick={sendMessage}
					disabled={!newMessage.trim() || isLoading}
					aria-label="Send message"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="22" y1="2" x2="11" y2="13" />
						<polygon points="22 2 15 22 11 13 2 9 22 2" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.chat-widget {
		position: fixed;
		bottom: 0;
		right: 2rem;
		z-index: 1000;
		font-family: inherit;
	}

	.chat-toggle {
		width: auto;
		min-width: 280px;
		max-width: 500px;
		height: 48px;
		border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
		background: linear-gradient(135deg, var(--primary, #3b82f6) 0%, var(--primaryHover, #2563eb) 100%);
		color: white;
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.25);
		box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 1.25rem;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}

	.chat-toggle::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
	}

	.chat-toggle:hover {
		background: rgba(0, 0, 0, 0.06);
		color: #111827;
		box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.chat-toggle:active {
		background: var(--primary, #3b82f6);
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
	}

	.chat-toggle-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		position: relative;
	}

	.chat-toggle-text {
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.badge {
		background: var(--danger, #ef4444);
		color: white;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		min-width: 20px;
		text-align: center;
		line-height: 1.2;
		margin-left: auto;
	}

	.chat-window {
		width: 500px;
		height: 420px;
		background: white;
		border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border, #e5e7eb);
		border-bottom: none;
		margin-bottom: 0;
	}

	.chat-header {
		padding: 1rem;
		border-bottom: 1px solid var(--border, #e5e7eb);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		background: linear-gradient(to bottom, var(--surfaceSolid, white) 0%, var(--surface2, #f9fafb) 100%);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.chat-header-content {
		flex: 1;
	}

	.chat-header h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: var(--text);
	}

	.chat-subtitle {
		font-size: 0.75rem;
		color: var(--muted, #6b7280);
		margin: 0;
	}

	.chat-close {
		background: transparent;
		border: none;
		color: var(--muted, #6b7280);
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md, 6px);
		transition: background 0.2s ease, color 0.2s ease;
	}

	.chat-close:hover {
		background: var(--surface2, #f3f4f6);
		color: var(--text);
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: var(--bg, #f9fafb);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--muted, #6b7280);
		font-size: 0.875rem;
		text-align: center;
	}

	.message {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.message.own {
		align-items: flex-end;
	}

	.message.own .message-content {
		background: linear-gradient(135deg, var(--primary, #3b82f6) 0%, var(--primaryHover, #2563eb) 100%);
		color: white;
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.message-content {
		max-width: 75%;
		background: white;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: var(--radius-lg, 12px);
		padding: 0.625rem 0.75rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08), 0 1px 0 rgba(0, 0, 0, 0.05);
	}

	.message-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.message-author {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted, #6b7280);
	}

	.message.own .message-author {
		color: rgba(255, 255, 255, 0.9);
	}

	.message-time {
		font-size: 0.6875rem;
		color: var(--muted, #6b7280);
		white-space: nowrap;
	}

	.message.own .message-time {
		color: rgba(255, 255, 255, 0.8);
	}

	.message-text {
		font-size: 0.875rem;
		line-height: 1.4;
		margin: 0;
		color: var(--text);
		word-wrap: break-word;
	}

	.message.own .message-text {
		color: white;
	}

	.chat-input-container {
		padding: 0.75rem;
		border-top: 1px solid var(--border, #e5e7eb);
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		background: white;
	}

	.chat-input {
		flex: 1;
		border: 1px solid var(--border-strong, #d1d5db);
		border-radius: var(--radius-md, 8px);
		padding: 0.625rem 0.75rem;
		font-size: 0.875rem;
		font-family: inherit;
		resize: none;
		max-height: 120px;
		min-height: 40px;
		line-height: 1.4;
	}

	.chat-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing, rgba(59, 130, 246, 0.1));
	}

	.chat-input:disabled {
		background: var(--surface2, #f3f4f6);
		cursor: not-allowed;
	}

	.send-button {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md, 8px);
		background: linear-gradient(135deg, var(--primary, #3b82f6) 0%, var(--primaryHover, #2563eb) 100%);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.send-button:hover:not(:disabled) {
		background: linear-gradient(135deg, var(--primaryHover, #2563eb) 0%, #1d4ed8 100%);
		transform: scale(1.05);
		box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.send-button:active:not(:disabled) {
		transform: scale(0.95);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15);
	}

	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.chat-window {
			max-width: calc(100vw - 1rem);
			width: calc(100vw - 1rem);
			height: calc(100vh - 4rem);
			max-height: 500px;
		}

		.chat-widget {
			right: 0.5rem;
		}

		.chat-toggle {
			min-width: 240px;
			max-width: calc(100vw - 1rem);
		}
	}
</style>
