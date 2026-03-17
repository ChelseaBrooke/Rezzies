import { test as base, type Page, type BrowserContext } from '@playwright/test';

/**
 * Extended test fixture that provides pre-authenticated pages for host and guest roles.
 * Useful for tests that need to interact as multiple users in the same test.
 */
type AuthFixtures = {
	hostPage: Page;
	guestPage: Page;
	hostContext: BrowserContext;
	guestContext: BrowserContext;
};

export const test = base.extend<AuthFixtures>({
	hostContext: async ({ browser }, use) => {
		const context = await browser.newContext({
			storageState: 'e2e/.auth/host.json',
		});
		await use(context);
		await context.close();
	},

	guestContext: async ({ browser }, use) => {
		const context = await browser.newContext({
			storageState: 'e2e/.auth/guest.json',
		});
		await use(context);
		await context.close();
	},

	hostPage: async ({ hostContext }, use) => {
		const page = await hostContext.newPage();
		await use(page);
	},

	guestPage: async ({ guestContext }, use) => {
		const page = await guestContext.newPage();
		await use(page);
	},
});

export { expect } from '@playwright/test';
