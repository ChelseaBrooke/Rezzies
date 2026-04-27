# Divvi Pricing Engine — Authoritative Reference

**Version:** MVP

**Status:** Source of truth. All developers, designers, and AI coding agents working on pricing features must reference this document before implementing or modifying any cost calculation. Do not implement pricing logic from memory or inference — use this document.

---

## Marketing description

**Fair splitting, without the spreadsheet.**

Divvi calculates everyone's share automatically — no group chat math, no awkward Venmo requests, and no one person carrying the trip on their card. Hosts choose how to split: equally per person, by room, or by bed type. Divvi handles the rest, showing each guest exactly what they owe and why — before they even RSVP.

For trips where privacy matters, Divvi's bed-based pricing accounts for the difference between a king in a private room and a bunk in a shared space. Everyone pays a fair share based on what they're actually getting — not just an equal slice of a number that doesn't reflect reality.

---

## Out of scope

This document covers one thing: **splitting `Trip.totalCost` among guests.** It does not cover taxes, add-ons, host fees, deposits, or Stripe payment rails. For those, see the invoice and payment documentation.

**Partial stays** are out of scope for MVP. All guests pay for the full trip duration. Date range selection within a trip is not supported. All stay factor calculations equal **1** — do not implement partial stay logic in MVP pricing paths.

---

## The “how many people” problem

The database has several fields that sound like headcount. They are not interchangeable. Using the wrong one produces wrong math.

| Field | What it means | Used for |
|--------|----------------|----------|
| `Trip.maxGuests` | Max guests from the **property listing** (stated capacity) | Context, listing; **not** the closing-range “cheap” end |
| `Trip.maxCapacity` | Hard cap on **yes-RSVP** count — the trip’s attendance ceiling | **Favorable (low-$) end of the estimate range** (fixed); bed-spot guard; validation |
| `Trip.expectedPeopleCount` | Host’s best guess at actual attendance | Expensive-end **starting** denominator (with yes-RSVPs) — see **Closing range** |
| *Current* `currentYesRsvpCount` | Count of **yes** RSVPs at this moment (not a DB field; computed) | Expensive end denominator (see **Closing range**) |
| **Sum of `room.maxOccupancy`** | “How many people the rooms can hold” | **Equal-split live price** denominator (`totalSlots`) — sum across rooms |
| **Sum of bed spot counts** | How many people can sleep | Bed-spot validation, one PER_BED sim path cap |

**Critical distinctions**

- **`maxCapacity` ≠ `maxGuests`.** The listing can say 25 while the host sets **`maxCapacity` to 20** so only 20 people may attend, even with enough beds for more — so guests can have real choice without the **planning range** assuming 25 payers. The **favorable** end of the estimate range uses **`Trip.maxCapacity`**, not `maxGuests` and not `totalSlots`.
- **Live price for `per_person`** uses **`totalSlots` (sum of `room.maxOccupancy`)** — not `maxCapacity`, not `maxGuests` alone.
- **The estimate range** uses headcount style denominators. That is a **separate** calculation from live price. Do not mix the two in code.

### `totalSlots` naming warning

The term shows up in two different senses:

- **Equal-split live pricing:** `totalSlots` = **sum of `room.maxOccupancy`**
- **Bed / spot checks:** `totalSlots` = **sum of bed spot counts** (how many can sleep)

Different numbers. When reading or writing code, confirm which module you are in before you assume a definition.

---

## Cents vs. dollars

- **Database:** monetary values stored as **integer cents**. Field names ending in `Cents` (e.g. `originalRangeMinCents`, `originalRangeMaxCents`) document this.
- **Display:** divide by 100, show two decimal places.
- **Intermediate math:** prefer integer cents; do not round until final presentation where appropriate.
- **Caution:** some older paths in `calculateReservationPrice` use `Math.round(... * 100) / 100` at the end — they may work in **dollars** internally. **Confirm which unit a value is in** before you operate on it.

---

## Pricing model labels

This document uses `PER_PERSON`, `PER_ROOM`, `PER_BED` for readability. In the database and code, store and compare with **snake_case:** `per_person`, `per_room`, `per_bed`.

`per_person_per_night` is **removed from MVP**. Mark it `@deprecated` if it still appears. Do not expose in the UI.

---

## Children and adults in pricing

- **Current behavior (server):** `computeGuestEstimateRange` uses `guestRsvp.adultsCount` — not a single combined “party including kids” field everywhere.
- **Intended product rule:** children count as full shares, same as adults, once party size is consistent.

Verify each code path. Leave a `// TODO: include kids in pricing party size where needed` if `adultsCount` is used without a clear rule for kids.

---

## The closing range — universal concept

Every guest sees a **cost range** when they RSVP. The range has two ends:

