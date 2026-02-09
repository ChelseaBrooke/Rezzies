import { z } from 'zod';

// Guest submission validation
export const guestSubmissionSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	email: z.string().email('Invalid email address'),
	roomId: z.number().int().positive(),
	bedId: z.string().uuid('Invalid bed ID'),
	checkInDate: z.coerce.date(),
	checkOutDate: z.coerce.date(),
	nights: z.number().int().positive(),
	calculatedPrice: z.number().positive()
}).refine((data) => data.checkOutDate > data.checkInDate, {
	message: 'Check-out date must be after check-in date',
	path: ['checkOutDate']
});

export type GuestSubmissionInput = z.infer<typeof guestSubmissionSchema>;

// Trip creation validation
export const tripCreationSchema = z.object({
	name: z.string().min(1, 'Trip name is required').max(200),
	description: z.string().max(1000).optional(),
	listingUrl: z.preprocess(
		(val) => (val === '' || val === null ? undefined : val),
		z.string().url('Invalid URL').optional()
	),
	listingTitle: z.string().optional(),
	listingCoverPhoto: z.string().optional(),
	checkInDate: z.coerce.date(),
	checkOutDate: z.coerce.date(),
	totalCost: z.number().positive('Total cost must be positive'),
	pricingModel: z.enum(['PER_ROOM', 'PER_BED', 'PER_PERSON', 'PER_PERSON_PER_NIGHT']),
	expectedPeopleCount: z.number().int().positive().optional(),
	maxGuests: z.number().int().positive().optional(),
	allowPartialStays: z.boolean().default(false),
	bedWeights: z.string().optional(), // JSON string
	sharingExponentAlpha: z.number().min(0.3).max(0.9).default(0.60),
	privacyPremiumP: z.number().min(0).max(0.25).default(0.00)
}).refine((data) => data.checkOutDate > data.checkInDate, {
	message: 'Check-out date must be after check-in date',
	path: ['checkOutDate']
});

export type TripCreationInput = z.infer<typeof tripCreationSchema>;

// Room creation validation
export const roomCreationSchema = z.object({
	tripId: z.string().uuid(),
	name: z.string().min(1, 'Room name is required').max(200),
	description: z.string().max(500).optional(),
	maxOccupancy: z.number().int().positive().optional()
});

export type RoomCreationInput = z.infer<typeof roomCreationSchema>;

// Bed creation validation
export const bedCreationSchema = z.object({
	roomId: z.number().int().positive(),
	bedType: z.string().min(1, 'Bed type is required'),
	capacity: z.number().int().positive().default(1),
	capacitySlots: z.number().int().positive().default(1)
});

export type BedCreationInput = z.infer<typeof bedCreationSchema>;

// Reservation validation (updated for new schema)
export const reservationSchema = z.object({
	tripId: z.string().uuid(),
	name: z.string().min(1, 'Name is required').max(200),
	email: z.string().email('Invalid email address'),
	roomId: z.number().int().positive(),
	bedId: z.string().uuid().optional(),
	numberOfGuests: z.number().int().positive().default(1),
	numberOfSlots: z.number().int().positive().default(1),
	checkInDate: z.coerce.date(),
	checkOutDate: z.coerce.date()
}).refine((data) => data.checkOutDate > data.checkInDate, {
	message: 'Check-out date must be after check-in date',
	path: ['checkOutDate']
});

export type ReservationInput = z.infer<typeof reservationSchema>;

// Standard error response shape
export interface ApiError {
	ok: false;
	code: string;
	message: string;
	details?: unknown;
}

export interface ApiSuccess<T = unknown> {
	ok: true;
	data?: T;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export function createErrorResponse(
	code: string,
	message: string,
	details?: unknown
): ApiError {
	return { ok: false, code, message, details };
}

export function createSuccessResponse<T>(data?: T): ApiSuccess<T> {
	return { ok: true, data };
}

