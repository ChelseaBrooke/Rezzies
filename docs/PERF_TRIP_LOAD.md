# Trip dashboard load — as-built performance diagnosis (PF1)

> **Story:** PF1 (Epic 9, [`docs/PLAN.md`](./PLAN.md) line 148) — *profile `trips/[tripId]/+layout.server.ts` + `+page.server.ts`, find the 3.8–5.0 s server cost.*
> **Scope:** read-only. No application code was changed. Fixes are PF2 (batching) and PF3 (pricing memoization).
> **Measured:** 2026-08-27, live against the project's Supabase database. Numbers below are real, not estimates.

---

## TL;DR

One trip-dashboard request issues **93–136 SQL statements** depending on who is looking. The dominant cost is **not** what the story guessed.

| Rank | Contributor | Share of server wall | The actual problem |
|---|---|---|---|
| 1 | `+layout.server.ts:229` mega `trip.findUnique` | **39–55 %** | Prisma 5 has no relation-join enabled, so its 12 `include` branches become **23 sequential round trips inside one transaction** |
| 2 | `+page.server.ts:88` `computeGuestEstimateRange` | **22 %** (guests only) | Re-fetches the trip, rooms, beds, RSVPs and assignments that the layout already loaded, then does a pricing call that re-fetches them again |
| 3 | `+page.server.ts:39-55` | **10–15 %** | `roomAssignment.findMany` and `rSVP.findFirst` are byte-for-byte duplicates of rows the layout already returned |
| 4 | `+layout.server.ts:207` `getUserTripMembership` | **8–11 %** | Pulls the **whole** Trip row + whole User row just to read `membership.role` |
| 5 | `+page.server.ts:67-78` `calculatePrice` per assignment | **6 %** (guests only) | Genuine N+1: one full trip re-fetch per assignment |
| 6 | 3 × redundant trip re-fetch inside `+layout.server.ts:228` | folded into #1 | `computeCommittedFundsFromYesRsvps` and `getCostAtMaxParticipation` each re-`findUnique` the same trip in parallel with the mega query |
| 7 | `src/routes/+layout.server.ts:5` duplicate session lookup | ~3 % | `hooks.server.ts:34` already resolved the user into `locals.user` |

**Roughly 56 % of the statements on a guest dashboard load (76 of 136) are re-reads of data already in memory.** A prototype that keeps the same data but issues it as one parallel wave cut the guest load from **136 statements / 16.1 s → 60 statements / 5.5 s**; adding Prisma's `relationJoins` took it to **9 statements-worth of SELECTs / 36 statements / 1.7 s**. See [Prototypes](#prototypes-what-pf2-can-actually-reach).

Two things the story suspected that turned out **not** to be the problem:

- **There is no N+1 over guests.** `computeCommittedFundsFromYesRsvps` was already de-N+1'd (see its comment at `src/lib/server/pricing-canonical.ts:705-707`) and costs a flat 5 SELECTs no matter how many people said yes. The N+1s that remain scale with *the viewing guest's own bed assignments* (typically 1), not with party size.
- **`getPerBedRangeGuestCounts` / `computePerBedPricingAtHeadcount` / `computeRoomPricing` never run on this route.** They are on `/trips/[tripId]/rsvp` and in `pricing-display.ts`. `/rsvp` is in fact the slowest page in `perf-log.csv` (19.9 s) — a separate story. **`getPricingPreview` (`pricing-canonical.ts:976`) has zero callers repo-wide** — it is dead code, not a perf item.

---

## How this was measured

**Live, not static analysis.** A throwaway harness in the session scratchpad replayed the exact load sequence against the real database, with `prisma.$on('query')` counting every statement.

- It **imports the real server modules** (`trip-access.ts`, `pricing-canonical.ts`, `guest-estimate.ts`, `pricing.ts`) rather than re-implementing them, by installing an instrumented client on `globalThis.prisma` before import — `src/lib/server/prisma.ts:10-14` picks it up. So the helper costs below are the production code paths.
- The two inline `prisma.trip.findUnique` blocks in the load functions are transcribed verbatim from the source.
- Statement counts are **perfectly deterministic** — identical on every repeat run. Wall milliseconds are not.

### The one caveat you must read before quoting a millisecond

These numbers come from a **dev laptop talking to `aws-1-us-east-2.pooler.supabase.com`**, which is the same link that produced `perf-log.csv`. On that link a single round trip costs **~90–190 ms**:

```
warm SELECT 1:  min 468 ms  median 476 ms  max 489 ms   (per Prisma operation, = 4 statements)
bare prisma.trip.findUnique (1 SELECT):  median 500 ms / 4 statements
```

So **wall time ≈ statement count × RTT**. On Vercel in-region the RTT is ~1–3 ms and the absolute numbers collapse, but the *ratios and the ranking transfer unchanged*. Treat **statement count as the durable metric** and wall ms as "what this shape costs when the DB is far away."

Repeat runs of the identical workload landed between 8.0 s and 18.4 s for the same 118-statement load — that spread is network, not code. Where a single number is quoted below it is a median of 3–5 runs.

---

## What `perf-log.csv` actually shows

Mined from the repo-root `perf-log.csv` (590 rows, `kind,metric` = `load|goto|link` × `server|TTFB|total|LCP|…`). The `server` metric is the `Server-Timing: srv;dur=` header set in `src/hooks.server.ts:73-74`, so it is true server time.

**Trip dashboard root** (`/trips/<uuid>`, `metric=server`, n = 27):

| min | p25 | median | p75 | max |
|---|---|---|---|---|
| 930 ms | 4 106 ms | **4 819 ms** | 8 160 ms | 20 669 ms |

