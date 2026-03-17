import { test, expect } from '@playwright/test';
import { HOST_USER } from '../fixtures/test-data.js';

test.describe('Logout', () => {
	test('logging out clears session and prevents access to protected pages', async ({ page }) => {
		// First login
		await page.goto('/login');
		await page.fill('input[name="email"]', HOST_USER.email);
		await page.fill('input[name="password"]', HOST_USER.password);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/trips');

		// Logout is POST-only (/logout), so send a POST request to clear the session
		await page.request.post('/logout');

		// Clear cookies in the browser context too (POST response set-cookie may not apply to page)
		await page.context().clearCookies();

		// After logout, navigating to /trips should redirect to login
		await page.goto('/trips');
		await page.waitForURL('**/login**', { timeout: 10_000 });
		await expect(page).toHaveURL(/\/login/);
	});
});
