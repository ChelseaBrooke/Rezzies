import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { generateInviteCode } from '$lib/server/pricing.js';

/** Map draft pricingModel to Prisma enum-style string */
function mapPricingModel(
	model: string
): 'PER_ROOM' | 'PER_BED' | 'PER_PERSON' | 'PER_PERSON_PER_NIGHT' {
	const m = (model || 'per-person').toLowerCase();
	if (m === 'per-room') return 'PER_ROOM';
	if (m === 'per-bed') return 'PER_BED';
	if (m === 'per-person') return 'PER_PERSON';
	if (m === 'per-person_per_night' || m === 'per-night') return 'PER_PERSON_PER_NIGHT';
	return 'PER_PERSON';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'You must be logged in to publish a trip' }, 401);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, 400);
	}

	const d = body as Record<string, unknown>;
	const name = typeof d.name === 'string' ? d.name.trim() : '';
	const checkInDateStr = typeof d.checkInDate === 'string' ? d.checkInDate : '';
	const checkOutDateStr = typeof d.checkOutDate === 'string' ? d.checkOutDate : '';
	const rsvpByDateStr = typeof d.rsvpByDate === 'string' ? d.rsvpByDate.trim() : '';
	const totalTripCostStr = typeof d.totalTripCost === 'string' ? d.totalTripCost : String(d.totalTripCost ?? '');
	const rooms = Array.isArray(d.rooms) ? d.rooms : [];
	const description = typeof d.description === 'string' ? d.description : null;
	const listingUrl = typeof d.listingUrl === 'string' ? d.listingUrl : null;
	const propertyAddress = typeof d.propertyAddress === 'string' ? d.propertyAddress : null;
	const locationCity = typeof d.locationCity === 'string' ? d.locationCity.trim() || null : null;
	const coverPhoto = typeof d.coverPhoto === 'string' ? d.coverPhoto : null;
	const pricingModel = mapPricingModel(typeof d.pricingModel === 'string' ? d.pricingModel : 'per-person');
	const expectedGuestCount = typeof d.expectedGuestCount === 'number' ? d.expectedGuestCount : null;
	const maxOccupancy = typeof d.maxOccupancy === 'number' ? d.maxOccupancy : null;
	const partialStayAllowed = d.partialStayAllowed === true;

	// Required validation
	if (!name) {
		return json({ error: 'Trip name is required' }, 400);
	}
	if (!checkInDateStr || !checkOutDateStr) {
		return json({ error: 'Check-in and check-out dates are required' }, 400);
	}
	const totalCost = parseFloat(totalTripCostStr.replace(/[$,]/g, ''));
	if (isNaN(totalCost) || totalCost <= 0) {
		return json({ error: 'Total trip cost must be a positive number' }, 400);
	}
	const checkInDate = new Date(checkInDateStr);
	const checkOutDate = new Date(checkOutDateStr);
	if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
		return json({ error: 'Invalid dates' }, 400);
	}
	if (checkOutDate <= checkInDate) {
		return json({ error: 'Check-out date must be after check-in date' }, 400);
	}
	const rsvpByDate = rsvpByDateStr
		? (() => {
				const d = new Date(rsvpByDateStr);
				return Number.isNaN(d.getTime()) ? null : d;
			})()
		: null;
	if (rooms.length === 0) {
		return json({ error: 'At least one room is required' }, 400);
	}

	// At least one photo (cover or in rooms)
	const hasPhotos =
		!!coverPhoto ||
		(Array.isArray(d.galleryPhotos) && d.galleryPhotos.length > 0) ||
		rooms.some(
			(r: { photos?: string[] }) => Array.isArray(r?.photos) && r.photos.length > 0
		);
	if (!hasPhotos) {
		return json({ error: 'Please add at least one photo (cover or room photo)' }, 400);
	}

	// Generate a unique invite code, retrying on the rare P2002 unique-constraint collision
	// instead of a pre-check loop (which has a TOCTOU race between check and insert).
	async function createTripWithUniqueCode(retries = 5): Promise<Awaited<ReturnType<typeof prisma.trip.create>>> {
		for (let attempt = 0; attempt < retries; attempt++) {
			const inviteCode = generateInviteCode();
			try {
				return await prisma.trip.create({
					data: {
						name,
						description: description || null,
						listingUrl,
						listingTitle: null,
						listingCoverPhoto: coverPhoto || null,
						checkInDate,
						checkOutDate,
						rsvpByDate,
						totalCost,
						pricingModel,
						inviteCode,
						isPublished: true,
						expectedPeopleCount: expectedGuestCount,
						maxGuests: maxOccupancy,
						allowPartialStays: partialStayAllowed,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
						location: propertyAddress || null,
						fullAddress: propertyAddress || null,
						locationCity: locationCity || null
					}
				});
			} catch (err: unknown) {
				const isUniqueConflict =
					typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
				if (!isUniqueConflict || attempt === retries - 1) throw err;
				// Unique conflict on inviteCode — try a new one.
			}
		}
		throw new Error('Failed to generate a unique invite code after retries');
	}

	try {
		const trip = await createTripWithUniqueCode();

		// Host as TripMember (User, not AdminUser)
		await prisma.tripMember.create({
			data: {
				tripId: trip.id,
				userId: user.id,
				role: 'host',
				inviteStatus: 'accepted'
			}
		});

		// Create rooms and beds
		for (const room of rooms) {
			const roomName = typeof room.name === 'string' ? room.name : 'Room';
			const roomPhotos = Array.isArray(room.photos) ? room.photos : [];
			const roomBeds = Array.isArray(room.beds) ? room.beds : [];
			const maxOccupancyRoom =
				typeof room.maxOccupants === 'number' ? room.maxOccupants : null;

			const createdRoom = await prisma.room.create({
				data: {
					tripId: trip.id,
					name: roomName,
					description:
						typeof room.notes === 'string' && room.notes
							? room.notes
							: typeof room.customRoomDescription === 'string' && room.customRoomDescription
								? room.customRoomDescription
								: null,
					baseRateModifier: 1.0,
					photoUrls: roomPhotos.length > 0 ? roomPhotos : [],
					maxOccupancy: maxOccupancyRoom
				}
			});

			for (const bed of roomBeds) {
				const bedType = typeof bed.bedType === 'string' ? bed.bedType : 'other';
				const count = typeof bed.count === 'number' && bed.count > 0 ? bed.count : 1;
				for (let i = 0; i < count; i++) {
					await prisma.bed.create({
						data: {
							roomId: createdRoom.id,
							bedType: bedType.toLowerCase(),
							capacity: 1,
							capacitySlots: 1,
							isAvailable: true
						}
					});
				}
			}
		}

		return json({
			success: true,
			tripId: trip.id,
			inviteCode: trip.inviteCode
		});
	} catch (err) {
		console.error('Publish trip error:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to publish trip' },
			500
		);
	}
};