For contrast, `/trips` (the index) over the same period: n = 22, median **1 834 ms**. Trip *sub*-routes are worse than the root: n = 39, median **6 066 ms**, max 22 928 ms (`/itinerary`), with `/rsvp` the single worst sample at **19 929 ms**.

The 3.8–5.0 s figure in the PLAN corresponds to the clean `goto` samples:

```
2026-06-13T19:53:56Z  goto  /trips/e10cba98…  server  3777.5
2026-06-13T19:53:44Z  goto  /trips/c82209cd…  server  4894.1
2026-06-13T19:54:55Z  goto  /trips/361083dd…  server  5029.9
2026-06-21T16:46:32Z  goto  /trips/e10cba98…  server  4223.1
2026-06-21T16:46:41Z  link  /trips/e10cba98…  server  3540.5
```

**The most important thing in this file:** every one of those trips is *empty*. Checked against the live DB:

| trip | rooms | beds | members | RSVPs | roomAssignments |
|---|---|---|---|---|---|
| `e10cba98…` | 4 | 5 | 1 | 0 | 0 |
| `cb20b181…` | 4 | 4 | 1 | 0 | 0 |
| `361083dd…` | 1 | 1 | 1 | 0 | 0 |
| `c82209cd…` | 4 | 4 | 1 | 0 | 0 |

**3.8–5.0 s with zero guests and zero assignments.** Whatever is slow is a *fixed* per-request cost, not something that scales with the party. (The 11–20 s outliers at `2026-06-21T17:06` are a burst of six concurrent loads against a dev server — treat them as a queueing artefact, not a code signal.)

The largest trip in the whole database is 4 members / 3 yes-RSVPs / 4 assignments, so no measurement here — and no production sample — exercises a genuinely large party.

---

## 1. Call-path map

### `src/hooks.server.ts` (runs before every load)

| # | Line | Work | SQL |
|---|---|---|---|
| 1 | `hooks.server.ts:34` | `getSessionUser(event.cookies)` → `session.ts:39` `session.findUnique` + `include user` | 2 SELECTs |
| — | `hooks.server.ts:37-41` | 1 % chance of fire-and-forget `cleanupExpiredSessions()` — non-blocking | 0–1 |
| — | `hooks.server.ts:44-48` | trip lookup, **write methods only** — not on a GET dashboard load | 0 |

### `src/routes/+layout.server.ts` (root layout, runs in parallel with the trip layout)

| # | Line | Work | SQL |
|---|---|---|---|
| 2 | `+layout.server.ts:5` | `getSessionUser(cookies)` **again** — `locals.user` was already populated at `hooks.server.ts:34` | 2 SELECTs |

### `src/routes/trips/[tripId]/+layout.server.ts`

Branches that do **not** apply to an authenticated dashboard load, listed for completeness: `:38` `invite.findUnique` and `:56` preview `trip.findUnique` (anonymous + invite token only); `:160` `trip.findUnique` (`/join/household/` only).

The authenticated path:

| # | Line | Work | SQL statements |
|---|---|---|---|
| 3 | `:207` | `getUserTripMembership(tripId, user.id)` → `src/lib/server/trip-access.ts:4-16`, `include: { trip: true, user: true }` | **6** (TripMember, Trip, User + txn) |
| 4 | `:229-263` | `prisma.trip.findUnique` with 12 `include` branches | **26** — see below |
| 5 | `:265` | `getUserTrips(user.id)` → `trip-access.ts:94-113` | 5 |
| 6 | `:266` | `prisma.rSVP.findUnique({ tripId_userId })` | 4 |
| 7 | `:269` | `computeCommittedFundsFromYesRsvps(tripId)` → `pricing-canonical.ts:704`, its own `trip.findUnique` at `:708` | 8 |
| 8 | `:270` | `getCostAtMaxParticipation(tripId)` **host only** → `pricing-canonical.ts:653`, its own `trip.findUnique` at `:654` | 6 |
| 9 | `:271` | `prisma.user.findUnique` for `dismissedTooltips` | 4 |
| | | *(4–9 run in one `Promise.all` at `:228`)* | |
| 10 | `:284` | `tripGame.findMany` | 4 |
| 11 | `:288` | `poll.findMany` take 30 | 4 |
| 12 | `:300` | `tripFile.findMany` | 4 |
| 13 | `:309` | `tripMember.count` pending — **host only** | 4 |
| | | *(10–13 run in one `Promise.all` at `:283`)* | |
| 14 | `:324` | `poll.count` — only if a `polls_visit_<tripId>` cookie exists | 0–4 |
| 15 | `:337` | `tripMember.count` hosted trips — only if host **and** `feature-tour:first-trip` not dismissed | 0–4 |
| 16 | `:346` | `rSVP.count` — only if guest, RSVP yes, and `feature-tour:first-rsvp` not dismissed | 0–4 |
| 17 | `:407` | `household.findUnique` + `include members` — **everyone who is not host/co-host** | 4 |

Steps 14–17 are **sequential `await`s after** the two `Promise.all` blocks — each costs a full serial round trip.

The mega `trip.findUnique` at `:229`, traced statement by statement (real capture, biggest trip):

