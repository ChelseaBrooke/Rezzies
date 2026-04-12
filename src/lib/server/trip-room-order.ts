/**
 * Prisma does not guarantee relation row order without explicit `orderBy`.
 * Use on Trip → rooms and Room → beds so lists match creation order everywhere (rooms page, RSVP, pricing, etc.).
 */
export const TRIP_ROOMS_ORDER_BY = { id: 'asc' } as const;
export const ROOM_BEDS_ORDER_BY = { createdAt: 'asc' } as const;
