# Divvi Pricing — Drift Analysis & Open Decisions

> **Status:** Analysis (Phase 1). Maps how pricing *actually works in code* against the three written sources of truth, flags every drift, and lists the decisions that need a human before we change anything.
> **Sources compared:** `PRICING.md` (declared authoritative spec), `docs/PRD.md` (product intent), `docs/ARCHITECTURE.md` (engineering doc), and the code.
> **Last updated:** 2026-06-20 · **Owner:** Brett

---

## 0. How to use this doc

1. Read §1 to understand that there are **four overlapping pricing surfaces**, not one.
2. Read §2 — the drift table — to see, per topic, what code does vs. what each doc says.
3. Work through §3 — the **open decisions**. These are blocking: most fixes can't be written until each is answered. Each has a recommendation but needs sign-off.
4. Once decisions land, we draft "what's right" (update `PRICING.md` + `ARCHITECTURE.md`), then build the front/backend todo list (§4 stub) and dispatch coding agents.

Nothing in the code has been changed as part of this analysis. The only edits so far are documentation (`ARCHITECTURE.md §6.2`, this file).

---

## 1. The four pricing surfaces (the core problem)

Pricing is not one engine. Four code paths compute "what a guest pays," with **different rules**, and only one of them fully matches `PRICING.md`.

| # | Surface | Entry point | Used by | Matches `PRICING.md`? |
|---|---|---|---|---|
| 1 | **Binding RSVP range** (what the guest approves) | `computeGuestEstimateRange` (`guest-estimate.ts:101`) + `closing-range.ts` | RSVP submit → stores `originalRange{Min,Max}Cents` (`rsvp/+page.server.ts:345`) | ✅ Yes |
| 2 | **Host preview / display tiles** | `getPerBedRangeGuestCounts` (`pricing-canonical.ts:401`) → `computePerBedPricingAtHeadcount` → `pricing-display.ts` | Room/bed price tiles shown in UI | ⚠ No |
| 3 | **Legacy live invoice math** | `calculatePrice` (`pricing.ts:50`) | `/api/submit/+server.ts`, `trips/[tripId]/+page.server.ts` | ⚠ No |
| 4 | **Canonical invoice math** | `calculateReservationPrice` / `computeRoomPricing` (`pricing-canonical.ts`) | `invoice-calculator.ts` (the actual invoice) | Partly (per-bed yes; per-room labeled "legacy" in spec) |