### Favorable end (lower $ per person — the “left” / best case for the guest in $)

- **Favorable / cheap denominator = `Trip.maxCapacity`**
- This is the **host’s max attendance** (yes-RSVP cap). It does not change for the life of the trip. It is **not** the same as the sum of room capacities or bed spots: a host may set **`maxCapacity` below** physical sleep capacity on purpose (e.g. cap 20, beds for 25) so the **planning range** reflects *“if we fill the trip the host actually allows”* — not *“if every bed is full.”*
- As long as `max(currentYesRsvpCount, expectedPeopleCount) ≤ Trip.maxCapacity`, dividing by **`maxCapacity`** is the **smaller $ per person** in this headcount model than dividing by that max — so it belongs on the **left (favorable)**. This is **not** the same as `total cost ÷ totalSlots` (live `per_person`): the host can cap **attendance** below “every room filled.” **Name it in UI** so you do not promise “if every **bed** is used” when you mean “if the trip reaches the host’s **max** (N people).”

### Expensive end (higher $ per person — the “right” / worst case the guest is agreeing to)

- **Expensive end denominator = `max(currentYesRsvpCount, Trip.expectedPeopleCount)`**
- This is **recomputed** as more people RSVP. When `currentYesRsvpCount` exceeds `expectedPeopleCount`, the denominator grows and the expensive end **moves toward** the favorable end.
- **When** `currentYesRsvpCount` **reaches `Trip.maxCapacity`**, the expensive end equals the favorable end — **the range collapses to one number** (for that model’s headcount story).

**Why this works**

- Early RSVPs see a **wider** range — more uncertainty.
- Late RSVPs see a **narrower** range or a single value.
- The expensive end is never below **`expectedPeopleCount` when only a few have RSVP’d** in the `max(yes, expected)` rule — that avoids useless extremes from tiny yes counts in isolation.
- The **favorable** end is **fixed** from the host’s cap — the guest always sees a stable “floor in this planning model.”

**Terminology in UI (recommended)**

- Favorable: *“$X if the trip fills to the host’s max (N people).”* Do not promise “if every bed is used” unless that is what you are calculating.

### What is stored at RSVP submit

The range is whatever is on screen the moment the guest confirms — recalculated **at submit** with a **live** `currentYesRsvpCount` (not a stale value from when the form opened if someone else RSVP’d in between).

- `originalRangeMinCents` = favorable (low-$) end **as shown**
- `originalRangeMaxCents` = expensive (high-$) end **as shown**

After save, these **do not** change. They are the record of what the guest agreed to.

**Display**

- `Your estimated share: $X – $Y`
- Short line, e.g.: *`$X if the trip reaches the host’s max · $Y based on who’s confirmed so far`* (adjust to brand voice)

As the range **narrows** or **closes**, use the states in **Cost range shown at RSVP** below.

---

## Bed types

Each bed has a type. The type sets **default spot count** and **type weight** (for `PER_BED` only). Spot count: use the bed’s **capacity** field if set, else the default below.

| Bed type   | Weight | Default spots | Notes |
|------------|--------|---------------|--------|
| Twin / Single | 1.0 | 1 | |
| Bunk | 0.9 | 1 per bunk level | Each level = one **bed** row. A standard 2-level bunk = 2 rows. |
| Full / Double | 1.1 | 2 | |
| Queen | 1.2 | 2 | |
| King | 1.3 | 2 | |
| Sofa bed | 0.85 | 2 | May be 1 at host choice |
| Air mattress | 0.75 | 1 | |
| Other | 1.0 | 1 | |

**MVP:** do not expose **custom bed weights** in the UI. `parseBedWeights` in `src/lib/server/pricing-canonical.ts` may still merge `bedWeights` JSON with defaults — keep that for forward compatibility.

**Bunks:** 2 levels = 2 bed objects in one room → privacy is **semi-private (1.125)**, not full private (1.25). Intentional.

---

## Privacy factor

Used in `PER_ROOM` and `PER_BED`, from **count of bed objects** in the room (not spot count).

| Beds in room | Privacy factor |
|--------------|----------------|
| 1 | 1.25 |
| 2 | 1.125 |
| 3+ | 1.0 |

**Formula**

`effective privacy = max(1.0, min(1.25, 1.25 − (bedsInRoom − 1) × 0.125))`

Computed at runtime, not stored. **Implementation:** `getEffectivePrivacyFactor` / `getRoomEffectivePrivacy` in `src/lib/server/pricing-canonical.ts`.

**UI:** show the adjustment in plain language with any differentiating price — e.g. *Private room · +25%* / *Shared room · standard rate*.

---

## Bed weight (`PER_BED` only)

`bed weight = (bed type weight) × (effective room privacy factor)`

