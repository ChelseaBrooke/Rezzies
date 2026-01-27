<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		progress: number;
		status: string;
	}

	let { progress = 0, status = 'Starting...' }: Props = $props();

	const animals = ['🐱', '🐶', '🐰', '🐼', '🐨', '🦊', '🐸', '🐯'];
	let currentAnimal = $state(animals[0]);
	let animalIndex = $state(0);
	let showCancel = $state(false);

	$effect(() => {
		const interval = setInterval(() => {
			animalIndex = (animalIndex + 1) % animals.length;
			currentAnimal = animals[animalIndex];
		}, 500);
		return () => clearInterval(interval);
	});

	// Show cancel button if stuck for more than 30 seconds
	$effect(() => {
		if (progress > 0 && progress < 90) {
			const timer = setTimeout(() => {
				showCancel = true;
			}, 30000); // 30 seconds
			return () => clearTimeout(timer);
		}
	});

	function handleCancel() {
		sessionStorage.removeItem('autofillUrl');
		goto('/trips/new');
	}
</script>

<div class="loader-container">
	<div class="loader-content">
		<div class="animal">{currentAnimal}</div>
		<h2>Extracting Property Information</h2>
		<p class="status-text">{status}</p>
		
		<div class="progress-container">
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progress}%"></div>
			</div>
			<p class="progress-text">{Math.round(progress)}%</p>
		</div>
		
		{#if showCancel}
			<div class="cancel-section">
				<p class="cancel-message">This is taking longer than expected...</p>
				<button class="btn btn-secondary" onclick={handleCancel}>
					Cancel & Go Back
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.loader-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		padding: var(--spacing-2xl);
	}

	.loader-content {
		text-align: center;
		max-width: 500px;
		width: 100%;
	}

	.animal {
		font-size: 4rem;
		margin-bottom: var(--spacing-lg);
		animation: bounce 1s ease-in-out infinite;
	}

	@keyframes bounce {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-20px);
		}
	}

	.loader-content h2 {
		margin-bottom: var(--spacing-md);
		color: var(--color-text);
	}

	.status-text {
		color: var(--color-text-light);
		margin-bottom: var(--spacing-xl);
		font-size: 1.1rem;
		min-height: 1.5em;
	}

	.progress-container {
		margin-top: var(--spacing-lg);
	}

	.progress-bar {
		width: 100%;
		height: 24px;
		background: var(--color-bg-light);
		border-radius: var(--radius-full);
		overflow: hidden;
		margin-bottom: var(--spacing-sm);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--color-primary), #60a5fa);
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
		box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
	}

	.progress-text {
		color: var(--color-text-light);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.cancel-section {
		margin-top: var(--spacing-xl);
		padding-top: var(--spacing-lg);
		border-top: 1px solid rgba(255, 255, 255, 0.2);
	}

	.cancel-message {
		color: rgba(255, 255, 255, 0.8);
		margin-bottom: var(--spacing-md);
		font-size: 0.95rem;
	}
</style>
