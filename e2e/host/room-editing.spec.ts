import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Room editing (host)', () => {
	let tripId: string;

	test.beforeAll(async () => {
		const trip = await prisma.trip.findFirst({
			where: { name: TEST_TRIP.name }
		});
		tripId = trip!.id;
	});

	test.afterAll(async () => {
		await prisma.$disconnect();
	});

	test('can view rooms page', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rooms`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/rooms`));
		// Should show seeded rooms
		await expect(page.getByText('Master Suite')).toBeVisible({ timeout: 10_000 });
	});

	test('Manage rooms opens trip settings step 1', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rooms`);
		await page.waitForLoadState('networkidle');
		await page.getByRole('link', { name: 'Manage rooms' }).click();
		await page.waitForURL(new RegExp(`/trips/${tripId}/settings/step/1`));
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/settings/step/1`));
	});

	test('trip settings step 1 shows rooms panel and seeded room', async ({ page }) => {
		await page.goto(`/trips/${tripId}/settings/step/1`);
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: /Rooms & Beds/i })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('Master Suite')).toBeVisible();
	});

	test('trip settings step 1 has Add Room', async ({ page }) => {
		await page.goto(`/trips/${tripId}/settings/step/1`);
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('button', { name: 'Add Room' })).toBeVisible({ timeout: 10_000 });
	});
});
