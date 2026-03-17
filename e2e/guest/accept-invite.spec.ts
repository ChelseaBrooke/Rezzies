import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Accept invite (guest)', () => {
	let tripId: string;

	test.beforeAll(async () => {
		const trip = await prisma.trip.findUnique({
			where: { inviteCode: TEST_TRIP.inviteCode },
		});
		tripId = trip!.id;
	});

	test.afterAll(async () => {
		await prisma.$disconnect();
	});

	test('logged-in member accessing public trip page redirects to dashboard', async ({ page }) => {
		// Guest is already a member, so visiting /trip/[inviteCode] should redirect to dashboard
		await page.goto(`/trip/${TEST_TRIP.inviteCode}`);
		await page.waitForURL(new RegExp(`/trips/${tripId}`), { timeout: 10_000 });
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}`));
	});

	test('can access trip dashboard as member', async ({ page }) => {
		await page.goto(`/trips/${tripId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(TEST_TRIP.name)).toBeVisible({ timeout: 10_000 });
	});
});
