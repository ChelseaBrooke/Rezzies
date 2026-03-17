import { test, expect } from '@playwright/test';
import { TEST_TRIP } from '../fixtures/test-data.js';

test.describe('Find a Trip (anonymous)', () => {
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

	test('can navigate to find vacation page', async ({ page }) => {
		await page.goto('/find-vacation');
		await expect(page).toHaveURL(/\/find-vacation/);
		// Should have invite code input with name="code"
		await expect(page.locator('input[name="code"]')).toBeVisible();
	});

	test('entering valid invite code navigates to trip page', async ({ page }) => {
		await page.goto('/find-vacation');
		// The form uses GET action="/trip" with input name="code"
		await page.fill('input[name="code"]', TEST_TRIP.inviteCode);
		await page.click('button[type="submit"]');

		// Should navigate to the public trip page
		await page.waitForURL(`**/trip/${TEST_TRIP.inviteCode}`, { timeout: 10_000 });
		await expect(page).toHaveURL(new RegExp(`/trip/${TEST_TRIP.inviteCode}`));
	});

	test('invalid invite code shows error or redirects', async ({ page }) => {
		await page.goto('/find-vacation');
		await page.fill('input[name="code"]', 'ZZZZZZ');
		await page.click('button[type="submit"]');

		// Should either show an error or redirect to home (trip not found)
		await page.waitForTimeout(2000);
		const url = page.url();
		const hasError = await page.locator('.error, [class*="error"], [role="alert"]').count() > 0;
		expect(url.includes('/find-vacation') || url.endsWith('/') || hasError).toBeTruthy();
	});

	test('public trip page shows trip details', async ({ page }) => {
		await page.goto(`/trip/${TEST_TRIP.inviteCode}`);
		await expect(page.getByText(TEST_TRIP.name)).toBeVisible({ timeout: 10_000 });
	});

	test('public trip page shows rooms', async ({ page }) => {
		await page.goto(`/trip/${TEST_TRIP.inviteCode}`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText('Master Suite')).toBeVisible({ timeout: 10_000 });
	});
});
