# Divvi — Architecture

> Companion to [PRD.md](./PRD.md). The PRD describes *what* Divvi is; this doc describes *how it's built*.
>
> **Last updated:** 2026-06-14 · **Owner:** Brett Burbidge

---

## 1. Stack at a glance

| Layer | Choice | Notes |
|---|---|---|
| Framework | **SvelteKit 2.x** | Form actions for server-rendered routes; `+server.ts` for REST |
| UI | **Svelte 5** (runes) | Per-component CSS; design tokens in `src/styles/theme.css` |
| Language | **TypeScript 5.x** | `svelte-check` for type/diagnostics |
| Build / dev | **Vite 7.x** | `npm run dev` for HMR, `npm run build` for adapter output |
| Adapter | **`@sveltejs/adapter-vercel`** | Produces Vercel-native serverless output |
| Runtime | **Node 20.x** (Vercel functions) | `engines.node` pinned in `package.json` |
| DB | **PostgreSQL** via Supabase | Pooled (`6543`) for app, direct (`5432`) for migrations |
| ORM | **Prisma 5.x** | Schema at `prisma/schema.prisma`; `postinstall` regenerates client |
| Auth | **Native password** (bcryptjs) + DB-backed sessions | No Supabase auth, no OAuth |
| Email | **Resend** | HTML templates rendered server-side in `src/lib/server/email/render/` |
| Payments | **Stripe** | Single PaymentIntent flow: $25 publish fee |
| Maps | **Google Maps JS API** + **Google Places** | Client autocomplete + server Nearby Search |
| Hosting | **Vercel** (region `iad1`) | Single project, single region |
| Tests | **Vitest** (unit) + **Playwright** (E2E) | E2E suite exists under `/e2e/`; pass-state unverified |

---

## 2. Repo layout

```
src/
├── app.css, app.html            # SvelteKit entry
├── hooks.server.ts              # Auth + write-gate + Server-Timing header
├── routes/
│   ├── +layout.svelte           # App shell (header, nav, modals)
│   ├── +page.svelte             # Public homepage
│   ├── (auth)/                  # signup, login, logout
│   ├── trips/                   # Trip listing + creation + dashboards
│   │   ├── new/                 # Multi-step wizard
│   │   └── [tripId]/            # Trip dashboard + all sub-routes
│   │       ├── rooms/, guests/, settings/, publish/, payments/, invoice/, files/
│   │       ├── rsvp/, join/
│   │       ├── itinerary/, activities/, polls/, games/, chat/
│   │       └── ...
│   ├── messages/                # Direct user-to-user DMs
│   ├── settings/                # User account settings
│   └── api/                     # REST + form-action helpers
│       ├── trips/[tripId]/...   # Trip CRUD, rooms, beds, invoices, re-approval
│       ├── stripe/              # PaymentIntent creation + verification
│       ├── activities/search    # Google Places proxy
│       ├── cron/                # waitlist, emails, polls (waitlist + emails to be removed)
│       ├── mobile/auth          # Native-app login/register endpoint
│       └── ...
├── lib/
│   ├── components/              # Svelte UI components
│   │   ├── trips/, wizard/, profile/, itinerary/, games/, layout/, ui/, ...
│   ├── server/                  # Server-only modules
│   │   ├── prisma.ts            # Singleton Prisma client
│   │   ├── session.ts           # DB-backed session cookies
│   │   ├── user-auth.ts, auth.ts
│   │   ├── pricing.ts           # Public entry: calculatePrice()
│   │   ├── pricing-canonical.ts # Per-bed canonical math + bed weighting
│   │   ├── pricing-display.ts   # Display-friendly ranges
│   │   ├── per-bed-pricing-validate.ts
│   │   ├── cost-reapproval.ts   # Asymmetric re-approval evaluator
│   │   ├── invoice-calculator.ts
│   │   ├── stripe.ts            # Publish-fee PaymentIntent + verification
│   │   ├── platform-publish-fee.ts  # $25 constant + discount code logic
│   │   ├── notification-service.ts  # Event-driven notification fan-out
│   │   ├── cron-email-service.ts    # Batch email dispatch (legacy)
│   │   ├── waitlist-service.ts, invite-service.ts
│   │   ├── household-claim.ts, poll-maintenance.ts, caption-this.ts
│   │   ├── api-protection.ts    # X-Internal-Api-Key gate
│   │   ├── cron-auth.ts         # Bearer CRON_SECRET gate
│   │   ├── mobile-cors.ts       # CORS headers for /api/mobile/*
│   │   ├── rate-limit.ts
│   │   ├── validation.ts        # Zod schemas + standard error shape
│   │   ├── trip-access.ts, trip-room-order.ts, trip-bed-spots.ts, trip-games-guard.ts
│   │   └── email/               # Resend templates (HTML + brand tokens)
│   ├── stores/                  # Client-side Svelte stores (tripDraft, profileOverlay, …)
│   ├── config/features.ts       # FEATURE_TRIP_GAMES flag
│   └── utils/                   # Pricing display, bed validation, etc.
├── styles/theme.css             # Design system tokens (palette + shadows + radii)
└── ...

prisma/
├── schema.prisma                # ~30 models
├── migrations/
└── seed.ts

e2e/                             # Playwright tests
scripts/                         # Vocabulary linter + utilities
static/                          # Public assets (incl. email logos)
```

