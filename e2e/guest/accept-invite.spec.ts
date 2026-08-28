import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { HOST_USER, TEST_TRIP } from '../fixtures/test-data.js';

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

/**
 * B1 regression — the invite link funnel, end to end.
 *
 * The fixture is a trip the host has invited to but not yet published, and this project's
 * seeded guest, who is not a member of it. That is the exact shape that used to 404
 * (logged out) and loop between /join and /join (logged in, not yet a member).
 *
 * It also covers the two leaks code review caught: a declined token must not open the
 * anonymous preview, and /join must stay 404 for a draft trip with no valid invite.
 */
test.describe('Invite link lands the invitee (B1)', () => {
	// Unique per worker so parallel workers never clean up each other's fixture.
	const DRAFT_TRIP_NAME = `E2E B1 Draft Trip ${process.env.TEST_WORKER_INDEX ?? '0'}`;
	let draftTripId: string;
	let freshToken: string;
	let expiredToken: string;
	let declinedToken: string;

	test.beforeAll(async () => {
		const host = await prisma.user.findFirst({ where: { email: HOST_USER.email } });

		await prisma.trip.deleteMany({ where: { name: DRAFT_TRIP_NAME } });

		const now = Date.now();
		const draft = await prisma.trip.create({
			data: {
				name: DRAFT_TRIP_NAME,
				location: TEST_TRIP.location,
				totalCost: TEST_TRIP.totalCost,
				pricingModel: TEST_TRIP.pricingModel,
				checkInDate: new Date(now + 45 * 24 * 60 * 60 * 1000),
				checkOutDate: new Date(now + 50 * 24 * 60 * 60 * 1000),
				// Not published yet — the host is still setting it up.
				isPublished: false,
				inviteMode: 'approval_required',
				costSharingEnabled: true
			}
		});
		draftTripId = draft.id;

		await prisma.tripMember.create({
			data: { tripId: draftTripId, userId: host!.id, role: 'host', inviteStatus: 'approved' }
		});

		freshToken = `e2e-b1-fresh-${now}`;
		expiredToken = `e2e-b1-expired-${now}`;
		declinedToken = `e2e-b1-declined-${now}`;
		await prisma.invite.createMany({
			data: [
				{
					tripId: draftTripId,
					token: freshToken,
					invitedByUserId: host!.id,
					channel: 'email',
					recipientEmail: 'e2e-b1-invitee@test.divvi.com',
					expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000)
				},
				{
					tripId: draftTripId,
					token: expiredToken,
					invitedByUserId: host!.id,
					channel: 'email',
					recipientEmail: 'e2e-b1-lapsed@test.divvi.com',
					expiresAt: new Date(now - 24 * 60 * 60 * 1000)
				},
				{
					tripId: draftTripId,
					token: declinedToken,
					invitedByUserId: host!.id,
					channel: 'email',
					recipientEmail: 'e2e-b1-declined@test.divvi.com',
					status: 'declined',
					expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000)
				}
			]
		});
	});

	test.afterAll(async () => {
		if (draftTripId) await prisma.trip.delete({ where: { id: draftTripId } }).catch(() => {});
		await prisma.$disconnect();
	});

	test('logged-out invitee lands on the trip, never a 404', async ({ page }) => {
		await page.context().clearCookies();
		const response = await page.goto(`/invite/${freshToken}`);

		expect(response?.status()).toBeLessThan(400);
		await expect(page).toHaveURL(new RegExp(`/trips/${draftTripId}\\?invite=`));
		await expect(page.getByText(DRAFT_TRIP_NAME)).toBeVisible({ timeout: 10_000 });
	});

	test('logged-in non-member lands on the join page, never a 404 or a redirect loop', async ({
		page
	}) => {
		// This context is the seeded guest, who is not a member of the draft trip — the
		// "logged-in, not-a-member" persona, with no extra auth fixture needed.
		const response = await page.goto(`/invite/${freshToken}`);

		expect(response?.status()).toBeLessThan(400);
		await page.waitForURL(new RegExp(`/trips/${draftTripId}/join`), { timeout: 10_000 });
		await expect(page.getByRole('button', { name: /join/i })).toBeVisible({ timeout: 10_000 });
	});

	// SECURITY: a declined token is still a live string in someone's inbox. It must not
	// open the preview, which carries the names/emails/avatars of everyone going.
	test('a declined invite does not open the preview for a logged-out visitor', async ({ page }) => {
		await page.context().clearCookies();
		await page.goto(`/invite/${declinedToken}`);

		await page.waitForURL(/\/login/, { timeout: 10_000 });
		await expect(page.getByText(DRAFT_TRIP_NAME)).toHaveCount(0);
	});

	// SECURITY: /join hands back trip metadata, so a draft trip needs a valid invite.
	test('a logged-in non-member cannot see a draft trip via /join without an invite', async ({
		page
	}) => {
		const response = await page.goto(`/trips/${draftTripId}/join`);
		expect(response?.status()).toBe(404);
	});

	test('an expired invite link explains itself instead of 404ing', async ({ page }) => {
		await page.context().clearCookies();
		const response = await page.goto(`/invite/${expiredToken}`);
		expect(response?.status()).toBe(410);
	});

	test('a token that does not exist is a 404', async ({ page }) => {
		await page.context().clearCookies();
		const response = await page.goto('/invite/e2e-b1-no-such-token');
		expect(response?.status()).toBe(404);
	});
});
