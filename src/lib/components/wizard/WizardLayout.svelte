<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import TopBar from './TopBar.svelte';
	import Stepper from './Stepper.svelte';
	
	let { currentStep, children }: { currentStep: number; children: any } = $props();
	
	const steps = [
		{ number: 1, label: 'Basics & Source', timeEstimate: '(Approx 5 Min)' },
		{ number: 2, label: 'Location, Dates & Media', timeEstimate: '(Approx 5 Min)' },
		{ number: 3, label: 'Property Structure', timeEstimate: '(Approx 5 Min)' },
		{ number: 4, label: 'Pricing & Capacity', timeEstimate: '(Approx 5 Min)' },
		{ number: 5, label: 'Payments & Invites', timeEstimate: '(Approx 5 Min)' },
		{ number: 6, label: 'Review & Publish', timeEstimate: '(Approx 5 Min)' }
	];
</script>

<div class="wizard-layout">
	<!-- Background with decorative blobs -->
	<div class="background">
		<div class="blob blob-1"></div>
		<div class="blob blob-2"></div>
		<div class="blob blob-3"></div>
	</div>
	
	<!-- Sidebar -->
	<Sidebar />
	
	<!-- Main Content Area -->
	<div class="main-content">
		<!-- Top Bar -->
		<TopBar />
		
		<!-- Stepper -->
		<Stepper {steps} {currentStep} />
		
		<!-- Page Content -->
		<div class="page-content">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.wizard-layout {
		min-height: 100vh;
		display: flex;
		background: var(--bg);
		position: relative;
		overflow-x: hidden;
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
	}
	
	.blob {
		position: absolute;
		border-radius: 50%;
		background: var(--primary);
		opacity: 0.05;
		filter: blur(60px);
	}
	
	.blob-1 {
		width: 400px;
		height: 400px;
		top: -100px;
		right: -100px;
	}
	
	.blob-2 {
		width: 300px;
		height: 300px;
		bottom: 100px;
		left: 200px;
	}
	
	.blob-3 {
		width: 250px;
		height: 250px;
		top: 50%;
		right: 300px;
	}
	
	.main-content {
		flex: 1;
		margin-left: 260px;
		display: flex;
		flex-direction: column;
		position: relative;
		z-index: 1;
		min-height: 100vh;
	}
	
	.page-content {
		flex: 1;
		padding: 0 1.5rem 2rem;
		max-width: 1280px;
		width: 100%;
		margin: 0 auto;
	}
	
	@media (max-width: 1024px) {
		.main-content {
			margin-left: 0;
		}
		
		.page-content {
			padding: 0 1rem 2rem;
		}
	}
</style>
