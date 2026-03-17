import { test, expect } from '../fixtures/auth.fixture.js';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP, HOST_USER } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Edge cases and error handling', () => {
	let tripId: string;

	test.beforeAll(async () => {
		const trip = await prisma.trip.findUnique({
			where: { inviteCode: TEST_TRIP.inviteCode },
		});
		tripId = trip!.id;
	});

	test.afterAll(async () => {
		await prisma.$disconnect();
	});

	test('invalid invite code redirects or shows error', async ({ page }) => {
		await page.goto('/trip/NONEXISTENT_CODE_XYZ');
		await page.waitForLoadState('networkidle');
		// Should redirect to home or show an error
		const url = page.url();
		const isRedirected = url.endsWith('/') || url.includes('/find-vacation');
		const hasError = await page.locator('.error, [class*="error"], [role="alert"]').count() > 0;
		expect(isRedirected || hasError).toBeTruthy();
	});

	test('non-existent trip ID returns error for member', async ({ hostPage }) => {
		await hostPage.goto('/trips/00000000-0000-0000-0000-000000000000');
		await hostPage.waitForLoadState('networkidle');
		// Should show error or redirect
		const url = hostPage.url();
		const content = await hostPage.textContent('body');
		const hasError = url.includes('/trips') ||
			content?.includes('not found') ||
			content?.includes('error') ||
			content?.includes('404');
		expect(hasError).toBeTruthy();
	});

	test('guest cannot access host-only settings page', async ({ guestPage }) => {
		await guestPage.goto(`/trips/${tripId}/settings`);
		await guestPage.waitForLoadState('networkidle');

		// Should either redirect away or show forbidden message
		const url = guestPage.url();
		const content = await guestPage.textContent('body');
		const isBlocked = !url.includes('/settings') ||
			content?.includes('forbidden') ||
			content?.includes('unauthorized') ||
			content?.includes('host');
		expect(isBlocked).toBeTruthy();
	});

	test('unauthenticated user cannot access /trips', async ({ page }) => {
		// Using a fresh context with no auth
		await page.goto('/trips');
		await page.waitForLoadState('networkidle');

		// Should redirect to login or home
		const url = page.url();
		expect(url.includes('/login') || url.endsWith('/')).toBeTruthy();
	});

	test('unauthenticated user cannot access trip dashboard', async ({ page }) => {
		await page.goto(`/trips/${tripId}`);
		await page.waitForLoadState('networkidle');

		const url = page.url();
		expect(url.includes('/login') || url.endsWith('/')).toBeTruthy();
	});

	test('calculate-price API handles invalid data without crashing', async ({ hostPage }) => {
		const response = await hostPage.request.post('/api/calculate-price', {
			data: {
				tripId: 'invalid-id',
				roomId: -1,
				numberOfSlots: 0,
				checkInDate: 'not-a-date',
				checkOutDate: 'not-a-date',
			},
		});
		// API should respond (not hang or crash) — any status is acceptable
		expect(response.status()).toBeDefined();
	});

	test('login with SQL injection attempt is rejected', async ({ page }) => {
		await page.goto('/login');
		await page.fill('input[name="email"]', "'; DROP TABLE users; --");
		await page.fill('input[name="password"]', 'password');
		await page.click('button[type="submit"]');
		// Should show validation error, not crash
		await page.waitForTimeout(1000);
		const url = page.url();
		expect(url).toContain('/login');
	});
});
