# PF1 — Trip Dashboard Server Load: Root-Cause Diagnosis

**Story:** PF1 (Epic 9, `docs/PLAN.md`) · **Status:** read-only diagnosis, no code changed.
**Route profiled:** `src/routes/trips/[tripId]/+layout.server.ts` + `src/routes/trips/[tripId]/+page.server.ts`
**Reported cost:** 3.8–5.0s server time (`perf-log.csv` per the story; the CSV does not yet exist in this
checkout — the `/api/perf` dev endpoint that would produce it, added in `0286378`, only writes rows once a
dev server is run and navigated. **All findings below are static code-reading analysis, not a captured
trace.** Every number is labeled measured vs. estimated.)

## Method

Read both load functions end-to-end plus every helper they call: `trip-access.ts`, `pricing-canonical.ts`,
`pricing.ts`, `guest-estimate.ts`. Traced every `prisma.*` call reachable from a single dashboard request and
every `await` that blocks the next step, to find (a) N+1 loop patterns and (b) redundant/duplicate work.

## Root causes, ranked by likely impact

### 1. The same trip/rooms/beds graph is independently re-fetched 4–7 times per request (highest impact)

The layout already runs one large `prisma.trip.findUnique` with ~13 nested `include` branches
(`+layout.server.ts:229-263`: rooms→beds, members→user, mealPlan, mealSlots→assignedUser,
activities→participants→user, invoices, reservations, rsvps→user, roomAssignments→room/bed/user,
invites→invitedBy/recipient, tripActivities, extraCostRules). That single call is itself expensive — Prisma
has no `relationJoins` preview feature enabled here (confirmed: no `previewFeatures` entry in
`prisma/schema.prisma`), so this many nested to-many `include`s fans out into a double-digit number of
separate SQL round-trips per invocation (estimated, not measured — recommend enabling
`PRISMA_LOG_QUERIES=true`, already wired in `src/lib/server/prisma.ts:8`, to get an exact count in PF2).

But that same trip graph (or a subset of it) is then **fetched again from scratch, independently**, by several
helpers called during the same request, each running its own `prisma.trip.findUnique({ include: { rooms: { include: { beds }}}, ... } )`:

