<div class="rezzies-background">
	<div class="background-image">
		<img src="/images/homepage-bg.jpg" alt="Background" class="bg-img" />
		<div class="background-overlay"></div>
	</div>
</div>

<style>
	.rezzies-background {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
		overflow: hidden;
	}

	.background-image {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
	}

	.bg-img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		z-index: 0;
	}

	.background-image::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #1d4d4e 0%, #2F7778 50%, #1d4d4e 100%);
		z-index: -1;
	}

	.background-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(10, 18, 22, 0.45);
		z-index: 1;
	}
</style>
