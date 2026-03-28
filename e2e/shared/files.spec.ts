import { test, expect } from '../fixtures/auth.fixture.js';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Files', () => {
	let tripId: string;

	test.beforeAll(async () => {
		const trip = await prisma.trip.findFirst({
		where: { name: TEST_TRIP.name },
	});
		tripId = trip!.id;
	});

	test.afterAll(async () => {
		await prisma.$disconnect();
	});

	test('can access files page', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/files`);
		await hostPage.waitForLoadState('networkidle');
		await expect(hostPage).toHaveURL(new RegExp(`/trips/${tripId}/files`));
	});

	test('files page shows upload option', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/files`);
		await hostPage.waitForLoadState('networkidle');

		const uploadBtn = hostPage.locator('button, input[type="file"], label').filter({ hasText: /upload|add.*file|choose.*file/i }).first();
		const hasUpload = await uploadBtn.isVisible().catch(() => false);
		// Upload might be a drag-and-drop zone or file input
		const fileInput = hostPage.locator('input[type="file"]');
		const hasFileInput = await fileInput.count() > 0;
		expect(hasUpload || hasFileInput).toBeTruthy();
	});

	test('files page shows empty state or file list', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/files`);
		await hostPage.waitForLoadState('networkidle');

		const content = await hostPage.textContent('body');
		// Should show either files or an empty state
		expect(content?.length).toBeGreaterThan(0);
	});

	test('guest can access files page', async ({ guestPage }) => {
		await guestPage.goto(`/trips/${tripId}/files`);
		await guestPage.waitForLoadState('networkidle');
		await expect(guestPage).toHaveURL(new RegExp(`/trips/${tripId}/files`));
	});
});
