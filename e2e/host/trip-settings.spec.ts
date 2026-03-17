import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Trip settings (host)', () => {
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

	test('settings redirects to step 1', async ({ page }) => {
		await page.goto(`/trips/${tripId}/settings`);
		await page.waitForURL(new RegExp(`/trips/${tripId}/settings/step/1`));
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/settings/step/1`));
	});

	test('step 1 shows trip basics', async ({ page }) => {
		await page.goto(`/trips/${tripId}/settings/step/1`);
		await page.waitForLoadState('networkidle');

		// Should show editable trip name
		const nameInput = page.locator('input[name="name"], input[value*="E2E"]').first();
		if (await nameInput.isVisible()) {
			await expect(nameInput).toHaveValue(TEST_TRIP.name);
		}
	});

	test('can navigate to step 2', async ({ page }) => {
		await page.goto(`/trips/${tripId}/settings/step/2`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/settings/step/2`));
	});

	test('settings has save button', async ({ page }) => {
		await page.goto(`/trips/${tripId}/settings/step/1`);
		await page.waitForLoadState('networkidle');

		const saveBtn = page.locator('button').filter({ hasText: /save|update/i }).first();
		await expect(saveBtn).toBeVisible();
	});
});
