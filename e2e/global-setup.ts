import { test as setup } from '@playwright/test';
import { seedTestData } from './fixtures/seed.js';
import { HOST_USER, GUEST_USER } from './fixtures/test-data.js';

setup('seed database and create auth states', async ({ browser }) => {
	// 1. Seed the database with test data
	await seedTestData();

	// 2. Login as host and save auth state
	const hostContext = await browser.newContext();
	const hostPage = await hostContext.newPage();
	await hostPage.goto('/login');
	await hostPage.fill('input[name="email"]', HOST_USER.email);
	await hostPage.fill('input[name="password"]', HOST_USER.password);
	await hostPage.click('button[type="submit"]');
	await hostPage.waitForURL('**/trips');
	await hostContext.storageState({ path: 'e2e/.auth/host.json' });
	await hostContext.close();

	// 3. Login as guest and save auth state
	const guestContext = await browser.newContext();
	const guestPage = await guestContext.newPage();
	await guestPage.goto('/login');
	await guestPage.fill('input[name="email"]', GUEST_USER.email);
	await guestPage.fill('input[name="password"]', GUEST_USER.password);
	await guestPage.click('button[type="submit"]');
	await guestPage.waitForURL('**/trips');
	await guestContext.storageState({ path: 'e2e/.auth/guest.json' });
	await guestContext.close();
});
