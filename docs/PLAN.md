# Divvi — Pre-Launch Plan & Story Backlog

> **Purpose:** the formal, story-level checklist for v1 launch. Each story is sized, owned, and has acceptance criteria so it can be handed to a dev/agent and marked complete for buyoff & tracking.
> **Companions:** `LAUNCH_CUTLINE.md` (scope decisions) · `PRICING_ANALYSIS.md` (pricing detail) · `CLAUDE.md` (how-we-build rules — *to be authored*).
> **Doc strategy:** `PRD.md` / `ARCHITECTURE.md` are **as-built**; this file holds the **divergence** (target behavior) + the backlog.
> **Last updated:** 2026-06-21 · **Owner:** Brett

**Status legend:** ☐ Todo · ◐ In progress · ⊙ In review (PR open) · ✅ Done (**merged to main**) · ⊘ Cut/deferred
**Estimate:** S (≤½ day) · M (~1–2 days) · L (3+ days / needs design)

**Running this plan — type `/go`:** picks up the next eligible story, does the work on a branch (via the owner agent), runs `check + test`, then **pushes and opens a draft PR** that's already been **code-reviewed** (the review is posted as a PR comment), and marks the story **⊙ In review**. You just review the draft PR and **squash-merge**. The next `/go` reconciles the merge to **✅** and moves on. Work a specific story with `/go <ID>` (e.g. `/go B2`). One story per run; merges stay in your control (pricing/migration/auth/money need your approval).

---

## Agent roster (approved)

| Agent | Type | Owns |
|---|---|---|
| **divvi-backend** | role | SvelteKit server, Prisma, APIs — guests, invites, notifications, cuts, waitlist |
| **divvi-frontend** | role | Svelte 5 UI + design system — wizard, guest UI, copy |
| **pricing-be** | specialist | Pricing engine consolidation (intricate; follows `PRICING_ANALYSIS.md`) |
| **perf-be** | specialist | Backend performance profiling & fixes |
| **observability** | specialist | Sentry + PostHog setup |
| **docs** | specialist | As-built doc rewrites; conventions; keeps planning docs synced |
| **code-review** | specialist | Reviews every PR against `CLAUDE.md` (correctness, tests-present, footguns, security) |

All agents follow **`CLAUDE.md`** (how-we-build rules) once authored.

**Standards (locked this session):** mandatory tests (unit for pricing/money, e2e for spine funnels) · **PR-per-story** workflow · design tokens codified from current code · hard rules with a short "why."

---

## Dashboard

| Epic | Stories | Done | Lead |
|---|---|---|---|
| 1. Bugs (testing) | 3 | 0 | divvi-backend |
| 2. Pricing | 11 | 0 | pricing-be |
| 3. Cost re-approval redesign | 3 | 0 | divvi-backend |
| 4. Notifications & cron | 4 | 0 | divvi-backend |
| 5. Waitlist | 2 | 0 | divvi-backend |
| 6. Itinerary trim | 2 | 0 | divvi-frontend |
| 7. Cuts | 6 | 0 | divvi-backend |
| 8. Wizard UI | 2 | 0 | divvi-frontend |
| 9. Performance | 3 | 0 | perf-be |
| 10. Observability | 2 | 0 | observability |
| 11. Loose tech-debt | 5 | 0 | divvi-backend |
| 12. Documentation & process | 8 | 3 | docs |
| **Total** | **51** | **3** | |

---

