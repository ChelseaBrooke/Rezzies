<script lang="ts">
	import TopBar from './TopBar.svelte';
	import Stepper from './Stepper.svelte';
	
	let { currentStep, children }: { currentStep: number; children: any } = $props();
	
	const steps = [
		{ number: 1, label: 'Basics & Rooms' },
		{ number: 2, label: 'Meals & Activities' },
		{ number: 3, label: 'Invite People' },
		{ number: 4, label: 'Review & Publish' }
	];
	
	const stepTitles = [
		'Basics & Rooms',
		'Meals & Activities',
		'Invite People',
		'Review & Publish'
	];
	
	const currentTitle = stepTitles[currentStep] || '';
</script>

<div class="create-trip-shell">
	<!-- Background -->
	<div class="background"></div>
	
	<!-- Main Card - starts at top of screen -->
	<div class="main-card">
		<!-- Top Bar inside card -->
		<TopBar />
		
		<!-- Stepper inside card -->
		<Stepper {steps} {currentStep} />
		
		<!-- Card Content -->
		<div class="card-content">
			{@render children()}
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
