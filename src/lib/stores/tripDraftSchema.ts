import { z } from 'zod';

const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snacks']);

const mealSlotSchema = z.object({
	id: z.string(),
	date: z.string(),
	mealType: mealTypeSchema,
	title: z.string().optional(),
	notes: z.string().optional(),
	maxVolunteers: z.number().optional(),
	allowCoVolunteers: z.boolean().optional()
});

const mealsConfigSchema = z
	.object({
		enabled: z.boolean(),
		modes: z.object({
			signups: z.boolean(),
			fund: z.boolean(),
			informal: z.boolean()
		}),
		signupConfig: z
			.object({
				slots: z.array(mealSlotSchema),
				allowHostPreassign: z.boolean(),
				includeLunch: z.boolean().optional()
			})
			.optional(),
		fundConfig: z
			.object({
				enabled: z.boolean(),
				contributionStyle: z.enum(['equal', 'custom']),
				totalToSplit: z.string().optional(),
				suggestedContributionPerPerson: z.number().optional(),
				notes: z.string().optional(),
				managers: z.array(z.object({ name: z.string().optional(), email: z.string().optional() }))
			})
			.optional(),
		informalConfig: z
			.object({
				notes: z.string().optional(),
				createPlaceholderSlots: z.boolean().optional(),
				placeholderSlots: z
					.array(
						z.object({
							id: z.string(),
							date: z.string(),
							mealType: mealTypeSchema,
							title: z.string().optional(),
							notes: z.string().optional()
						})
					)
					.optional()
			})
			.optional(),
		preferences: z
			.object({
				dietaryNotes: z.string().optional(),
				collectIndividualPreferencesLater: z.boolean()
			})
			.optional(),
		expectations: z
			.object({
				participationLevel: z.enum(['required', 'optional']),
				allowGuestsToClaimSlots: z.boolean(),
				allowGuestsToContributeInstead: z.boolean(),
				allowOptOut: z.boolean()
			})
			.optional()
	})
	.superRefine((data, ctx) => {
		if (!data.enabled) return;
		const { modes } = data;
		if (!modes.signups && !modes.fund && !modes.informal) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'At least one meal setup style must be selected',
				path: ['modes']
			});
		}
		if (modes.fund && data.fundConfig) {
			if (!data.fundConfig.contributionStyle) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Contribution style is required when using shared food fund',
					path: ['fundConfig', 'contributionStyle']
				});
			}
		}
	});

export type MealsConfigSchema = z.infer<typeof mealsConfigSchema>;
export { mealsConfigSchema };

// Activities
const activityCostSchema = z.object({
	totalAmount: z.number(),
	currency: z.string(),
	paidBy: z.enum(['host', 'other']),
	paidByName: z.string().optional(),
	splitMethod: z.literal('even_among_attendees')
});

const activityItemSchema = z.object({
	id: z.string(),
	source: z.enum(['manual', 'nearby']),
	provider: z.enum(['google', 'yelp', 'mapbox', 'ticketmaster']).optional(),
	providerPlaceId: z.string().optional(),
	title: z.string(),
	category: z.string().optional(),
	date: z.string().optional(),
	time: z.string().optional(),
	durationMins: z.number().optional(),
	locationName: z.string().optional(),
	address: z.string().optional(),
	lat: z.number().optional(),
	lng: z.number().optional(),
	linkUrl: z.string().optional(),
	notes: z.string().optional(),
	hasCost: z.boolean(),
	cost: activityCostSchema.optional()
});

export const activitiesConfigSchema = z
	.object({
		enabled: z.boolean(),
		allowGuestSuggestions: z.boolean(),
		items: z.array(activityItemSchema)
	})
	.superRefine((data, ctx) => {
		if (!data.enabled) return;
		for (let i = 0; i < data.items.length; i++) {
			const item = data.items[i];
			if (item.hasCost && item.cost) {
				if (item.cost.totalAmount <= 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Total amount must be greater than 0 when activity has cost',
						path: ['items', i, 'cost', 'totalAmount']
					});
				}
				if (!item.cost.paidBy) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Paid by is required when activity has cost',
						path: ['items', i, 'cost', 'paidBy']
					});
				}
			}
		}
	});

export type ActivitiesConfigSchema = z.infer<typeof activitiesConfigSchema>;