```
 1   88ms BEGIN
 2   92ms DEALLOCATE ALL
 3  557ms Trip
 4  382ms Room                 ← rooms
 5  189ms Bed                  ← rooms.beds
 6  179ms TripMember           ← members
 7  191ms User                 ← members.user
 8  191ms MealPlan             ← mealPlan          (no reader — see §6)
 9  195ms MealSlot             ← mealSlots
10  179ms User                 ← mealSlots.assignedUser
11  195ms Activity             ← activities
12  207ms ActivityParticipant  ← activities.participants
13  188ms User                 ← activities.participants.user
14  193ms Invoice              ← invoices
15  197ms Reservation          ← reservations      (no reader)
16  191ms RSVP                 ← rsvps
17  187ms User                 ← rsvps.user
18  193ms RoomAssignment       ← roomAssignments   (dead fallback only)
19  295ms Room                 ← roomAssignments.room
20  187ms Bed                  ← roomAssignments.bed
21  184ms User                 ← roomAssignments.user
22  191ms Invite               ← invites           (no reader)
23  179ms User                 ← invites.invitedBy/.recipient
24  196ms TripActivity         ← tripActivities    (no reader)
25  191ms ExtraCostRule        ← extraCostRules
26   91ms COMMIT
                               → 23 SELECTs, 26 statements, median 5 091 ms
```

`prisma/schema.prisma:4-6` declares no `previewFeatures`, so `relationJoins` is off and every `include` branch is its own serial statement. **This one call is the single biggest line item on the page.**

### `src/routes/trips/[tripId]/+page.server.ts`

| # | Line | Work | SQL statements |
|---|---|---|---|
| 18 | `:32` | `await parent()` — blocks on the entire layout chain above | 0 |
| 19 | `:40` | `prisma.rSVP.findFirst({ tripId, userId })` — **same row as layout `:266`** | 4 |
| 20 | `:41` | `prisma.invoice.findMany({ tripId, userId })` — subset of layout `:244` `invoices` | 4 |
| 21 | `:45` | `prisma.roomAssignment.findMany({ tripId })` + 3 includes — **identical shape to layout `:247-253`** | 7 |
| 22 | `:51` | `prisma.roomAssignment.findMany({ tripId, userId })` — **a JS `filter` of #21**, guests only | 7 |
| | | *(19–22 run in one `Promise.all` at `:39`)* | |
| 23 | `:67-78` | `Promise.all(myAssignments.map(a => calculatePrice(…)))` → **N+1**, guests only | 6 or 15 **per assignment** |
| 24 | `:88` | `computeGuestEstimateRange(tripId, user.id)` — guests with a `yes` RSVP | 21–30 |

---

## 2. Query inventory

Measured per scenario. Counts are exact and reproduce identically on every run.

| Scenario | trip shape | SELECTs | pooler overhead | **total statements** | wall (this link) |
|---|---|---|---|---|---|
| Host, empty trip (`e10cba98`) — *the perf-log trip* | 4 rooms / 5 beds / 1 member / 0 RSVPs | 42 | 51 | **93** | 7.6 s |
| Host, largest trip (`8fc036a8`) | 3 rooms / 4 members / 3 yes / 4 assignments / 20 meal slots / 8 invoices | 52 | 51 | **103** | 10.9 s |
| Guest `PER_PERSON`, same trip | + 1 own assignment, RSVP yes | 70 | 66 | **136** | 16.1 s |
| Guest `PER_BED` (`76344db3`) | 5 rooms / 2 members / 0 own assignments | 58 | 60 | **118** | 12.3 s |

> **Casing note.** Scenario labels above quote the value **as stored** — every `Trip.pricingModel` row in this database is UPPER_SNAKE (`PER_PERSON`, `PER_BED`), matching `prisma/schema.prisma`'s `@default("PER_PERSON")`. `CLAUDE.md` says stored/compared values should be snake_case, so the DB has drifted from the rule; the code papers over it by lowercasing at `pricing.ts:81` and `pricing-canonical.ts:867` before every comparison. Everywhere below that a **code branch** is named, this report uses the lowercase form the comparison actually sees (`per_bed`), and reserves UPPER_SNAKE for stored row values. Worth a `pricing-be` decision on which way to normalise — out of scope for PF1.

Same-row re-reads on the 136-statement guest load:

| table | times fetched in one request |
|---|---|
| Trip (full row) | **7** |
| Room | **10** |
| Bed | **9** |
| RoomAssignment | **7** |
| RSVP | **7** |
| User | 9 |
| Session | 2 |

### N+1 sites — every one, with what it multiplies by

| # | Site | Loop | Multiplies by | Cost per iteration | Parallel? |
|---|---|---|---|---|---|
| **N+1 ①** | `src/routes/trips/[tripId]/+page.server.ts:67-78` | `myAssignments.map(a => calculatePrice(…))` | **the viewing guest's own room assignments** | `per_person` **6 statements**; `per_bed` **15 statements** (`pricing.ts:57` fetches the trip, then `pricing.ts:91` calls `calculateReservationPrice` which fetches it *again* at `pricing-canonical.ts:829`) | yes (`Promise.all`) |
| **N+1 ②** | `src/lib/server/guest-estimate.ts:232-264` | `for (const a of guestAssignments) { … await calculateReservationPrice(…) }` at `:255` | **the viewing guest's own room assignments**, `per_bed` only | **9 statements**, and it is a **sequential `await` inside a `for` loop** — no `Promise.all` | **no** |
| Not an N+1 | `src/lib/server/pricing-canonical.ts:749-808` | `for (const userId of yesUserIds)` | — | **0 queries** — already batched; see the comment at `:705-707` | — |
| Not an N+1 | `pricing-canonical.ts:491`, `:527`, `:665` | `trip.rooms.map` / `.reduce` | — | pure in-memory math | — |

**Neither N+1 scales with the size of the party.** They scale with how many beds *the person looking at the page* has claimed — normally 1, occasionally 2–3 for a household. That is why the empty trips in `perf-log.csv` are still 3.8–5.0 s: at zero assignments both N+1s contribute zero, and the page is *still* slow.

