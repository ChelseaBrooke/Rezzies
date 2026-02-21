/** Meal type slot */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
	breakfast: 'Breakfast',
	lunch: 'Lunch',
	dinner: 'Dinner',
	snack: 'Snacks'
};

/** Guest (trip member) with optional profile */
export interface MealGuest {
	id: string;
	name: string;
	email?: string | null;
	dietaryRestrictions?: string | null;
	allergies?: string | null;
}

/** Meal slot from API (MealSlot + derived) */
export interface Meal {
	id: string;
	tripId: string;
	title: string | null;
	mealType: MealType;
	startAt: Date;
	time: string | null;
	description: string | null;
	notes: string | null;
	tags: string[];
	cookIds: string[];
	cooks: MealGuest[];
	attendance: MealAttendance[];
	attendingCount: number;
	optedOutCount: number;
	allergySummary: Record<string, number>;
}

/** Per-guest attendance for one meal */
export interface MealAttendance {
	mealId: string;
	guestId: string;
	guest?: MealGuest;
	optedOut: boolean;
	optOutReason?: string | null;
	dietaryNote?: string | null;
}

/** Coverage slot: one day + one meal type (covered or open) */
export interface MealSlotCoverage {
	date: string;
	mealType: MealType;
	meal: Meal | null;
}

/** Day with list of meals */
export interface DaySection {
	date: string;
	label: string;
	meals: Meal[];
}

export const OPT_OUT_REASONS = [
	{ value: 'allergy', label: 'Allergy / dietary' },
	{ value: 'eating_out', label: 'Eating out' },
	{ value: 'own_food', label: 'Bringing my own' },
	{ value: 'other', label: 'Other' }
] as const;