Use **“bed weight”** consistently; do not say “spot weight” in new code (same idea, one name).

Examples: King, 1 bed in room: `1.3 × 1.25 = 1.625`. King, 3 beds in room: `1.3 × 1.0 = 1.3`.

---

## Common inputs

- **Nights:** `ceil(check-out − check-in)` in days; **end date exclusive** (e.g. Jan 4–9 check-out = 5 nights).
- **Stay factor:** **1** in MVP (no partial-stay pricing).
- **Equal-split live denominator:** `totalSlots` = **sum of `room.maxOccupancy`**, with a safe fallback (e.g. `|| 1` per your codebase) if unset. Used for **`per_person` live** only — not for the closing headcount range.

---

## Pricing models

### `PER_PERSON`

Equal split for **live** price. **Full trip** in MVP.

**Live (what they owe)**

- `per person (cents) = total trip cost (cents) ÷ totalSlots`
- `total reservation (cents) = per person × party size` (per your party-size rules)
- `totalSlots` = sum of **room** `maxOccupancy`. **Headcount fields do not** change this.

**Closing range at RSVP (planning; not the same as live formula)**

- **Favorable (min $ in range):** `total trip cost ÷ Trip.maxCapacity`
- **Expensive (max $ in range):** `total trip cost ÷ max(currentYesRsvpCount, expectedPeopleCount)`

**Example** — $5,000, `maxCapacity` = 10, `expectedPeopleCount` = 6, 2 yes.

- Favorable: $5,000 ÷ 10 = **$500**
- Expensive: $5,000 ÷ max(2, 6) = **$833** → show **$500 – $833**

After **8** yes: expensive = $5,000 ÷ max(8, 6) = **$625** → e.g. **$500 – $625**

After **10** yes: $5,000 ÷ 10 = **$500** on both → **one number** (range **closed** at the host cap).

### `PER_ROOM`

**Live:** privacy-weighted, **per night then sum** — not `totalCost × one room fraction` for the whole stay.

For each night (MVP: full-stay; still structure per night for future occupancy changes):

- Split `Trip.totalCost` across nights (see **Rounding**).
- Build denominator from occupied rooms: sum of `(room privacy × people in that room that night)`.
- Floor: `expectedPeopleCount × (average of all room privacies)`; `denominator = max(raw denominator, floor)`.
- Guest’s share that night: proportional to `(this room’s privacy × this guest’s party size)`.
- **Total = sum of nightly shares in cents, then present.**

**Closing range (RSVP):** run the **same weighted** `PER_ROOM` construction **twice** — (1) **favorable** headcount story using **`Trip.maxCapacity`** in the way your implementation distributes people across rooms (e.g. proportional to `room.maxOccupancy`), and (2) **expensive** using `max(currentYes, expectedPeopleCount)` with the same distribution rule. Must match the **universal** closing rule above. **UI:** always show **privacy** next to the price.

**Example (single night)** $5,000. Room A: 1 bed (1.25), 2 people. Room B: 3 beds (1.0), 3 people. Denominator = 1.25×2 + 1.0×3 = 5.5. Room A per person ≈ $1,136; Room B per person ≈ $909. (For **range** ends, re-run the same style with the two headcount inputs, not the numbers from this one-off example alone.)

### `PER_BED`

**Live:** by **bed weight**; shared beds split by spots.

- `bed weight` = type weight × room privacy; **unassigned** beds do not count in the denominator of **occupied** weight.
- `bed share` ∝ that bed’s weight; split among spot claimers; no partial-stay in MVP.
- Requote: merge proposed bed into **hypothetical** occupancy; **exclude** old assignment for a fair delta.

**Closing range:** use the same **favorable** / **expensive** **headcount** inputs as everywhere else:

- **Favorable sim headcount = `Trip.maxCapacity`** (full cap, with full sharing in the sim).
- **Expensive = `max(currentYes, expectedPeopleCount)`** with the **single-sleeper** / worst-sharing behavior your product defines.

Run **`per-bed-selection.ts` / `computePerBedRangeByBedId` style logic twice**; only the **headcount** input to the sim changes. Exact corners still live in code — do not reimplement from prose alone.

**Headcount cap — two code paths (do not merge without review)**

- `getPricingPreview` (PER_BED): today may cap with **bed row** count;  
- `perBedSelectionRangeForTripBedIds`: cap with **total spot** count.  

`// TODO: align preview with totalSpots` — do not “fix” one in isolation.

If no beds: show host and guest the copy you already use (“add rooms and beds” / “pricing when set up”).

**Display-only aggregation by type** — `min` / `max` of favorable / expensive per row of that type.

**Committed funds (dashboard):** exclude `PER_BED` guests with **no** bed assignment; price unknown.

---

## Rounding