The thing that behaves *like* an N+1 but isn't one is **Prisma's relation fan-out**: 12 `include` branches → 23 serial statements. It does not *grow* with row counts — one statement per branch, whatever the branch returns — but it is not perfectly fixed either: Prisma skips a nested query when its parent set comes back empty, which is why the empty trip's `:228` phase is 45 statements against the populated trip's 53. Call it a near-fixed floor that only ever shrinks on sparse trips.

### The other half of the statements

Between **49 % and 55 %** of all statements on a dashboard load are `BEGIN` / `DEALLOCATE ALL` / `COMMIT`, not queries:

```
DATABASE_URL=…pooler.supabase.com:6543/postgres?pgbouncer=true
```

Port 6543 is Supavisor in **transaction pooling** mode. With `pgbouncer=true`, Prisma disables prepared statements and emits `DEALLOCATE ALL` inside a transaction wrapper around **every** operation. A trivial `findUnique` is therefore 4 round trips, not 1. This is infrastructure, not application code — flagged as a separate story in §6.

---

## 3. Pricing cost

### What runs, per dashboard request

| Function | Call site | Runs when | Times per request |
|---|---|---|---|
| `computeCommittedFundsFromYesRsvps` | `+layout.server.ts:269` | always | **1** |
| `getCostAtMaxParticipation` | `+layout.server.ts:270` | host only | **1** |
| `calculatePrice` | `+page.server.ts:69` | guest, has assignments | **1 per own assignment** |
| `calculateReservationPrice` | via `pricing.ts:91` | `PER_BED` only | **1 per own assignment** |
| `computeGuestEstimateRange` | `+page.server.ts:88` | guest with RSVP `yes` | **1** |
| `calculateReservationPrice` | via `guest-estimate.ts:255` / `:313` / `:333` | inside the above | **1 per own assignment** (`PER_BED`) or **1 total** (`per_room`, `per_person`) |

`calculateReservationPrice` total per guest dashboard load:

- `per_person` / `per_person_per_night` → **1** call
- `per_room` → **1** call
- **`per_bed` with A own assignments → 2A calls** — A from `+page.server.ts:69`, A from `guest-estimate.ts:255`

**Not on this route at all:** `getPerBedRangeGuestCounts` (`pricing-canonical.ts:394`), `computePerBedPricingAtHeadcount` (`:629`), `computePerBedDisplayPricing` (`:602`), `computeRoomPricing` (`:429`), `getPricingPreview` (`:976`), and everything in `closing-range.ts` beyond the four pure helpers `computeGuestEstimateRange` calls in-memory at `guest-estimate.ts:141-149`. `computePerBedPricingAtHeadcount` and `computeRoomPricing` belong to `/trips/[tripId]/rsvp/+page.server.ts:166` / `:148` and `pricing-display.ts:107` / `:64`.

### The redundancy

For a `per_bed` guest, these two calls have **identical inputs** and are computed twice per request:

```ts
// src/routes/trips/[tripId]/+page.server.ts:69
calculatePrice({ tripId, roomId: a.roomId, bedId: a.bedId ?? undefined,
                 numberOfGuests: a.partySize ?? 1,
                 checkInDate: trip.checkInDate!, checkOutDate: trip.checkOutDate! })

// src/lib/server/guest-estimate.ts:255
calculateReservationPrice({ tripId, roomId: a.roomId, bedId: a.bedId,
                            numberOfSlots: a.partySize || 1,
                            checkInDate: a.startDate ?? trip.checkInDate,
                            checkOutDate: a.endDate ?? trip.checkOutDate })
```

`a.startDate` / `a.endDate` are null in the MVP (`PRICING.md` fixes the stay factor at 1), so the two resolve to the same arguments and the same answer. That is a clean **PF3** target.

### What each pricing call actually costs

Measured individually against the live DB, medians:

| Call | SELECTs | statements | wall | notes |
|---|---|---|---|---|
| `calculateReservationPrice` (`per_bed`, 1 call) | 6 | 9 | 1 469 ms | `pricing-canonical.ts:829` re-fetches Trip + rooms + beds + yes-RSVPs + all roomAssignments (+ their rooms) |
| `calculatePrice` (`per_bed` wrapper, 1 call) | 9 | 15 | 2 379 ms | `pricing.ts:57` fetch **plus** the above |
| `calculatePrice` (`per_person` wrapper, 1 call) | 3 | 6 | 876 ms | `pricing.ts:57` only; the `:113` dispatch calls `calculatePerPersonPrice` (`pricing.ts:148`), which is pure math |
| `computeCommittedFundsFromYesRsvps` | 5 | 8 | 1 242 ms | flat, independent of guest count |
| `getCostAtMaxParticipation` | 3 | 6 | 951 ms | |
| `computeGuestEstimateRange` (`per_person`, 1 assignment) | **15** | **30** | 3 767 ms | `:105-127` four-way `Promise.all` (9 SELECTs) + `:333` pricing call (6) |
| `computeGuestEstimateRange` (`per_bed`, 0 assignments) | 10 | 22 | 1 719 ms | takes the `:272` branch, no pricing call |
| `computeGuestEstimateRange` (`per_bed`, 1 assignment) | 15 | 30 | 2 925 ms | + 9 statements per additional assignment, **serially** |

Every input `computeGuestEstimateRange` fetches at `guest-estimate.ts:105-127` — the trip with rooms and beds, the yes-RSVPs, all room assignments, the guest's own RSVP — is **already in memory** from `+layout.server.ts:229-263` and `:266` by the time `+page.server.ts:88` calls it.

