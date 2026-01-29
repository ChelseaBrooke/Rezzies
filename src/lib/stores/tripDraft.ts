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

// Activities (itinerary items: manual + nearby search)
export type ActivitySource = 'manual' | 'nearby';
export type ActivityProvider = 'google' | 'yelp' | 'mapbox' | 'ticketmaster';

export interface ActivityCost {
	totalAmount: number;
	currency: string;
	paidBy: 'host' | 'other';
	paidByName?: string;
	splitMethod: 'even_among_attendees';
}

export interface ActivityItem {
	id: string;
	source: ActivitySource;
	provider?: ActivityProvider;
	providerPlaceId?: string;
	title: string;
	category?: string;
	date?: string;
	time?: string;
	durationMins?: number;
	locationName?: string;
	address?: string;
	lat?: number;
	lng?: number;
	linkUrl?: string;
	notes?: string;
	hasCost: boolean;
	cost?: ActivityCost;
}

export interface ActivitiesConfig {
	enabled: boolean;
	allowGuestSuggestions: boolean;
	items: ActivityItem[];
}

export function getDefaultActivitiesConfig(): ActivitiesConfig {
	return {
		enabled: false,
		allowGuestSuggestions: true,
		items: []
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
	// Activities (itinerary: manual + nearby)
	activities?: ActivitiesConfig;
	// Optional cached coords for nearby search
	destinationLat?: number;
	destinationLng?: number;
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
	activities: getDefaultActivitiesConfig()
};

/** Sample draft with all fields filled for "new trip" preview in trip portal */
export function getSampleDraft(): TripDraft {
	const checkIn = new Date();
	checkIn.setDate(checkIn.getDate() + 30);
	const checkOut = new Date(checkIn);
	checkOut.setDate(checkOut.getDate() + 7);
	const pad = (n: number) => String(n).padStart(2, '0');
	const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	return {
		...defaultDraft,
		name: 'Lake House Weekend',
		description: 'A relaxing weekend at the lake with friends. Bring your swimsuit and board games!',
		destinationCity: '123 Lakeshore Dr, Lake Tahoe, CA',
		destinationState: 'CA',
		destinationCountry: 'United States',
		propertyAddress: '123 Lakeshore Dr',
		checkInDate: ymd(checkIn),
		checkOutDate: ymd(checkOut),
		flexibleDates: true,
		expectedGuestCount: 8,
		maxOccupancy: 10,
		bedrooms: 4,
		bathrooms: 3,
		totalTripCost: '2400',
		cleaningFee: '150',
		serviceFee: '0',
		taxes: '0',
		refundableDeposit: '500',
		rooms: [
			{
				id: 'room-1',
				name: 'Master Bedroom',
				roomType: 'master-bedroom',
				customRoomDescription: '',
				type: 'private',
				maxOccupants: 2,
				notes: 'Lake view',
				photos: [],
				beds: [{ id: 'b1', bedType: 'King', count: 1, shared: false, notes: '' }]
			},
			{
				id: 'room-2',
				name: 'Guest Room 1',
				roomType: 'guest-room',
				customRoomDescription: '',
				type: 'private',
				maxOccupants: 2,
				notes: '',
				photos: [],
				beds: [{ id: 'b2', bedType: 'Queen', count: 1, shared: false, notes: '' }]
			},
			{
				id: 'room-3',
				name: 'Bunk Room',
				roomType: 'bedroom',
				customRoomDescription: '',
				type: 'shared',
				maxOccupants: 4,
				notes: 'Kids love it',
				photos: [],
				beds: [
					{ id: 'b3', bedType: 'Twin', count: 2, shared: false, notes: 'Bunk beds' },
					{ id: 'b4', bedType: 'Full', count: 1, shared: false, notes: '' }
				]
			},
			{
				id: 'room-4',
				name: 'Loft',
				roomType: 'other',
				customRoomDescription: 'Sleeping loft',
				type: 'shared',
				maxOccupants: 2,
				notes: '',
				photos: [],
				beds: [{ id: 'b5', bedType: 'Queen', count: 1, shared: false, notes: '' }]
			}
		],
		meals: getDefaultMealsConfig(),
		activities: getDefaultActivitiesConfig()
	};
}

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
				// Normalize activities: if old array format, migrate to new shape
				let activities = defaultDraft.activities;
				if (parsed.activities != null) {
					if (Array.isArray(parsed.activities)) {
						activities = {
							enabled: true,
							allowGuestSuggestions: true,
							items: parsed.activities.map((a: { id?: string; name?: string; description?: string; price?: string; date?: string; time?: string }) => ({
								id: a.id ?? crypto.randomUUID(),
								source: 'manual' as const,
								title: a.name ?? '',
								notes: a.description ?? undefined,
								date: a.date ?? undefined,
								time: a.time ?? undefined,
								hasCost: false,
								...(a.price && !isNaN(parseFloat(a.price)) ? { hasCost: true, cost: { totalAmount: parseFloat(a.price), currency: 'USD', paidBy: 'host' as const, splitMethod: 'even_among_attendees' as const } } : {})
							}))
						};
					} else if (typeof parsed.activities === 'object' && 'items' in parsed.activities) {
						activities = { ...getDefaultActivitiesConfig(), ...parsed.activities };
					}
				}
				set({ ...defaultDraft, ...parsed, meals, activities });
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
