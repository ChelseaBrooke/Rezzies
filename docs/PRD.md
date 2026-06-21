# Divvi — Product Requirements Document (v1)

> **Status:** Living document. v1 product · doc revision 2 (incorporates founder review).
> **Last updated:** 2026-06-14
> **Owner:** Brett Burbidge

---

## 1. The Pitch

**Divvi turns the most painful part of a group trip — figuring out who pays what, who sleeps where, and who's actually coming — into one shared link.**

Anyone who has ever tried to organize a beach week with three other families, a ski trip with college friends, or a bachelorette weekend knows the drill: a spreadsheet that nobody trusts, a group chat with 400 unread messages, and that one person who keeps changing their mind two days before the rental is booked. Divvi replaces that with a single hosted trip page where the rental is described, the rooms are visible, the cost split is transparent, and the RSVP/payment loop is closed.

The host publishes once ($25), invites guests, and watches RSVPs, room picks, and the cost split update in real time. Guests see exactly what they owe and why.

---

## 2. Who It's For

Divvi serves **anyone who organizes a group rental** — the person who books the house and then has to chase everyone else. Two equally important personas:

### Persona A: The Family Organizer
- Parent or aunt/uncle planning a multi-family vacation (beach week, lake house, ski cabin, holiday gathering)
- Coordinating 2–6 households, often with kids and pets in the mix
- Needs: handle uneven family sizes fairly, manage room assignments by family unit, surface allergies/dietary needs, coordinate meals
- Pain point: a per-night rental for 14 people where families have different headcounts and want different rooms feels impossible to split fairly

### Persona B: The Friend-Group Organizer
- 20s/30s coordinating bachelor/bachelorette, ski trips, birthday weekends, friend reunions
- Coordinating 4–12 individuals, mostly adults
- Needs: fast RSVPs, easy bed-by-bed selection, polls for "where should we eat Saturday," group chat in-context
- Pain point: someone always pays more than their share, late RSVPs throw off the per-person math, group chat is a mess

Both personas share the same core need: **a transparent, fair, real-time split**. The difference is mostly in the surrounding tools they lean on (meal planning + plus-ones for families; polls + chat + activities for friends).

---

## 3. Why Now / Why This

Group rental volume has grown faster than the tools around it. Airbnb and Vrbo solve the booking. Splitwise and Venmo solve the after-the-fact reimbursement. Nothing in the middle handles **the trip itself** — the headcount/cost feedback loop, who's actually committed, who picked which bed, and what happens when the rental price changes after some guests have already said yes.

The clearest wedge: **honest cost-splitting that recalculates as the trip evolves**. If two guests drop out, the per-person price goes up — and Divvi forces a re-approval flow so guests aren't surprised by a higher charge after the fact. That alone is something spreadsheets and Splitwise can't do.

---

## 4. Product Principles

These should guide every feature and design decision:

1. **The split must always be defensible.** A guest should be able to look at their invoice and immediately understand why their number is what it is. No magic, no hidden adjustments.
2. **Hosts shouldn't be financial intermediaries.** Divvi is the source of truth on what everyone owes; payment can route through us (Stripe) but the host shouldn't have to play accountant.
3. **The link is the product.** Everything a guest needs lives on one page, no app install required. Auth is needed but light.
4. **Real-time over locked-in.** Plans change. Headcount changes. Prices change. Divvi recalculates and walks affected guests through a re-approval — it never silently overcharges.
5. **The host stays in control.** Approvals, capacity, invites, and final cost are the host's call. Divvi proposes; the host disposes.

---

## 5. Core Features (v1)

This section covers what ships at public launch. Features marked **[WIP]** exist in code but need finishing touches before launch.

### 5.1 Trip Creation Wizard
A guided multi-step flow that takes a host from blank canvas to publishable trip in under ten minutes.