> **The layout's copy is not a drop-in, though.** `guest-estimate.ts:120-123` fetches assignments with `room: { include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } } }`, whereas the layout's copy at `+layout.server.ts:249` is `room: { select: { id, name, photoUrls } }` — **no `beds`**. PF2 must rehydrate beds from `trip.rooms` (which does carry them, via `+layout.server.ts:233-234`) by joining on `roomId`, not just hand the layout object over and assume the shapes match. Same trap for anything else that reads `assignment.room.beds`.

Functions that loop over guests or beds in memory (no queries, correctly batched, leave them alone): `pricing-canonical.ts:749` (yes-RSVPs), `:496` (beds per room), `:665` (spot count), `guest-estimate.ts:133-137` (slot totals), `buildPerBedOccupancyMap` at `:324`.

---

## 4. Measurements

### Per-phase, guest on the largest trip (`8fc036a8` / user `f50d80eb`, `PER_PERSON`)

| phase | wall | statements | share of wall |
|---|---|---|---|
| `hooks.server.ts:34` session | 482 ms | 4 | 3.0 % |
| `+layout.server.ts:5` session (duplicate) | 488 ms | 4 | 3.0 % † |
| `[tripId]/+layout.server.ts:207` membership | 1 265 ms | 6 | 7.9 % |
| **`:228` Promise.all (mega + trips + rsvp + committed + user)** | **6 345 ms** | **47** | **39.4 %** |
| `:283` Promise.all (games + polls + files) | 689 ms | 13 | 4.3 % |
| `:407` household | 536 ms | 4 | 3.3 % |
| `+page.server.ts:39` Promise.all | 1 684 ms | 22 | 10.5 % |
| `+page.server.ts:67` `calculatePrice` ×1 | 1 018 ms | 6 | 6.3 % |
| **`+page.server.ts:88` `computeGuestEstimateRange`** | **3 583 ms** | **30** | **22.3 %** |
| **total** | **16 090 ms** | **136** | |

† SvelteKit runs the root layout load in parallel with the trip layout load, so in the real app this overlaps and adds ~0 ms of wall — but it is still 4 statements of load on the database and it is free to delete.

### Per-phase, host on the largest trip (`8fc036a8` / user `3e56343c`)

| phase | wall | statements |
|---|---|---|
| session ×2 | 955 ms | 8 |
| `:207` membership | 1 213 ms | 6 |
| **`:228` Promise.all** (+ `getCostAtMaxParticipation`) | **6 040 ms** | **53** |
| `:283` Promise.all (+ pending count) | 637 ms | 17 |
| `:337` feature-tour count | 458 ms | 4 |
| `+page.server.ts:39` Promise.all | 1 603 ms | 15 |
| **total** | **10 907 ms** | **103** |

### Per-phase, host on the empty perf-log trip (`e10cba98` / user `750d1f5d`)

| phase | wall | statements |
|---|---|---|
| session ×2 | 1 302 ms | 10 |
| `:207` membership | 869 ms | 6 |
| **`:228` Promise.all** | **3 860 ms** | **45** |
| `:283` Promise.all | 500 ms | 16 |
| `:337` feature-tour count (fires — this user has dismissed nothing) | 501 ms | 4 |
| `+page.server.ts:39` Promise.all | 533 ms | 12 |
| **total** | **7 564 ms** | **93** |

Zero guests, zero assignments, **93 statements**. This is the trip that logged 3.8–5.0 s in production-ish use.

### Prototypes: what PF2 can actually reach

Two throwaway prototypes, same data returned to the page, measured over the same link (5 runs, median):

| variant | SELECTs | statements | guest, largest trip | host, empty trip |
|---|---|---|---|---|
| **as-built** | 70 | **136** | 16 090 ms | 7 564 ms (93 stmts) |
| **① one parallel wave**, no duplicate re-fetches, pricing from in-memory rows | 33 | **60** | **5 461 ms** (min 4 304 / max 7 134) | **2 982 ms** (47 stmts) |
| **② ① + `relationLoadStrategy: 'join'`** | **9** | **36** | **1 702 ms** (min 1 545 / max 2 693) | **1 476 ms** (36 stmts) |

Prototype ② was produced by generating a throwaway Prisma client from a copy of `prisma/schema.prisma` with `previewFeatures = ["relationJoins"]` added — the repo schema was **not** modified. It collapses the 23-statement `include` fan-out into **one** SQL statement.

Also measured, for the "just delete the unread relations" option in isolation:

| mega `trip.findUnique` variant | SELECTs | statements | wall |
|---|---|---|---|
| as-built (12 relations) | 23 | 26 | 5 091 ms |
| pruned — `mealPlan`, `reservations`, `invites`, `tripActivities` removed | 18 | 21 | 4 356 ms |

Note where prototype ② lands: **36 statements, of which 27 are `BEGIN`/`DEALLOCATE ALL`/`COMMIT`.** Once the code is fixed, three quarters of the remaining round trips are pooler bookkeeping.

---

## 5. Ranked findings

Shares are of measured server wall on the 136-statement guest load; the host figure is in brackets where it differs materially.

**① Prisma relation fan-out on `+layout.server.ts:229-263` — 39 % [55 %]**
23 sequential SELECTs inside one transaction for a single `findUnique`. `prisma/schema.prisma:4-6` has no `previewFeatures`, so `relationJoins` is off. Evidence: the 26-statement trace in §1; `relationLoadStrategy: 'join'` reduces it to 1 statement. This is a fixed cost — it is exactly why empty trips are still 3.8–5.0 s.

