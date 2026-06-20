<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import DivviLogo from '$lib/components/DivviLogo.svelte';
	import { TRAVEL_STYLE_OPTIONS } from '$lib/travel-style.js';
	import type { ActionData } from './$types';

	let { form } = $props();

	const redirectParam = $derived($page.url.searchParams.get('redirect') ?? '');
	const loginHref = $derived(redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login');
</script>

<div class="auth-page">
	<div class="auth-bg">
		<img src="/images/homepage-bg.jpg" alt="" class="auth-bg-img" />
		<div class="auth-bg-overlay"></div>
	</div>

	<header class="auth-header">
		<div class="auth-header-left">
			<DivviLogo href="/" class="auth-logo" />
		</div>
		<div class="auth-header-right">
			<a href={loginHref} class="auth-header-btn">Log in</a>
		</div>
	</header>

	<main class="auth-main">
		<div class="auth-card">
			<h1 class="auth-title">Sign up</h1>
			<p class="auth-subtitle">Create your account to start hosting group trips.</p>

			{#if form?.error}
				<div class="auth-error">{form.error}</div>
			{/if}

			<form method="POST" use:enhance class="auth-form">
				<div class="auth-field">
					<label for="email">Email</label>
					<input type="email" id="email" name="email" required placeholder="you@example.com" />
				</div>
				<div class="auth-field">
					<label for="password">Password</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						placeholder="Create a password"
						minlength="8"
					/>
					<small class="auth-hint">Must be at least 8 characters</small>
				</div>
				<div class="auth-field">
					<label for="confirmPassword">Confirm password</label>
					<input
						type="password"
						id="confirmPassword"
						name="confirmPassword"
						required
						placeholder="Confirm your password"
					/>
				</div>
				<div class="auth-field">
					<label for="travelStyle">Travel style</label>
					<select id="travelStyle" name="travelStyle" class="auth-select">
						<option value="">Pick one (optional)</option>
						{#each TRAVEL_STYLE_OPTIONS as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				</div>
				<button type="submit" class="auth-submit">Sign up</button>
			</form>

			<p class="auth-footer">
				Already have an account? <a href={loginHref}>Log in</a>
			</p>
		</div>
	</main>
</div>

<style>
	.auth-page {
		position: relative;
		min-height: 100vh;
		width: 100%;
		overflow: hidden;
		color: white;
	}

	.auth-bg {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
		overflow: hidden;
	}
	.auth-bg-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}
	.auth-bg::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #1d4d4e 0%, #2F7778 50%, #1d4d4e 100%);
		z-index: -1;
	}
	.auth-bg-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(10, 18, 22, 0.88) 0%,
			rgba(10, 18, 22, 0.38) 32%,
			rgba(10, 18, 22, 0.05) 58%,
			transparent 100%
		);
		z-index: 1;
	}

	.auth-header {
		position: relative;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		background: rgba(10, 18, 22, 0.22);
		backdrop-filter: blur(10px);
	}
	.auth-header-left,
	.auth-header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.auth-logo {
		color: white;
	}
	.auth-header-btn {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		text-decoration: none;
		color: white;
		background: transparent;
		transition: background 0.2s;
	}
	.auth-header-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.auth-header-btn-primary {
		background: var(--warm);
	}
	.auth-header-btn-primary:hover {
		background: var(--chocolate);
	}

	.auth-main {
		position: relative;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 80px);
		padding: 2rem;
	}

	.auth-card {
		width: 100%;
		max-width: 420px;
		padding: 2.5rem 2rem;
		background: rgba(10, 18, 22, 0.18);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.auth-title {
		margin: 0 0 0.25rem 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.75rem;
		font-weight: 600;
		color: #fffbf7;
		text-align: center;
	}
	.auth-subtitle {
		margin: 0 0 1.5rem 0;
		font-size: 0.9375rem;
		color: rgba(255, 255, 255, 0.85);
		text-align: center;
	}

	.auth-error {
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
		background: rgba(239, 68, 68, 0.2);
		color: #fecaca;
		border-radius: 8px;
		font-size: 0.875rem;
		border-left: 3px solid var(--danger, #732c2c);
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.auth-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.auth-field label {
		font-size: 0.875rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.9);
	}
	.auth-field input {
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.12);
		color: white;
		transition: border-color 0.2s, background 0.2s;
	}
	.auth-field input::placeholder {
		color: rgba(255, 255, 255, 0.5);
	}
	.auth-field input:focus {
		outline: none;
		border-color: rgba(255, 255, 255, 0.5);
		background: rgba(255, 255, 255, 0.15);
	}
	.auth-select {
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.12);
		color: white;
		cursor: pointer;
	}
	.auth-select:focus {
		outline: none;
		border-color: rgba(255, 255, 255, 0.5);
	}
	.auth-select option {
		background: #1d4d4e;
		color: white;
	}
	.auth-hint {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.auth-submit {
		margin-top: 0.25rem;
		padding: 0.875rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: var(--warm);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
	}
	.auth-submit:hover {
		background: var(--chocolate);
	}

	.auth-footer {
		margin: 1.5rem 0 0 0;
		padding-top: 1.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		text-align: center;
		font-size: 0.9375rem;
		color: rgba(255, 255, 255, 0.8);
	}
	.auth-footer a {
		color: #fff;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.auth-footer a:hover {
		color: rgba(255, 255, 255, 0.95);
	}
</style>
