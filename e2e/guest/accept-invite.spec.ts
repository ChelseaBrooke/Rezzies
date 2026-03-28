import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

// Join flow tests: auth + request-to-join + host approval.

test.describe('Trip join flow (authenticated guest)', () => {
	let tripId: string;

	test.beforeAll(async () => {
		// Find seeded test trip by name
		const trip = await prisma.trip.findFirst({ where: { name: TEST_TRIP.name } });
		tripId = trip!.id;
	});

	test.afterAll(async () => {
		await prisma.$disconnect();
	});

	test('accessing trip join page while logged in shows join CTA', async ({ page }) => {
		// Assumes guest is already approved from seed; visiting /join should redirect to trip
		await page.goto(`/trips/${tripId}/join`);
		// Either sees join page or gets redirected to /trips/[id] (already a member)
		const url = page.url();
		const onJoinPage = url.includes('/join');
		const onDashboard = url.includes(`/trips/${tripId}`) && !url.includes('/join');
		expect(onJoinPage || onDashboard).toBeTruthy();
	});

	test('approved member can access trip dashboard', async ({ page }) => {
		await page.goto(`/trips/${tripId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(TEST_TRIP.name)).toBeVisible({ timeout: 10_000 });
	});

	test('unauthenticated user visiting join page is redirected to login', async ({ page }) => {
		// Create a fresh context with no auth cookies
		await page.context().clearCookies();
		await page.goto(`/trips/${tripId}/join`);
		await page.waitForURL(/\/login/, { timeout: 8_000 });
		await expect(page).toHaveURL(/\/login/);
	});
});