- `computeCommittedFundsFromYesRsvps(tripId)` — `src/lib/server/pricing-canonical.ts:708-718` (rooms/beds/rsvps/roomAssignments). Called unconditionally, `+layout.server.ts:269`.
- `getCostAtMaxParticipation(tripId)` — `src/lib/server/pricing-canonical.ts:654-663` (rooms/beds). Called for hosts only, `+layout.server.ts:270`.
- `calculatePrice()` (legacy engine) — `src/lib/server/pricing.ts:57-67` (rooms/beds). Called once per the guest's own room assignment in `+page.server.ts:69-77` (usually N=1, but see #2).
- `calculateReservationPrice()` (canonical engine) — `src/lib/server/pricing-canonical.ts:829-841` (rooms/beds/rsvps/roomAssignments→room). This is called *from inside* `calculatePrice()`'s `per_bed` branch (`pricing.ts:91-104`) — so a per_bed guest's single price lookup on the dashboard triggers **two** full trip fetches back to back (one in `calculatePrice`, one in `calculateReservationPrice`), not one.
- `computeGuestEstimateRange(tripId, user.id)` — `src/lib/server/guest-estimate.ts:105-127` — its own `Promise.all` re-fetches trip+rooms+beds+roomAssignments, **plus** a fresh `roomAssignment.findMany` for the whole trip, **plus** a fresh `rSVP.findUnique` for the same user whose RSVP the layout *and* the page have already fetched (see #4). Called for every guest whose RSVP status is `yes`, `+page.server.ts:86-95`.

None of these helpers accept an already-loaded trip object — they all re-query Prisma from `tripId` alone. For
a `yes`-RSVP guest on a `per_bed` trip, one dashboard page view can trigger on the order of 6+ independent
`trip.findUnique`-shaped queries carrying largely the same rooms/beds/roomAssignments payload. This is the
single biggest suspect for the 3.8–5.0s figure: it's not one slow query, it's the *same* moderately-expensive
relational fetch paid for repeatedly, once per helper, with no request-scoped cache or shared data passed
between them.

**PF2/PF3 target:** batch this. The trip + rooms + beds + rsvps + roomAssignments shape only needs to be
fetched once per request; every helper above should accept the already-loaded trip (or a request-scoped
memoized fetch) instead of re-querying. This is explicitly a pricing-adjacent change (touches
`calculateReservationPrice`'s call sites and `computeGuestEstimateRange`), so **PF3 should coordinate with
pricing-be per CLAUDE.md** — the math must not change, only how many times the identical inputs are fetched
and how many times the identical result is (re)computed.

### 2. Literal N+1 loop: `computeGuestEstimateRange` PER_BED branch

`src/lib/server/guest-estimate.ts:232-264` (also mirrored in `computeGuestEstimateWithOverrides`,
lines 533-576, though that function isn't on the dashboard hot path):

```ts
for (const a of guestAssignments) {
    if (!a.bedId) continue;
    const fav = perBedSelectionRangeForTripBedIds(...);   // pure compute, fine
    const ex = perBedSelectionRangeForTripBedIds(...);    // pure compute, fine
    ...
    guestDisplayedTotal += (
        await calculateReservationPrice({ tripId, roomId: a.roomId, bedId: a.bedId, ... })
    ).totalPrice;
}
```

This is a sequential `await` inside a `for` loop (not even parallelized with `Promise.all`), and each iteration
calls `calculateReservationPrice`, which — per root cause #1 — does its own full
`prisma.trip.findUnique` with rooms/beds/rsvps/roomAssignments. For a guest with multiple bed assignments on
a per_bed trip, this is a textbook N+1: N full trip fetches, done one at a time, purely to price N beds the
guest already holds.

In practice most guests hold 1 bed assignment, so on a typical dashboard load this loop runs once — but it
still stacks on top of the other trip re-fetches in #1, and for any guest with 2+ bed assignments the cost
multiplies linearly and serially (no concurrency).

**PF2 target:** batch/parallelize this loop (`Promise.all` at minimum) and, ideally, since the pricing math for
one bed given a known occupancy map is pure/local (`computePerBedLivePriceForBed` — no DB call, see
`pricing-canonical.ts:371-389`), avoid calling `calculateReservationPrice` (which re-derives everything from a
fresh DB fetch) per assignment at all — compute the occupancy map once and call the pure per-bed price
function directly per assignment instead. Needs pricing-be sign-off since it touches inputs feeding
`calculateReservationPrice`.

### 3. Serial "waves" of independent queries in `+layout.server.ts` that don't need to be serial

The layout does, in order:

1. `getUserTripMembership(tripId, user.id)` (`trip-access.ts:3-16`) — **awaited alone**, before anything else starts, and its `include: { trip: true, user: true }` pulls the *entire* `Trip` row (no `select`) even though only `.role` / `.inviteStatus` are read off the result (`+layout.server.ts:207,225-227`). The `trip` field on this result is discarded — the layout re-fetches trip data fully in the next step regardless. One wasted round trip carrying an unused full trip row, and it blocks step 2 from starting.
2. `Promise.all([...7 items...])` (`+layout.server.ts:228-275`) — the big trip query, `getUserTrips`, the user's RSVP, `computeCommittedFundsFromYesRsvps`, `getCostAtMaxParticipation` (host), and the tooltip-dismissal lookup. Good that these are parallelized.
3. A **second** `Promise.all([...4 items...])` (`+layout.server.ts:283-310`) for trip games, polls, gallery files, and pending-member count — none of these depend on anything produced in step 2, so they could have been included in step 2's `Promise.all` instead of forming a second sequential wave.
4. Up to four more **sequential, one-at-a-time** conditional queries after that: `pollsBadgeCount` (`:324-327`), `hostedTripCount` for the first-trip tour check (`:337-339`, host only), `yesRsvpCount` for the first-rsvp tour check (`:346-348`, guest only), and the `household.findUnique` lookup (`:407-410`, non-host only).

None of steps 3–4 depend on each other or on anything not already available after step 2, but they're written
as separate sequential `await`s rather than folded into the existing `Promise.all`s. Each wave costs a full
network round-trip to the DB; against a hosted Supabase instance (not co-located with the Vercel function)
each round trip plausibly costs tens of ms just in transit, independent of query execution time — stacking
4–6 of them serially is a believable chunk of the reported multi-second total, additive to root cause #1.

**PF2 target:** merge steps 2–4 into the smallest number of `Promise.all` waves the data dependencies allow
(all four Epic-3 conditional counts have no cross-dependency and can run alongside the big trip query), and
switch `getUserTripMembership`'s `include: { trip: true, user: true }` to a `select` of just the fields the
layout actually reads (`role`, `inviteStatus`, `id`) so it isn't pulling a discarded full trip row before the
real trip query even starts.

### 4. `+page.server.ts` re-fetches data the layout already loaded

- `userRsvp` — `+page.server.ts:40` does `prisma.rSVP.findFirst({ where: { tripId, userId: user.id }})`. The
  layout already fetched the identical row via `prisma.rSVP.findUnique({ where: { tripId_userId: { tripId, userId: user.id }}})`
  at `+layout.server.ts:266-268` and returns it as `userRsvp` in `parentData` — but `+page.server.ts` never
  reads `parentData.userRsvp`, it just queries again.
- `roomAssignments` — `+page.server.ts:45-48` runs `prisma.roomAssignment.findMany({ where: { tripId }, include: assignmentInclude })` for **every** assignment on the trip. The layout's big trip query already fetched `trip.roomAssignments` with an equivalent (slightly larger) include at `+layout.server.ts:247-253`, available as `parentData.trip.roomAssignments`. This is a full duplicate of trip-wide data.
- `guestRoomAssignments` — `+page.server.ts:49-54` runs a third `roomAssignment.findMany`, scoped to the current user, when this could be derived in-memory by filtering the `roomAssignments` array (or `parentData.trip.roomAssignments`) already in hand instead of a third DB call.

**PF2 target:** thread `parentData.trip.roomAssignments` and `parentData.userRsvp` through instead of
re-querying; derive `guestRoomAssignments` via `.filter()` in memory.

## What's *not* a problem here (checked, ruled out)

- The dashboard does **not** loop pricing calculations over every guest on the trip — `calculatePrice`/`calculateReservationPrice` calls in this route are scoped to the current user's own assignment(s), not all trip members. The N+1 in #2 is per-assignment for one guest, not per-guest for the whole trip.
- The big `Promise.all` in step 2 of the layout (root cause #3) is correctly parallelized — it's steps 3–4 layered after it that are the problem, not step 2 itself.
- `getPricingPreview`, `computeRoomPricing`, and `computePerBedDisplayPricing` (`pricing-canonical.ts`) are not called anywhere in this route — they're presumably used elsewhere (settings/wizard); not in scope here.

## Recommendations for PF2 vs PF3

**PF2 (N+1 / batching — perf-be, no pricing-math change):**
1. Eliminate the layout's discarded full-trip fetch in `getUserTripMembership` — `select` only `role`/`inviteStatus`/`id` (`src/lib/server/trip-access.ts:3-16`, call site `+layout.server.ts:207`).
2. Merge the layout's second `Promise.all` (games/polls/gallery/pending-count, `+layout.server.ts:283-310`) and the four trailing conditional single queries (`:324-410`) into the first `Promise.all` wave — none have a data dependency that requires waiting.
3. In `+page.server.ts`, use `parentData.userRsvp` and `parentData.trip.roomAssignments` instead of re-querying (`+page.server.ts:40,45-54`); derive `guestRoomAssignments` in memory.
4. Parallelize (`Promise.all`) the per-bed-assignment loop in `computeGuestEstimateRange` (`guest-estimate.ts:232-264`) at minimum; ideally replace its per-iteration `calculateReservationPrice` DB round-trip with the already-in-scope pure `computePerBedLivePriceForBed` (coordinate with pricing-be, since it changes how a canonical-engine input is sourced).
5. Enable `PRISMA_LOG_QUERIES=true` locally for one profiling pass to get an exact, *measured* per-request query count and replace the "estimated" figures in this doc — recommended as PF2's first step before changing code, to confirm the ranking above against real numbers.

**PF3 (pricing memoization/caching — perf-be, coordinate with pricing-be, no result change):**
1. Introduce a request-scoped memoized "get trip with rooms/beds/rsvps/roomAssignments for tripId" loader and have `computeCommittedFundsFromYesRsvps`, `getCostAtMaxParticipation`, `calculatePrice`, `calculateReservationPrice`, and `computeGuestEstimateRange` all consume it instead of each independently calling `prisma.trip.findUnique` (root cause #1). This is the highest-leverage fix in this report.
2. Once memoized, re-verify (unit tests + a manual diff of dashboard numbers before/after) that `calculateReservationPrice`'s returned totals are byte-for-byte identical — CLAUDE.md is explicit that pricing *results* must not change, only call/fetch volume.
3. `+page.server.ts`'s guest price (`userReservationPrice`, lines 63-82) currently calls the **legacy** `calculatePrice()` (`pricing.ts`) rather than the canonical engine directly; per `PLAN.md` PR4 this is already flagged for pricing-be to retarget at `calculateReservationPrice`. PF3 should sequence after or alongside PR4 rather than duplicate that work.

## Numbers: measured vs. estimated

- **Measured:** none. `perf-log.csv` does not exist in this checkout; the dev perf-badge/`/api/perf` pipeline (from `0286378`) has not been exercised in this session, per the read-only-diagnosis scope of PF1.
- **Estimated (static analysis):** 4–7 independent full/partial `trip.findUnique`-shaped queries per dashboard request for a `yes`-RSVP per_bed guest (root cause #1); the layout's single big query fanning out into a double-digit number of underlying SQL statements due to ~13 nested `include` branches with no `relationJoins` preview feature enabled; 3–5 sequential round-trip "waves" in the layout alone (root cause #3) before `+page.server.ts` even starts its own queries.
- **Recommended first PF2 action:** set `PRISMA_LOG_QUERIES=true` (already wired in `src/lib/server/prisma.ts:8`) and capture one real trace of `/trips/[tripId]` to replace every "estimated" figure above with a measured one, and to confirm the fix's impact against the <800ms target.
