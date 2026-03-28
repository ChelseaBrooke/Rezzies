import { test, expect } from '../fixtures/auth.fixture.js';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Activities', () => {
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

	test('can access activities page', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/activities`);
		await hostPage.waitForLoadState('networkidle');
		await expect(hostPage).toHaveURL(new RegExp(`/trips/${tripId}/activities`));
	});

	test('activities page loads without error', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/activities`);
		await hostPage.waitForLoadState('networkidle');

		// Page should not show a server error
		const content = await hostPage.textContent('body');
		expect(content?.includes('500') && content?.includes('Internal')).toBeFalsy();
	});

	test('guest can access activities page', async ({ guestPage }) => {
		await guestPage.goto(`/trips/${tripId}/activities`);
		await guestPage.waitForLoadState('networkidle');
		await expect(guestPage).toHaveURL(new RegExp(`/trips/${tripId}/activities`));
	});
});
