<script lang="ts">
	import TopBar from './TopBar.svelte';
	import Stepper from './Stepper.svelte';
	
	let { currentStep, children, onBack, backHref, previewLabel }: { currentStep: number; children: any; onBack?: () => void; backHref?: string; previewLabel?: string } = $props();
	
	const steps = [
		{ number: 1, label: 'Basics & Rooms' },
		{ number: 2, label: 'Meals', optional: true },
		{ number: 3, label: 'Activities' },
		{ number: 4, label: 'Invite People' },
		{ number: 5, label: 'Review & Publish' }
	];
	
	const stepTitles = [
		'Basics & Rooms',
		'Meals (Optional)',
		'Activities',
		'Invite People',
		'Review & Publish'
	];
	
	const currentTitle = stepTitles[currentStep] || '';
</script>

<div class="create-trip-shell" class:contained={!!previewLabel}>
	<!-- Background (hidden when contained in trip portal) -->
	<div class="background"></div>
	
	<!-- Main Card - starts at top of screen -->
	<div class="main-card">
		<!-- Top Bar or preview label -->
		{#if previewLabel}
			<div class="preview-label">{previewLabel}</div>
		{:else}
			<TopBar />
		{/if}
		
		<!-- Stepper inside card -->
		<Stepper {steps} {currentStep} {onBack} {backHref} />
		
		<!-- Card Content -->
		<div class="card-content">
			{#if children != null && typeof children === 'function'}
				{@render children()}
			{/if}
		</div>
	</div>
</div>

<style>
	.create-trip-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #1a1a1a;
		position: relative;
		overflow-x: hidden;
		padding: 0;
		margin: 0;
		width: 100%;
	}

	/* Contained inside trip portal (e.g. preview-new): no full-page background, fit in rounded box */
	.create-trip-shell.contained {
		min-height: 0;
		background: transparent;
		flex: 1;
		display: flex;
		overflow: hidden;
	}
	.create-trip-shell.contained .background {
		display: none;
	}
	.create-trip-shell.contained .main-card {
		max-width: 100%;
		min-height: 0;
		flex: 1;
		align-self: stretch;
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	
	.background {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
		background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
		background-image: url('/images/homepage-bg.jpg');
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		filter: blur(8px) brightness(0.3);
		transform: scale(1.1);
	}
	
	.background::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
	}
	
	.main-card {
		position: relative;
		z-index: 1;
		background: white;
		border-radius: 0;
		border: none;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 85%;
		margin: 0;
		min-height: 100vh;
		overflow-y: auto;
		flex: 1;
		align-self: center;
	}
	
	.card-header {
		padding: 1rem 2.5rem;
		border-bottom: 1px solid var(--border);
	}
	
	.card-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}
	
	.card-subtitle {
		font-size: 0.875rem;
		color: var(--muted);
	}
	
	.preview-label {
		padding: 1rem 2rem;
		background: var(--bg, #f5f5f5);
		border-bottom: 1px solid var(--border);
		font-size: 0.9375rem;
		color: var(--muted);
	}
	
	.card-content {
		flex: 1;
		padding: 1rem 2rem 1.5rem;
		display: flex;
		flex-direction: column;
	}
	
	@media (max-width: 1024px) {
		.main-card {
			max-width: 100%;
		}
		
		.card-content {
			padding: 1.5rem 2rem 2rem;
		}
	}
	
	@media (max-width: 768px) {
		.card-header,
		.card-content {
			padding: 1rem 1.5rem;
		}
		
		.card-title {
			font-size: 1.5rem;
		}
	}
</style>
