/** @param {string} tripId @param {string} householdId @param {string} [origin] */
export function generateHouseholdLink(tripId, householdId, origin) {
	const path = `/trips/${encodeURIComponent(tripId)}/join/household/${encodeURIComponent(householdId)}`;
	if (!origin) return path;
	return `${origin.replace(/\/$/, '')}${path}`;
}