---

## 3. Request lifecycle

Every request flows through `src/hooks.server.ts` → SvelteKit router → either a route's `+page.server.ts` `load`/form-actions, or an `+server.ts` REST handler.

```
Browser
   │
   ▼
hooks.server.ts                  (src/hooks.server.ts)
   │   1. event.locals.user = await getSessionUser(cookies)
   │   2. ~1% chance: fire-and-forget cleanupExpiredSessions()
   │   3. If POST/PUT/PATCH/DELETE to a trip-edit route AND trip ended → 403
   │   4. await resolve(event)
   │   5. Set Server-Timing header for the dev PerfBadge
   ▼
SvelteKit Router
   │
   ├──► /routes/.../+page.server.ts (load + form actions)
   │       │
   │       ▼
   │   Server logic → Prisma → Supabase Postgres
   │
   └──► /routes/api/.../+server.ts (REST handler)
           │
           ▼
       Server logic → Prisma / Stripe / Google / Resend
```

Key properties:
- **Single auth checkpoint.** `event.locals.user` is hydrated once in `hooks.server.ts:34`; downstream handlers read it without touching the DB again.
- **No middleware chain.** SvelteKit doesn't have Express-style middleware. Cross-cutting concerns (auth, key checks, CORS) are explicit helper calls inside each handler.
- **Lazy maintenance.** Session GC piggybacks on real traffic (1% probability per request) instead of a dedicated cron.
- **Closed-trip write gate.** `hooks.server.ts:43–66` blocks writes to `/trips/[tripId]/(guests|itinerary|rooms|settings)` and `/api/trips/[tripId]/update` once `checkOutDate` is in the past. JSON 403 for API, plaintext for page routes.

---

## 4. Authentication & sessions

Pure native-password + DB session cookies. No third-party identity provider, no OAuth.

- **Hashing:** `bcryptjs` at signup/login (`src/lib/server/user-auth.ts`).
- **Session model:** Prisma `Session` row — `userId`, opaque `token` (UUID), `expiresAt`.
- **Web cookie:** `user_session`, `httpOnly`, `sameSite=strict`, `secure` in prod, **7-day TTL** (`session.ts:6`).
- **Mobile token:** Same `Session` table, **90-day TTL** issued via `/api/mobile/auth`. The cookie isn't used for native; the token is returned in the JSON body and supplied as a bearer header by the native client.
- **Logout:** `destroySession()` deletes from DB and clears the cookie.
- **Cleanup:** `cleanupExpiredSessions()` deletes expired rows; called probabilistically from `hooks.server.ts` (~1% of requests).

**`requireAuth()` wraps `getSessionUser()` and returns `null` when no user**, so handlers can throw `redirect(302, '/login')` themselves. This is per-handler, not a global gate — handlers that need auth must opt in.

---

## 5. Data model — orientation

Full schema is in `prisma/schema.prisma`. Trip is the center of the graph; everything else hangs off it.

