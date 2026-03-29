import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

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
	const totalTripCostStr =
		typeof d.totalTripCost === 'string' ? d.totalTripCost : String(d.totalTripCost ?? '0');
	const rooms = Array.isArray(d.rooms) ? d.rooms : [];
	const description = typeof d.description === 'string' ? d.description : null;
	const listingUrl = typeof d.listingUrl === 'string' ? d.listingUrl : null;
	const propertyAddress = typeof d.propertyAddress === 'string' ? d.propertyAddress : null;
	const locationCity = typeof d.locationCity === 'string' ? d.locationCity.trim() || null : null;
	const coverPhoto = typeof d.coverPhoto === 'string' ? d.coverPhoto : null;
	const pricingModel = mapPricingModel(
		typeof d.pricingModel === 'string' ? d.pricingModel : 'per-person'
	);
	const expectedGuestCount = typeof d.expectedGuestCount === 'number' ? d.expectedGuestCount : null;
	const maxOccupancy = typeof d.maxOccupancy === 'number' ? d.maxOccupancy : null;
	const partialStayAllowed = d.partialStayAllowed === true;
	const costSharingEnabled = d.costSharingEnabled === true; // explicit opt-in; default false
	const isPublished = d.isPublished !== false; // default true, pass false to save as draft
	const splitPlatformFee = d.splitCost === true;
	const gamesEnabled = d.gamesEnabled === true;
	const activitiesEnabled = d.activitiesEnabled !== false; // default true; only false when host explicitly disabled
	const selectedGames = Array.isArray(d.selectedGames) ? (d.selectedGames as string[]) : [];
	const VALID_GAME_IDS = ['caption-this', 'scavenger-bingo', 'alphabet-hunt', 'daily-trivia'];
	const GAME_NAMES: Record<string, string> = {
		'caption-this': 'Caption This',
		'scavenger-bingo': 'Scavenger Bingo',
		'alphabet-hunt': 'Alphabet Hunt',
		'daily-trivia': 'Daily Trivia'
	};
	const PLATFORM_FEE = 25;
	const discountCodeRaw = typeof d.discountCode === 'string' ? d.discountCode.trim() : '';
	const waivePlatformFee = discountCodeRaw === 'BearsBestFriend#1';
	const platformFeePerPerson = waivePlatformFee
		? 0
		: splitPlatformFee
			? PLATFORM_FEE / Math.max(1, typeof d.expectedGuestCount === 'number' ? d.expectedGuestCount : 1)
			: 0;

	if (!name) {
		return json({ error: 'Trip name is required' }, 400);
	}
	if (!checkInDateStr || !checkOutDateStr) {
		return json({ error: 'Check-in and check-out dates are required' }, 400);
	}

	const totalCost = costSharingEnabled
		? parseFloat(totalTripCostStr.replace(/[$,]/g, ''))
		: 0;

	if (costSharingEnabled && (isNaN(totalCost) || totalCost <= 0)) {
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

	const hasPhotos =
		!!coverPhoto ||
		(Array.isArray(d.galleryPhotos) && d.galleryPhotos.length > 0) ||
		rooms.some((r: { photos?: string[] }) => Array.isArray(r?.photos) && r.photos.length > 0);
	if (!hasPhotos) {
		return json({ error: 'Please add at least one photo (cover or room photo)' }, 400);
	}

	if (expectedGuestCount == null || expectedGuestCount < 1) {
		return json({ error: 'Minimum headcount (realistic low) is required' }, 400);
	}

	/** Only persist a trip-level max when the host entered one; otherwise null (capacity from beds elsewhere). */
	const maxGuestsToStore =
		maxOccupancy != null && maxOccupancy > 0 ? maxOccupancy : null;

	try {
		const trip = await prisma.trip.create({
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
			isPublished,
			costSharingEnabled,
			activitiesEnabled,
			gamesEnabled,
			platformFeePerPerson,
				expectedPeopleCount: expectedGuestCount,
				maxGuests: maxGuestsToStore,
				allowPartialStays: partialStayAllowed,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
				location: propertyAddress || null,
				fullAddress: propertyAddress || null,
				locationCity: locationCity || null
			}
		});

		// Host as TripMember (approved immediately)
		await prisma.tripMember.create({
			data: {
				tripId: trip.id,
				userId: user.id,
				role: 'host',
				inviteStatus: 'approved'
			}
		});

		// Create rooms and beds
		for (let ri = 0; ri < rooms.length; ri++) {
			const room = rooms[ri];
			const rawName = typeof room.name === 'string' ? room.name.trim() : '';
			const roomName = rawName || `Room ${ri + 1}`;
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

		// Create selected TripGames if games add-on is enabled
		if (gamesEnabled && selectedGames.length > 0) {
			for (const gameId of selectedGames) {
				if (!VALID_GAME_IDS.includes(gameId)) continue;
				await prisma.tripGame.create({
					data: {
						tripId: trip.id,
						gameId,
						name: GAME_NAMES[gameId] ?? gameId,
						addedByUserId: user.id
					}
				});
			}
		}

		return json({ success: true, tripId: trip.id });
	} catch (err) {
		console.error('Publish trip error:', err);
		return json({ error: err instanceof Error ? err.message : 'Failed to publish trip' }, 500);
	}
};
