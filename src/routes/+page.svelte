<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="welcome-page">
	<div class="container">
		<header>
			<h1>Welcome!</h1>
			<p class="subtitle">Wedding Room Selection</p>
		</header>

		<div class="content">
			<p>
				We're so excited to celebrate with you! This quick form will help us coordinate
				room assignments for the wedding week.
			</p>
			<p>
				Simply choose your room and bed, select your dates, and we'll handle the rest.
				Pricing is based on bed type, room sharing, and length of stay to keep things fair for everyone.
			</p>
		</div>

		<div class="actions">
			<button class="btn-primary" onclick={() => goto('/select')}>
				Choose Your Room
			</button>
		</div>
	</div>
</div>

<style>
	.welcome-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
	}

	.container {
		max-width: 600px;
		width: 100%;
		background: white;
		border-radius: 16px;
		padding: 3rem;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
		font-weight: 600;
	}

	.subtitle {
		font-size: 1.2rem;
		color: #7f8c8d;
		margin: 0;
	}

	.content {
		margin: 2rem 0;
		line-height: 1.8;
		color: #555;
	}

	.content p {
		margin: 1rem 0;
	}

	.actions {
		text-align: center;
		margin-top: 2rem;
	}

	.btn-primary {
		background: #3498db;
		color: white;
		border: none;
		padding: 1rem 2.5rem;
		font-size: 1.1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
		font-weight: 500;
	}

	.btn-primary:hover {
		background: #2980b9;
	}

	.btn-primary:active {
		transform: scale(0.98);
	}
</style>
