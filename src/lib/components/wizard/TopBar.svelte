<script lang="ts">
	// Simple top bar with notification and user icons
</script>

<div class="topbar">
	<div class="topbar-content">
		<div class="topbar-actions">
			<button class="icon-btn" type="button" aria-label="Notifications">
				<span>🔔</span>
			</button>
			<button class="icon-btn" type="button" aria-label="User profile">
				<span>👤</span>
			</button>
		</div>
	</div>
</div>

<style>
	.topbar {
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0 2.5rem;
		background: white;
		border-bottom: 1px solid var(--border);
	}
	
	.topbar-content {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}
	
	.topbar-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	
	.icon-btn {
		width: 2.5rem;
		height: 2.5rem;
		border: none;
		background: transparent;
		border-radius: 0.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s ease;
		font-size: 1.25rem;
		color: var(--text);
	}
	
	.icon-btn:hover {
		background: rgba(0, 0, 0, 0.05);
	}
</style>
