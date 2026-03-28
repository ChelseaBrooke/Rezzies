import { test, expect } from '@playwright/test';

// Anonymous reservation flow has been removed.
// Trips now require auth + host approval to access.
// These tests are replaced by the authenticated join flow specs.

test.describe('Anonymous reservation (deprecated)', () => {
	test('anonymous visit to any trip URL redirects to login', async ({ page }) => {
		await page.goto('/trips/some-trip-id');
		await page.waitForURL(/\/login/, { timeout: 8_000 });
		await expect(page).toHaveURL(/\/login/);
	});

	test('old /trip/[code] URLs return gone status', async ({ page }) => {
		const response = await page.goto('/trip/TESTCD');
		expect([404, 410].includes(response?.status() ?? 0)).toBeTruthy();
	});
});
