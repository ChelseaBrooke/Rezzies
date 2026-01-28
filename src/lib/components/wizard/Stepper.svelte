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
			<div class="step-wrapper">
				<div class="step-info">
					<span class="step-number" class:completed={index < currentStep} class:current={index === currentStep}>
						{String(step.number).padStart(2, '0')}
					</span>
					<span class="step-label" class:completed={index < currentStep} class:current={index === currentStep}>
						{step.label}
					</span>
				</div>
				<div class="step-marker-wrapper">
					<div class="step-line" class:completed={index < currentStep}></div>
					<div
						class="step-marker"
						class:completed={index < currentStep}
						class:current={index === currentStep}
						class:upcoming={index > currentStep}
					>
						{#if index < currentStep}
							<span class="checkmark">✓</span>
						{/if}
					</div>
					{#if index < steps.length - 1}
						<div class="step-line-after" class:completed={index < currentStep}></div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.stepper {
		padding: 1rem 0;
		background: white;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-bottom: 1px solid var(--border);
	}
	
	.stepper-content {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 0;
		min-width: min-content;
		padding: 0 2rem;
	}
	
	.step-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		flex: 0 0 auto;
		min-width: 140px;
	}
	
	.step-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 0.5rem;
		gap: 0.25rem;
	}
	
	.step-number {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted);
		transition: color 0.2s ease;
	}
	
	.step-number.completed,
	.step-number.current {
		color: var(--primary);
	}
	
	.step-label {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--muted);
		text-align: center;
		transition: color 0.2s ease;
	}
	
	.step-label.completed,
	.step-label.current {
		color: var(--text);
		font-weight: 500;
	}
	
	.step-time {
		font-size: 0.75rem;
		color: var(--muted);
		margin-top: 0.125rem;
	}
	
	.step-marker-wrapper {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2px;
	}
	
	.step-line {
		position: absolute;
		left: 0;
		right: 50%;
		height: 2px;
		background: var(--border);
		z-index: 0;
	}
	
	.step-line.completed {
		background: var(--primary);
	}
	
	.step-line-after {
		position: absolute;
		left: 50%;
		right: 0;
		height: 2px;
		background: var(--border);
		z-index: 0;
	}
	
	.step-line-after.completed {
		background: var(--primary);
	}
	
	.step-marker {
		position: relative;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: white;
		border: 2px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
		transition: all 0.2s ease;
	}
	
	.step-marker.completed {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}
	
	.step-marker.current {
		background: white;
		border-color: var(--primary);
		border-width: 2px;
	}
	
	.step-marker.upcoming {
		background: white;
		border-color: var(--border);
	}
	
	.checkmark {
		font-size: 0.75rem;
		font-weight: bold;
		color: white;
	}
	
	@media (max-width: 768px) {
		.stepper-content {
			justify-content: flex-start;
			padding: 0 1rem;
		}
		
		.step-wrapper {
			min-width: 120px;
		}
		
		.step-label {
			font-size: 0.75rem;
		}
		
		.step-time {
			display: none;
		}
	}
</style>
