import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface MealSlot {
	id: string;
	date: string;
	mealType: MealType;
	title?: string;
	notes?: string;
	maxVolunteers?: number;
	allowCoVolunteers?: boolean;
}

export interface MealsConfig {
	enabled: boolean;
	modes: {
		signups: boolean;
		fund: boolean;
		informal: boolean;
	};
	signupConfig?: {
		slots: MealSlot[];
		allowHostPreassign: boolean;
		includeLunch?: boolean;
	};
	fundConfig?: {
		enabled: boolean;
		contributionStyle: 'equal' | 'custom';
		suggestedContributionPerPerson?: number;
		notes?: string;
		managers: Array<{ name?: string; email?: string }>;
	};
	informalConfig?: {
		notes?: string;
		createPlaceholderSlots?: boolean;
		placeholderSlots?: Array<{
			id: string;
			date: string;
			mealType: MealType;
			title?: string;
			notes?: string;
		}>;
	};
	preferences?: {
		dietaryNotes?: string;
		collectIndividualPreferencesLater: boolean;
	};
	expectations?: {
		participationLevel: 'required' | 'optional';
		allowGuestsToClaimSlots: boolean;
		allowGuestsToContributeInstead: boolean;
		allowOptOut: boolean;
	};
}

export function getDefaultMealsConfig(): MealsConfig {
	return {
		enabled: false,
		modes: { signups: true, fund: false, informal: false },
		signupConfig: { slots: [], allowHostPreassign: false, includeLunch: false },
		fundConfig: {
			enabled: false,
			contributionStyle: 'equal',
			managers: []
		},
		informalConfig: { createPlaceholderSlots: false, placeholderSlots: [] },
		preferences: { collectIndividualPreferencesLater: true },
		expectations: {
			participationLevel: 'optional',
			allowGuestsToClaimSlots: true,
			allowGuestsToContributeInstead: true,
			allowOptOut: true
		}
	};
}

export interface TripDraft {
	// Step 1: Basics & Source
	name: string;
	description: string;
	visibility: 'private' | 'invite-only';
	sourceType: 'airbnb' | 'vrbo' | 'manual';
	listingUrl: string;
	scrapeStatus: 'idle' | 'scraping' | 'connected' | 'error';
	
	// Step 2: Location, Dates & Media
	destinationCity: string;
	destinationState: string;
	destinationCountry: string;
	propertyAddress: string;
	checkInDate: string;
	checkOutDate: string;
	flexibleDates: boolean;
	coverPhoto: string;
	galleryPhotos: string[];
	
	// Step 3: Property Structure
	maxOccupancy: number;
	expectedGuestCount: number;
	bedrooms: number;
	bathrooms: number;
	rooms: Array<{
		id: string;
		name: string;
		roomType: 'bedroom' | 'living-room' | 'kitchen' | 'bathroom' | 'dining-room' | 'office' | 'guest-room' | 'master-bedroom' | 'other';
		customRoomDescription: string;
		type: 'private' | 'shared';
		maxOccupants: number;
		notes: string;
		photos: string[];
		beds: Array<{
			id: string;
			bedType: string;
			count: number;
			shared: boolean;
			notes: string;
		}>;
	}>;
	
	// Step 4: Pricing & Capacity Rules
	totalTripCost: string;
	cleaningFee: string;
	serviceFee: string;
	taxes: string;
	refundableDeposit: string;
	customLineItems: Array<{ label: string; amount: string }>;
	pricingModel: 'per-person' | 'per-room' | 'per-bed' | 'hybrid';
	pricingType: 'per-night' | 'flat';
	partialStayAllowed: boolean;
	prorationRule: string;
	minimumPayment: string;
	maxGuestsPerRoom: number;
	maxGuestsPerBed: number;
	couplesAllowed: boolean;
	childrenAllowed: boolean;
	genderRestrictions: string;
	
	// Step 5: Payments, Invites & Policies
	paymentDueDates: Array<{ date: string; amount: string }>;
	installmentsEnabled: boolean;
	installmentSchedule: Array<{ date: string; amount: string }>;
	refundPolicy: string;
	cancellationCutoffDate: string;
	latePaymentHandling: string;
	inviteMethod: 'email' | 'link' | 'both';
	guests: Array<{ name: string; email: string; role: 'guest' | 'co-host' }>;
	inviteMessage: string;
	rsvpDeadline: string;
	autoReminders: boolean;
	sendInvitesNow: boolean;
	houseRules: string;
	quietHours: string;
	petPolicy: string;
	smokingPolicy: string;
	checkInInstructions: string;
	checkOutInstructions: string;
	accessibilityNotes: string;
	
	// Meals (optional structured config)
	meals?: MealsConfig;
	// Legacy / other
	activities?: Array<{ id: string; name: string; description: string; price: string; date: string; time: string }>;
}

const defaultDraft: TripDraft = {
	name: '',
	description: '',
	visibility: 'invite-only',
	sourceType: 'manual',
	listingUrl: '',
	scrapeStatus: 'idle',
	destinationCity: '',
	destinationState: '',
	destinationCountry: '',
	propertyAddress: '',
	checkInDate: '',
	checkOutDate: '',
	flexibleDates: false,
	coverPhoto: '',
	galleryPhotos: [],
	maxOccupancy: 0,
	expectedGuestCount: 0,
	bedrooms: 0,
	bathrooms: 0,
	rooms: [],
	totalTripCost: '',
	cleaningFee: '',
	serviceFee: '',
	taxes: '',
	refundableDeposit: '',
	customLineItems: [],
	pricingModel: 'per-person',
	pricingType: 'per-night',
	partialStayAllowed: false,
	prorationRule: 'proportional',
	minimumPayment: '',
	maxGuestsPerRoom: 0,
	maxGuestsPerBed: 0,
	couplesAllowed: true,
	childrenAllowed: true,
	genderRestrictions: '',
	paymentDueDates: [],
	installmentsEnabled: false,
	installmentSchedule: [],
	refundPolicy: '',
	cancellationCutoffDate: '',
	latePaymentHandling: 'reminder',
	inviteMethod: 'both',
	guests: [],
	inviteMessage: '',
	rsvpDeadline: '',
	autoReminders: true,
	sendInvitesNow: false,
	houseRules: '',
	quietHours: '',
	petPolicy: '',
	smokingPolicy: '',
	checkInInstructions: '',
	checkOutInstructions: '',
	accessibilityNotes: '',
	meals: getDefaultMealsConfig(),
	activities: []
};

const STORAGE_KEY = 'trip-draft';

function createTripDraftStore() {
	const { subscribe, set, update } = writable<TripDraft>(defaultDraft);
	
	// Load from localStorage on init
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				// Normalize meals: if old array format, use default meals config
				const meals = Array.isArray(parsed.meals)
					? getDefaultMealsConfig()
					: parsed.meals && typeof parsed.meals === 'object' && 'enabled' in parsed.meals
						? { ...getDefaultMealsConfig(), ...parsed.meals }
						: defaultDraft.meals;
				set({ ...defaultDraft, ...parsed, meals });
			} catch (e) {
				console.error('Failed to load trip draft from localStorage:', e);
			}
		}
	}
	
	return {
		subscribe,
		set,
		update,
		save: (draft: TripDraft) => {
			if (browser) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
			}
			set(draft);
		},
		clear: () => {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			set(defaultDraft);
		}
	};
}

export const tripDraft = createTripDraftStore();
