/** Travel style options for profile and signup */
export const TRAVEL_STYLE_OPTIONS = [
	'Up at 6am',
	'A backpack and a dream',
	'Captain Color-code',
	'Booked everything months ago',
	'Overpacker',
	'Just here for the vibes',
	'Group photographer',
	'Sleeps past brunch',
	'Vibes curator',
	'"We\'ll figure it out"',
	'Group accountant',
	'Sidequester',
	'Group chauffeur'
] as const;

export type TravelStyleOption = (typeof TRAVEL_STYLE_OPTIONS)[number];

export function isValidTravelStyle(value: string): value is TravelStyleOption {
	return (TRAVEL_STYLE_OPTIONS as readonly string[]).includes(value);
}