**② `computeGuestEstimateRange` re-fetching the world — 22 %, guests only**
`guest-estimate.ts:105-127` re-reads the trip (+rooms +beds +roomAssignments), the yes-RSVPs, all room assignments (+room +beds), and the guest's own RSVP — 9 SELECTs, all already in memory — then spends 6 more on a `calculateReservationPrice` at `:333`. 30 statements, 3 583 ms measured. On `per_bed` it adds 9 more **serially** per own assignment at `:255`.

**③ `+page.server.ts:39-55` duplicating the layout — 10 % [15 %]**
`:40` re-reads the RSVP already fetched at `+layout.server.ts:266`. `:45` re-reads all room assignments with an include shape **identical** to `+layout.server.ts:247-253`. `:51` re-queries what is a `.filter()` of `:45`. 15–22 statements, none of which need to exist.

**④ `getUserTripMembership` at `+layout.server.ts:207` — 8 % [11 %]**
`trip-access.ts:11-14` does `include: { trip: true, user: true }` — a full Trip row and a full User row (including `passwordHash`) — and the caller reads only `membership.role` and `membership.inviteStatus`. 6 statements, 904–1 265 ms, on the **critical path before** the `Promise.all` at `:228` can even start.

**⑤ Redundant trip re-fetches inside the `:228` `Promise.all` — folded into ①**
`computeCommittedFundsFromYesRsvps` (`pricing-canonical.ts:708`) and `getCostAtMaxParticipation` (`:654`) each `findUnique` the same trip with rooms and beds, in parallel with the mega query that is already fetching them. 8 + 6 statements. They hide behind the mega query in wall time but they triple the DB's work.

**⑥ `calculatePrice` N+1 at `+page.server.ts:67-78` — 6 %, guests only**
6 statements per assignment on `per_person`, **15** on `per_bed` (two full trip re-fetches per assignment: `pricing.ts:57` then `pricing-canonical.ts:829`). Measured 1 018 ms for a single assignment.

**⑦ Serial tail after the `Promise.all`s — 3–7 %**
`+layout.server.ts:324`, `:337`, `:346`, `:407` are sequential `await`s, each a full round trip, each trivially foldable into the `:283` batch. `:407` fires for every non-host on every page under `[tripId]`.

**⑧ Duplicate session lookup at `src/routes/+layout.server.ts:5` — 3 % of statements, ~0 wall**
`hooks.server.ts:34` already resolved the user into `locals.user`. Two more statements per request for nothing.

**⑨ Pooler transaction overhead — 49–55 % of all statements, ~0 code**
`BEGIN` + `DEALLOCATE ALL` + `COMMIT` around every Prisma operation, caused by `?pgbouncer=true` on the port-6543 transaction pooler. Not an application bug; see §6.

---

## 6. Recommendations

### → PF2 (batch / eliminate N+1)

Target from the PLAN is **< 800 ms**. Prototype ② reached 1 702 ms over a ~120 ms/statement link; the same 36 statements in-region on Vercel is comfortably inside the target, and prototype ① alone (5 461 ms here) is not. **PF2 needs both the batching and the relation-join change to hit the number.**

In rough order of value:

1. **Turn on `relationJoins`.** `prisma/schema.prisma:4-6` → `previewFeatures = ["relationJoins"]`, then `relationLoadStrategy: 'join'` on the mega `findUnique` at `+layout.server.ts:229`. Measured: 23 SELECTs → 1, 5 091 ms → sub-second on this link. Biggest single win in the whole story.

   > **⚠️ Brett's gate.** This edits `prisma/schema.prisma`. Per `CLAUDE.md`'s tiered approval, **migrations are Brett's call** — PF2 cannot merge this on agent-pass + green CI the way the rest of the story can. It is a generator-only change (no `migrate`, no DDL, the database is untouched), which is worth saying out loud when asking, but it still goes to Brett.
   >
   > **It is a preview feature, not GA.** Prisma here is **5.22.0** (`node_modules/prisma/package.json`), where `relationJoins` is behind `previewFeatures`. Preview means the semantics can move between releases, and the one that moves is **nested ordering** — the join strategy orders differently from the send-a-query-per-relation strategy. So PF2's acceptance criteria must explicitly name:
   > - the nested `orderBy` on rooms and beds — `TRIP_ROOMS_ORDER_BY` / `ROOM_BEDS_ORDER_BY` at `+layout.server.ts:233-234` (and the same pair at `pricing-canonical.ts:436-438`, `:610-611`, `:658-659`, `:712-713`, `:833-834`, `pricing.ts:61-63`, `guest-estimate.ts:110-111`, `:389-390`). Bed order is load-bearing: it drives which bed `guest-estimate.ts:181` and `:275` pick as "first bed" for a guest with no assignment.
   > - the `orderBy: { createdAt: 'desc' }` **plus `take: 50`** on `tripActivities` at `+layout.server.ts:260` — `take` inside a join is exactly where a preview relation-load strategy is most likely to differ. (If item 2 lands, this relation is pruned and the risk disappears with it — sequence item 2 before item 1 and the acceptance surface shrinks.)
   >
   > Verify row shapes are byte-identical before and after; a snapshot diff of the serialized `trip` object across every trip in the DB is the cheapest proof.

