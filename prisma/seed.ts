/**
 * Development seed (TD5).
 *
 * Creates a small but coherent dev world you can actually log into and click
 * around: a host, two guests, one published trip with rooms and beds, trip
 * members, RSVPs and bed assignments.
 *
 * Design notes:
 * - LOCAL ONLY. Refuses to run unless DATABASE_URL and DIRECT_URL both point at
 *   localhost (scripts/require-local-db.mjs), because it writes well-known dev
 *   credentials and rebuilds the demo trip.
 * - Idempotent. Users are upserted by email and the demo trip is rebuilt under
 *   a fixed id, so re-running never duplicates, never crashes, and keeps stable
 *   ids/URLs. Re-running DOES reset the demo trip, which is what you want from
 *   a dev seed.
 * - No pricing math here. Prices come from calculateReservationPrice
 *   ($lib/server/pricing-canonical.ts) at read time -- the seed only supplies
 *   the inputs (total cost, rooms, beds, RSVPs, assignments) so the dashboard
 *   and the pricing engine have something meaningful to work with.
 * - Trip.totalCost is a Float in dollars in the current schema; the seed stores
 *   no hand-computed `*Cents` values.
 *
 * Usage: npm run db:seed   (or `npm run db:fresh` to rebuild the DB first)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { requireLocalDatabase } from '../scripts/require-local-db.mjs';

const prisma = new PrismaClient();

/** Obvious, clearly non-production dev credentials. */
const DEV_PASSWORD = 'DivviDev123!';
const DEV_EMAIL_DOMAIN = '@divvi.local';

const DEV_USERS = [
	{ key: 'host', email: `host${DEV_EMAIL_DOMAIN}`, name: 'Hana Host', homeCity: 'Portland, OR' },
	{ key: 'guest', email: `guest${DEV_EMAIL_DOMAIN}`, name: 'Gabe Guest', homeCity: 'Seattle, WA' },
	{ key: 'guest2', email: `guest2${DEV_EMAIL_DOMAIN}`, name: 'Priya Patel', homeCity: 'Denver, CO' }
] as const;

/**
 * Fixed id so re-runs are stable (same trip URL every time) and so the seed can
 * never collide with a real trip that happens to share the display name.
 */
const DEMO_TRIP_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_TRIP_NAME = 'Divvi Dev Lakehouse';

/** Rooms and beds for the demo trip. capacitySlots drives the canonical model. */
const DEMO_ROOMS = [
	{
		name: 'Master Suite',
		roomType: 'master-bedroom',
		description: 'King bed, lake view, private bath',
		privacyFactor: 1.25,
		beds: [{ bedType: 'king', capacitySlots: 2 }]
	},
	{
		name: 'Garden Room',
		roomType: 'bedroom',
		description: 'Queen bed plus a twin',
		privacyFactor: 1.0,
		beds: [
			{ bedType: 'queen', capacitySlots: 2 },
			{ bedType: 'twin', capacitySlots: 1 }
		]
	},
	{
		name: 'Bunk Room',
		roomType: 'bedroom',
		description: 'Two bunks, great for kids',
		privacyFactor: 1.0,
		beds: [
			{ bedType: 'bunk', capacitySlots: 1 },
			{ bedType: 'bunk', capacitySlots: 1 }
		]
	}
] as const;

function daysFromNow(days: number): Date {
	const d = new Date();
	d.setUTCHours(15, 0, 0, 0);
	d.setUTCDate(d.getUTCDate() + days);
	return d;
}

