# Divvi – Product & Flows Reference (AI Test Bot)

This document describes everything Divvi does: pages, flows, API endpoints, form actions, and key behaviors so an AI test bot can exercise all user journeys and edge cases.

---

## 1. What Divvi Is

**Divvi** is a web app for **fair room and cost splitting for group vacations**. Tagline: *When price depends on headcount, but headcount depends on price, you can depend on divvi.*

- **Hosts** create trips (property, dates, rooms, beds, pricing), invite guests, and manage RSVPs, room assignments, activities, polls, games, files, and trip settings.
- **Guests** find trips via invite code or invite link, join trips, RSVP (yes/no), claim beds, see cost estimates, and use trip features (activities, polls, meals, itinerary, games, messages).
- **Public (unauthenticated)** users can open a trip by invite code, see room selection, and submit a reservation (name, email, room, bed, dates); they get a confirmation page and optional signup.

---

## 2. Tech Stack (Relevant for Testing)

- **Framework:** SvelteKit (SSR + client).
- **Auth:** Session cookie (`user_session`); no JWT in normal browser flows.
- **DB:** PostgreSQL via Prisma.
- **Storage:** Supabase Storage for images and trip files (optional; uploads fail gracefully if not configured).
- **Email:** Resend (HTML rendered in-app: guest confirmation, trip invites); optional.
- **APIs:** REST-style under `/api/`. Form actions use `?/actionName` on page URLs.

---

## 3. Routes & Pages (Sitemap)

| Path | Description | Auth |
|------|-------------|------|
| `/` | Home: hero, “Host a Trip”, “Find a Trip”, “Learn More” | Optional |
| `/login` | Log in (email + password). Redirects to `/trips` or `?redirect=` if already logged in | No |
| `/signup` | Sign up (email, password, confirm, name, travel style). Links pending invites by email | No |
| `/our-services` | Marketing “Learn More” | Optional |
| `/find-vacation` | Find a trip: enter invite code → GET `/trip?code=XXX` → redirect to `/trip/XXX` | No |
| `/trip` | Redirect: `?code=XXX` → `/trip/{code}` | No |
| `/trip/[inviteCode]` | **Public trip page**: room/bed selection, dates, price calc, reserve (or “Join” if logged in) | Optional |
| `/confirmation/[id]` | Post-reservation thank-you + summary; link to sign up or trip dashboard | No |
| `/reservation/[id]` | Redirects to `/confirmation/[id]` (legacy) | No |
| `/invite/[token]` | Invite by token: accept → redirect to `/trips/[tripId]` (login if needed) | Optional |
| `/trips` | My Trips list; pending invites; “Host a Trip” | Yes |
| `/trips/new` | Trip creation (alternate UI: single-page steps) | Yes |
| `/trips/new/step/1` | **Create trip Step 1:** Basics, rooms, beds, photos, total cost | Yes |
| `/trips/new/step/2` | **Step 2:** Pricing (model, optional policies) | Yes |
| `/trips/new/step/3` | **Step 3:** Meals & activities (optional) | Yes |
| `/trips/new/step/4` | **Step 4:** Invite people (emails; “From Divvi” coming soon) | Yes |
| `/trips/new/step/5` | **Step 5:** Review & Publish → `POST /api/trips/publish` → redirect to `/trip/[inviteCode]` | Yes |
| `/trips/[tripId]` | Trip dashboard (overview, goals, quick actions) | Member |
| `/trips/[tripId]/guests` | Guest list, invite (email/friends), room assignment, RSVP override, remove/restore, add manual guest | Host/co-host/guest |
| `/trips/[tripId]/rooms` | Rooms & beds overview; claim/request share; hosts edit rooms via Settings Step 1 | Member |
| `/trips/[tripId]/rsvp` | **Guest RSVP:** Yes/No, party size, beds claim, dietary, dates, cost estimate | Member |
| `/trips/[tripId]/itinerary` | Itinerary + meal slots, assignments, attendance | Member |
| `/trips/[tripId]/activities` | Discover activities (Divvi Events API), add to trip, view details | Member |
| `/trips/[tripId]/polls` | Create poll, vote, close, nudge, watch | Member |
| `/trips/[tripId]/games` | Games hub | Member |
| `/trips/[tripId]/games/caption-this` | Caption This game: submit photo, submit caption, vote, results, next round | Member |
| `/trips/[tripId]/files` | Trip files: upload, list, delete; gallery vs documents/receipts | Member |
| `/trips/[tripId]/payments` | Redirects to `/trips/[tripId]/guests` | Member |
| `/trips/[tripId]/invoice` | Invoice view (if applicable) | Member |
| `/trips/[tripId]/settings` | Redirects to `/trips/[tripId]/settings/step/1` (host only) | Host |
| `/trips/[tripId]/settings/step/1` | Edit trip basics (same as create Step 1) | Host |
| `/trips/[tripId]/settings/step/2` | Edit pricing & rooms link | Host |
| `/messages` | Direct messages: conversation list, open thread, send message | Yes |
| `/settings` | Account settings (profile, basics, dietary, etc.) | Yes |
| `/qc` | QC / internal tooling (if present) | Depends |
| `/sitemap` | Sitemap page | No |

