import { test, expect } from '../fixtures/auth.fixture.js';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Caption This game', () => {
	let tripId: string;

	test.beforeAll(async () => {
		const trip = await prisma.trip.findFirst({
		where: { name: TEST_TRIP.name },
	});
		tripId = trip!.id;
	});

	test.afterAll(async () => {
		await prisma.$disconnect();
	});

	test('can access games hub', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/games`);
		await hostPage.waitForLoadState('networkidle');
		await expect(hostPage).toHaveURL(new RegExp(`/trips/${tripId}/games`));
	});

	test('can navigate to Caption This game', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/games/caption-this`);
		await hostPage.waitForLoadState('networkidle');
		await expect(hostPage).toHaveURL(new RegExp(`/trips/${tripId}/games/caption-this`));
	});

	test('Caption This page shows game UI', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/games/caption-this`);
		await hostPage.waitForLoadState('networkidle');

		// Should show some game-related content
		const content = await hostPage.textContent('body');
		const hasGameContent = content?.toLowerCase().includes('caption') ||
			content?.toLowerCase().includes('photo') ||
			content?.toLowerCase().includes('round');
		expect(hasGameContent).toBeTruthy();
	});
});
