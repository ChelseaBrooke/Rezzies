import { test, expect } from '../fixtures/auth.fixture.js';
import { PrismaClient } from '@prisma/client';
import { TEST_TRIP } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Polls', () => {
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

	test('host can access polls page', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/polls`);
		await expect(hostPage).toHaveURL(new RegExp(`/trips/${tripId}/polls`));
	});

	test('host can see create poll button', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/polls`);

		// New Poll button has class="btn-new-poll"
		const createBtn = hostPage.locator('.btn-new-poll, button').filter({ hasText: /new.*poll|create.*poll/i }).first();
		await expect(createBtn).toBeVisible();
	});

	test('clicking new poll opens create modal', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/polls`);

		const createBtn = hostPage.locator('.btn-new-poll, button').filter({ hasText: /new.*poll|create.*poll/i }).first();
		await expect(createBtn).toBeVisible();
		await createBtn.click();

		// Modal should be open with title/question input
		const titleInput = hostPage.locator('input[name="title"], input[name="question"], input[placeholder*="question" i], input[placeholder*="title" i]').first();
		await expect(titleInput).toBeVisible({ timeout: 5_000 });
	});

	test('polls page has hidden vote form', async ({ hostPage }) => {
		await hostPage.goto(`/trips/${tripId}/polls`);

		// Hidden forms for vote, close, nudge, watch
		const voteForm = hostPage.locator('#vote-form, form[action*="vote"]');
		const hasVoteForm = await voteForm.count() > 0;
		expect(hasVoteForm).toBeTruthy();
	});

	test('guest can access polls page', async ({ guestPage }) => {
		await guestPage.goto(`/trips/${tripId}/polls`);
		await expect(guestPage).toHaveURL(new RegExp(`/trips/${tripId}/polls`));
	});
});
