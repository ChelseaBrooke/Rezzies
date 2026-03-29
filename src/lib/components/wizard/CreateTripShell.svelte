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
		{ number: 2, label: 'Trip Add-Ons', optional: true },
		{ number: 3, label: 'Review & Publish' }
	];

	let {
		currentStep,
		children,
		onBack,
		backHref,
		backLabel,
		previewLabel,
		stepperInlineLabel,
		steps: stepsProp,
		hideStepperBack = false,
		/** Hide wizard TopBar (emoji bell/profile) — e.g. trip editor publish */
		hideTopBar = false,
		/** Hide step circles; keep only back link when applicable */
		hideStepIndicators = false
	}: {
		currentStep: number;
		children: any;
		onBack?: () => void;
		backHref?: string;
		/** Text for back link/button when using backHref or step 0 + onBack */
		backLabel?: string;
		previewLabel?: string;
		/** When set, replaces the back button with an inline label inside the stepper row */
		stepperInlineLabel?: string;
		steps?: Step[];
		/** When true, stepper header hides Back (e.g. trips/new — footer has Back). */
		hideStepperBack?: boolean;
		hideTopBar?: boolean;
		hideStepIndicators?: boolean;
	} = $props();

	const steps = $derived(stepsProp ?? DEFAULT_STEPS);
	const stepTitles = $derived(steps.map((s) => s.label));
	const currentTitle = $derived(stepTitles[currentStep] || '');
</script>

<div
	class="create-trip-shell"
	class:contained={!!previewLabel || !!stepperInlineLabel}
	class:contained-portal-edit={!!stepperInlineLabel}
>
	<!-- Background (hidden when contained in trip portal) -->
	<div class="background"></div>
	
	<!-- Main Card - starts at top of screen -->
	<div class="main-card">
		<!-- Top Bar or preview label (only when standalone, not portal-contained) -->
		{#if previewLabel}
			<div class="preview-label">{previewLabel}</div>
		{:else if !stepperInlineLabel && !hideTopBar}
			<TopBar />
		{/if}
		
		<!-- Stepper inside card -->
		<Stepper
			{steps}
			{currentStep}
			{onBack}
			{backHref}
			{backLabel}
			hideBack={hideStepperBack}
			inlineLabel={stepperInlineLabel}
			hideSteps={hideStepIndicators}
		/>
		
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
		flex-direction: column;
		overflow: hidden;
		width: 100%;
	}

	/* Edit trip in portal: use more horizontal space + room for add-on glows */
	.create-trip-shell.contained-portal-edit {
		margin-left: -1.25rem;
		margin-right: -1.25rem;
		width: calc(100% + 2.5rem);
		max-width: calc(100% + 2.5rem);
		box-sizing: border-box;
	}
	.create-trip-shell.contained .background {
		display: none;
	}
	.create-trip-shell.contained .main-card {
		max-width: 100%;
		min-height: 0;
		flex: 1;
		align-self: stretch;
		height: auto;
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-md);
		border: 1px solid var(--border);
		overflow: hidden;
		max-height: calc(100% - 0.75rem);
		box-sizing: border-box;
	}

	.create-trip-shell.contained-portal-edit .main-card {
		max-height: calc(100% - 1.25rem);
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
		height: 100dvh;
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

	.create-trip-shell.contained .card-content {
		min-height: 0;
		overflow: hidden;
		padding-top: 1rem;
		padding-bottom: 0;
		flex: 1;
	}

	.create-trip-shell.contained-portal-edit .card-content {
		padding-left: 2.75rem;
		padding-right: 2.75rem;
	}

	@media (max-width: 1024px) {
		.main-card {
			max-width: 100%;
		}
		
		.card-content {
			padding: 1.5rem 2rem 2rem;
		}

		.create-trip-shell.contained .card-content {
			padding-bottom: 0;
		}

		.create-trip-shell.contained-portal-edit {
			margin-left: -0.75rem;
			margin-right: -0.75rem;
			width: calc(100% + 1.5rem);
			max-width: calc(100% + 1.5rem);
		}

		.create-trip-shell.contained-portal-edit .card-content {
			padding-left: 1.5rem;
			padding-right: 1.5rem;
		}
	}
	
	@media (max-width: 768px) {
		.card-header,
		.card-content {
			padding: 1rem 1.5rem;
		}

		.create-trip-shell.contained-portal-edit {
			margin-left: 0;
			margin-right: 0;
			width: 100%;
			max-width: 100%;
		}

		.create-trip-shell.contained-portal-edit .card-content {
			padding-left: 1rem;
			padding-right: 1rem;
		}
		
		.card-title {
			font-size: 1.5rem;
		}
	}
</style>