---

## 4. Authentication Flows

### 4.1 Login

- **Page:** `GET /login`
- **Action:** Form `POST /login?/login` (or default action).
- **Body:** `email`, `password`.
- **Success:** Create session, optional backfill trip memberships for existing reservations by email; redirect to `?redirect=` (if safe path) or `/trips`.
- **Fail:** 400/401 with `error` (e.g. “Invalid email or password”).

### 4.2 Signup

- **Page:** `GET /signup` (optional `?email=` prefill).
- **Action:** Form `POST /signup` (default).
- **Body:** `email`, `password`, `confirmPassword`, `name` (optional), `travelStyle` (optional).
- **Success:** Create user, link pending invites by email, create session, redirect `/trips`.
- **Fail:** 400 with `error`.

### 4.3 Logout

- Not always a visible “Logout” link; may be in avatar menu or `/api/mobile/auth/logout` (POST).

### 4.4 Invite token (accept)

- **Page:** `GET /invite/[token]`
- **Action:** `POST /invite/[token]?/accept`
- **Behavior:** If not logged in → redirect `/login?redirect=/invite/[token]`. If logged in: upsert TripMember (accepted), update Invite status, redirect `/trips/[tripId]`.

---

## 5. Trip Creation Flow (Host)

- **Entry:** “Host a Trip” → `/trips/new` or `/trips/new/step/1`.
- **Steps:** 1 → 2 → 3 → 4 → 5 (Back / Next / Save Draft). Draft stored in client (e.g. `tripDraft` store).
- **Step 1 (required):** name, check-in/out dates, rooms (each with name, beds, photos), total trip cost, at least one photo (cover or room).
- **Step 2:** Pricing model (per-person, per-bed, per-room, etc.), optional policies.
- **Step 3:** Meals & activities (optional).
- **Step 4:** Invite people by email (optional for publish).
- **Step 5:** Review; “Publish” calls `POST /api/trips/publish` with full draft JSON.
- **Publish success:** Response `{ success, tripId, inviteCode }`; client clears draft and redirects to `/trip/[inviteCode]`.
- **Publish failure:** 400/401/500 with `error`; stay on step 5.

---

## 6. Public Trip Page & Reservation (No Login)

- **Page:** `GET /trip/[inviteCode]`
- **Load:** Trip by `inviteCode`; if not found or not published → redirect `/`. If user is logged-in member → redirect `/trips/[trip.id]`. If logged-in non-member → show “Join” confirmation.
- **Price calculation:** Client calls `POST /api/calculate-price` with `tripId`, `roomId`, `bedId?`, `numberOfSlots`, `checkInDate`, `checkOutDate` (tripId is UUID).
- **Join (logged-in non-member):** Form `POST /trip/[inviteCode]?/join` → redirect `/trips/[tripId]`.
- **Reserve (guest submission):** Form `POST /trip/[inviteCode]?/reserve`.
  - **Body:** `name`, `email`, `roomId`, `bedId` (if per-bed), `checkInDate`, `checkOutDate`, `numberOfGuests`/`numberOfSlots`.
  - **Server:** Validates, calculates price, checks bed conflict, creates `Reservation`, sends confirmation email, redirect `303` to `/confirmation/[reservation.id]`.