## Epic 1 — Bugs found in testing (2026-06-21)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **B1** | **Invite link 404.** `/invite/<token>` → `/trips/<tripId>?invite=<token>` 404s for the invited user. Root-cause the guard in `trips/[tripId]/+layout.server.ts` (~`throw error(404)` line 84, invite-preview / not-yet-member path). *Acceptance: clicking a fresh invite link (logged-out and logged-in-non-member) lands on the trip join page, never 404.* | divvi-backend | M | ☐ |
| **B2** | **Guest edit "Missing user".** Setting a guest's status/room from the guest list fails. Param mismatch: actions read `targetUserId` (`guests/+page.server.ts:978…1161`) vs `userId` (:638/:713/:795); form posts the wrong name. *Acceptance: host sets status + room with no error; regression test.* | divvi-backend | S | ☐ |
| **B3** | **Delete guest.** Today `removeGuest` only soft-removes (`:629`). Add a hard delete (remove `TripMember` + cascade RSVP/assignments) behind a **confirmation dialog**. *Acceptance: host deletes a guest after confirming; guest gone from list + trip; cancel aborts.* | divvi-backend (+FE confirm) | M | ☐ |

---

## Epic 2 — Pricing (detail in `PRICING_ANALYSIS.md §6`)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **PR1** | Remove dead `sharingExponentAlpha` + `privacyPremiumP` (validator, interface fields) + dead `Room.privacyFactor`; Prisma migration drops the columns. *No pricing-number change.* | pricing-be | M | ☐ |
| **PR2** | Fix stale `bedWeights` schema comment (`schema.prisma:59`) to real defaults. | pricing-be | S | ☐ |
| **PR3** | Remove `per_person_per_night`: engines + validator + wizard option; map legacy rows → `per_person`. | pricing-be (+FE) | M | ☐ |
| **PR4** | Kill legacy `pricing.ts:calculatePrice`: repoint `trips/[tripId]/+page.server.ts` (+`/api/submit` per CU6) to canonical `calculateReservationPrice`; delete `pricing.ts`. | pricing-be | M | ☐ |
| **PR5** | Retire weighted `computeRoomPricing` + fallback (PerRoom is flat); verify no live consumer first. | pricing-be | M | ☐ |
| **PR6** | **PerPerson ÷ attendance:** canonical per_person divides by Σ(party of YES rsvps), not Σ(room.maxOccupancy). **Kids = full share** (include children in party size). | pricing-be | M | ☐ |
| **PR7** | Verify invoice recompute + re-approval fire on RSVP yes/drop for per_person. | pricing-be | S | ☐ |
| **PR8** | Tests: Σ(per_person invoices) == totalCost; a drop raises others' shares. | pricing-be | S | ☐ |
| **PR9** | Reconcile display/preview path (`getPerBedRangeGuestCounts`/`computePerBedPricingAtHeadcount`) to use `closing-range.ts` so host tiles match guest-approved ranges. Heed "don't merge caps blindly." | pricing-be (+FE) | M | ☐ |
| **PR10** | PerRoom range = single fixed number (`computeGuestEstimateRange` per_room → low=high=totalCost/#rooms); FE shows one price, not a range. | pricing-be (+FE) | S | ☐ |
| **PR11** | Rewrite `PRICING.md` to the final model (remove α/P/ppn; PerRoom flat; PerPerson ÷attendance; kids; partial-stay out). | docs | M | ☐ |

---

## Epic 3 — Cost re-approval redesign (R1)

**Intent:** inform, don't pressure. One quiet notification, host drives the nudge — never bombard a guest with "your trip is too expensive."

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **RA1** | Guest email on **first** over-range crossing is **content-light: no price/amount**, just "something about your trip cost changed — log in to see." (`cost-reapproval.ts` already idempotent per pending cycle; change the email template.) *Acceptance: triggering re-approval sends one no-amount email; logging in shows the detail.* | divvi-backend | M | ☐ |
| **RA2** | Ensure **no automatic reminders** to the guest (ties to NJ1 cron removal). *Acceptance: no scheduled/repeat re-approval emails fire.* | divvi-backend | S | ☐ |
| **RA3** | **Host-initiated manual nudge** for a guest needing re-approval (mirror existing nudge pattern). Host sees who's pending and can send one nudge. *Acceptance: host sees pending guests; clicking nudge sends one email; no auto-send.* | divvi-backend (+FE) | M | ☐ |

---

## Epic 4 — Notifications & cron (WS-J)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **NJ1** | Remove waitlist-promotion + cost-reapproval **reminder crons**; keep poll-lifecycle cron + event-driven sends. | divvi-backend | M | ☐ |
| **NJ2** | Wire event-driven equivalents for any orphaned triggers (or accept no-reminder); audit `cron-email-service.ts` + `/api/cron/*` before deleting. | divvi-backend | M | ☐ |
| **NJ3** | Implement `nudgeAllPending` (TECH_DEBT #1, currently a stub) via the email pipeline. | divvi-backend | S | ☐ |
| **NJ4** | Implement poll non-responder notifications (TECH_DEBT #2, stub). | divvi-backend | S | ☐ |

---

## Epic 5 — Waitlist (WS-K)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **WK1** | Keep + verify capacity-cap enforcement (server + client). | divvi-backend | S | ☐ |
| **WK2** | Replace the timed claim-window automation with **manual host promote**. *Acceptance: host manually promotes the next waitlisted guest; no auto-rolling timer.* | divvi-backend | M | ☐ |

---

## Epic 6 — Itinerary trim (WS-I)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **IT1** | **Hide "Discover"** — remove the Google Places / Divvi Events discovery UI + its API dependency from the itinerary/activities flow. | divvi-frontend (+BE) | M | ☐ |
| **IT2** | Verify manual activity/meal add + meal-fund still work without Discover. | divvi-frontend | S | ☐ |

---

## Epic 7 — Cuts

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **CU1** | Cut **invite-from-friends**: remove `inviteFriend` action + "From friends" UI. Co-host invite role stays. | divvi-backend (+FE) | S | ☐ |
| **CU2** | Strip **SMS/Twilio** invite placeholder (TECH_DEBT #3). | divvi-backend | S | ☐ |
| **CU3** | Strip **Mobile API** — remove `/api/mobile/*` (routes + CORS / 90-day-TTL scaffolding). | divvi-backend | M | ☐ |
| **CU4** | Confirm **Trip Games** fully hidden behind `FEATURE_TRIP_GAMES` everywhere; defer the sessionStorage→DB debt (TECH_DEBT #7). | divvi-backend | S | ☐ |
| **CU5** | Disable partial **plus-ones** UI (WS-S); keep adults/kids counts pricing needs. | divvi-frontend | S | ☐ |
| **CU6** | **WS-P:** sever `/api/submit` dependency on `pricing.ts` (disable/repoint route); leave `Reservation`/`GuestSubmission` models + login backfill **dormant**. | divvi-backend | M | ☐ |

---

## Epic 8 — Wizard UI (U1)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **UI1** | Reuse the edit-trip cards from `/trips/[tripId]/settings/step/*` in the new-trip flow `/trips/new/step/*`; keep the new-trip background (little-icons). Share components from settings → new-trip so both render identically. | divvi-frontend | L | ☐ |
| **UI2** | Pricing step: remove the PPN option from the wizard (FE side of PR3); show only PerPerson / PerRoom / PerBed (+ skip cost-sharing). | divvi-frontend | S | ☐ |

---

## Epic 9 — Performance (P1)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **PF1** | Profile the trip dashboard load (`trips/[tripId]/+layout.server.ts` + `+page.server.ts`); identify the 3.8–5.0s server cost (suspect: per-request pricing sims + N+1 queries). *Read-only diagnosis → report.* | perf-be | M | ☐ |
| **PF2** | Fix N+1 / batch Prisma queries on the trip load (`include`/batched fetches). *Acceptance: trip-page server time materially down (target <800ms).* | perf-be | M | ☐ |
| **PF3** | Memoize/cache pricing per request (don't recompute estimates repeatedly); cache where safe. | perf-be | M | ☐ |

---

## Epic 10 — Observability (WS-T)

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **OB1** | Add **Sentry** (server + client error tracking), minimal config. | observability | M | ☐ |
| **OB2** | Add **PostHog** (product analytics) for the core funnel events. | observability | M | ☐ |

---

## Epic 11 — Loose tech-debt

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **TD1** | Contacts modal dead button on invite step (TECH_DEBT #5) — remove or wire. | divvi-frontend | S | ☐ |
| **TD2** | `locked` RSVP status referenced but unwired (TECH_DEBT #6) — remove the reference or implement. Low priority. | divvi-backend | S | ☐ |
| **TD3** | Bed-removed email is listed both **open and resolved** in TECH_DEBT.md (#4) — verify actual state, fix the register. | divvi-backend | S | ☐ |
| **TD4** | A fresh database cannot be built from the migration history — `schema.prisma` drifted ahead of `prisma/migrations`, so `migrate deploy` on an empty DB yields a schema the app can't run on. Add one migration closing the drift; `migrate diff --from-migrations --to-schema-datamodel` must report no difference and the e2e seed must run clean. Add a documented fresh-setup path (`db:fresh` + CONTRIBUTING). | divvi-backend | M | ☐ |
| **TD5** | `prisma/seed.ts` is dead code and crashes (`Argument 'trip' is missing`) — it seeds 9 hard-coded rooms with no `tripId` from the single-property era. Rewrite for the current schema: host + guests, one published trip with rooms/beds, members, RSVPs and assignments; idempotent, obvious non-production credentials. | divvi-backend | M | ☐ |

---

## Epic 12 — Documentation

| ID | Story · acceptance | Owner | Est | Status |
|---|---|---|---|---|
| **DC0** | Author **`CONTRIBUTING.md`** — the PR-per-story workflow + behavior-change guide for the dev (branch naming, commit format, review/merge, git snippets, FAQ). | docs (+Brett) | M | ✅ |
| **DC1** | Author **`CLAUDE.md`** — how-we-build Divvi (prime directives, BE/FE rules, UI/UX + codified design tokens via `docs/PALETTE.html`, naming, mandatory-test bar, git rules → links to CONTRIBUTING, footguns). | docs (+Brett) | M | ✅ |
| **DC7** | Build the **code-review agent** (`.claude/agents/code-review.md`) — reviews PRs vs `CLAUDE.md`; enforces tests-present + footguns + tiered gate. | docs (+Brett) | M | ✅ |
| **DC2** | As-built **PRD.md** rewrite — full current feature inventory (co-host, waitlist, manual guest add, profiles, DMs, files, polls, itinerary, games-behind-flag, etc.). | docs | L | ☐ |
| **DC3** | As-built **ARCHITECTURE.md** rewrite to match consolidated code. | docs | M | ☐ |
| **DC4** | Fix **`DIVVI.md`** — stale (still documents the removed anonymous reserve flow). | docs | S | ☐ |
| **DC5** | Confirm **Resend** in all docs; scrub any SendGrid mention (none in code). | docs | S | ☐ |
| **DC6** | Keep `LAUNCH_CUTLINE.md` (+.html) and this plan in sync as decisions land. | docs | S | ☐ |

---

## Suggested sequencing

1. **DC1** (`CLAUDE.md`) first — rules in place before the other dev starts.
2. **Now-safe / high-value:** PF1 (read-only), B1, B2, B3.
3. **Pricing PR1–PR5** (deletions/consolidation) — also unblocks perf; CU6 rides with PR4.
4. **PR6–PR10**, RA1–RA3, UI1–UI2, NJ1–NJ4.
5. **Cuts** (CU1–CU5), **Waitlist** (WK), **Itinerary** (IT), **Observability** (OB).
6. **PF2–PF3** after pricing settles; **Docs** DC2–DC5 once behavior is stable.

> **Gate:** execution starts once `LAUNCH_CUTLINE.md` is approved. B1–B3 + PF1 + DC1 can start sooner — Brett to confirm.
