import { test, expect } from '@playwright/test';
import { TEST_TRIP } from '../fixtures/test-data.js';

test.describe('Public trip reservation (anonymous)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/trip/${TEST_TRIP.inviteCode}`);
		await page.waitForLoadState('networkidle');
	});

	test('can see room cards on public trip page', async ({ page }) => {
		// Room cards use class="room-card"
		const roomCards = page.locator('.room-card');
		await expect(roomCards.first()).toBeVisible({ timeout: 10_000 });
		const count = await roomCards.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('reservation form has required guest fields', async ({ page }) => {
		// The reserve form has name="name" and name="email" inputs
		await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('input[name="email"]')).toBeVisible();
	});

	test('reservation form has date fields', async ({ page }) => {
		await expect(page.locator('input[name="checkInDate"]')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('input[name="checkOutDate"]')).toBeVisible();
	});

	test('selecting a room updates selection state', async ({ page }) => {
		const firstRoom = page.locator('.room-card').first();
		await firstRoom.click();
		// After clicking, the room should gain a selected state
		await expect(firstRoom).toHaveClass(/selected/, { timeout: 5_000 });
	});

	test('can fill reservation form', async ({ page }) => {
		// Select a room
		await page.locator('.room-card').first().click();
		await page.waitForTimeout(300);

		// Select a bed if visible (non per_room pricing)
		const bedOption = page.locator('.bed-option').first();
		if (await bedOption.isVisible().catch(() => false)) {
			await bedOption.click();
			await page.waitForTimeout(300);
		}

		// Fill guest info
		await page.fill('input[name="name"]', 'E2E Test Reservation');
		await page.fill('input[name="email"]', 'e2e-reserve@test.divvi.com');

		// Fill dates using trip dates
		const checkInInput = page.locator('input[name="checkInDate"]');
		const checkOutInput = page.locator('input[name="checkOutDate"]');
		if (await checkInInput.isVisible()) {
			const minDate = await checkInInput.getAttribute('min');
			const maxDate = await checkOutInput.getAttribute('max');
			if (minDate) await checkInInput.fill(minDate);
			if (maxDate) await checkOutInput.fill(maxDate);
		}

		// Reserve button should be present
		const reserveBtn = page.locator('button[type="submit"]').filter({ hasText: /reserve/i });
		await expect(reserveBtn).toBeVisible();
	});
});