2. **Prune four relations from the `include` at `+layout.server.ts:231-262`** — `mealPlan` (`:237`), `reservations` (`:245`), `invites` (`:254-259`), `tripActivities` (`:260`). Measured on its own: 23 → 18 SELECTs.

   Prune-safety, traced reader by reader:
   - `mealPlan` — `itinerary/+page.server.ts:116` reads it, but from its **own** query at `:78`. `invoice-calculator.ts:125` reads its own too.
   - `reservations` — two readers, neither reachable through the layout's copy. `guests/+page.server.ts:956` reads it from its **own** `trip.findUnique` at `:945-953`, inside the `exportLegacyBookings` form action. `src/lib/trips/selectors.ts:24` (`trip.reservations?.length`) *is* a real read of a `TripForSidebar`, but its only caller is `TripSidebar.svelte:2`, and **`TripSidebar` is rendered by no route** — `grep -rn "TripSidebar" src/routes/` is empty. Orphaned component; the reader is unreachable.
   - `invites`, `tripActivities` — sole reader is `trip-activity-log.ts:176` / `:186`, reached only via `guests/+page.svelte:27`, which is fed the **narrowed** trip from `guests/+page.server.ts:424-435`, not the layout's. That panel is already silently empty today (see the BUG note in §6).

   **Do *not* prune `roomAssignments` (`:247-253`) — see item 3.** *Keep* `rooms`, `members`, `mealSlots`, `activities`, `invoices`, `rsvps`, `extraCostRules`: all read by `HostDashboard.svelte` / `GuestDashboard.svelte`.

3. **Delete the duplicates in `+page.server.ts`. The layout's `roomAssignments` is the copy that survives; the page's two fetches are the ones that die.**

   The layout's include at `:247-253` and the page's `assignmentInclude` at `:7-11` are the same shape, so exactly one of them should exist. Keep the **layout's**, because (a) it is one extra branch on a query that has to run anyway — and zero extra statements once item 1 lands — while the page's `:45` + `:51` are two separate operations costing 14 statements, and (b) every sub-route under `[tripId]` then gets assignments from shared layout data instead of re-querying.

   - `:40` → use `parentData.userRsvp` (same row as `+layout.server.ts:266`).
   - `:45` → delete; use `parentData.trip.roomAssignments`.
   - `:51` → delete; `roomAssignments.filter(a => a.userId === user.id)`, which is already the fallback the code writes at `:65`.
   - Keep re-exporting the result under the **same `roomAssignments` key** the page already returns at `:101`, so `HostDashboard.svelte:45` and `GuestDashboard.svelte:60` (`Array.isArray(data.roomAssignments) ? … : (trip?.roomAssignments ?? [])`) keep working untouched and never fall through to `?? []`.

   Removes 14 statements.

4. **Thin `getUserTripMembership`.** `trip-access.ts:11-14`: drop `include: { trip: true, user: true }`, or add a `select` for `{ role, inviteStatus }`. 6 statements → 4, off the critical path prologue. (Used elsewhere — check `isTripHost` / `isTripHostOrCoHost` at `trip-access.ts:18-26` first.)

5. **Pass data in instead of re-fetching it.** Give `computeCommittedFundsFromYesRsvps` (`pricing-canonical.ts:704`) and `getCostAtMaxParticipation` (`:653`) an optional pre-loaded trip parameter; the layout already has rooms, beds, yes-RSVPs and roomAssignments in hand at `:229`. Keep the existing signature as a thin wrapper so the other 8 call sites are untouched. **Coordinate with `pricing-be`:** this changes the *inputs* to pricing math, and per `CLAUDE.md` that needs their sign-off even though the arithmetic is untouched. Nothing here should change a single output cent — the acceptance test is that `committedFundsFromYesRsvps` and `costAtMaxParticipation` are identical before and after on every trip in the DB.

6. **Same for `computeGuestEstimateRange`.** `guest-estimate.ts:105-127` should accept the already-loaded trip / RSVPs / assignments rather than re-querying. Removes 9 SELECTs. **Mind the shape mismatch flagged in §3:** the layout's assignments carry `room: { id, name, photoUrls }` with **no `beds`**, while `guest-estimate.ts:122` expects `room.beds`; rehydrate from `trip.rooms` on `roomId` rather than passing the layout object through as-is. Again a `pricing-be` coordination point — the whole `guest-estimate.ts` file is downstream of `calculateReservationPrice`.

7. **Kill both N+1s — by giving the engine the trip, never by moving math into the route.**

   > **Read this before touching `+page.server.ts:67-78`.** The fix is a **new optional parameter on `calculatePrice` / `calculateReservationPrice`** that accepts an already-loaded trip, so the engine skips its own `findUnique` and does the identical arithmetic on rows the caller already has. The route keeps calling the engine and keeps using its return value. It must **not** start computing a price itself from `trip.rooms` — that is `CLAUDE.md` footgun #1 ("compute price outside `calculateReservationPrice`") and it would be a second pricing path. `guest-estimate.ts:232-264` lives inside `$lib/server/` and is engine-adjacent, so it may work with trip rows directly; the route may not.

   `computePerBedLivePriceForBed` (`pricing-canonical.ts:371`) and `buildPerBedOccupancyMap` (`:324`) are already pure and already take a trip object, so the preloaded-trip parameter is plumbing, not new math. At minimum, make `guest-estimate.ts:232-264` a `Promise.all` instead of a sequential `for … await`. **`pricing-be` owns this one** — it is inside the pricing engine.