**Why this matters:** a guest can see one number on the display tile (#2), approve a range computed a different way (#1), and be invoiced by yet another path (#3 or #4). The numbers can legitimately disagree. Consolidating these is the central architectural question (§3-B1).

---

## 2. Drift table (code vs. the three docs)

Legend: ✅ agree · ⚠ drift · ❌ contradiction · — not addressed.

| Topic | Code (actual) | `PRICING.md` | PRD | `ARCHITECTURE.md` (pre-edit) |
|---|---|---|---|---|
| **Favorable range denom** | `maxCapacity` → `maxGuests` → `sumRoomMaxOcc` (`closing-range.ts:25`) — binding path correct | `Trip.maxCapacity`, explicitly **not** `maxGuests` | — | — |
| **Same, preview path** | `trip.maxGuests ?? bedRows` (`pricing-canonical.ts:401`) ⚠ | `Trip.maxCapacity` | — | — |
| **Expensive range denom** | binding: `max(effectiveYes, expected)` ✅; preview: `expected` only ⚠ (`:627`) | `max(currentYes, expected)`, recomputed live | "recalculates as trip evolves" (§3) | — |
| **Live `per_person`** | `expectedPeopleCount ?? sumRoomMaxOcc` (`pricing.ts:148`) ⚠ | `÷ totalSlots` (= `sumRoomMaxOcc`), **not** expected/maxCapacity | "total ÷ headcount" (§5.1) | "flat totalCost / headcount" |
| **Live `per_room`** | flat `totalCost / nights / rooms` (`pricing.ts:126`) ⚠ | per-night privacy-weighted (`computeRoomPricing`) | "each room pays equally" (§5.1) ✅-ish | — |
| **`computeRoomPricing` status** | the weighted engine, used by invoice | labeled **legacy / deprecated** ❌ (inverted) | — | — |
| **`per_person_per_night`** | fully implemented (`pricing.ts:172`), in wizard `Step4.svelte` | **removed from MVP**, mark `@deprecated`, not in UI ❌ | listed as a live v1 model "accounts for partial stays" (§5.1) ❌ | shown in §6.1 flow |
| **Partial stays** | `arrivalDatetime`/`departureDatetime` columns exist (`schema.prisma:574`); stay factor hard-coded 1 in pricing | out of scope MVP, stay factor = 1 | "Optional partial-stay support" core feature (§5.2) ❌ | — |
| **Bed weights** | king 1.3 > queen 1.2 > full 1.1 > twin 1.0 > bunk 0.9 > sofa 0.85 > air 0.75 (`pricing-canonical.ts:80`) | same table ✅ | beds: king/queen/twin/bunk/sofa/full (no air) ⚠ | "king>queen>full>twin>sofa>bunk" ❌ (bunk/sofa swapped, air missing) — **fixed** |
| **`bedWeights` schema example** | comment shows `{king:1.00, queen:0.75, twin:0.50}` (`schema.prisma:59`) ⚠ stale | defaults table (1.3/1.2/1.0…) | — | — |
| **Privacy factor** | bed-count: 1→1.25, 2→1.125, 3+→1.0 (`pricing-canonical.ts:221`) | identical formula ✅ | "multiplier on private/single-occupant rooms" (glossary) ⚠ (occupant- vs bed-count framing) | "default 1.0; private up to 1.25" ❌ (inverted) — **fixed** |
| **`Room.privacyFactor` (stored)** | column exists, default 1.0 (`schema.prisma:137`); canonical math ignores it, computes from bed count | privacy "computed at runtime, not stored" ✅ (so column is dead) ⚠ | — | "Room has a privacy factor" |
| **`sharingExponentAlpha`** | stored + validated 0.3–0.9 (`schema.prisma:60`, `validation.ts:33`); **unused** in canonical math (`pricing-canonical.ts:36` "legacy") | not in the model at all | live tuning knob "α … how aggressively shared occupancy discounts" (§5.1, glossary) ❌ | not mentioned |
| **`privacyPremiumP`** | stored + validated 0–0.25; "legacy; privacy now via Room.privacyFactor" (`:37`) | not in the model | live knob (§5.1, glossary) ❌ | not mentioned |
| **Skip cost-sharing** | `costSharingEnabled` bool (`schema.prisma:30`); gates RSVP cost commitment (`rsvp/+page.server.ts:289`) | not mentioned (`pricingModel` always set) ⚠ | "Or skip cost-sharing entirely" (§5.1) ✅ | — |
| **Invoice scope** | `invoice-calculator.ts` sums lodging + activities + meals + extras; re-approval ceiling = lodging-only `originalRangeMaxCents` | "splits `Trip.totalCost` **only**; not taxes/add-ons/activities" | invoice = room/bed + activities + meals + extras (§5.8); add-ons trigger re-approval (§5.2) | re-approval compares "invoice total" to ceiling (§7) |
| **Children in pricing** | `adultsCount` used as party size (`guest-estimate.ts:138`) | "intended: kids = full share; verify each path, leave TODO" ⚠ | adult/kid/pet counts per guest (§5.2) | — |
| **Re-approval (asymmetric, ceiling rises)** | `cost-reapproval.ts` matches | matches | matches (§5.2) | matches (§7) | ✅ all agree |

---

## 3. Open decisions

Grouped: **A** = product calls (need Brett), **B** = architecture/consolidation, **C** = spec↔code reconciliation (smaller, mostly "make the doc and code agree"). Each is a blocker for the corresponding code change.

### A. Product decisions (need founder sign-off)

**A1 — Is `per_person_per_night` in or out for v1?**
Code implements it and the wizard still offers it (`Step4.svelte`); `PRICING.md` says removed; PRD §5.1 lists it as live and ties it to partial stays. These can't all be true.
- *Option A (recommended):* Drop it for v1 — remove from wizard, `@deprecate` in code, map legacy rows to `per_person`. Matches `PRICING.md` and the "no partial stays in MVP" stance.
- *Option B:* Keep it — then PRICING.md and the partial-stay scope must change too.
- **Decide:** ship A or B. → unblocks the wizard + `pricing.ts` cleanup.

**A2 — Are partial stays in scope for v1?**
PRD §5.2 calls them a feature and the schema has the date columns; `PRICING.md` hard-codes stay factor = 1 and calls them out of scope. Tightly coupled to A1.
- *Recommended:* Out for v1 (stay factor = 1 everywhere), keep columns dormant. Update PRD §5.2 to mark partial stays **[post-MVP]**.
- **Decide:** in or out. → unblocks PRD edit + confirms `nights`/stayFactor handling.

**A3 — What does the approved cost *range* cover — lodging only, or the full invoice?**
The guest approves a range derived from `Trip.totalCost` (lodging) only, but the re-approval ceiling gates the **full invoice** (lodging + activities + meals). So adding a $40 activity can push a guest "over budget" against a lodging-only ceiling. PRD §5.2 says added activities/meals *should* trigger re-approval, so this may be intended — but the guest-facing "range" copy implies lodging.
- *Option A:* Intended — keep, but fix copy so the range is clearly "lodging estimate" and activities are a separate, always-confirmable line.
- *Option B:* The range should include opted-in activities/meals so the ceiling and the approved number describe the same thing.
- **Decide:** A or B. → drives invoice + re-approval + RSVP copy.

**A4 — Do children count as full pricing shares?**
Code uses `adultsCount` as party size; `PRICING.md` says the *intent* is kids = full share; PRD tracks adult/kid/pet separately.
- **Decide:** (a) kids = full share, (b) kids = some fraction, (c) kids free. → changes party-size source in `guest-estimate.ts` and invoice. (Recommended: (a) for simplicity/defensibility, matching `PRICING.md` intent.)

**A5 — `sharingExponentAlpha` & `privacyPremiumP`: keep the concept or bury it?**
The PRD glossary still sells "sharing exponent (α)" and "privacy premium" as the per-bed algorithm. The actual model replaced both with bed-count privacy weighting; the fields are stored/validated but `alpha` is unused and `privacyPremiumP` is legacy.
- *Recommended:* Bury them. Remove α/P from PRD prose and glossary, stop validating them as live knobs, plan a migration to drop the columns. Keep `bedWeights` JSON for forward-compat per `PRICING.md`.
- **Decide:** bury vs. revive. → big PRD edit + possible schema migration.

### B. Architecture / consolidation decisions

**B1 — Consolidate the four pricing surfaces (the big one).**
We have binding-range, preview, legacy-live, and canonical-invoice engines computing overlapping numbers with different rules. Target state should be: **one** range engine (`closing-range.ts` + `guest-estimate.ts`, already correct) and **one** live/invoice engine (canonical), with the display tiles reading from the same canonical math as the invoice.
- **Decide the target architecture**, then we can: retire `pricing.ts:calculatePrice` (migrate `/api/submit` and `trips/[tripId]/+page.server.ts` to canonical), and point `pricing-display.ts` at the same headcount logic as the binding range so tiles and approval agree. → unblocks the largest chunk of the todo list.

**B2 — Reconcile the preview path with the binding path (sub-case of B1, but fixable independently).**
`getPerBedRangeGuestCounts` uses `maxGuests` and ignores live yes; the binding path uses `maxCapacity` and live yes. Even before full consolidation, should the preview adopt `closing-range.ts` helpers so host tiles match what guests approve?
- *Recommended:* Yes — make preview call `favorableHeadcountForClosingRange` / `effectiveYesCountForClosingRange`. Note `PRICING.md` explicitly warns "do not merge the two caps blindly," so this needs a careful, tested change.

**B3 — `computeRoomPricing` labeling is inverted between spec and code.**
`PRICING.md` calls the weighted per-night room model "legacy" and a flat slot model "canonical," but the code uses the weighted model as the real invoice path and the flat one (`calculatePerRoomPrice` in `pricing.ts`) is the throwaway. The spec has it backwards.
- **Decide:** confirm the weighted per-night model is canonical (recommended — it's what the invoice uses), then **fix `PRICING.md`** to match, and retire the flat `calculatePerRoomPrice`.

**B4 — `Room.privacyFactor` column: dead field or intended override?**
Privacy is computed from bed count at runtime; the stored `Room.privacyFactor` is ignored by the canonical math. Is it meant to be a host/admin override, or is it dead?
- *Recommended:* Dead → drop in a migration (and remove from `costBasisVersion` payload), OR formally wire it as an override if product wants manual privacy control. → schema decision.

### C. Spec ↔ code reconciliation (low-risk, mostly doc fixes)

- **C1 — `PRICING.md` live `per_person` rule vs. code.** Spec says `÷ totalSlots`; the legacy live path divides by `expectedPeopleCount`. Once B1 retires the legacy path this resolves; until then, decide which is authoritative and align. (Recommended: spec is right; canonical/invoice should use `sumRoomMaxOcc`.)
- **C2 — Stale `bedWeights` schema comment** (`schema.prisma:59`, shows 1.00/0.75/0.50). Update the comment to the real defaults. No logic change.
- **C3 — `costSharingEnabled` undocumented in `PRICING.md`.** Add a short section: when false, all pricing paths are skipped and cost UX hidden. Matches PRD §5.1's "skip cost-sharing."
- **C4 — Air mattress missing from PRD bed list** (§5.1/§5.2). Add it (weight 0.75) to match `bed-types.ts`.
- **C5 — Privacy "premium" wording** in PRD glossary frames it as occupant-count; the model is bed-count. Reword to "fewer beds in a room → higher privacy factor."

---

## 4. DECISIONS LOCKED (2026-06-20)

| # | Decision | Outcome |
|---|---|---|
| A1 | `per_person_per_night` | **Removed** from v1. Drop from wizard + both engines; map legacy rows → `per_person`. |
| A2 | Partial stays | **Out** of v1. Stay factor = 1 everywhere. Columns stay dormant. |
| A3 | Approved range scope | **Lodging only.** Activities/meals are separate confirmable lines; fix guest copy. |
| A5 | `sharingExponentAlpha`, `privacyPremiumP` | **Removed entirely** (already dead code; drop columns + validators). Keep `bedWeights` (PerBed only). |
| B1 | Engine consolidation | **One engine:** `calculateReservationPrice` (canonical). Delete legacy `pricing.ts:calculatePrice`; repoint its 2 callers. |
| B2/Display | Preview vs binding range | Display path adopts `closing-range.ts` helpers so host tiles match guest-approved ranges. |
| PerPerson denom | "Price moves with attendance" | Live `per_person = totalCost ÷ Σ(party of YES guests) × yourParty`. **Changed** from `÷ Σ(room.maxOccupancy)`. Sums to total; falls as people join, rises as they drop (drives re-approval). |
| PerRoom split | One household per room | Live `per_room = totalCost ÷ #rooms`, claimer pays the whole room. No occupant split (use PerBed for that). Range collapses to a **single fixed number**. |
| B4 | `Room.privacyFactor` column | **Dead** — drop (privacy is computed from bed count). |

**Still open (non-blocking):** A4 — do children count as full pricing shares? Current code uses `adultsCount`. Recommend **yes = full share** for defensibility; confirm before touching party-size sources.

## 5. Final consolidated model (the "what's right")

Stay factor = 1. Three models only. `costSharingEnabled = false` skips all pricing + hides cost UX.

| Model | Live / invoice | Closing range at RSVP |
|---|---|---|
| **PerPerson** | `totalCost ÷ Σ(party of YES guests)` × your party — moves with attendance, sums to total | favorable `÷ maxCapacity`; expensive `÷ max(liveYesHeads, expected)` |
| **PerRoom** | `totalCost ÷ #rooms`; claimer pays the whole room (one household/room) | **single fixed number** = `totalCost ÷ #rooms` (no headcount range) |
| **PerBed** | `bedWeight = typeWeight × privacy(bedCount)`; bed slice `= totalCost × w / Σw(occupied)`; even split among occupants. `bedWeights` JSON override (backend-only) | per-bed sim ×2: favorable at `maxCapacity` sharing, expensive at `max(yes, expected)` |

Privacy factor (PerRoom/PerBed) = `max(1.0, min(1.25, 1.25 − (bedsInRoom − 1) × 0.125))`. Bed weights: king 1.3 / queen 1.2 / full 1.1 / twin 1.0 / bunk 0.9 / sofa 0.85 / air 0.75.

## 6. Implementation todo (front + back)

Sequenced safe → risky. **BE** = backend, **FE** = frontend, **DOC** = docs/spec.

**Phase 1 — Pure deletions (zero behavior change, ship anytime)**
- [ ] BE: remove `sharingExponentAlpha` + `privacyPremiumP` from `validation.ts` zod schema
- [ ] BE: remove the two `// legacy` interface fields in `pricing-canonical.ts`
- [ ] BE: Prisma migration — drop `Trip.sharingExponentAlpha`, `Trip.privacyPremiumP`, `Room.privacyFactor`
- [ ] BE: fix stale `bedWeights` schema comment (`schema.prisma:59`) to real defaults
- [ ] FE: remove α/P references in publish/wizard if any (verify `Step4.svelte`, `AddOnsStep.svelte`)

**Phase 2 — Remove `per_person_per_night`**
- [ ] FE: remove PPN option + copy from wizard `Step4.svelte`
- [ ] BE: remove PPN branches in `pricing-canonical.ts`, `pricing.ts`, `validation.ts`
- [ ] BE: migration mapping existing `per_person_per_night` trips → `per_person`

**Phase 3 — Kill the legacy duplicate engine (consolidation)**
- [ ] BE: repoint `/api/submit/+server.ts` + `trips/[tripId]/+page.server.ts` from `pricing.ts:calculatePrice` → `calculateReservationPrice`
- [ ] BE: delete `pricing.ts` (`calculatePrice` + per-model helpers) after callers migrate
- [ ] BE: retire weighted `computeRoomPricing` + its fallback (per_room is flat now) — verify no live consumer first

**Phase 4 — PerPerson "moves with attendance" (behavior change)**
- [ ] BE: per_person branch in `calculateReservationPrice` → divide by Σ(party of YES rsvps), not Σ(room.maxOccupancy)
- [ ] BE: verify invoice-recompute + re-approval fire on RSVP yes/drop for per_person
- [ ] BE: tests — Σ(per_person invoices) == totalCost; a drop raises others' shares

**Phase 5 — Reconcile display/preview with binding range**
- [ ] BE: display path (`getPerBedRangeGuestCounts` / `computePerBedPricingAtHeadcount`) uses `closing-range.ts` (maxCapacity + live yes) — heed PRICING.md "don't merge caps blindly"; test
- [ ] FE: verify room/bed price tiles render reconciled numbers

**Phase 6 — PerRoom range = single fixed number**
- [ ] BE: `computeGuestEstimateRange` per_room → low = high = `totalCost ÷ #rooms`
- [ ] FE: RSVP copy shows one price (not a range) for per_room

**Phase 7 — Spec + docs**
- [ ] DOC: rewrite `PRICING.md` to this model (remove α/P/ppn, per_room flat, per_person ÷attendance, partial stays out, kids policy)
- [ ] DOC: update PRD §5.1 (drop PPN + partial stays), glossary (remove α / privacy-premium-as-knob)
- [ ] DOC: finalize `ARCHITECTURE.md §6.2` once code lands

**Open:** A4 kids-as-full-share — confirm, then adjust party-size source in `guest-estimate.ts` + invoice if needed.