- **Step 1 — Basics:** Trip name, location (Google Places autocomplete), check-in/out dates, timezone.
- **Step 2 — Rooms & Beds:** Add rooms (with photos and descriptions), specify beds inside each (king/queen/twin/bunk/sofa/full), set capacity and max occupancy per room. This is the geometric foundation everything else builds on.
- **Step 3 — Pricing model:** Pick how costs are split:
  - **Per Person** — total cost ÷ headcount
  - **Per Person Per Night** — accounts for partial stays
  - **Per Room** — each room pays equally regardless of occupants
  - **Per Bed** — each bed has its own price, with a built-in privacy premium and bed-type weighting (computed server-side; the host doesn't tune these knobs)
  - **Or skip cost-sharing entirely** — Divvi can also be used as a pure coordination tool without money involved

  The host picks one of these models when creating the trip. The model is required (not optional), but the underlying pricing algorithm parameters (`sharingExponentAlpha`, `privacyPremiumP`, `bedWeights`) are backend tuning knobs — never exposed to the host.
- **Step 4 — Publish:** $25 one-time fee via Stripe. After payment, the trip goes live and invites can be sent.

The wizard persists progress to localStorage so a half-finished trip survives a closed tab.

### 5.2 RSVP & Headcount Management
The center of gravity for the whole product.

- Guests RSVP yes/no/maybe (or land on the waitlist if capacity is full)
- Adult/kid/pet counts per guest
- Optional partial-stay support (arrival/departure within the trip window)
- Cost commitment: when a guest says "yes," they accept an **estimated cost range** based on current headcount. They're not locked into a single number — they're locked into a range they've explicitly approved.
- **Cost re-approval (over-budget only):** triggered whenever a "yes" guest's share rises *above* their personal ceiling (the high end of their accepted range, or the most recent re-approved share). Once they re-approve at the new value, **the ceiling rises to that new value** — so their accepted range only ever expands.
  - **Triggers** include: a guest dropping out (fewer splitters → higher per-person), host editing the total cost, added activities/meals, room/bed assignment changes.
  - **Decreases never trigger.** If someone's share goes *down* (e.g., a new guest joins and dilutes the split), they don't get a re-approval prompt — they'll discover the pleasant surprise next time they log in.
  - Email + in-app notification go out on trigger; guest must confirm before the new amount is considered final.
- **Waitlist:** When the trip is full, additional RSVPs queue. If someone drops, the next person in line gets a time-windowed claim notification (configurable hours).

### 5.3 Room & Bed Assignment
After RSVP'ing yes, guests pick where they sleep:

- For per-room trips: pick a room
- For per-bed trips: pick a specific bed
- For per-person trips: assignment is informational, not pricing-load-bearing
- The host can lock or override assignments
- Photos and descriptions per room help guests understand what they're picking

### 5.4 Itinerary (Activities + Meals)
A shared calendar/grid view of everything happening on the trip.

- **Activities:** Title, date/time, location, price-per-person, max participants. Guests RSVP individually to each activity.
- **Meals:** Per-meal slots (breakfast/lunch/dinner/snack) with an assigned cook, menu text, and dietary opt-outs. Optional host-budget mode for shared groceries.
- **Discovery:** Search nearby points of interest via Google Places (filter by category, budget, indoor/outdoor, radius). Add a discovered place directly to the itinerary or use it as a poll option.
- Drag-to-reschedule on the grid for fast iteration.

### 5.5 Polls
Group decision-making in context, not in a separate group chat.

- Single-choice, multi-choice, or datetime polls
- Categories: Scheduling / Meals / Activities / Rooms & Beds / Other
- Optional anonymous voting
- Live results or hidden-until-close
- Polls can be spun up directly from a discovered activity ("vote: which restaurant Saturday?")

### 5.6 Group Chat & Direct Messages
- Trip-scoped group chat — all members can post, with per-user chat bubble colors
- Direct messages between any two users on the platform (private)
- File/photo uploads supported in chat context via the shared files area

### 5.7 Shared Files
Photos, receipts, packing lists, check-in instructions, signed waivers — anything the group needs in one place. Trip-scoped, member-only access.

### 5.8 Invoicing & Payment Tracking
For MVP, **Divvi is the source of truth on what each guest owes — not a payment processor for guest balances.** The only Stripe checkout flow in the entire product is the host's one-time $25 publish fee at trip creation.

- Per-guest invoice page showing the full breakdown (room/bed share, activity costs, meal contributions, extra costs)
- **Host marks guests as paid** to track who's settled up; status is visible to the guest
- Money moves off-platform — guests Venmo / Zelle / cash the host directly, however the host normally collects
- Cost re-approval still gates the invoice: a guest with a `pending` re-approval sees their breakdown but is asked to re-confirm before the number is considered final

### 5.9 Guest Profiles
- Per-trip profile: dietary restrictions, allergies, emergency contact, payment preference
- Per-user profile: name, phone, avatar, travel style, home city, timezone, friend graph
- Emergency contact can optionally be shared with hosts only

### 5.10 Notifications
- In-app notification center (invite received, RSVP accepted, room assigned, cost re-approval needed, poll closed, etc.)
- Transactional emails via Resend for the same events — sent **event-driven** when the event happens. Invite emails, RSVP confirmations, cost-re-approval prompts, and waitlist promotion alerts all fire in real time (no daily batch).
- **One** scheduled cron — poll lifecycle nudges (open polls expiring soon, polls just closed) — runs three times daily at **7am, 12pm, and 8pm ET**.

### 5.11 Mobile API Surface **[WIP]**
A REST surface at `/api/mobile/*` with token-based auth (90-day session TTL, CORS configured) is scaffolded for a future native mobile client. v1 is web-only at launch but the API is exposed for the eventual app.

### 5.12 Trip Games **[Flagged off for v1 — candidate for v1.1]**
A set of light, in-trip games designed to make the trip itself more fun (not just the logistics). Code is complete but stays behind `FEATURE_TRIP_GAMES` for public launch.

- **Caption This** — Daily photo gets captioned by the group, then voted on. Daily winner.
- **Scavenger Bingo** — Pre-built bingo cards of trip-relevant items/experiences.
- **Alphabet Hunt** — Find things starting with each letter of the alphabet.
- **Daily Trivia** — Lightweight trivia rounds.

The flag stays false for v1. v1.1 is the planned vehicle for turning it on once the core flow has been stress-tested with real users.

### 5.13 Household Plus-Ones **[WIP]**
A primary guest can bring "plus ones" (spouse, kids, friends) without each requiring a full account. The data model is fully in place; the UI is partial. Likely target for first post-launch polish.

### 5.14 SMS Invites **[WIP]**
Email invites work today. SMS invites are wired through the data model and invite-service but the actual SMS sending (Twilio) is unimplemented. Optional for v1 launch.

---

## 6. Non-Goals (for v1)

What Divvi is explicitly *not* doing at launch:

- **Processing guest payments.** The only Stripe checkout in MVP is the host's $25 publish fee. Guests pay the host directly off-platform (Venmo, Zelle, cash); Divvi tracks "paid / not paid" but never moves the money.
- **Booking the actual rental.** Divvi assumes the host has already booked or is about to book. We don't integrate with Airbnb/Vrbo APIs.
- **Multi-currency or i18n.** USD only, English only.
- **Non-US users.** US-only at launch — US timezones, US English, USD pricing.
- **Native mobile app.** API surface is ready, native app is not in v1 scope.
- **Travel insurance, refunds, or chargeback mediation.** Stripe handles the publish fee; disputes go through Stripe. Guest-balance disputes are off-platform and host-managed.
- **Hosts as professional property managers.** Divvi is for ad-hoc group organizers, not commercial short-term-rental businesses.
- **AI/LLM features.** No AI in v1. (Possible future: AI-suggested itinerary, trip summary emails.)
- **In-product games.** `FEATURE_TRIP_GAMES` stays off for v1.

---

## 7. Monetization

**v1: $25 one-time publish fee per trip.** Charged via Stripe when the host publishes. **This is the only Stripe checkout flow in the entire product.** No subscriptions, no markup on guest payments (Divvi doesn't move guest money at all in MVP), no ads.

The fee is enforced server-side: a single `publishFeePaymentIntentId` on the Trip record prevents re-use, and the trip is gated until paid.

Long-term monetization is intentionally out of scope for this PRD.

---

## 8. Success Metrics (Proposed)

The PRD doesn't lock these in — they're starting points for you to refine. **[TODO: Brett to confirm targets.]**

**Activation:**
- % of new accounts that create a trip
- % of created trips that reach the publish step
- % of published trips that reach 5+ confirmed RSVPs

**Engagement:**
- Median time from trip creation to publish
- Median RSVPs per trip
- % of trips that use ≥2 collaboration features (polls, itinerary, chat, files)

**Retention:**
- % of hosts who plan a second trip within 12 months
- % of guests who become hosts (the most important leading indicator for organic growth)

**Revenue:**
- Published trips per week (= revenue / $25)
- Cost per acquired host (channel-dependent)

---

## 9. Risks & Open Questions

### Product risks (live)
- **Cost re-approval friction.** Each re-approval prompt is a chance for a guest to drop out. Worth instrumenting carefully: how often it fires per trip, what % of prompts get re-approved within the deadline, and which causes trigger it most (dropouts vs host edits vs added activities/meals). The asymmetric design — only over-budget triggers; under-budget changes are a pleasant log-in surprise — is intentional and keeps surprise charges out.
- **Off-platform payment hand-off.** "Host marks paid" is a tracking field, not a payment guarantee. Some guests will pay late, some hosts will forget to flip the status. The risk is the guest's view of "what I owe / what's settled" goes stale. Mitigation: clear copy that this is host-tracked, not Divvi-enforced.

### Technical risks (live)
- **Legacy models** (`Reservation`, `GuestSubmission`) may indicate incomplete migrations. Worth auditing whether they're actually unused or still referenced.
- **No analytics or error tracking** (Sentry, PostHog, etc.). Going to public launch blind would be a mistake — recommend adding before launch.
- **No visible test coverage data.** E2E tests exist in `/e2e/` (Playwright) but pass/fail status of the suite is unknown.
- **Email deliverability** depends on the verified Resend domain. Confirm DNS is set up before launch traffic.
- **Cron jobs being removed.** The waitlist-promotion cron and cost-re-approval-reminder cron are out of scope for MVP. The corresponding notification triggers need to be wired event-driven (or accepted as no-reminder for MVP). Audit the existing cron code paths in `cron-email-service.ts` and `/api/cron/*` before deleting — don't orphan event sources.

### Decided / closed
- ~~Games on or off at launch?~~ → **Off.** `FEATURE_TRIP_GAMES` stays `false` for v1; revisit in v1.1.
- ~~Geography focus?~~ → **US only at launch.** USD, English, US timezones.
- ~~Pricing model "overload"?~~ → Not a risk. Host picks one model from a list; algorithmic tuning (bed weights, sharing exponent, privacy premium) is backend-only and never exposed.
- ~~Legal docs (TOS, Privacy, refund policy)?~~ → Owned by Brett before launch.
- ~~Support plan?~~ → **Email-based support for MVP.** No helpdesk or in-product chat; one support inbox handles "my charge is wrong" / "I can't log in" / etc.

---

## 10. Glossary

- **Trip** — A planned group stay at a specific rental. The top-level entity in the data model.
- **Host** — The user who created the trip. Has admin rights over the trip.
- **Co-host** — A trusted guest with elevated permissions (assign rooms, manage invites). Same `TripMember.role`, different value.
- **Guest** — Any user who's been invited to or RSVP'd for the trip.
- **RSVP** — A guest's response record. Includes status (yes/no/maybe/waitlisted), headcount, and cost commitment.
- **Cost commitment** — A guest's explicit approval of an *estimated cost range*, accepted at RSVP time. Re-approval is required if costs move outside the range.
- **Privacy premium** — A multiplier applied to private (single-occupant) rooms when using per-bed pricing, so a guest who takes a king bed solo pays more than the same king bed split between two people.
- **Sharing exponent (α)** — A configurable parameter in the per-bed pricing algorithm that controls how aggressively shared occupancy discounts the per-person rate.
- **Household** — A unit of guests traveling together where one primary guest manages the others (plus-ones). Designed for families.
- **Publish fee** — The $25 one-time Stripe charge that activates a trip.
- **Waitlist claim window** — The configurable time window (in hours) during which a promoted waitlist guest can accept their spot before it rolls to the next person.

---

## Appendix A: References

- **Repository:** `/Users/brett/Documents/Code/CheLabs/DivviHQ/Divvi`
- **Stack:** SvelteKit + Svelte 5, TypeScript, Prisma, PostgreSQL (Supabase), Stripe, Resend, Google Places, Vercel
- **Architecture detail:** see `docs/ARCHITECTURE.md` *(to be written next)*
- **Schema:** `prisma/schema.prisma`
- **Feature flags:** `src/lib/config/features.ts`
