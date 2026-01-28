<script lang="ts">
	let { title, icon, children }: { title: string; icon: string; children: any } = $props();
</script>

<div class="section-card">
	<div class="section-header">
		<div class="icon-container">
			<span class="icon">{icon}</span>
		</div>
		<h3 class="section-title">{title}</h3>
	</div>
	<div class="section-body">
		{@render children()}
	</div>
</div>

<style>
	.section-card {
		background: white;
		border-radius: 1rem;
		border: 1px solid var(--border);
		padding: 1.5rem;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}
	
	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}
	
	.icon-container {
		width: 2.5rem;
		height: 2.5rem;
		background: rgba(30, 58, 138, 0.1);
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	
	.icon {
		font-size: 1.25rem;
		color: var(--primary);
	}
	
	.section-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}
	
	.section-body {
		/* Content goes here */
	}
</style>
