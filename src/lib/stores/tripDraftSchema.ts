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
