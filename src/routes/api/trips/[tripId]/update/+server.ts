import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Prisma } from '@prisma/client';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { ROOM_BEDS_ORDER_BY, TRIP_ROOMS_ORDER_BY } from '$lib/server/trip-room-order.js';
import { capacityFieldsForNewBed } from '$lib/bed-spot-validation.js';
import { normalizeRoomTypeFromWizard } from '$lib/room-type-display.js';

function mapPricingModel(
	model: string
): 'PER_ROOM' | 'PER_BED' | 'PER_PERSON' | 'PER_PERSON_PER_NIGHT' {
	const m = (model || 'per-person').toLowerCase().replace(/_/g, '-');
	if (m === 'per-room') return 'PER_ROOM';
	if (m === 'per-bed') return 'PER_BED';
	if (m === 'per-person') return 'PER_PERSON';
	if (m === 'per-person-per-night' || m === 'per-night') return 'PER_PERSON_PER_NIGHT';
	return 'PER_PERSON';
}

function parseOptionalInt(v: unknown): number | null {
	if (v == null || v === '') return null;
	if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
	if (typeof v === 'string') {
		const t = v.trim();
		if (t === '') return null;
		const n = parseInt(t, 10);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function logTripUpdateError(tripId: string, phase: string, err: unknown) {
	console.error(`[api/trips/update] tripId=${tripId} phase=${phase}`, err);
	if (err instanceof Prisma.PrismaClientKnownRequestError) {
		console.error(`[api/trips/update] Prisma code=${err.code} meta=${JSON.stringify(err.meta)}`);
	}
	if (err instanceof Error && err.stack) {
		console.error('[api/trips/update] stack:', err.stack);
	}
}

export const PUT: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'You must be logged in to update a trip' }, { status: 401 });
	}

	const tripId = params.tripId;
	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) {
		return json({ error: 'Only the trip host can update this trip' }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch (e) {
		logTripUpdateError(tripId, 'json_parse', e);
		return json({ error: 'Invalid JSON body' }, { status: 400 });
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
	const propertyAddress = typeof d.propertyAddress === 'string' ? d.propertyAddress.trim() || null : null;
	const fullAddressPayload = typeof d.fullAddress === 'string' ? d.fullAddress.trim() || null : null;
	const locationCityPayload = typeof d.locationCity === 'string' ? d.locationCity.trim() || null : null;
	const coverPhoto = typeof d.coverPhoto === 'string' ? d.coverPhoto : null;
	const pricingModel = mapPricingModel(typeof d.pricingModel === 'string' ? d.pricingModel : 'per-person');
	const expectedGuestCount = parseOptionalInt(d.expectedGuestCount);
	const maxOccupancy = parseOptionalInt(d.maxOccupancy);
	/** Persist trip-level max only when host entered a positive value (same as publish). */
	const maxGuestsToStore = maxOccupancy != null && maxOccupancy > 0 ? maxOccupancy : null;
	const partialStayAllowed = d.partialStayAllowed === true;
	const costSharingEnabled = d.costSharingEnabled === true;
	const gamesEnabled = d.gamesEnabled === true;
	const activitiesEnabled = d.activitiesEnabled !== false; // default true
	const mealsEnabled = d.mealsEnabled === true;

	if (!name) {
		return json({ error: 'Trip name is required' }, { status: 400 });
	}
	if (!checkInDateStr || !checkOutDateStr) {
		return json({ error: 'Check-in and check-out dates are required' }, { status: 400 });
	}
	// Total cost validation is conditional: required and positive only when cost sharing is on
	const totalCost = costSharingEnabled
		? parseFloat(totalTripCostStr.replace(/[$,]/g, ''))
		: 0;
	if (costSharingEnabled && (isNaN(totalCost) || totalCost <= 0)) {
		return json({ error: 'Total trip cost must be a positive number' }, { status: 400 });
	}
	const checkInDate = new Date(checkInDateStr);
	const checkOutDate = new Date(checkOutDateStr);
	if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
		return json({ error: 'Invalid dates' }, { status: 400 });
	}
	if (checkOutDate <= checkInDate) {
		return json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
	}
	const rsvpByDate = rsvpByDateStr
		? (() => {
				const d = new Date(rsvpByDateStr);
				return Number.isNaN(d.getTime()) ? null : d;
			})()
		: null;
	if (rooms.length === 0) {
		return json({ error: 'At least one room is required' }, { status: 400 });
	}

	if (expectedGuestCount != null && expectedGuestCount < 1) {
		return json({ error: 'Minimum headcount must be at least 1' }, { status: 400 });
	}

	try {
		console.info(`[api/trips/update] start tripId=${tripId} userId=${user.id} rooms=${rooms.length} costSharing=${costSharingEnabled}`);
		await prisma.trip.update({
			where: { id: tripId },
			data: {
				name,
				description: description || null,
				listingUrl,
				listingCoverPhoto: coverPhoto || null,
				checkInDate,
				checkOutDate,
				rsvpByDate,
				totalCost,
				pricingModel,
				expectedPeopleCount: expectedGuestCount,
				maxGuests: maxGuestsToStore,
				allowPartialStays: partialStayAllowed,
				costSharingEnabled,
				gamesEnabled,
				activitiesEnabled,
				location: fullAddressPayload ?? propertyAddress ?? null,
				fullAddress: fullAddressPayload ?? propertyAddress ?? null,
				locationCity: locationCityPayload ?? null
			}
		});

		// Upsert MealPlan.enabled for this trip
		await prisma.mealPlan.upsert({
			where: { tripId },
			create: { tripId, enabled: mealsEnabled },
			update: { enabled: mealsEnabled }
		});

		// Fetch the existing trip so we can do a structural diff before touching rooms.
		const existingTrip = await prisma.trip.findUnique({
			where: { id: tripId },
			include: {
				rooms: {
					orderBy: TRIP_ROOMS_ORDER_BY,
					include: {
						beds: {
							orderBy: ROOM_BEDS_ORDER_BY,
							select: { id: true, bedType: true }
						}
					}
				}
			}
		});

		// Determine whether the room/bed structure has actually changed.
		// A "structural change" means the room names or bed types differ between the
		// current state and the submitted payload, only in that case do we rebuild rooms.
		// Metadata-only edits (name, dates, cost, pricing model) leave rooms intact.
		const existingRoomSignature = (existingTrip?.rooms ?? [])
			.map((r) => `${r.name}:${r.beds.map((b) => b.bedType).sort().join(',')}`)
			.sort()
			.join('|');
		const incomingRoomSignature = rooms
			.map(
				(r: { name?: string; beds?: Array<{ bedType?: string }> }) =>
					`${r.name ?? ''}:${(r.beds ?? []).map((b: { bedType?: string }) => b.bedType ?? 'other').sort().join(',')}`
			)
			.sort()
			.join('|');

		if (existingRoomSignature !== incomingRoomSignature) {
			// Room structure changed, rebuild rooms but preserve trip-level data (RSVPs, members).
			// Reservations and room assignments reference specific room/bed IDs so we must clear them,
			// but RSVP records (yes/no answers) are kept, guests can re-pick rooms.
			const existingRoomIds = (existingTrip?.rooms ?? []).map((r) => r.id);
			if (existingRoomIds.length > 0) {
				// Clear room-specific foreign-key records before deleting rooms.
				await prisma.roomAssignment.deleteMany({ where: { tripId } });
				await prisma.reservation.deleteMany({ where: { tripId } });
				await prisma.guestSubmission.deleteMany({ where: { roomId: { in: existingRoomIds } } });
			}
			await prisma.room.deleteMany({ where: { tripId } });

			for (const room of rooms) {
				const roomName = typeof room.name === 'string' ? room.name : 'Room';
				const roomPhotos = Array.isArray(room.photos) ? room.photos : [];
				const roomBeds = Array.isArray(room.beds) ? room.beds : [];
				const maxOccupancyRoom = parseOptionalInt(
					(room as { maxOccupants?: unknown }).maxOccupants
				);

				const createdRoom = await prisma.room.create({
					data: {
						tripId,
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
					const countRaw = parseOptionalInt((bed as { count?: unknown }).count);
					const count = countRaw != null && countRaw > 0 ? countRaw : 1;
					const bt = bedType.toLowerCase();
					const { capacity, capacitySlots } = capacityFieldsForNewBed(bt);
					for (let i = 0; i < count; i++) {
						await prisma.bed.create({
							data: {
								roomId: createdRoom.id,
								bedType: bt,
								capacity,
								capacitySlots,
								isAvailable: true
							}
						});
					}
				}
			}
		} else {
			// Room structure unchanged, only update metadata (name, photos, maxOccupancy) on existing rooms.
			for (const room of rooms) {
				const existingRoom = (existingTrip?.rooms ?? []).find(
					(r) => r.name === (room.name ?? '')
				);
				if (!existingRoom) continue;
				const roomPhotos = Array.isArray(room.photos) ? room.photos : [];
				const maxOccupancyRoom = parseOptionalInt(
					(room as { maxOccupants?: unknown }).maxOccupants
				);
				await prisma.room.update({
					where: { id: existingRoom.id },
					data: {
						roomType: normalizeRoomTypeFromWizard((room as { roomType?: unknown }).roomType) ?? undefined,
						description:
							typeof room.notes === 'string' && room.notes
								? room.notes
								: typeof room.customRoomDescription === 'string' && room.customRoomDescription
									? room.customRoomDescription
									: undefined,
						photoUrls: roomPhotos.length > 0 ? roomPhotos : undefined,
						maxOccupancy: maxOccupancyRoom ?? undefined
					}
				});
			}
		}

		console.info(`[api/trips/update] success tripId=${tripId}`);
		return json({ success: true, tripId });
	} catch (err) {
		logTripUpdateError(tripId, 'transaction', err);
		const message = err instanceof Error ? err.message : 'Failed to update trip';
		return json({ error: message }, { status: 500 });
	}
};
