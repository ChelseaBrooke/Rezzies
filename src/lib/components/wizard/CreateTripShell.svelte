<script lang="ts">
	import TopBar from './TopBar.svelte';
	import Stepper from './Stepper.svelte';

	interface Step {
		number: number;
		label: string;
		optional?: boolean;
	}

	const DEFAULT_STEPS: Step[] = [
		{ number: 1, label: 'Basics & Rooms' },
		{ number: 2, label: 'Pricing' },
		{ number: 3, label: 'Meals & Activities', optional: true },
		{ number: 4, label: 'Invite People' },
		{ number: 5, label: 'Review & Publish' }
	];

	let {
		currentStep,
		children,
		onBack,
		backHref,
		previewLabel,
		steps: stepsProp
	}: {
		currentStep: number;
		children: any;
		onBack?: () => void;
		backHref?: string;
		previewLabel?: string;
		steps?: Step[];
	} = $props();

	const steps = $derived(stepsProp ?? DEFAULT_STEPS);
	const stepTitles = $derived(steps.map((s) => s.label));
	const currentTitle = $derived(stepTitles[currentStep] || '');
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
		background: var(--bg);
		position: relative;
		overflow-x: hidden;
		padding: 0;
		margin: 0;
		width: 100%;
	}

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
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-md);
		border: 1px solid var(--border);
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
		background-image: url('/images/homepage-bg.jpg');
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		filter: blur(8px) brightness(0.5);
		transform: scale(1.1);
	}
	
	.background::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(10, 18, 22, 0.45);
	}
	
	.main-card {
		position: relative;
		z-index: 1;
		background: white;
		border-radius: 0;
		border: 1px solid var(--border);
		box-shadow: var(--shadow-xl);
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
		background: var(--surface2);
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