```
                    User ──┬── Session
                           ├── RSVP ──── Trip
                           ├── TripMember
                           ├── Invoice
                           ├── ChatMessage / DirectMessage
                           ├── Notification
                           ├── Friendship / FriendRequest
                           └── HouseholdMember

       Trip ──┬── Room ── Bed
              ├── RoomAssignment
              ├── RSVP
              ├── Household ── HouseholdMember
              ├── Activity ── ActivityParticipant
              ├── MealPlan ── MealSlot ── MealSlotAttendance
              ├── Poll ── PollOption / PollVote / PollWatcher
              ├── CaptionThisRound ── Caption / Vote
              ├── TripGame
              ├── Invite
              ├── Invoice
              ├── ExtraCostRule ── GuestExtraSelection
              ├── ChatMessage
              ├── TripFile
              └── TripActivity (append-only log)
```

**Pricing-critical fields on Trip:**
- `pricingModel` — `PER_PERSON | PER_PERSON_PER_NIGHT | PER_ROOM | PER_BED`
- `totalCost`, `costSharingEnabled`
- `bedWeights` (JSON), `sharingExponentAlpha`, `privacyPremiumP` — backend tuning knobs (PRD §5.1)
- `publishFeePaymentIntentId` — uniqueness gate for the $25 fee

**Cost-re-approval-critical fields on RSVP:**
- `acceptedEstimateLowCents`, `acceptedEstimateHighCents` — the range the guest accepted at RSVP time
- `originalRangeMinCents`, `originalRangeMaxCents` — frozen originals
- `approvedCostShareCents` — most recent re-approved share (raises the ceiling)
- `costApprovalStatus` (`approved | pending | hostApproved`), `costReapprovalReason`, `reApprovalDeadline`

**Legacy / superseded** (audit before deleting): `Reservation`, `GuestSubmission`.

---

## 6. Pricing engine

Three forms of the same enum coexist — keep them straight:

| Layer | Form | Example |
|---|---|---|
| DB / REST API | `lowercase_underscore` | `per_bed` |
| Canonical (server math) | `UPPER_SNAKE` | `PER_BED` |
| UI / wizard | `kebab-case` | `per-bed` |

Translation lives in `src/lib/server/pricing.ts:1–9` (header comment). `calculatePrice()` normalizes via `.toLowerCase()` and accepts both DB and canonical forms.

### 6.1 Flow

```
+page.server.ts / +server.ts
        │
        ▼
calculatePrice(params)        (pricing.ts)
        │ switch on pricingModel
        │
        ├── per_room      → calculatePerRoomPrice()
        ├── per_person    → flat totalCost / headcount
        ├── per_person_per_night → totalCost / headcount / nights
        └── per_bed       → delegates to calculateReservationPrice()
                                          (pricing-canonical.ts)
```

### 6.2 Per-bed math (canonical model)

`pricing-canonical.ts` (1,200+ lines) implements the bed-weighting + privacy-premium model. **`PRICING.md` (repo root) is the authoritative spec**; `PRICING_MATH.md` and `PRICING_FORMULAS.md` are now redirect stubs that point to it. This section summarizes the canonical model and **flags where the code currently diverges from `PRICING.md`** (see the callout at the end).

**Bed weight.** Each `Bed` has a type weight (`DEFAULT_BED_WEIGHTS`, `pricing-canonical.ts:80`):

| Type | Weight | | Type | Weight |
|---|---|---|---|---|
| King | 1.3 | | Bunk (per level) | 0.9 |
| Queen | 1.2 | | Sofa bed | 0.85 |
| Full / Double | 1.1 | | Air mattress | 0.75 |
| Twin / Single | 1.0 | | Other | 1.0 |

**Privacy factor.** Derived from the **count of bed rows in the room** (not slots) — fewer beds = more privacy. `getEffectivePrivacyFactor` (`pricing-canonical.ts:221`):

`privacy = max(1.0, min(1.25, 1.25 − (bedsInRoom − 1) × 0.125))` → 1 bed = **1.25**, 2 beds = **1.125**, 3+ beds = **1.0** (`PRIVACY_FACTOR_PRIVATE = 1.25`, `PRIVACY_FACTOR_SHARED = 1.0`).

