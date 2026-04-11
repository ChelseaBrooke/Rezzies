# Tech Debt Register

Captured: 2026-04-11. Update this file as items are resolved or new ones discovered.

---

## Notifications & Messaging

### 1. Nudge notification not implemented
- **File:** `src/routes/trips/[tripId]/guests/+page.server.ts` — `nudgeAllPending` action
- **Status:** Stub — returns success without sending anything
- **What's needed:** Email (or push) to each unresponded trip member via existing email pipeline
- **Priority:** Medium — feature is exposed to hosts in the UI

### 2. Poll non-responder notifications not implemented
- **File:** `src/routes/trips/[tripId]/polls/+page.server.ts` line ~468
- **Status:** Stub — comment says "Send notifications to non-responders via existing pipeline"
- **What's needed:** Hook into the email pipeline used elsewhere (Resend) when a host explicitly triggers a poll reminder
- **Priority:** Medium

### 3. SMS sending not implemented (Twilio)
- **File:** `src/lib/server/invite-service.ts` line ~161
- **Status:** Placeholder comment, no Twilio integration wired up
- **What's needed:** Twilio credentials in env + send logic replacing the TODO
- **Priority:** Low — email invites work; SMS is enhancement

### 4. Bed-removed email template missing
- **File:** `src/lib/server/bed-claims.ts` line ~40
- **Status:** Email not sent when a bed is removed from a guest; template `BED_REMOVED` doesn't exist yet
- **What's needed:** Create email template + wire `sendTemplateEmail('BED_REMOVED', ...)`
- **Priority:** Low — hosts manually communicate this today

---

## Frontend / UI

### 5. Contacts modal on invite step blocked by missing backend
- **File:** `src/routes/trips/new/step/[stepNumber]/Step3.svelte` line ~75
- **Status:** Button does nothing; comment says "open modal or navigate to contacts when backend exists"
- **What's needed:** Contacts/friends API + modal component
- **Priority:** Medium — currently a dead UI element

### 6. `locked` RSVP status not wired from backend
- **File:** `src/lib/trips/types.ts` line ~33
- **Status:** `locked` is mentioned in a TODO but not implemented in DB schema or RSVP status enum
- **What's needed:** Add `locked` to RSVP status enum, migration, and UI handling
- **Priority:** Low — no current user-facing impact

---

## Data Persistence

### 7. Trip games stored in sessionStorage (temporary)
- **File:** `src/lib/stores/tripGames.ts`
- **Status:** Comment explicitly says "Will be replaced by API/database later"
- **What's needed:** `TripGame` model in Prisma schema + API endpoints + migrate store to use API
- **Priority:** High — sessionStorage is cleared on tab close; data loss risk for hosts mid-setup

---

## Resolved

| Date | Item | PR/Commit |
|------|------|-----------|
| 2026-04-11 | Removed deprecated `getAllBedsWithPricing`, `getBedsByRoomId`, `getBedById`, `calculateGuestPrice` stubs from `pricing.ts`; fixed `/api/rooms` to use Prisma data directly | — |
| 2026-04-11 | Extracted `applyBedAssignments` + `parseTripDatesFromForm` helpers from guests `+page.server.ts`; eliminated copy-paste duplication between `assignBeds` and `updateGuestDetails` actions | — |
| 2026-04-11 | Implemented full notification email system: 15 email templates, `notification-service.ts`, `cron-email-service.ts`, `/api/cron/emails` endpoint, wired all event-triggered and time-based emails | — |
| 2026-04-11 | Resolved bed-removed TODO in `bed-claims.ts` — now sends `BED_REMOVED` email via `sendBedRemovedEmails` | — |
