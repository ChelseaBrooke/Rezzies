<script lang="ts">
	export interface Step {
		number: number;
		label: string;
		timeEstimate?: string;
	}
	
	let { steps, currentStep }: { steps: Step[]; currentStep: number } = $props();
</script>

<div class="stepper">
	<div class="stepper-content">
		{#each steps as step, index}
			<div class="step-item" class:completed={index < currentStep} class:current={index === currentStep}>
				<div class="step-circle" class:completed={index < currentStep} class:current={index === currentStep}>
					{#if index < currentStep}
						<span class="checkmark">✓</span>
					{:else if index === currentStep}
						<span class="step-number">{step.number}</span>
					{:else}
						<span class="step-number">{step.number}</span>
					{/if}
				</div>
				<span class="step-label">{step.label}</span>
				{#if index < steps.length - 1}
					<div class="step-connector" class:completed={index < currentStep}></div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.stepper {
		padding: 1.25rem 0;
		background: white;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-bottom: 1px solid var(--border);
	}
	
	.stepper-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-width: min-content;
		padding: 0 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}
	
	.step-item {
		display: flex;
		align-items: center;
		position: relative;
		flex: 0 0 auto;
		gap: 0.5rem;
	}
	
	.step-circle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: white;
		border: 2px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 0.2s ease;
	}
	
	.step-circle.completed {
		background: var(--primary);
		border-color: var(--primary);
	}
	
	.step-circle.current {
		background: white;
		border-color: var(--primary);
		border-width: 2px;
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.step-number {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted);
		transition: color 0.2s ease;
	}
	
	.step-circle.completed .step-number {
		color: white;
	}
	
	.step-circle.current .step-number {
		color: var(--primary);
	}
	
	.step-label {
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--muted);
		white-space: nowrap;
		transition: color 0.2s ease;
	}
	
	.step-item.completed .step-label,
	.step-item.current .step-label {
		color: var(--text);
		font-weight: 500;
	}
	
	.step-connector {
		width: 60px;
		height: 2px;
		background: var(--border);
		margin: 0 0.5rem;
		flex-shrink: 0;
		transition: background 0.2s ease;
	}
	
	.step-connector.completed {
		background: var(--primary);
	}
	
	.checkmark {
		font-size: 0.875rem;
		font-weight: bold;
		color: white;
		line-height: 1;
	}
	
	@media (max-width: 768px) {
		.stepper-content {
			justify-content: flex-start;
			padding: 0 1rem;
		}
		
		.step-item {
			min-width: auto;
		}
		
		.step-label {
			font-size: 0.75rem;
		}
		
		.step-connector {
			width: 40px;
		}
	}
</style>