**Per-bed weight & share.** `bedWeight = typeWeight × roomPrivacy`. Trip total $ is allocated in proportion to each occupied bed's weight; a shared bed's share is split among its spot claimers (`effectiveSleepSlots`). Unassigned beds are excluded from the occupied-weight denominator. Example: a King alone in a room = `1.3 × 1.25 = 1.625`; the same King in a 3-bed room = `1.3 × 1.0 = 1.3`.

**Slot helpers.** `effectiveSleepSlots()` (`$lib/bed-spot-validation.ts`) returns `max(storedSlots, bed-type default)` — a static per-bed spot count (king/queen/full/bunk/sofa = 2, twin/air = 1), **not** an occupancy-dependent value. Used for spot validation and splitting shared-bed cost.

**Quote simulation.** `quoteForUserId` + `provisionalPick` (`calculateReservationPrice`, `pricing-canonical.ts:817`) let the quote flow simulate "what would this cost if I picked this bed?" — the proposed bed is merged into hypothetical occupancy and the user's existing assignment excluded, without persisting.

**Closing range (estimate at RSVP).** Per `PRICING.md`, every guest sees a two-ended `$min–$max` range: the **favorable** end divides by `Trip.maxCapacity` (host's attendance cap, fixed) and the **expensive** end by `max(currentYesRsvpCount, expectedPeopleCount)` (recomputed live, so the range narrows and collapses as RSVPs come in). The **binding** estimate is computed by `computeGuestEstimateRange` (`guest-estimate.ts:101`) using the helpers in `closing-range.ts`, then stored immutably as `originalRangeMinCents` / `originalRangeMaxCents` (`schema.prisma:600`) at RSVP submit (`rsvp/+page.server.ts:345`). This path **does** follow the spec (favorable = `maxCapacity` with fallbacks; expensive = `max(effectiveYes, expected)`). It drives cost re-approval (§7).

**None of these knobs are host-facing.** Hosts pick a model; the rest is server-side tuning the team can adjust by editing constants without a UI change.

> **⚠ There are four overlapping pricing surfaces and they do not all agree.** This is the central drift; see `docs/PRICING_ANALYSIS.md` for the full map, decision questions, and reconciliation plan. In brief:
>
> 1. **Binding RSVP range** — `guest-estimate.ts` + `closing-range.ts`. Matches `PRICING.md`. ✅
> 2. **Host preview/display tiles** — `getPerBedRangeGuestCounts` (`pricing-canonical.ts:401`) uses `trip.maxGuests` (not `maxCapacity`) and **ignores live yes count** (comment at `:627`: "ranges use trip.expectedPeopleCount only"). Diverges from #1 and from `PRICING.md`. ⚠
> 3. **Legacy live invoice math** — `pricing.ts` `calculatePrice` (still wired into `/api/submit` and `trips/[tripId]/+page.server.ts`): `per_person` ÷ `expectedPeopleCount` (spec wants `totalSlots`); `per_room` flat `÷ rooms` un-weighted (spec wants per-night privacy-weighted); `per_person_per_night` still fully implemented (spec says removed/deprecated). ⚠
> 4. **Canonical per-bed/per-room invoice** — `calculateReservationPrice` / `computeRoomPricing` (`pricing-canonical.ts`), used by `invoice-calculator.ts`. The weighted model `PRICING.md` calls canonical — but `PRICING.md` labels `computeRoomPricing` "legacy," so the spec and code are inverted here. ⚠
>
> Also unresolved: `sharingExponentAlpha` / `privacyPremiumP` / `Room.privacyFactor` are stored + validated (`schema.prisma:60,61,137`) and named as live knobs in the **PRD glossary**, but the canonical math marks them **legacy** and uses bed-count privacy instead (`pricing-canonical.ts:36–37`). And **partial stays**: PRD §5.2 lists them as a feature with `arrivalDatetime`/`departureDatetime` columns (`schema.prisma:574`), but `PRICING.md` fixes stay factor = 1 and declares them out of scope.

---

## 7. Cost re-approval

Implemented in `src/lib/server/cost-reapproval.ts`. The rule (PRD §5.2): an RSVP gets `costApprovalStatus = 'pending'` whenever its invoice total exceeds its personal ceiling. Decreases never trigger.

### 7.1 When the evaluator runs

`evaluateCostReapprovalForTrip(tripId)` is called from:

| Caller | When |
|---|---|
| `invoice-calculator.ts:201`, `:217` | After any invoice recompute (host changes, activity added, room/bed shuffled) |
| `/api/trips/[tripId]/cost-reapproval/withdraw/+server.ts:85` | After a guest withdraws an RSVP (fewer splitters → others' shares go up) |

It is **idempotent** — RSVPs already `pending` are skipped (`cost-reapproval.ts:58`).

### 7.2 The asymmetric check

```ts
const ceiling = r.approvedCostShareCents ?? origMax;
if (currentCents <= ceiling) continue;   // decreases or in-range: no-op
// else: mark pending, notify, set deadline
```

- **Ceiling** = most recently re-approved share, or the original accepted high.
- **On approval**, `approvedCostShareCents` is updated to the new value → ceiling rises → range only expands.
- **Deadline** = 48 hours before `Trip.checkInDate` (`cost-reapproval.ts:4–8`).
- **Notification fan-out**: writes a `Notification` row + sends a Resend email via `sendCostShareReapprovalToGuest`.

### 7.3 Decreases

Intentionally a no-op. The guest sees the lower share next time they log in. This is a product decision (PRD §5.2) to keep re-approval traffic focused on the only thing that matters: someone potentially owing more than they agreed to.

---

## 8. Notifications

**Event-driven by default** (PRD §5.10). Almost every notification — invite received, RSVP accepted, room assigned, cost re-approval needed, waitlist promotion — fires in real time at the moment the event happens, via `src/lib/server/notification-service.ts`.

Each event writes a `Notification` row (in-app) and conditionally calls Resend (email) based on the user's notification preferences.

### 8.1 Scheduled jobs (post-MVP)

**Current** `vercel.json` (will be slimmed for MVP):

```json
{
  "crons": [
    { "path": "/api/cron/waitlist", "schedule": "0 12 * * *"  },
    { "path": "/api/cron/emails",   "schedule": "15 12 * * *" },
    { "path": "/api/cron/polls",    "schedule": "30 12 * * *" }
  ]
}
```

**Planned for MVP** — only poll lifecycle nudges, three times daily at 7am / 12pm / 8pm ET:

```json
{
  "crons": [
    { "path": "/api/cron/polls", "schedule": "0 11 * * *" },   // 7am ET (UTC-4)
    { "path": "/api/cron/polls", "schedule": "0 16 * * *" },   // 12pm ET
    { "path": "/api/cron/polls", "schedule": "0 0 * * *"  }    // 8pm ET
  ]
}
```

> **Note:** Vercel crons run in UTC. The schedule above assumes EDT (UTC-4). For year-round behavior consistent with US Eastern, either accept the one-hour drift across DST boundaries or move the schedule logic inside the handler.

`/api/cron/waitlist` and `/api/cron/emails` are slated for removal. Audit the upstream callers in `cron-email-service.ts` first — any event that currently relies on the batched send needs to be wired to the event-driven path before the cron is deleted.

### 8.2 Cron auth

`src/lib/server/cron-auth.ts` — if `CRON_SECRET` is set, the handler requires `Authorization: Bearer <CRON_SECRET>`. Vercel injects this header automatically when calling its own cron endpoints. Returns 401 JSON when invalid; **silently allows** when the env var is unset (so local invocation works).

---

## 9. External integrations

### 9.1 Stripe (`src/lib/server/stripe.ts`)

Single flow: the $25 publish fee.

- **Key pairing guard** (`assertPublishableKeyMatchesSecretMode`, lines 25–50) refuses to start if `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are on different test/live modes. Catches a common deployment footgun.
- **PaymentIntent**: card-only (`payment_method_types: ['card']`) — hides Klarna / Amazon Pay / redirect-based methods from the Payment Element.
- **Metadata**: `userId`, `purpose: 'platform_publish_fee'`, optional `tripId` — used to verify the payment is for *this* user and *this* purpose.
- **Replay protection** (`verifyPublishPaymentIntent`, lines 104–145):
  - status must be `succeeded`
  - amount must equal `PLATFORM_PUBLISH_FEE_CENTS` (2500)
  - currency must be `usd`
  - `purpose` and `userId` in metadata must match
  - **`publishFeePaymentIntentId` must not already exist on any Trip** — one PaymentIntent = one publish
- **Webhooks:** verification is request/response (no webhook flow). The trip page polls `/api/stripe/verify` after the Payment Element confirms.

### 9.2 Google APIs

- **Client:** `@googlemaps/js-api-loader` + `VITE_GOOGLE_MAPS_API_KEY` → Places Autocomplete for the wizard's location field.
- **Server:** `GOOGLE_PLACES_API_KEY` → Nearby Search / Text Search / Geocoding via `/api/trips/[tripId]/activities/discover`.

The keys are distinct because the client one is publicly visible (and should be domain-restricted in Google Cloud); the server one should be IP-restricted to Vercel egress.

### 9.3 Resend

Transactional email. Templates live in `src/lib/server/email/render/` as TypeScript files that emit HTML strings. Brand tokens (colors, fonts, radii) come from `src/lib/server/email/brand.ts`, which mirrors `theme.css` — emails can't use CSS variables, so hex codes are duplicated.

Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (must be on a verified domain), `RESEND_FROM_NAME`, optional `EMAIL_LOGO_URL`.

### 9.4 Supabase

Used **only for the Postgres database** in this app. The codebase imports `@supabase/supabase-js` but the auth flow is fully native (bcryptjs + DB sessions). The Supabase service-role key is set but not exercised for auth.

- App connection: Supabase **pooler** on port `6543`
- Migrations: **direct** connection on port `5432`

---

## 10. API surface

### 10.1 Web

REST endpoints at `/api/*` are SvelteKit `+server.ts` files. Conventions:

- **Input validation** via Zod schemas in `src/lib/server/validation.ts`. `createErrorResponse(code, message)` standardizes error shape.
- **Authn check** is per-handler (no global middleware). Most write endpoints call `requireAuth()` and then `requireTripAccess()` (from `trip-access.ts`) to confirm the user is a member of the trip.
- **Internal-only writes** (those called by server code, not the browser) gate with `requireInternalApiKey(event)` and require `X-Internal-Api-Key`.
- **Rate limit** helpers in `rate-limit.ts` (in-memory token bucket; appropriate for a single-region deployment, would need a shared store for multi-region).

### 10.2 Mobile

`/api/mobile/auth` (POST) handles login/register for a future native client.

- **Token-based**: returns a session token in the JSON body; client supplies it as `Authorization: Bearer …` on subsequent calls.
- **90-day TTL** for mobile sessions (web is 7 days).
- **CORS**: helper in `src/lib/server/mobile-cors.ts` returns permissive headers for native clients. **The web app does not use these endpoints** — they're isolated to the `/api/mobile/*` namespace.

Native app isn't in v1 scope (PRD §6), but the surface is preserved so the app team can wire up without backend changes.

---

## 11. Security model

| Concern | Mechanism | Where |
|---|---|---|
| Web session | `user_session` cookie, httpOnly + sameSite=strict + secure | `session.ts` |
| Mobile session | Bearer token, 90-day TTL, CORS-restricted endpoint | `/api/mobile/auth`, `mobile-cors.ts` |
| Password storage | bcryptjs | `user-auth.ts` |
| Internal-only API writes | `X-Internal-Api-Key` header | `api-protection.ts` |
| Cron endpoints | `Authorization: Bearer $CRON_SECRET` (when set) | `cron-auth.ts` |
| Stripe replay | Once-only PaymentIntent ID stored on Trip | `stripe.ts:136–142` |
| Closed-trip write gate | 403 on edit routes after `checkOutDate` | `hooks.server.ts:43–66` |
| Trip-membership check | `requireTripAccess()` | `trip-access.ts` |
| Input validation | Zod schemas | `validation.ts` |
| Rate limiting | In-memory token bucket | `rate-limit.ts` |
| Session GC | Lazy 1%-per-request cleanup | `hooks.server.ts:37` |

**No CSRF tokens.** SvelteKit form actions ship with built-in same-origin CSRF protection; same-origin enforcement is enabled by default.

**Known gaps:** No Sentry / error tracking. No structured audit log beyond the `TripActivity` append-only model (which is trip-scoped, not security-focused). No analytics or anomaly detection.

---

## 12. Deployment

- **Adapter:** `@sveltejs/adapter-vercel` → Vercel serverless functions (Node 20 runtime).
- **Region:** `iad1` (US-East). Single region, matching the US-only launch (PRD §6).
- **Build:** `npm run build` (Vite). `postinstall` regenerates the Prisma client so Vercel's build pulls it in.
- **DB migrations:** `prisma migrate deploy` (`npm run db:migrate`). Run manually before app deploy when schema changes; CI doesn't currently gate on this.
- **Env vars** (set in Vercel project settings; mirror in local `.env`):
  - **Database:** `DATABASE_URL` (pooler), `DIRECT_URL` (direct, for migrations)
  - **Supabase:** `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (or `STRIPE_PUBLIC_KEY`) — must be same test/live mode
  - **Google:** `VITE_GOOGLE_MAPS_API_KEY` (client, domain-restricted), `GOOGLE_PLACES_API_KEY` (server, IP-restricted)
  - **Resend:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, optional `EMAIL_LOGO_URL`
  - **Auth/misc:** `INTERNAL_API_KEY` (required), `CRON_SECRET` (recommended), `APP_BASE_URL`

See `docs/GETTING_STARTED.md` (TBD) for local setup detail.

---

## 13. Performance

- **Server-Timing header** added in `hooks.server.ts:73`. A dev-only `<PerfBadge>` reads it client-side via the `Server-Timing` / Resource Timing APIs and displays the server-side request duration. Cheap header, safe to leave on in prod.
- **Lazy session GC** (1% per-request probability) avoids a separate scheduled job for cleanup.
- **Prisma client singleton** (`prisma.ts`) avoids cold-start connection storms.
- **PostgreSQL connection pooler** (Supabase 6543) handles per-function-invocation connections so serverless cold starts don't exhaust DB connections.
- **`web-vitals`** package is installed — wire-up TBD; no visible reporting endpoint yet.

---

## 14. Known technical debt

1. **Legacy models.** `Reservation` and `GuestSubmission` look superseded by `RSVP + RoomAssignment`. Audit before deleting.
2. **No error tracking.** Sentry (or equivalent) needs to land before public launch. Going to public traffic blind = fragile.
3. **No analytics / event instrumentation.** Re-approval funnel data is the single most important thing to measure (PRD §9).
4. **E2E test status unknown.** Playwright tests exist in `/e2e/` — confirm pass/fail status, wire into CI.
5. **Cron cleanup pending.** `waitlist` and `emails` crons to be removed (PRD §5.10); upstream callers need event-driven rewiring first.
6. **DST drift on cron schedule.** Vercel crons run UTC; the 7am/12pm/8pm ET targets drift one hour at DST boundaries. Acceptable for MVP; would need handler-side timezone arithmetic for year-round precision.
7. **In-memory rate limiter** won't survive multi-region deployment. Acceptable for `iad1`-only MVP.
8. **Mobile API endpoint scaffold** is in place but unused (no native app shipped). Either ship the app or freeze and document the API contract before changes.
9. **`@sveltejs/adapter-auto`** is in `devDependencies` alongside `adapter-vercel`. The config uses `adapter-vercel`; `adapter-auto` can be removed.

---

## Appendix A: where to find things

| Looking for | Open |
|---|---|
| Pricing math | `src/lib/server/pricing-canonical.ts` |
| Cost re-approval rule | `src/lib/server/cost-reapproval.ts` |
| Auth & sessions | `src/lib/server/session.ts`, `user-auth.ts`, `hooks.server.ts` |
| Stripe replay protection | `src/lib/server/stripe.ts:104–145` |
| Cron auth | `src/lib/server/cron-auth.ts` |
| Email templates | `src/lib/server/email/render/` |
| Design tokens | `src/styles/theme.css`, `src/lib/server/email/brand.ts` |
| Feature flags | `src/lib/config/features.ts` |
| Validation schemas | `src/lib/server/validation.ts` |
| Trip access checks | `src/lib/server/trip-access.ts` |
| Vercel config (regions, crons) | `vercel.json` |
| DB schema | `prisma/schema.prisma` |
