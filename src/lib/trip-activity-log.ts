/**
 * Build activity log entries from trip data (and TripActivity records).
 * Used by Host and Guest dashboards for Recent activity card and activity log modal.
 */

export interface ActivityLogEntry {
	text: string;
	at: Date;
}

function fmtDate(d: Date | string): string {
	const date = typeof d === 'string' ? new Date(d) : d;
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function mealLabel(mealType: string): string {
	return mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
}

function rsvpStatusLabel(status: string): string {
	if (status === 'yes') return 'Going';
	if (status === 'no') return 'No';
	if (status === 'maybe') return 'Maybe';
	return status;
}

/** Within 2 seconds = same "action" (treat as submit not edit) */
function isSameEvent(createdAt: Date, updatedAt: Date): boolean {
	return Math.abs(updatedAt.getTime() - createdAt.getTime()) < 2000;
}

export interface TripForActivityLog {
	rsvps?: Array<{
		user?: { name: string | null } | null;
		status: string;
		createdAt: Date | string;
		updatedAt: Date | string;
	}>;
	roomAssignments?: Array<{
		user?: { name: string | null } | null;
		room?: { name: string | null } | null;
		partySize?: number;
		bedType?: string | null;
		createdAt: Date | string;
		updatedAt: Date | string;
	}>;
	mealSlots?: Array<{
		mealType: string;
		date: Date | string;
		time?: string | null;
		createdAt: Date | string;
		updatedAt: Date | string;
	}>;
	activities?: Array<{
		title: string;
		date: Date | string;
		participants?: Array<{
			user?: { name: string | null } | null;
			createdAt: Date | string;
		}>;
		createdAt: Date | string;
		updatedAt: Date | string;
	}>;
	invites?: Array<{
		invitedBy?: { name: string | null } | null;
		recipient?: { name: string | null } | null;
		recipientEmail?: string | null;
		createdAt: Date | string;
	}>;
	tripActivities?: Array<{
		summary: string;
		createdAt: Date | string;
	}>;
}

export function buildTripActivityLog(trip: TripForActivityLog | null | undefined): ActivityLogEntry[] {
	if (!trip) return [];

	const items: ActivityLogEntry[] = [];

	// RSVP submitted / updated / withdrawn (we only have current state: one line per RSVP)
	(trip.rsvps ?? []).forEach((r) => {
		const name = r.user?.name ?? 'Someone';
		const label = rsvpStatusLabel(r.status);
		const created = new Date(r.createdAt);
		const updated = new Date(r.updatedAt);
		if (r.status === 'no') {
			items.push({ text: `${name} declined`, at: updated });
		} else if (isSameEvent(created, updated)) {
			items.push({ text: `${name} submitted RSVP (${label})`, at: created });
		} else {
			items.push({ text: `${name} updated RSVP (${label})`, at: updated });
		}
	});

	// Room claimed / room changed; Bed claimed (bedType); Party size updated
	(trip.roomAssignments ?? []).forEach((a) => {
		const name = a.user?.name ?? 'Someone';
		const roomName = a.room?.name ?? 'room';
		const created = new Date(a.createdAt);
		const updated = new Date(a.updatedAt);
		const partySize = a.partySize ?? 1;

		// Room claimed (and bed if bedType)
		items.push({
			text: a.bedType
				? `${name} claimed ${roomName} (${a.bedType})`
				: `${name} claimed ${roomName}`,
			at: created
		});
		if (!isSameEvent(created, updated)) {
			items.push({
				text: `${name} changed room to ${roomName}`,
				at: updated
			});
			if (partySize > 1) {
				items.push({
					text: `${name} set party size to ${partySize}${partySize === 2 ? ' (bringing +1)' : ` (bringing +${partySize - 1})`}`,
					at: updated
				});
			}
		}
	});

	// Meal added / edited (date, timeslot, title = meal type)
	(trip.mealSlots ?? []).forEach((m) => {
		const created = new Date(m.createdAt);
		const updated = new Date(m.updatedAt);
		const dateStr = fmtDate(m.date);
		const timePart = m.time ? `, ${m.time}` : '';
		const label = mealLabel(m.mealType);

		items.push({
			text: `Meal added: ${label} [${dateStr}${timePart}]`,
			at: created
		});
		if (!isSameEvent(created, updated)) {
			items.push({
				text: `Meal edited: ${label} [${dateStr}${timePart}]`,
				at: updated
			});
		}
	});

	// Activity added / edited (date, title)
	(trip.activities ?? []).forEach((act) => {
		const created = new Date(act.createdAt);
		const updated = new Date(act.updatedAt);
		const dateStr = fmtDate(act.date);

		items.push({
			text: `Activity "${act.title}" added (${dateStr})`,
			at: created
		});
		if (!isSameEvent(created, updated)) {
			items.push({
				text: `Activity "${act.title}" edited (${dateStr})`,
				at: updated
			});
		}
	});

	// [Name] RSVP'd for [Activity name] (date)
	(trip.activities ?? []).forEach((act) => {
		const dateStr = fmtDate(act.date);
		(act.participants ?? []).forEach((p) => {
			const name = p.user?.name ?? 'Someone';
			items.push({
				text: `${name} RSVP'd for ${act.title} (${dateStr})`,
				at: new Date(p.createdAt)
			});
		});
	});

	// Guest invited by another guest
	(trip.invites ?? []).forEach((inv) => {
		const inviter = inv.invitedBy?.name ?? 'Someone';
		const recipient = inv.recipient?.name ?? inv.recipientEmail ?? 'a guest';
		items.push({
			text: `${inviter} invited ${recipient}`,
			at: new Date(inv.createdAt)
		});
	});

	// TripActivity (poll created, photo added, etc.)
	(trip.tripActivities ?? []).forEach((ta) => {
		items.push({
			text: ta.summary,
			at: new Date(ta.createdAt)
		});
	});

	// Sort newest first
	items.sort((a, b) => b.at.getTime() - a.at.getTime());
	return items;
}
