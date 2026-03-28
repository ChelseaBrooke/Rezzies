import { test, expect } from '@playwright/test';

// Anonymous / unauthenticated user flows.
// Invite codes have been removed — trips are accessed by direct link only.

test.describe('Find a Trip (unauthenticated)', () => {
	test('home page has Find a Trip link', async ({ page }) => {
		await page.goto('/');
		const findTripLink = page.locator('a[href="/find-vacation"]').first();
		await expect(findTripLink).toBeVisible();
	});

	test('home page has Host a Trip link', async ({ page }) => {
		await page.goto('/');
		const hostLink = page.locator('a[href="/trips/new"]').first();
		await expect(hostLink).toBeVisible();
	});

	test('find-vacation page explains link-based access (no code input)', async ({ page }) => {
		await page.goto('/find-vacation');
		await expect(page).toHaveURL(/\/find-vacation/);
		// There should be no invite code input field
		const codeInput = page.locator('input[name="code"]');
		await expect(codeInput).toHaveCount(0);
		// Should explain that trips are accessed by link
		await expect(page.getByText(/direct link/i)).toBeVisible({ timeout: 5_000 });
	});

	test('old invite code URL returns gone / redirect', async ({ page }) => {
		// /trip/[code] now returns 410 Gone or redirect
		const response = await page.goto('/trip/ZZZZZZ');
		const statusOk =
			response?.status() === 410 ||
			response?.status() === 404 ||
			response?.url().endsWith('/');
		expect(statusOk).toBeTruthy();
	});

	test('unauthenticated visit to a trip redirects to login', async ({ page }) => {
		// Visiting a trip URL without a session should redirect to login
		await page.goto('/trips/nonexistent-trip-id');
		await page.waitForURL(/\/login/, { timeout: 8_000 });
		await expect(page).toHaveURL(/\/login/);
	});
});
