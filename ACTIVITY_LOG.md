# Activity log – what gets captured

The **Recent activity** card shows the last **10** items. Clicking **View activity log** opens a modal on the same screen with **all** activity, sorted newest first, with **date and time** on each line; the list is scrollable.

Activity is built in `src/lib/trip-activity-log.ts` from trip data (and optional `TripActivity` records).

## Currently captured

| # | Event | Source | Display example |
|---|--------|--------|------------------|
| 1 | **RSVP submitted** | `rsvps` (createdAt ≈ updatedAt) | "Jane submitted RSVP (Going / Maybe / No)" |
| 2 | **RSVP updated** | `rsvps` (updatedAt > createdAt) | "Jane updated RSVP (Going / Maybe / No)" |
| 3 | **RSVP declined** | `rsvps` (status = no) | "Jane declined" |
| 4 | **Party size updated** | `roomAssignments` (partySize, updatedAt) | "Jane set party size to 2 (bringing +1)" |
| 5 | **Room claimed** | `roomAssignments` (createdAt) | "Jane claimed Master Bedroom" |
| 6 | **Room changed** | `roomAssignments` (updatedAt when changed) | "Jane changed room to Guest Room" |
| 7 | **Bed claimed** | `roomAssignments` (bedType) | "Jane claimed Master Bedroom (queen)" |
| 8 | **Meal added** | `mealSlots` (createdAt) | "Meal Dinner added (Jan 15, 6:00 PM)" |
| 9 | **Meal edited** | `mealSlots` (updatedAt when edited) | "Meal Dinner edited (Jan 15, 6:00 PM)" |
| 10 | **Activity added** | `activities` (createdAt) | "Activity \"Hike\" added (Jan 16)" |
| 11 | **Activity edited** | `activities` (updatedAt when edited) | "Activity \"Hike\" edited (Jan 16)" |
| 12 | **Activity RSVP** | `ActivityParticipant` | "Jane RSVP'd for Hike (Jan 16)" |
| 13 | **Guest invited** | `invites` (invitedBy + recipient) | "Jane invited john@example.com" |
| 14 | **TripActivity** | `tripActivities` | Poll created/edited/deleted/closed, Photo added to gallery, etc. (when you insert records) |

**Note:** Meal/Activity **deleted** and **RSVP withdrawn** (was Going → then No) are not distinguishable from current state alone; Poll and Photo events appear when you write to the `TripActivity` table from your poll/photo features.

## Adding Poll / Photo / custom events

Insert into `TripActivity` when the action happens:

```ts
await prisma.tripActivity.create({
  data: {
    tripId,
    type: 'poll_created',  // or 'photo_added', etc.
    summary: 'Jane created a poll: "Best dinner night?"'
  }
});
```

The activity log modal will show `summary` with the stored `createdAt`.
