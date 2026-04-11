import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('RSVP (guest)', () => {
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

	test('can access RSVP page', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rsvp`);
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/rsvp`));
	});

	test('RSVP page has status selector', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rsvp`);

		// The RSVP form uses select#status with name="status" and options yes/no
		const statusSelect = page.locator('#status, select[name="status"]');
		await expect(statusSelect).toBeVisible({ timeout: 10_000 });
	});

	test('RSVP page has main form', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rsvp`);

		// The main form has id="rsvp-form" with action="?/updateRsvp"
		const form = page.locator('#rsvp-form, form[action*="updateRsvp"]');
		await expect(form).toBeVisible({ timeout: 10_000 });
	});

	test('selecting yes shows party size fields', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rsvp`);

		// Select "yes"
		const statusSelect = page.locator('#status, select[name="status"]');
		await expect(statusSelect).toBeVisible({ timeout: 10_000 });
		await statusSelect.selectOption('yes');

		// Should show adults count (name="adultsCount")
		const adultsInput = page.locator('#adultsCount, input[name="adultsCount"]');
		await expect(adultsInput).toBeVisible({ timeout: 5_000 });
	});

	test('selecting no shows notes field', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rsvp`);

		const statusSelect = page.locator('#status, select[name="status"]');
		await expect(statusSelect).toBeVisible({ timeout: 10_000 });
		await statusSelect.selectOption('no');

		// Should show notes textarea (name="notes")
		const notesField = page.locator('#notes, textarea[name="notes"]');
		await expect(notesField).toBeVisible({ timeout: 5_000 });
	});

	test('RSVP page has dietary section', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rsvp`);

		// Dietary form uses action="?/updateDietary"
		const dietaryForm = page.locator('form[action*="updateDietary"]');
		const hasDietaryForm = await dietaryForm.count() > 0;

		// Or dietary inputs exist
		const dietaryInput = page.locator('#myDietary, input[name="dietaryRestrictions"]');
		const hasDietaryInput = await dietaryInput.count() > 0;

		expect(hasDietaryForm || hasDietaryInput).toBeTruthy();
	});

	test('RSVP page shows room/bed selection when yes', async ({ page }) => {
		await page.goto(`/trips/${tripId}/rsvp`);

		const statusSelect = page.locator('#status, select[name="status"]');
		await expect(statusSelect).toBeVisible({ timeout: 10_000 });
		await statusSelect.selectOption('yes');

		// Should show room cards (.hotel-room-card) or bed checkboxes (name="bedIds")
		const roomCards = page.locator('.hotel-room-card');
		const bedCheckboxes = page.locator('input[name="bedIds"]');
		const hasRoomUI = (await roomCards.count()) > 0 || (await bedCheckboxes.count()) > 0;
		expect(hasRoomUI).toBeTruthy();
	});
});
