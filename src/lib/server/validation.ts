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

// Admin login validation
export const adminLoginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(1, 'Password is required')
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

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

