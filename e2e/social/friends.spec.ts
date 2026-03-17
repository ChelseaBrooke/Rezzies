import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Friends', () => {
	test('host can access settings page (friends managed via profile)', async ({ hostPage }) => {
		await hostPage.goto('/settings');
		await hostPage.waitForLoadState('networkidle');
		await expect(hostPage).toHaveURL(/\/settings/);
	});

	test('guest can access settings page', async ({ guestPage }) => {
		await guestPage.goto('/settings');
		await guestPage.waitForLoadState('networkidle');
		await expect(guestPage).toHaveURL(/\/settings/);
	});
});
