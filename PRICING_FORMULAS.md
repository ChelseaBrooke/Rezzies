# Pricing Formulas (Full Variable Names)

Reference for all pricing-related formulas used in the app. Variables are spelled out instead of using single letters.

---

## Privacy factor

**Where used:** `getEffectivePrivacyFactor` / `getRoomEffectivePrivacy` in `pricing-canonical.ts`.

- **Effective privacy factor (by bed count in room)**  
  `effective privacy factor = max(1.0, min(1.25, 1.25 − (number of beds in room − 1) × 0.125))`  
  So: 1 bed → 1.25, 2 beds → 1.125, 3+ beds → 1.0.

---

## Spot weight and spot count (PER_BED)

- **Spot weight**  
  `spot weight = bed type weight × effective room privacy factor`  
  (Bed type weight from table; room privacy from formula above.)

- **Spot count for a bed**  
  `spot count = capacity slots` (or `capacity` if set, else 1).

---

## Common inputs

- **Number of nights**  
  `number of nights = ceil((check-out date − check-in date) in days)` (end exclusive).

- **Stay factor (partial stays)**  
  `stay factor = nights stayed ÷ total trip nights`  
  (Often used as multiplier for PER_PERSON / PER_PERSON_PER_NIGHT.)

---

## PER_PERSON

- **Per-person price (full stay)**  
  `per person price = total trip cost ÷ total capacity`  
  (Total capacity = sum of rooms’ max occupancy.)

- **Total reservation price**  
  `total price = per person price × number of guests × stay factor`

---

## PER_PERSON_PER_NIGHT

- **Per-person per-night price**  
  `per person per night price = total trip cost ÷ total trip nights ÷ total capacity`

- **Total reservation price**  
  `total price = per person per night price × number of guests × nights stayed`

---

## PER_ROOM

- **When partial stays are allowed:** Compute **per night**; do not use full stay price × stay factor.
- **Per night:**  
  `night cost cents` = that night’s share of total trip cost (integer cents, distributed deterministically across trip nights).  
  `people in each room that night` = from assignments active that night (including this booking).  
  `denominator` = sum over each occupied room of (that room’s effective privacy factor × number of people in that room that night).  
  `floor weighted` = minimum expected guest count × average room privacy factor.  
  `denominator` = max(denominator, floor weighted).  
  This guest’s share for that night (cents) = round(night cost cents × (this room’s effective privacy factor × this guest’s party size) ÷ denominator).
- **Total reservation price**  
  `total price = (sum of this guest’s nightly share in cents over all stayed nights) ÷ 100`

---

## PER_BED — shared definitions

- **Bed row weight** (one DB bed row = one priced unit)  
  `bed weight = bed type weight × room privacy factor`

- **Simulation guest count** (estimates only; not `max(yes RSVP, expected)`)  
  `sim guest count = min(expected people count, number of bed rows in inventory)`

- **Expanded inventory**  
  One row per bed in the trip (count is already expanded in the data model used for pricing).

---

## PER_BED — estimated price per bed (range)

For each bed row, with `others = sim guest count − 1`:

- **Low (others take heaviest beds first):**  
  `low = total trip cost × w_this ÷ (w_this + sum of next others largest weights among remaining rows)`

- **High (others take lightest beds first):**  
  `high = total trip cost × w_this ÷ (w_this + sum of next others smallest weights among remaining rows)`

Aggregate by bed type: `type low = min(rows)`, `type high = max(rows)`.

**Guest share on a bed:** `bed share × (party on bed ÷ total party on bed) × stay factor`. Occupancy does not change `w_this`; it only splits the bed’s dollar share.

---

## PER_BED — live reservation total (after assignments)

- Only beds with at least one yes-RSVP assignment are in the denominator.  
  `total weight = sum of bed weight over occupied beds`  
  `bed share = total trip cost × bed weight ÷ total weight`

- **Per assignment:**  
  `assignment total = bed share × (party size ÷ total party on that bed) × (nights stayed ÷ total trip nights)`  
  Sum assignments for the guest’s total.

- **Quotes** (before save): merge provisional pick into occupancy; exclude that user’s existing assignments when re-pricing a change.

---

## PER_BED — bed display (“X per night · Y total”)

- **Estimates:** show low–high per bed type (or per row) using the selection simulation above; per-night = total ÷ trip nights for display strings.
- **Live:** show the amount from the occupied-bed formula.

---

## Committed funds (dashboard “$ committed”)

- **Committed funds**  
  `committed funds = sum over every yes-RSVP of (that person’s current expected cost)`  
  Where “current expected cost” = reservation price (PER_BED: live bed-share split as above; PER_ROOM: per-night weighted denominator). Yes-RSVPs with no assignment: PER_BED does not assume a price until a bed is assigned; other models may use first room / default slot rules as documented elsewhere.

---

## Room pricing (legacy / computeRoomPricing)

- **Per room**  
  `bed weight sum = sum over beds in room of (bed type weight × spot count)`  
  `slot value = (bed weight sum ÷ max occupancy in room) × room effective privacy factor`  
  `total value all slots = sum over rooms of (slot value × max occupancy in room)`  
  `dollars per value unit = total trip cost ÷ total value all slots`  
  `slot price full stay = dollars per value unit × slot value`  
  `room price full stay = slot price full stay × max occupancy in room`  
  `slot price per night = slot price full stay ÷ total trip nights`  
  `room price per night = room price full stay ÷ total trip nights`

---

## Rounding

- **Trip cost to nights**  
  Total trip cost in cents is distributed evenly across trip nights with deterministic rounding so the sum of nightly amounts equals total trip cost.

- **PER_BED**  
  Rounding is applied to the final assignment total in cents after the bed-share split and stay factor.
