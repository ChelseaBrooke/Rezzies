export interface TooltipDef {
	key: string;
	title: string;
	body: string;
	role: 'host' | 'guest' | 'both';
	position: 'top' | 'bottom' | 'left' | 'right';
	align?: 'start' | 'center' | 'end';
}

export const HOST_TOOLTIPS: TooltipDef[] = [
	{
		key: 'host_mode_selector',
		title: 'Switch views',
		body: 'Toggle between Planning, Vacation, and Recap modes as your trip progresses.',
		role: 'host',
		position: 'bottom',
		align: 'center'
	},
	{
		key: 'host_quick_actions',
		title: 'Quick actions',
		body: 'Invite guests, share your trip link, add to calendar, or get directions\u2014all in one spot.',
		role: 'host',
		position: 'bottom',
		align: 'center'
	},
	{
		key: 'host_progress',
		title: 'Track your progress',
		body: 'These rings show how your trip is coming together\u2014RSVPs, beds, rooms, and trip info.',
		role: 'host',
		position: 'right',
		align: 'start'
	},
	{
		key: 'host_capacity_card',
		title: 'Fill spots, lower the price',
		body: 'As more guests RSVP, everyone\u2019s share drops. Invite more to unlock the best rate.',
		role: 'host',
		position: 'top',
		align: 'center'
	},
	{
		key: 'host_trip_info',
		title: 'Add trip details',
		body: 'Fill in check-in times, parking, and house rules so guests know what to expect.',
		role: 'host',
		position: 'top',
		align: 'center'
	},
	{
		key: 'host_recent_activity',
		title: 'Stay in the loop',
		body: 'See who RSVPed, new activities, polls, and games\u2014all in real time.',
		role: 'host',
		position: 'left',
		align: 'start'
	},
	{
		key: 'host_polls',
		title: 'Polls',
		body: 'Create polls to let your group vote on activities, restaurants, or anything else.',
		role: 'host',
		position: 'bottom',
		align: 'center'
	},
	{
		key: 'host_guests_preview',
		title: 'Your guest list',
		body: "See who\u2019s coming at a glance. Tap \u2018Nudge pending\u2019 to remind undecided guests.",
		role: 'host',
		position: 'top',
		align: 'center'
	}
];

export const GUEST_TOOLTIPS: TooltipDef[] = [
	{
		key: 'guest_mode_selector',
		title: 'Switch views',
		body: 'Toggle between Planning, Vacation, and Recap as your trip progresses.',
		role: 'guest',
		position: 'bottom',
		align: 'center'
	},
	{
		key: 'guest_rsvp_card',
		title: 'Your RSVP',
		body: 'See your trip details, room assignment, and what you owe at a glance.',
		role: 'guest',
		position: 'right',
		align: 'start'
	},
	{
		key: 'guest_trip_info',
		title: 'Trip details',
		body: 'Find check-in times, parking info, and house rules your host has shared.',
		role: 'guest',
		position: 'top',
		align: 'center'
	},
	{
		key: 'guest_recent_activity',
		title: "What\u2019s new",
		body: 'Keep up with new activities, polls, and who else is joining.',
		role: 'guest',
		position: 'left',
		align: 'start'
	},
	{
		key: 'guest_polls',
		title: 'Vote on plans',
		body: 'Your host created polls\u2014tap to vote and help shape the trip.',
		role: 'guest',
		position: 'bottom',
		align: 'center'
	}
];

export const ALL_TOOLTIPS = [...HOST_TOOLTIPS, ...GUEST_TOOLTIPS];

export function getTooltip(key: string): TooltipDef | undefined {
	return ALL_TOOLTIPS.find((t) => t.key === key);
}