- **Confirmation page:** `GET /confirmation/[id]` shows reservation summary and CTA to create Divvi account or go to trip.

---

## 7. Internal Submit API (Headless / External)

- **Endpoint:** `POST /api/submit`
- **Auth:** Requires internal API key (e.g. `requireInternalApiKey`).
- **Body (JSON):** `name`, `email`, `roomId`, `bedId`, `checkInDate`, `checkOutDate` (validated by `guestSubmissionSchema`).
- **Behavior:** Same as reserve (verify bed, calculate price, prevent double-book), but creates `GuestSubmission` and sends confirmation email; returns JSON (e.g. 201 with submission). Used for external/headless booking.

---

## 8. Trip Dashboard & Member Flows

### 8.1 Trip dashboard

- **Page:** `GET /trips/[tripId]`
- **Layout:** Trip sidebar (Dashboard, Guests, Rooms, Itinerary, Activities, Polls, Games, Files, Settings). Dashboard shows goals, quick actions, RSVP CTA, etc.

### 8.2 RSVP (logged-in member)

- **Page:** `GET /trips/[tripId]/rsvp`
- **Actions:**
  - **updateRsvp:** `POST .../rsvp?/updateRsvp` — status (yes/no), arrival/departure dates, adults/kids/pets, notes (for “no”). For “yes”, requires cost commitment accepted; server computes estimate and stores.
  - **updateDietary:** `POST .../rsvp?/updateDietary` — dietary/allergies for self and plus-ones.
  - **updateProfile:** `POST .../rsvp?/updateProfile` — dietary, allergies, phone, emergency contact.
  - **claimBeds:** `POST .../rsvp?/claimBeds` — form field `bedIds` (multiple); party size must be covered by selected bed slots.
- **Data:** Trip with rooms/beds, current RSVP, guest profile, my/others’ bed claims, guest estimate range, room/bed pricing.

### 8.3 Guests (host/co-host)

- **Page:** `GET /trips/[tripId]/guests`
- **Actions:**
  - **createInvite:** `POST .../guests?/createInvite` — `email`, optional `name`, `role` (guest/co-host). Creates Invite; if recipient has account, notifies and adds TripMember (invited).
  - **inviteFriend:** `POST .../guests?/inviteFriend` — `friendUserId`. Same as createInvite but for existing friend.
  - **removeGuest:** `POST .../guests?/removeGuest` — `userId`; set member `inviteStatus` to removed.
  - **restoreGuest:** `POST .../guests?/restoreGuest` — `userId`; set to accepted.
  - **updateGuestRsvp:** `POST .../guests?/updateGuestRsvp` — override RSVP status for a guest.
  - **assignBeds:** `POST .../guests?/assignBeds` — host assigns room/bed for a user (form data varies).
  - **addManualGuest:** `POST .../guests?/addManualGuest` — add by name/email (placeholder user if needed), no invite link.
- **Copy invite link:** Client builds `origin/trip/[inviteCode]` and copies to clipboard.

### 8.4 Room assignment (host)

- **API:** `PATCH /api/trips/[tripId]/room-assignment`
- **Body:** `userId`, `roomId` (optional), `bedType`, `partySize`. Clear assignment with `roomId: null` and header `x-confirm-clear-room: true`.

### 8.5 Rooms (overview)

- **Page:** `GET /trips/[tripId]/rooms` — who is in which bed, per-bed pricing, empty-bed claim / request to share (form actions on this page).
- **Host edits (rooms, beds, room photos):** `GET /trips/[tripId]/settings/step/1` (same wizard as create-trip Step 1); saved with trip **Save** via `PUT /api/trips/[tripId]/update` (rooms included in payload).