async function main() {
	// Refuse to touch anything that is not a local database. This runs before
	// the first write: the seed sets well-known dev passwords and rebuilds the
	// demo trip, neither of which may ever happen against a hosted database.
	requireLocalDatabase('db:seed');

	console.log('Seeding Divvi dev data...');

	// 1. Users -- upserted by email, so ids stay stable across runs.
	const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
	const users: Record<string, { id: string; email: string }> = {};

	for (const u of DEV_USERS) {
		const user = await prisma.user.upsert({
			where: { email: u.email },
			update: { name: u.name, passwordHash, homeCity: u.homeCity },
			create: { email: u.email, name: u.name, passwordHash, homeCity: u.homeCity }
		});
		users[u.key] = { id: user.id, email: user.email };
	}
	console.log(`  users: ${DEV_USERS.length} upserted`);

	// 2. Reset the demo trip by its FIXED id -- never by display name, which
	//    could match a real trip. Deleting cascades to rooms, beds, members,
	//    RSVPs and assignments, so the rebuild below is a clean upsert.
	const { count: removed } = await prisma.trip.deleteMany({ where: { id: DEMO_TRIP_ID } });
	if (removed > 0) console.log('  reset previous demo trip');

	// 3. The trip, with rooms and beds created in one nested write.
	const checkInDate = daysFromNow(21);
	const checkOutDate = daysFromNow(24); // 3 nights

	const created = await prisma.trip.create({
		data: {
			id: DEMO_TRIP_ID,
			name: DEMO_TRIP_NAME,
			description: 'A three-night lakehouse weekend for poking at the dev build.',
			location: 'Lake Chelan, WA',
			locationCity: 'Lake Chelan',
			checkInDate,
			checkOutDate,
			rsvpByDate: daysFromNow(14),
			totalCost: 4800, // dollars, per the current schema
			pricingModel: 'PER_BED',
			expectedPeopleCount: 6,
			maxGuests: 8,
			isPublished: true,
			inviteMode: 'approval_required',
			costSharingEnabled: true,
			timezone: 'America/Los_Angeles',
			checkInTime: '4:00 PM',
			checkOutTime: '11:00 AM',
			houseRules: 'Shoes off inside. Quiet hours after 10pm.',
			whatToBring: 'Towel, swimsuit, a board game.',
			petsAllowed: true,
			childrenAllowed: true,
			rooms: {
				create: DEMO_ROOMS.map((room) => ({
					name: room.name,
					roomType: room.roomType,
					description: room.description,
					privacyFactor: room.privacyFactor,
					beds: { create: room.beds.map((b) => ({ ...b })) }
				}))
			}
		},
		select: { id: true }
	});

	// Read the generated room/bed ids back in a single batched query.
	const trip = await prisma.trip.findUniqueOrThrow({
		where: { id: created.id },
		select: {
			id: true,
			rooms: {
				select: { id: true, name: true, beds: { select: { id: true, bedType: true } } },
				orderBy: { id: 'asc' }
			}
		}
	});

	const roomByName = new Map(trip.rooms.map((r) => [r.name, r]));
	const masterSuite = roomByName.get('Master Suite')!;
	const gardenRoom = roomByName.get('Garden Room')!;
	const kingBed = masterSuite.beds.find((b) => b.bedType === 'king')!;
	const queenBed = gardenRoom.beds.find((b) => b.bedType === 'queen')!;

	console.log(`  trip: ${trip.id} (${trip.rooms.length} rooms)`);

	// 4. Trip members.
	await prisma.tripMember.createMany({
		data: [
			{ tripId: trip.id, userId: users.host.id, role: 'host', inviteStatus: 'approved' },
			{ tripId: trip.id, userId: users.guest.id, role: 'guest', inviteStatus: 'approved' },
			{ tripId: trip.id, userId: users.guest2.id, role: 'guest', inviteStatus: 'approved' }
		]
	});

	// 5. RSVPs -- a confirmed yes, a second yes, and a maybe, so headcount-driven
	//    pricing and the dashboard have a realistic mix to render.
	await prisma.rSVP.createMany({
		data: [
			{
				tripId: trip.id,
				userId: users.host.id,
				status: 'yes',
				adultsCount: 1,
				costCommitmentAccepted: true,
				yesSubstatus: 'confirmed',
				rsvpYesAcceptedAt: new Date()
			},
			{
				tripId: trip.id,
				userId: users.guest.id,
				status: 'yes',
				adultsCount: 2,
				costCommitmentAccepted: true,
				yesSubstatus: 'confirmed',
				rsvpYesAcceptedAt: new Date(),
				notes: 'Driving up Friday afternoon.'
			},
			{
				tripId: trip.id,
				userId: users.guest2.id,
				status: 'maybe',
				adultsCount: 1,
				notes: 'Waiting to hear back about work.'
			}
		]
	});

	// 6. Bed assignments for the two confirmed guests.
	await prisma.roomAssignment.createMany({
		data: [
			{
				tripId: trip.id,
				roomId: masterSuite.id,
				userId: users.host.id,
				bedId: kingBed.id,
				bedType: kingBed.bedType,
				partySize: 1
			},
			{
				tripId: trip.id,
				roomId: gardenRoom.id,
				userId: users.guest.id,
				bedId: queenBed.id,
				bedType: queenBed.bedType,
				partySize: 2
			}
		]
	});

	console.log('  members, RSVPs and bed assignments created');
	console.log('\nDone. Dev logins (local only -- never use these anywhere real):');
	for (const u of DEV_USERS) {
		console.log(`  ${u.email.padEnd(22)} ${DEV_PASSWORD}   (${u.name})`);
	}
}

main()
	.catch((e) => {
		console.error('Error seeding database:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
