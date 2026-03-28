import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Room editing (host)', () => {
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

	test('can view rooms page', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rooms`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/rooms`));
		// Should show seeded rooms
		await expect(page.getByText('Master Suite')).toBeVisible({ timeout: 10_000 });
	});

	test('can navigate to room edit page', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rooms/edit`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/rooms/edit`));
	});

	test('room edit page shows existing rooms', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rooms/edit`);
		await page.waitForLoadState('networkidle');

		// Room names appear in textbox inputs (placeholder="Room name")
		const roomInputs = page.locator('input[placeholder="Room name"], textbox');
		const firstInput = page.getByRole('textbox', { name: 'Room name' }).first();
		await expect(firstInput).toBeVisible({ timeout: 10_000 });
		// Verify it contains one of our seeded room names
		const value = await firstInput.inputValue();
		expect(['Master Suite', 'Guest Room', 'Bunk Room']).toContain(value);
	});

	test('can see add room option', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rooms/edit`);
		await page.waitForLoadState('networkidle');

		const addRoomBtn = page.locator('button, a').filter({ hasText: /add.*room|new.*room/i }).first();
		await expect(addRoomBtn).toBeVisible();
	});
});
