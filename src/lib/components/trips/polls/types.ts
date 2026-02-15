/** Poll display status: open, closing_soon (derived), closed, draft, canceled */
export type PollStatusDisplay = 'open' | 'closing_soon' | 'closed' | 'draft' | 'canceled';

export const POLL_CATEGORIES = ['All', 'Scheduling', 'Meals', 'Activities', 'Rooms/Beds', 'Other'] as const;
export type PollCategory = (typeof POLL_CATEGORIES)[number];

export const SORT_OPTIONS = [
	{ value: 'recent', label: 'Most Recent' },
	{ value: 'ending_soon', label: 'Ending Soon' },
	{ value: 'most_votes', label: 'Most Votes' },
	{ value: 'newest', label: 'Newest' },
	{ value: 'oldest', label: 'Oldest' }
] as const;
export type PollSort = (typeof SORT_OPTIONS)[number]['value'];

export interface PollOptionWithCount {
	id: string;
	label: string;
	sortOrder: number;
	voteCount: number;
}

export interface PollWithMeta {
	id: string;
	title: string;
	description?: string | null;
	category: string;
	pollType: string;
	status: string;
	statusDisplay: PollStatusDisplay;
	showResultsLive: boolean;
	startAt?: Date | string | null;
	endAt?: Date | string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
	createdById: string;
	createdBy?: { id: string; name: string | null; avatarUrl?: string | null } | null;
	options: PollOptionWithCount[];
	totalVotes: number;
	userVoted: boolean;
	userOptionIds: string[];
	/** Humanized: "Ends in 2d" or "Closed 3d ago" */
	timeLabel: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
	All: 'All',
	Scheduling: 'Scheduling',
	Meals: 'Meals',
	Activities: 'Activities',
	'Rooms/Beds': 'Rooms/Beds',
	Other: 'Other'
};

export const CATEGORY_ICONS: Record<string, string> = {
	Scheduling: '📅',
	Meals: '🍽️',
	Activities: '🎯',
	'Rooms/Beds': '🛏️',
	Other: '📋'
};
