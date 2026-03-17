import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
	HOST_USER,
	GUEST_USER,
	TEST_TRIP,
	TEST_ROOMS,
	E2E_EMAIL_DOMAIN,
} from './test-data.js';

const prisma = new PrismaClient();

export async function seedTestData() {
	console.log('[e2e seed] Seeding test data...');

	// Create host user
	const hostPasswordHash = await bcrypt.hash(HOST_USER.password, 10);
	const host = await prisma.user.upsert({
		where: { email: HOST_USER.email },
		update: { passwordHash: hostPasswordHash, name: HOST_USER.name },
		create: {
			email: HOST_USER.email,
			passwordHash: hostPasswordHash,
			name: HOST_USER.name,
		},
	});

	// Create guest user
	const guestPasswordHash = await bcrypt.hash(GUEST_USER.password, 10);
	const guest = await prisma.user.upsert({
		where: { email: GUEST_USER.email },
		update: { passwordHash: guestPasswordHash, name: GUEST_USER.name },
		create: {
			email: GUEST_USER.email,
			passwordHash: guestPasswordHash,
			name: GUEST_USER.name,
		},
	});

	// Clean up existing test trip if it exists (by invite code)
	const existingTrip = await prisma.trip.findUnique({
		where: { inviteCode: TEST_TRIP.inviteCode },
	});
	if (existingTrip) {
		await prisma.trip.delete({ where: { id: existingTrip.id } });
	}

	// Create test trip
	const now = new Date();
	const checkIn = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
	const checkOut = new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000); // 37 days from now

	const trip = await prisma.trip.create({
		data: {
			name: TEST_TRIP.name,
			inviteCode: TEST_TRIP.inviteCode,
			location: TEST_TRIP.location,
			totalCost: TEST_TRIP.totalCost,
			pricingModel: TEST_TRIP.pricingModel,
			checkInDate: checkIn,
			checkOutDate: checkOut,
			isPublished: true,
			rooms: {
				create: TEST_ROOMS.map((room) => ({
					name: room.name,
					beds: {
						create: room.beds.map((bed) => ({
							bedType: bed.bedType,
							capacitySlots: bed.capacitySlots,
						})),
					},
				})),
			},
		},
	});

	// Add host as trip member
	await prisma.tripMember.upsert({
		where: { tripId_userId: { tripId: trip.id, userId: host.id } },
		update: { role: 'host', inviteStatus: 'accepted' },
		create: {
			tripId: trip.id,
			userId: host.id,
			role: 'host',
			inviteStatus: 'accepted',
		},
	});

	// Add guest as trip member (invited, not yet accepted)
	await prisma.tripMember.upsert({
		where: { tripId_userId: { tripId: trip.id, userId: guest.id } },
		update: { role: 'guest', inviteStatus: 'accepted' },
		create: {
			tripId: trip.id,
			userId: guest.id,
			role: 'guest',
			inviteStatus: 'accepted',
		},
	});

	// Create an invite for the guest
	await prisma.invite.create({
		data: {
			tripId: trip.id,
			invitedByUserId: host.id,
			recipientEmail: GUEST_USER.email,
			recipientUserId: guest.id,
			channel: 'email',
			status: 'accepted',
			token: `e2e-invite-${Date.now()}`,
		},
	});

	console.log(`[e2e seed] Created host: ${host.id}`);
	console.log(`[e2e seed] Created guest: ${guest.id}`);
	console.log(`[e2e seed] Created trip: ${trip.id} (invite code: ${TEST_TRIP.inviteCode})`);
	console.log('[e2e seed] Done.');

	return { host, guest, trip };
}

export async function cleanupTestData() {
	console.log('[e2e cleanup] Cleaning up test data...');

	// Delete test trip by invite code (cascades to rooms, beds, members, invites, etc.)
	try {
		await prisma.trip.delete({
			where: { inviteCode: TEST_TRIP.inviteCode },
		});
	} catch {
		// Trip may already be deleted
	}

	// Find all e2e test user IDs
	const e2eUsers = await prisma.user.findMany({
		where: { email: { endsWith: E2E_EMAIL_DOMAIN } },
		select: { id: true },
	});
	const e2eUserIds = e2eUsers.map((u) => u.id);

	if (e2eUserIds.length > 0) {
		// Delete records that reference users with onDelete: Restrict (not Cascade)
		// Invite.invitedByUserId has onDelete: Restrict
		await prisma.invite.deleteMany({
			where: { invitedByUserId: { in: e2eUserIds } },
		});

		// Now safe to delete the users (remaining FKs use onDelete: Cascade or SetNull)
		await prisma.user.deleteMany({
			where: { id: { in: e2eUserIds } },
		});
	}

	console.log('[e2e cleanup] Done.');
}

// Allow running directly: tsx e2e/fixtures/seed.ts
if (process.argv[1]?.includes('seed')) {
	seedTestData()
		.then(() => prisma.$disconnect())
		.catch((e) => {
			console.error(e);
			prisma.$disconnect();
			process.exit(1);
		});
}
