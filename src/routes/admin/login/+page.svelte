<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form } = $props();
</script>

<div class="login-page">
	<div class="container">
		<h1>Admin Login</h1>
		{#if form?.error}
			<div class="error-message">{form.error}</div>
		{/if}
		<form method="POST" use:enhance>
			<div class="form-group">
				<label for="email">Email</label>
				<input type="email" id="email" name="email" required />
			</div>
			<div class="form-group">
				<label for="password">Password</label>
				<input type="password" id="password" name="password" required />
			</div>
			<button type="submit" class="btn-primary">Login</button>
		</form>
	</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: #f5f7fa;
	}

	.container {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 400px;
	}

	h1 {
		margin: 0 0 1.5rem 0;
		text-align: center;
		color: #2c3e50;
	}

	.error-message {
		background: #fee;
		color: #c33;
		padding: 0.75rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.form-group {
		margin: 1rem 0;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #555;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	.btn-primary {
		width: 100%;
		background: #3498db;
		color: white;
		border: none;
		padding: 0.75rem;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		margin-top: 1rem;
	}

	.btn-primary:hover {
		background: #2980b9;
	}
</style>

