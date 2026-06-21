# Divvi — v1 Launch Cutline (Workstream Plan)

> **Status:** DRAFT — for approval.
> **Date:** 2026-06-20 · **Owner:** Brett
> **Decisions** were locked in working session 2026-06-20, **except the 3 items flagged ⏳ PENDING APPROVAL** below.
> **Format:** every workstream is dispositioned as **Spine** (keep, full build) / **Trim** (keep core, cut the edge) / **Hide** (flag off, code stays) / **Cut** (remove from v1) / **Infra** (add before launch).
> **Role of this doc:** the divergence baseline. `PRD.md` and `ARCHITECTURE.md` describe the code **as-built today**; this doc defines **what v1 becomes**. The detailed task list + agent owners will live in `docs/PLAN.md` once this cutline is approved.

---

## Decision status

**✅ Decided:**
- **Observability (WS-T) — IN.** Sentry (errors) + PostHog (analytics), minimal config.
- **Kids = full pricing share.** Pricing party size includes children (was `adultsCount` only).
- **WS-P — Anonymous booking → DEFER to post-launch.** Launch funnel is **invite → sign in / sign up → join**, which is already the live behavior. The old anonymous reserve flow is already disabled; only dormant plumbing remains — see [WS-P](#ws-p--legacy-anonymous-booking-deferred) below.

---

## 🟢 Spine — keep (full build)

The cost feedback loop is the product (PRD §3). These ship complete.

| WS | Workstream | Notes | PRD |
|---|---|---|---|
| A | **Pricing engine** | Consolidated to **one** engine (`calculateReservationPrice`); 3 models only — PerPerson (÷ live attendance), PerRoom (flat ÷ rooms, one household/room), PerBed (bed weight × privacy, even split). **Kids = full pricing share.** See `PRICING_ANALYSIS.md`. | §5.1 |
| B | **RSVP + headcount + cost re-approval** | Two-ended closing range, immutable snapshot, asymmetric over-budget re-approval. | §5.2 |
| C | **Trip-creation wizard** | Keep; pricing step trimmed (PPN removed — see Cut). Canonical wizard structure TBD in PLAN. | §5.1 |
| D | **Rooms & beds assignment** | Load-bearing for PerRoom/PerBed. | §5.3 |
| E | **Invoicing + host "mark paid"** | Source of truth on who owes; **no guest Stripe** — money moves off-platform. | §5.8 |
| F | **Stripe publish fee ($25)** | The only checkout in the product. | §7 |
| G | **Auth + guest profiles (light)** | Session cookie; per-trip + per-user profile. | §5.9 |
| H | **Notifications — event-driven core** | Invite / RSVP / room assigned / re-approval / waitlist, fired in real time. | §5.10 |
| ✚ | **Invite → join funnel** | Host invites by email → guest clicks link → signs in / signs up → **joins the trip**. Already live (`/invite/[token]` → `/trips/[tripId]` join page). This is the launch funnel; replaces the deferred anonymous flow (WS-P). | §5.2 |
| L | **Polls** | Kept (per decision) — friends-persona collaboration. | §5.5 |
| M | **Group chat & DMs** | Kept (per decision). | §5.6 |
| N | **Shared files** | Kept (per decision); Supabase storage. | §5.7 |

## 🟡 Trim — keep core, cut the edge

| WS | Workstream | Trim |
|---|---|---|
| I | **Itinerary / Activities / Meals** | Keep **manual add** + meal fund (feeds invoice). **Hide "Discover"** → removes the Google Places / Divvi Events API dependency. |
| J | **Notifications crons** | **Remove reminder crons** (waitlist-promotion, cost-reapproval reminders). Keep poll-lifecycle cron + all event-driven sends. (PRD §9 already wants this.) |
| K | **Waitlist** | Keep the **capacity cap** + enforcement. **Simplify the timed claim-window → manual host promote** (remove the auto-rolling claim automation). |

## 🔵 Hide — flag off, code stays

| WS | Workstream | Note |
|---|---|---|
| O | **Trip games** | `FEATURE_TRIP_GAMES = false` (already off). **Defer** the sessionStorage→DB fix (TECH_DEBT #7) — irrelevant while hidden. |
| S | **Plus-ones / households UI** | **Disable the partial UI**; keep the data model + the adults/kids **counts** pricing needs. Finish post-launch (PRD §5.13). |

## 🔴 Cut — remove from v1

| WS | Workstream | What gets removed |
|---|---|---|
| P ✅ | **Legacy anonymous booking** | **Deferred** to post-launch (feature already disabled — `/trip/[code]` returns 410). For launch: sever `/api/submit` → `pricing.ts` so pricing can consolidate; leave `Reservation` / `GuestSubmission` models **dormant** (revisit post-launch, don't delete yet). See [WS-P](#ws-p--legacy-anonymous-booking-deferred). |
| A′ | **Legacy pricing paths** | `pricing.ts:calculatePrice`, `per_person_per_night` (model + wizard option), `sharingExponentAlpha` + `privacyPremiumP` (dead fields + columns), dead `Room.privacyFactor`. |
| Q | **SMS / Twilio invites** | Email invites only — strip the placeholder (TECH_DEBT #3). |
| R | **Mobile API** | Strip `/api/mobile/*` entirely (routes + CORS / 90-day-TTL scaffolding). |
| U | **Invite from friends list** | Cut the `inviteFriend` action + "From friends" UI for v1 (unclear UX, low value now). **Co-host invites stay** — that's just an invite *role* on the email invite, not a separate flow. |

## ⚙️ Infra — add before launch

| WS | Workstream | Note |
|---|---|---|
| T ✅ | **Observability** | **IN (approved).** Sentry (errors) + PostHog (product analytics), minimal config. |

---

## WS-P — Legacy anonymous booking (deferred)

**Decision: defer to post-launch.** The launch funnel is **invite → sign in / sign up → join** — which is already the live behavior. Anonymous "reserve without an account" is a signup-friction reducer we'll revisit after launch.

### What it was meant to do

Let a guest book a spot on a trip from a public link **without an account** — enter name + email, pick a room/bed — creating a `Reservation`. When they later signed up or logged in with that email, `backfillTripMembershipsForUser` auto-linked them to the trip as a member. *"Reserve now, make an account later."* `/api/submit` (headless, gated by `INTERNAL_API_KEY`) did the same via `GuestSubmission` for external callers.

### What's actually live today

The anonymous flow is **already disabled** — this is dead/dormant code, not a working feature we're removing:

- `/trip/[inviteCode]` returns **`410 Gone`** ("invite codes are no longer supported"). The public reserve action is gone.
- `/invite/[token]` simply **redirects to the trip's join page** (`/trips/[tripId]?invite=…`) — i.e. exactly the simple flow we want: click link → sign in / up → join.
- What remains is **dormant plumbing**: the `Reservation` + `GuestSubmission` models, the login backfill (`backfillTripMembershipsForUser`), `/api/submit`, and `confirmation/[id]` — no UI entry point feeds them.
- `DIVVI.md` still documents the old anonymous reserve flow as live — **that doc is stale here** and will be corrected in the as-built pass.

### What we do for launch

- **Keep** the invite → sign in / up → join funnel (already works). ✅
- **Defer** anonymous trip-starts / reserve-without-account to **post-launch** (rebuild when we tackle signup friction).
- **Cleanup that unblocks pricing:** sever `/api/submit`'s dependency on legacy `pricing.ts` (disable or repoint the route) so Spine-A can delete `pricing.ts`. `/api/calculate-price` is already canonical.
- **Leave `Reservation` / `GuestSubmission` models + the login backfill dormant** — harmless, and we may revive the funnel post-launch. Don't delete the models yet.

---

## Approval

- [ ] **Cutline approved as written** (Spine / Trim / Hide / Cut as above)
- [x] **Observability — IN** (WS-T) ✅
- [x] **Kids = full pricing share** (A4) ✅
- [x] **WS-P — defer anonymous booking; launch funnel = invite → sign in / up → join** ✅

**On approval:** PRD.md + ARCHITECTURE.md get rewritten to the as-built baseline, and `docs/PLAN.md` is created with every workstream broken into front/back tasks mapped to agent owners — then execution begins.