---

## 9. Trip Settings (Host)

- **Entry:** `/trips/[tripId]/settings` → redirect to `/trips/[tripId]/settings/step/1`.
- **Steps:** 1 (basics + **rooms & beds** editor), 2 (pricing). Same components as create flow; **Save** calls `PUT /api/trips/[tripId]/update` with trip payload (name, dates, rooms, pricing, etc.).
- **Room/bed REST APIs** (still available; useful for integrations or other UI): `GET/POST/DELETE /api/trips/[tripId]/rooms`, `GET/PUT/DELETE /api/trips/[tripId]/rooms/[roomId]`, `POST /api/trips/[tripId]/rooms/[roomId]/beds`, `DELETE/PATCH /api/trips/[tripId]/beds/[bedId]`, `POST /api/upload-image` (room photos).

---

## 10. Activities

- **Page:** `GET /trips/[tripId]/activities`
- **Discovery:** Client calls `GET /api/trips/[tripId]/activities/discover` (optional query params). Server calls **Divvi Events API** (`DIVVI_EVENTS_API_BASE_URL`, `DIVVI_EVENTS_API_KEY`). If not configured, returns error JSON.
- **Add to trip / poll:** UI may create activities or link to polls; add-to-trip behavior is page-specific.

---

## 11. Itinerary & Meals

- **Itinerary:** `GET /trips/[tripId]/itinerary` — meal plan, meal slots, assignments, attendance, and meal coverage/planning UI; form actions for updating assignments/attendance (see server actions in itinerary `+page.server.ts`).

---

## 12. Polls

- **Page:** `GET /trips/[tripId]/polls`
- **Actions:**  
  - **create:** Create poll (title, description, options, end time, category, etc.).  
  - **vote:** Submit vote for option(s).  
  - **close:** Close poll (may create Activity from winning option).  
  - **nudge:** Nudge non-voters.  
  - **watch:** Watch/unwatch poll.

---

## 13. Caption This Game

- **Page:** `GET /trips/[tripId]/games/caption-this`
- **Phases:** e.g. PHOTO_SUBMISSION → CAPTION_SUBMISSION → VOTING → RESULTS; round can be per-day (dayKey).
- **Actions:**  
  - **submitPhoto:** `roundId`, `photoUrl`.  
  - **submitCaption:** `roundId`, `text`.  
  - **submitVote:** `roundId`, `captionId`.  
  - **endRoundNow:** `roundId`.  
  - **startNextRound:** (no body) — photo submitter starts next round after RESULTS.

---

## 14. Files

- **Page:** `GET /trips/[tripId]/files`
- **Upload:** `POST /api/trips/[tripId]/files` — form: `file`, `category`, `mealSlotId?`, `notes?`. Max 20 MB; types: images, PDF, video (mp4, webm, quicktime), HEIC/HEIF.
- **List:** Load from page data (trip files).
- **Delete:** `DELETE /api/trips/[tripId]/files/[fileId]`.

---

## 15. Chat & Messages

- **Trip chat:** `GET/POST /api/trips/[tripId]/chat/messages` — list and send trip-scoped chat messages.
- **Direct messages:**  
  - `GET /api/messages/conversations` — list conversations.  
  - `GET /api/messages/[withUserId]` — get thread with user.  
  - `POST /api/messages/[withUserId]` — send direct message.

---

## 16. Notifications & Friends

- **Notifications:** `GET /api/notifications` — list for current user; unread count.  
  `POST /api/notifications/mark-read` (if present) — mark read.
- **Friends:**  
  - `GET /api/users/me/friends` — my friends.  
  - `POST /api/friends/request` — send friend request.  
  - `POST /api/friends/accept` — accept.  
  - `POST /api/friends/decline` — decline.  
  - `POST /api/friends/unfriend` — remove friend.  
