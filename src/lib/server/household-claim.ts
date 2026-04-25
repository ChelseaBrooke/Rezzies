import { prisma } from './prisma.js';

export const HOUSEHOLD_CLAIM_COOKIE = 'divvi_household_claim';
export const HOUSEHOLD_CLAIM_MAX_AGE = 60 * 30; // 30 min

export type HouseholdClaimPayload = {
	v: 1;
	householdMemberId: string;
	householdId: string;
	tripId: string;
};

function parseNameParts(full: string | null | undefined): { first: string; rest: string } {
	if (!full?.trim()) return { first: '', rest: '' };
	const p = full.trim().split(/\s+/);
	if (p.length === 1) return { first: p[0].toLowerCase(), rest: '' };
	return { first: p[0].toLowerCase(), rest: p.slice(1).join(' ').toLowerCase() };
}

/**
 * After merge, detect similar existing trip member and notify host for review.
 * // TODO: build host duplicate resolution UI
 */
async function flagDuplicateNameForHostReview(params: {
	tripId: string;
	householdMemberId: string;
	newUserId: string;
	newName: string;
}): Promise<void> {
	const { tripId, householdMemberId, newUserId, newName } = params;
	const members = await prisma.tripMember.findMany({
		where: { tripId, inviteStatus: 'approved', userId: { not: newUserId } },
		include: { user: { select: { id: true, name: true, email: true } } }
	});
	const mine = (newName || '').trim().toLowerCase();
	if (!mine) return;
	for (const m of members) {
		const their = (m.user?.name || m.user?.email || '').trim().toLowerCase();
		if (!their || m.userId === newUserId) continue;
		const close =
			(their.length >= 3 && (mine.includes(their.slice(0, 3)) || their.includes(mine.slice(0, 3)))) ||
			levenshtein(mine, their) <= 2;
		if (close) {
			const host = await prisma.tripMember.findFirst({
				where: { tripId, role: 'host' },
				select: { userId: true }
			});
			if (host) {
				// TODO: notify host — duplicate name review
				await prisma.notification
					.create({
						data: {
							userId: host.userId,
							type: 'household_duplicate_review',
							title: 'Possible duplicate guest',
							message: `A guest may overlap with an existing name on the trip. Review the guest list.`,
							relatedTripId: tripId,
							relatedEntityId: householdMemberId
						}
					})
					.catch(() => {});
			}
			return;
		}
	}
}

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	if (!m) return n;
	if (!n) return m;
	const row = Array(n + 1);
	for (let j = 0; j <= n; j++) row[j] = j;
	for (let i = 1; i <= m; i++) {
		let prev = row[0];
		row[0] = i;
		for (let j = 1; j <= n; j++) {
			const t = a[i - 1] === b[j - 1] ? prev : prev + 1;
			prev = row[j];
			row[j] = Math.min(t, row[j] + 1, row[j - 1] + 1);
		}
	}
	return row[n]!;
}

/**
 * Link an authenticated user to a HouseholdMember, grant trip access, merge RSVP surface.
 */
export async function mergeHouseholdProxyToUser(params: {
	householdMemberId: string;
	userId: string;
	userName: string | null;
}): Promise<{ tripId: string; householdId: string; firstName: string; tripName: string }> {
	const { householdMemberId, userId, userName } = params;
	const member = await prisma.householdMember.findUnique({
		where: { id: householdMemberId },
		include: {
			household: {
				include: {
					trip: { select: { id: true, name: true, inviteMode: true } },
					primary: { select: { id: true, name: true } }
				}
			}
		}
	});
	if (!member) throw new Error('Invalid household member');
	if (member.userId && member.userId !== userId) throw new Error('This spot is already linked to an account');
	if (member.accountStatus === 'active' && member.userId === userId) {
		return {
			tripId: member.household.tripId,
			householdId: member.householdId,
			firstName: member.firstName,
			tripName: member.household.trip.name
		};
	}
	if (member.ageGroup === 'child') throw new Error('Invalid member');

	const tripId = member.household.tripId;
	const status = member.household.trip.inviteMode === 'open' ? 'approved' : 'approved';

	await prisma.$transaction([
		prisma.householdMember.update({
			where: { id: householdMemberId },
			data: { userId, accountStatus: 'active' }
		}),
		prisma.tripMember.upsert({
			where: { tripId_userId: { tripId, userId } },
			create: { tripId, userId, role: 'guest', inviteStatus: status },
			update: { inviteStatus: 'approved' }
		})
	]);

	await flagDuplicateNameForHostReview({
		tripId,
		householdMemberId,
		newUserId: userId,
		newName: userName || member.firstName
	});

	// TODO: notify host: "[Name] claimed their spot from [Primary]'s household."
	// TODO: notify primary member
	const displayName = userName || member.firstName;

	return { tripId, householdId: member.householdId, firstName: displayName, tripName: member.household.trip.name };
}

/** Fuzzy: whether logged-in user display name plausibly matches a proxy first name. */
export function preselectProxyMemberId(
	unclaimed: { id: string; firstName: string; lastName: string | null }[],
	displayName: string | null
): string | null {
	if (!unclaimed.length || !displayName?.trim()) return null;
	const { first: ufirst } = parseNameParts(displayName);
	if (!ufirst) return null;
	let best: { id: string; score: number } | null = null;
	for (const m of unclaimed) {
		const t = m.firstName.trim().toLowerCase();
		if (t === ufirst) return m.id;
		if (t.startsWith(ufirst) || ufirst.startsWith(t)) {
			const score = Math.min(t.length, ufirst.length) / Math.max(t.length, ufirst.length);
			if (!best || score > best.score) best = { id: m.id, score };
		}
	}
	if (best && best.score > 0.5) return best.id;
	return null;
}

export function firstNameFromUserName(name: string | null | undefined): string {
	if (!name?.trim()) return '';
	return name.trim().split(/\s+/)[0] ?? '';
}
