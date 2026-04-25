<script lang="ts">
	type TourVariant = 'first-trip' | 'first-rsvp';

	interface Slide {
		title: string;
		description: string;
		eyebrow: string;
		emoji: string;
	}

	interface Props {
		variant: TourVariant;
	}

	let { variant }: Props = $props();
	let current = $state(0);
	let open = $state(true);
	let saving = $state(false);

	const slidesByVariant: Record<TourVariant, Slide[]> = {
		'first-trip': [
			{
				eyebrow: 'Welcome to Divvi',
				title: 'You just launched your first trip',
				description: 'Divvi helps you run the whole weekend in one place so guests always know what is happening.',
				emoji: '🎉'
			},
			{
				eyebrow: 'Cost Sharing',
				title: 'Set pricing your way',
				description: 'Split by person, room, or bed. Guests see costs before they RSVP, which keeps expectations clear.',
				emoji: '💸'
			},
			{
				eyebrow: 'Planning Add-ons',
				title: 'Meals and activities stay organized',
				description: 'Guests can sign up, coordinate details, and keep plans synced without messy group texts.',
				emoji: '🧭'
			},
			{
				eyebrow: 'Guest Experience',
				title: 'Rooms and logistics are easy to follow',
				description: 'Show sleeping arrangements, trip info, and what to bring so everyone arrives prepared.',
				emoji: '🛏️'
			},
			{
				eyebrow: 'Ready to host',
				title: 'You are set',
				description: 'Invite guests, watch RSVPs roll in, and publish when you are ready.',
				emoji: '✅'
			}
		],
		'first-rsvp': [
			{
				eyebrow: 'Welcome to Divvi',
				title: 'Your RSVP is in',
				description: 'You now have everything you need in one trip space: plans, updates, and your costs.',
				emoji: '🙌'
			},
			{
				eyebrow: 'Cost Sharing',
				title: 'See your share clearly',
				description: 'Divvi shows your expected range up front, so payments are transparent and predictable.',
				emoji: '💳'
			},
			{
				eyebrow: 'Meals and plans',
				title: 'Coordinate with the group',
				description: 'Sign up for meals, vote on options, and keep trip details tidy in one place.',
				emoji: '🍽️'
			},
			{
				eyebrow: 'Your stay',
				title: 'Know where and when',
				description: 'Check room setup, dates, and trip logistics without digging through old messages.',
				emoji: '📍'
			},
			{
				eyebrow: 'All set',
				title: 'Enjoy your trip',
				description: 'You are ready. Keep an eye on updates and jump into trip chat when things change.',
				emoji: '🌴'
			}
		]
	};

	const slides = $derived(slidesByVariant[variant]);
	const isLast = $derived(current === slides.length - 1);

	async function finishTour() {
		if (saving) return;
		saving = true;
		const key = variant === 'first-trip' ? 'feature-tour:first-trip' : 'feature-tour:first-rsvp';
		try {
			await fetch('/api/user/tooltips', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dismiss: key })
			});
		} finally {
			open = false;
			saving = false;
		}
	}
</script>

{#if open}
	<div class="ft-backdrop" role="dialog" aria-modal="true" aria-labelledby="feature-tour-title">
		<div class="ft-modal">
			<div class="ft-visual" aria-hidden="true">
				<div class="ft-emoji">{slides[current]?.emoji}</div>
				<div class="ft-orb ft-orb--a"></div>
				<div class="ft-orb ft-orb--b"></div>
			</div>
			<div class="ft-content">
				<p class="ft-eyebrow">{slides[current]?.eyebrow}</p>
				<h2 id="feature-tour-title" class="ft-title">{slides[current]?.title}</h2>
				<p class="ft-body">{slides[current]?.description}</p>

				<div class="ft-progress" aria-label="Tour progress">
					{#each slides as _, idx}
						<span class="ft-dot" class:ft-dot--active={idx === current}></span>
					{/each}
				</div>

				<div class="ft-actions">
					<button
						type="button"
						class="ft-btn ft-btn--ghost"
						onclick={() => (current = Math.max(0, current - 1))}
						disabled={current === 0 || saving}
					>
						Back
					</button>
					{#if isLast}
						<button type="button" class="ft-btn ft-btn--primary" onclick={finishTour} disabled={saving}>
							{saving ? 'Saving...' : 'Get started'}
						</button>
					{:else}
						<button
							type="button"
							class="ft-btn ft-btn--primary"
							onclick={() => (current = Math.min(slides.length - 1, current + 1))}
							disabled={saving}
						>
							Next
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.ft-backdrop {
		position: fixed;
		inset: 0;
		z-index: 12000;
		background: rgba(7, 15, 15, 0.72);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		padding: 1rem;
	}

	.ft-modal {
		width: min(800px, 100%);
		background: #fff;
		border-radius: 1rem;
		border: 1px solid var(--border, #d8e2e2);
		box-shadow: 0 20px 40px -26px rgba(7, 15, 15, 0.6);
		overflow: hidden;
		display: grid;
		grid-template-columns: minmax(220px, 34%) minmax(0, 1fr);
	}

	.ft-visual {
		position: relative;
		background: linear-gradient(160deg, var(--primary, #2f7778), #1d4d4e 70%);
		display: grid;
		place-items: center;
		padding: 1.5rem;
		min-height: 270px;
		overflow: hidden;
	}

	.ft-emoji {
		position: relative;
		z-index: 2;
		width: 88px;
		height: 88px;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.14);
		border: 1px solid rgba(255, 255, 255, 0.22);
		display: grid;
		place-items: center;
		font-size: 2.4rem;
	}

	.ft-orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(2px);
		opacity: 0.45;
	}

	.ft-orb--a {
		width: 160px;
		height: 160px;
		top: -38px;
		right: -44px;
		background: rgba(247, 170, 41, 0.55);
	}

	.ft-orb--b {
		width: 120px;
		height: 120px;
		bottom: -30px;
		left: -30px;
		background: rgba(122, 206, 211, 0.38);
	}

	.ft-content {
		padding: 1.3rem 1.3rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.72rem;
	}

	.ft-eyebrow {
		margin: 0;
		font-size: 0.69rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.11em;
		color: var(--warm, #ce5612);
	}

	.ft-title {
		margin: 0;
		font-size: 1.55rem;
		line-height: 1.18;
		letter-spacing: -0.02em;
		color: var(--navy, #1d4d4e);
	}

	.ft-body {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--muted, #5e6a6a);
	}

	.ft-progress {
		margin-top: 0.15rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.ft-dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: rgba(29, 77, 78, 0.2);
	}

	.ft-dot--active {
		width: 20px;
		background: var(--primary, #2f7778);
	}

	.ft-actions {
		margin-top: auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
	}

	.ft-btn {
		border: none;
		border-radius: 0.62rem;
		padding: 0.6rem 0.95rem;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
	}

	.ft-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ft-btn--ghost {
		color: var(--muted, #5e6a6a);
		background: rgba(15, 23, 42, 0.05);
	}

	.ft-btn--primary {
		color: #fff;
		background: linear-gradient(120deg, var(--warm, #ce5612), #b8480d);
	}

	@media (max-width: 740px) {
		.ft-modal {
			grid-template-columns: 1fr;
		}

		.ft-visual {
			min-height: 150px;
		}
	}
</style>