- **Profile:** `GET /api/users/[userId]/profile`, `GET /api/users/[userId]/profile-card`.  
  **Me:** `GET /api/users/me`, `PUT /api/users/me` (update profile). Profile edit modal may use `POST /api/upload-image` for avatar.

---

## 17. Price Calculation

- **Endpoint:** `POST /api/calculate-price`
- **Body (JSON):** `tripId` (UUID), `roomId`, `bedId?`, `numberOfSlots`, `checkInDate`, `checkOutDate`.
- **Access:** Trip must be published, or user must be trip member.
- **Response:** e.g. `{ ok, data: { nights, nightlyRate, totalPrice } }` or error payload.

---

## 18. Other APIs (Reference)

| Method | Path | Purpose |
|-------|------|---------|
| POST | `/api/trips/publish` | Create trip + rooms/beds + host membership (auth required). |
| PUT | `/api/trips/[tripId]/update` | Update trip (host only). |
| GET | `/api/trips/[tripId]/trip-info` | Trip info. |
| GET | `/api/trips/[tripId]/activities/discover` | Discover events (Divvi Events API). |
| GET | `/api/activities/search` | Activities search (used in wizard). |
| POST | `/api/upload-image` | Generic image upload (e.g. cover, room, avatar); returns `{ url }`. |
| POST | `/api/submit` | Internal API key; create GuestSubmission (headless reserve). |
| GET | `/api/rooms` | Rooms (context-dependent). |

---

## 19. Key User Flows for Test Bot

1. **Anonymous:** Home → Find a Trip (invite code) → `/trip/[code]` → select room/bed, dates → Reserve → Confirmation; optional Sign up.
2. **Signup/Login:** Sign up → redirect /trips; Login with redirect.
3. **Host full flow:** Login → Host a Trip → Steps 1–5 (all required fields + photo) → Publish → land on `/trip/[inviteCode]`; copy link.
4. **Invite & accept:** Host sends invite (email or friend) → other user gets notification / invite link → Accept invite → land on trip dashboard.
5. **Guest RSVP:** Member opens trip → RSVP → Yes + party size + claim beds + dietary → submit; or No + notes.
6. **Host guest management:** Guests page → invite by email, invite friend, remove/restore guest, assign beds, add manual guest.
7. **Room edit:** Rooms → Add rooms → edit rooms/beds, upload photos.
8. **Trip settings:** Settings → step 1 & 2 → Save (PUT update).
9. **Activities:** Open Activities → discover (if API configured) → add/view.
10. **Polls:** Create poll → vote → close; nudge; watch.
11. **Caption This:** Submit photo → submit caption → vote → results → start next round (if photo submitter).
12. **Files:** Upload file (with category) → list → delete.
13. **Messages:** Open Messages → select conversation → send message; from Guests, “Message” to user.
14. **Notifications:** Open tray; mark read if API exists.
15. **Friends:** Request, accept, decline, unfriend; use “From friends” on invite.
16. **Profile:** Edit profile (name, avatar via upload-image), account settings.

---

## 20. Error & Edge Cases to Cover

- Invalid or expired invite token; already member.
- Trip not found or not published (redirect or 404).
- Double reserve same bed/dates (409).
- RSVP “yes” without cost commitment accepted (400).
- Publish without required fields or without photo (400).
- Unauthorized/forbidden on host-only actions (403).
- Calculate price for unpublished trip as non-member (401/403).
- Upload too large or wrong type (400); storage not configured (503).
- Divvi Events API not configured (error in discover).
- Login/signup validation (email format, password length, match).

---

## 21. Environment / Config (for Test Setup)

- **Session:** Cookie-based; ensure `user_session` is sent on API and form requests when testing as logged-in user.
- **Optional:** `DATABASE_URL`, `DIRECT_URL`, Supabase (storage), Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`), `DIVVI_EVENTS_API_BASE_URL`, `DIVVI_EVENTS_API_KEY`, `APP_BASE_URL` (for confirmation links). Internal `POST /api/submit` requires API key (see `requireInternalApiKey`).

This document should be sufficient for an AI test bot to drive all main flows, forms, and APIs in Divvi.
