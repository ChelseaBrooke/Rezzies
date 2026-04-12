/** Display name for trip member list rows (name, else email). */
export function tripMemberDisplayName(user: { name?: string | null; email?: string | null } | null | undefined): string {
	const n = user?.name?.trim();
	if (n) return n;
	const e = user?.email?.trim();
	if (e) return e;
	return '';
}

type HostMemberLike = {
	role?: string | null;
	user?: { name?: string | null; email?: string | null } | null;
};

/**
 * "Hosted by Pat", "Hosted by Pat and Sam", "Hosted by Pat, Sam, and Alex" (Oxford comma).
 * Order: primary host first, then co-hosts A→Z by display name.
 */
export function formatHostedByLine(members: HostMemberLike[] | null | undefined): string | null {
	if (!members?.length) return null;
	const ordered: string[] = [];
	const seen = new Set<string>();

	for (const m of members) {
		if (m.role !== 'host') continue;
		const d = tripMemberDisplayName(m.user);
		if (d && !seen.has(d)) {
			seen.add(d);
			ordered.push(d);
		}
	}

	const cohostNames = members
		.filter((m) => m.role === 'co-host')
		.map((m) => tripMemberDisplayName(m.user))
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

	for (const d of cohostNames) {
		if (!seen.has(d)) {
			seen.add(d);
			ordered.push(d);
		}
	}

	if (ordered.length === 0) return null;
	if (ordered.length === 1) return `Hosted by ${ordered[0]}`;
	if (ordered.length === 2) return `Hosted by ${ordered[0]} and ${ordered[1]}`;
	return `Hosted by ${ordered.slice(0, -1).join(', ')}, and ${ordered[ordered.length - 1]}`;
}