8. **Fold the serial tail into a batch.** `+layout.server.ts:324`, `:337`, `:346` and `:407` should join the `Promise.all` at `:283` (compute their conditions first, pass `Promise.resolve(null)` when they don't apply — the file already uses that pattern at `:270` and `:309`).

9. **Delete `src/routes/+layout.server.ts:5`.** Return `locals.user`; `hooks.server.ts:34` has already resolved it.

### → PF3 (memoize pricing per request)

1. **A per-request memo around `calculateReservationPrice`** keyed on `(tripId, roomId, bedId, numberOfSlots, checkInDate, checkOutDate, quoteForUserId, provisionalPick)`. On a `per_bed` guest dashboard this alone removes A of the 2A calls — the pair shown in §3 is provably identical. **Must be request-scoped**, never module-scoped: occupancy changes the instant anyone claims a bed, and a stale cross-request cache would show a guest a number that no longer matches `PRICING.md`. Owned jointly with `pricing-be`.

2. **A per-request trip-load memo.** `pricing-canonical.ts:829`, `:708`, `:654`, `pricing.ts:57`, `guest-estimate.ts:106` all issue the same `trip.findUnique(rooms → beds)`. If PF2's plumbing (items 5–7) proves too invasive to land in one PR, a request-scoped trip cache is the cheap version of the same win: 7 Trip fetches → 1.

3. **Do not** cache anything across requests, and do not cache `computeGuestEstimateRange` output — its `costBasisVersion` (`guest-estimate.ts:70-95`) exists precisely to detect that the basis moved.

### → Neither PF2 nor PF3 — suggested new stories

- **PF4 — pooler round-trip overhead.** 49–55 % of every request's statements are `BEGIN`/`DEALLOCATE ALL`/`COMMIT` from `?pgbouncer=true` on the port-6543 transaction pooler. After PF2 this is *three quarters* of what's left (27 of 36 statements in prototype ②). Worth investigating `connection_limit=1`, Supavisor session mode, or Prisma's newer driver adapters. Infrastructure, needs Brett — it touches the production connection string.
- **PF5 — the sub-routes are worse than the dashboard.** `perf-log.csv` median for `/trips/<id>/*` is **6 066 ms** vs 4 819 ms for the root, and `/trips/<id>/rsvp` logged **19 929 ms**. `rsvp/+page.server.ts` runs `computeGuestEstimateRange` (`:136` and `:295`), `computeRoomPricing` (`:148`) and `computePerBedPricingAtHeadcount` (`:166`) *on top of* the whole layout chain, and re-queries rooms, beds, members, RSVPs and assignments it already has (`:46-70`). Every fix in this report applies there and then some.
- **BUG — the guests-page activity log is silently empty.** `guests/+page.svelte:27` calls `buildTripActivityLog(data.trip ?? null)`, but `guests/+page.server.ts:424-435` returns a narrowed `trip` (only `id`, `name`, `rsvpByDate`, `allowPartialStays`, `checkInDate`, `checkOutDate`, `expectedPeopleCount`) that shadows the layout's. Every field of `TripForActivityLog` (`src/lib/trip-activity-log.ts:32-74`) is optional, so this type-checks and renders nothing. It is also the *only* consumer of the layout's `invites` and `tripActivities` — which is why PF2 can prune them. Not a perf story; file it separately so pruning doesn't get blamed for a pre-existing empty panel.
- **Payload size.** The layout returns the full `trip` object — including every guest's `invoices` — to every route under `[tripId]` (`+layout.server.ts:433`). Pruning per item 2 shrinks the serialized payload too, but the `invoices` exposure is worth its own look.

---

## Appendix — reproducing this

Everything was run from throwaway scripts in the session scratchpad; nothing was added to the repo. To redo it:

1. Build a `PrismaClient` with `log: [{ level: 'query', emit: 'event' }]` and assign it to `globalThis.prisma` **before** importing anything from `$lib/server/` — `src/lib/server/prisma.ts:10-14` will adopt it.
2. Run the scripts with `npx tsx --tsconfig ./tsconfig.json <file>.mts` from the repo root, so `$lib` resolves via `.svelte-kit/tsconfig.json`.
3. Call the real helpers, and transcribe the two inline `trip.findUnique` blocks from `+layout.server.ts:229-263` and `+page.server.ts:39-55` verbatim.
4. Count statements, not milliseconds. Wall time on a remote link is ~90–190 ms per statement and varies by more than 2× run to run.

A lighter-weight alternative for spot checks: `PRISMA_LOG_QUERIES=true npm run dev` (`src/lib/server/prisma.ts:8`) and count the query lines for one page load.

### Gate results at the time of writing

- `npm test` — **passes.** 3 files, 33 tests, 129 ms.
- `npm run check` — **fails, pre-existing on `main`.** `svelte-check found 285 errors and 418 warnings in 92 files`. The working tree was clean and no application code was touched for PF1, so this is not caused by this story. First failures include `Type 'string[]' is not assignable to type '(LogLevel | LogDefinition)[]'` (`src/lib/server/prisma.ts`), `Property 'TRIP_FILLING_UP_80' does not exist…`, and several stale Prisma field references (`publishedAt`, `startDatetime`). Because `check` is `svelte-check && npm run lint:vocabulary`, the vocabulary lint never runs.
- `npm run lint:vocabulary` **standalone also fails — exit code 1**, and it is a one-line fix:

  ```
  Vocabulary guard failed. Disallowed terms found:
  - src/lib/components/trips/dashboard/GuestRsvpSummaryCard.svelte:107 (booking)
    -> /** Confirmed: going + room + (bed or whole-room booking). */
  ```

  So the cleanup story is **two** problems, not one: 285 svelte-check errors, *and* a genuine vocabulary violation that the `&&` short-circuit has been hiding. The vocabulary half is a single word in a comment.
- **Neither is visible to CI.** There is no `.github/workflows/` directory in this repo — CI is the Vercel deploy only. `npm run check` has never gated a merge, which is how 285 errors accumulated. Worth folding into the same cleanup story.
