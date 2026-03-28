/** Test user credentials and data constants for E2E tests */

export const HOST_USER = {
	email: 'e2e-host@test.divvi.com',
	password: 'TestHost123!',
	name: 'E2E Host',
} as const;

export const GUEST_USER = {
	email: 'e2e-guest@test.divvi.com',
	password: 'TestGuest123!',
	name: 'E2E Guest',
} as const;

// Used by signup tests — a fresh user that gets created and cleaned up per test
export const SIGNUP_USER = {
	email: 'e2e-signup@test.divvi.com',
	password: 'TestSignup123!',
	name: 'E2E Signup',
} as const;

export const TEST_TRIP = {
	name: 'E2E Test Beach House',
	location: 'Malibu, CA',
	totalCost: 5000,
	pricingModel: 'PER_BED',
} as const;

export const TEST_ROOMS = [
	{
		name: 'Master Suite',
		beds: [
			{ bedType: 'king', capacitySlots: 2 },
		],
	},
	{
		name: 'Guest Room',
		beds: [
			{ bedType: 'queen', capacitySlots: 2 },
			{ bedType: 'twin', capacitySlots: 1 },
		],
	},
	{
		name: 'Bunk Room',
		beds: [
			{ bedType: 'bunk', capacitySlots: 1 },
			{ bedType: 'bunk', capacitySlots: 1 },
		],
	},
] as const;

// Prefix used to identify and clean up test data
export const E2E_EMAIL_PREFIX = 'e2e-';
export const E2E_EMAIL_DOMAIN = '@test.divvi.com';