- Prefer **integer cents** through the stack; no sloppy rounding mid-pipeline.
- **Trip over nights:** split total cents across nights, remainder with a deterministic rule (e.g. **largest remainder**, tiebreak **stable** by **night index**). Sum of all nights = **exact** total.
- **`PER_ROOM`:** for each night, all guests’ charges **sum** to that night’s cents — **test** this.
- **`PER_BED`:** round at the **end** of an assignment’s total in cents (after share and spot split).

---

## Cost range at RSVP (summary)

- **Favorable denominator (fixed for trip):** `Trip.maxCapacity`
- **Expensive denominator (live):** `max(currentYesRsvpCount, Trip.expectedPeopleCount)`  
- **Recomputed at submit** with a live yes count.  
- **Store:** `originalRangeMinCents` / `originalRangeMaxCents` (and fallbacks for re-approval: `acceptedEstimateLowCents` / `…HighCents` per your schema). **Immutable** after save.  
- If **new** cost **>** `originalRangeMaxCents` → re-approval path.

| State | Display idea |
|--------|----------------|
| Wide | $X – $Y · *at host max vs current confirmations* |
| Narrowing | $X – $Y · *getting closer as more confirm* |
| Nearly one value | *Almost closed* |
| Collapsed | single **$X** (when `currentYes` reaches **`maxCapacity`** in the two-end story) |

**Re-approval** — `src/lib/server/cost-reapproval.ts`, `CostReapprovalModal.svelte`. **Future:** possible host “absorbs delta” — `// TODO` in that flow, non-MVP.

---

## Validation: `PER_BED` and capacity

- **Activation block** if `total bed spot count < Trip.maxCapacity` (server + client). Message should name **max capacity** and **bed spots** and link to **Rooms & Beds** to fix.  
- **Ongoing** non-dismissible warning (host-only **Rooms** + **Pricing** settings) if `PER_BED` and spots drop under **`maxCapacity`**.  
- All beds taken / party too big for one bed: follow the UX in your spec (message host, allow RSVP without bed where allowed, `// TODO` multi-bed claim).

`Trip.maxCapacity` is **not null** in product rules for these guards; document any edge case in code if a legacy row exists.

---

## Deprecated paths

- `per_person_per_night` — not in MVP UI; `@deprecated` in code. Old trips: define server behavior (map to `per_person` or reject) explicitly.
- `computeRoomPricing` — **legacy** `PER_ROOM` / slot model; **not** the canonical per-night weighted room model. `calculateReservationPrice` may still **fall back** to it for unknown/legacy; search for the **`computeRoomPricing`** fallback in `calculateReservationPrice` in `pricing-canonical.ts` — if numbers are wrong, check that path first. **Mark deprecated,** migrate, then remove.

**Legacy (do not use for new work)**

```text
bed weight sum = sum over beds in room of (bed type weight × spot count)
slot value     = (bed weight sum ÷ room max occupancy) × room privacy
… (see code comments) …
```

---

## Implementation checklist

- [ ] `per_person_per_night` deprecated, not in UI; legacy data handled
- [ ] Stay factor = **1** everywhere in MVP
- [ ] **Live** `per_person` uses `totalSlots` (room `maxOccupancy` sum) — not `maxCapacity` / not `maxGuests` alone
- [ ] **Closing range** is **separate** from live math; **favorable = ÷ `Trip.maxCapacity`**
- [ ] **Expensive** = ÷ `max(yes, expectedPeopleCount)`; recompute; submit-time snapshot
- [ ] **Range** stored as `originalRangeMinCents` / `originalRangeMaxCents` — immutable
- [ ] `PER_ROOM` estimate: **two** headcount stories (`maxCapacity` vs `max(yes, expected)`) with same per-night method
- [ ] `PER_BED` sim: **two** runs; **favorable** sim count = **`maxCapacity`**
- [ ] `getPricingPreview` vs `perBedSelectionRangeForTripBedIds` — do not merge caps blindly
- [ ] `PER_ROOM` per night, sum; nightly sums tie to night cents; tests
- [ ] Privacy in guest UI wherever room-based cost differs
- [ ] `PER_BED` committed funds: unassigned = excluded
- [ ] Spots < `maxCapacity` blocked and still enforced on server
- [ ] `computeRoomPricing` deprecated / not used for new paths
- [ ] `parseBedWeights` merge kept; no weight UI in MVP
- [ ] `adultsCount` / kids: TODOs where party size is incomplete
- [ ] `maxCapacity` vs `maxGuests` vs `totalSlots` used correctly in each context
- [ ] `// TODO` host gap absorption (re-approval) per backlog

---

*Replaces the former `PRICING_FORMULAS.md` and `PRICING_MATH.md` (see those files for redirects).*
