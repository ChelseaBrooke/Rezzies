<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<header class="rezzies-header">
	<div class="header-left">
		<a href="/" class="logo-link">
			<span class="logo-text">rezzies</span>
			<span class="flamingo-icon">🦩</span>
		</a>
		<span class="tagline">for the host that does the most</span>
	</div>
	
	<div class="header-right">
		<button class="header-btn" type="button">
			<span class="globe-icon">🌐</span>
			<span>US</span>
		</button>
		<a href="/our-services" class="header-btn">About Us</a>
		<a href="/trips" class="header-btn">My Trips</a>
		<button class="header-btn" type="button">
			<span class="bell-icon">🔔</span>
			<span>Notifications</span>
		</button>
		<button class="avatar-btn" type="button">
			<div class="avatar-circle"></div>
		</button>
	</div>
</header>

<style>
	.rezzies-header {
		position: relative;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(10px);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: white;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.logo-text {
		text-transform: lowercase;
		letter-spacing: -0.5px;
	}

	.flamingo-icon {
		font-size: 1.25rem;
	}

	.tagline {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.8);
		font-weight: 300;
		margin-left: 0.5rem;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: transparent;
		border: none;
		color: white;
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s;
		text-decoration: none;
		font-family: inherit;
	}

	.header-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.globe-icon,
	.bell-icon {
		font-size: 1rem;
	}

	.avatar-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.avatar-circle {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	@media (max-width: 768px) {
		.rezzies-header {
			padding: 1rem;
			flex-wrap: wrap;
		}

		.header-left {
			flex-wrap: wrap;
		}

		.tagline {
			font-size: 0.75rem;
			margin-left: 0;
		}

		.header-right {
			gap: 0.5rem;
		}

		.header-btn span:not(.globe-icon):not(.bell-icon) {
			display: none;
		}
	}
</style>
