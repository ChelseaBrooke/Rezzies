/**
 * Human-readable room category for RSVP / listing UI.
 * `roomType` comes from the trip wizard when published; older rows may be null.
 */

const LABELS: Record<string, string> = {
	bedroom: 'Bedroom',
	'living-room': 'Living room',
	kitchen: 'Kitchen',
	bathroom: 'Bathroom',
	'dining-room': 'Dining room',
	office: 'Office',
	'guest-room': 'Guest room',
	'master-bedroom': 'Master bedroom',
	other: 'Other space'
};

/** CSS-safe modifier for placeholder styling (e.g. hotel-room-photo-placeholder--bedroom). */
export function roomTypeCssSlug(roomType: string | null | undefined): string {
	const t = (roomType ?? '').toLowerCase().trim().replace(/\s+/g, '-');
	if (!t) return 'unknown';
	return t.replace(/[^a-z0-9-]/g, '') || 'unknown';
}

export function roomTypeDisplayLabel(room: {
	roomType?: string | null;
	beds?: readonly unknown[] | null;
}): string {
	const rt = room.roomType?.toLowerCase().trim();
	if (rt && LABELS[rt]) return LABELS[rt];
	if (rt) {
		return rt
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}
	if ((room.beds?.length ?? 0) > 0) return 'Bedroom';
	return 'Room';
}

export function normalizeRoomTypeFromWizard(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	const t = v.trim().toLowerCase();
	return t || null;
}
