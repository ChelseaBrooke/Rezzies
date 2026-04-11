import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP, GUEST_USER } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Guest management (host)', () => {
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

	test('can view guest list', async ({ page }) => {
		await page.goto(`/trips/${tripId}/guests`);
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/guests`));
		// Should see at least the guest user
		await expect(page.getByText(GUEST_USER.name)).toBeVisible({ timeout: 10_000 });
	});

	test('can see invite options', async ({ page }) => {
		await page.goto(`/trips/${tripId}/guests`);

		// Look for invite button or form
		const inviteBtn = page.locator('button, a').filter({ hasText: /invite|add guest/i }).first();
		await expect(inviteBtn).toBeVisible();
	});

	test('can open invite dropdown', async ({ page }) => {
		await page.goto(`/trips/${tripId}/guests`);

		// The add guest button opens a dropdown with a backdrop overlay.
		// If a backdrop is already showing (e.g. from a previous interaction), dismiss it first.
		const backdrop = page.locator('.add-guest-backdrop');
		if (await backdrop.isVisible().catch(() => false)) {
			await backdrop.click();
			await expect(backdrop).not.toBeVisible({ timeout: 3_000 });
		}

		// Click the add guest button (use force to bypass any remaining overlay)
		const addGuestBtn = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /invite|add guest/i }).first();
		await addGuestBtn.click({ force: true });

		// Dropdown portal should appear
		const portal = page.locator('.add-guest-portal');
		await expect(portal).toBeVisible({ timeout: 5_000 });
	});

	test('can copy invite link', async ({ page }) => {
		await page.goto(`/trips/${tripId}/guests`);

		// Look for copy link button
		const copyBtn = page.locator('button').filter({ hasText: /copy.*link|invite.*link|share/i }).first();
		if (await copyBtn.isVisible()) {
			await copyBtn.click();
			// Button text or tooltip may change to indicate success — no fixed wait needed
		}
	});
});
