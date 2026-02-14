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

- **Night cost (per night of trip)**  
  `night cost = total trip cost ÷ total trip nights`

- **Spot weight**  
  `spot weight = bed type weight × room privacy factor`

- **Full inventory weight**  
  `full inventory weight = sum over every sleeping spot in the trip of (that spot’s spot weight)`

- **Total spot capacity**  
  `total spot capacity = sum over all beds of (spot count per bed)`

- **Average spot weight**  
  `average spot weight = full inventory weight ÷ total spot capacity`

- **Effective guests** (used for both displayed price and range high end)  
  `effective guests = max(min expected guests, yes RSVP guests)`

- **Effective weight**  
  `effective weight = effective guests × average spot weight`

---

## PER_BED — displayed price and reservation total

- **Displayed price formula:**  
  `spot price per night = night cost × (spot weight ÷ effective weight)`  
  `guest displayed total = spot price per night × nights stayed × spots claimed`  
  (Effective weight = effective guests × average spot weight; same rule as range high end.)

- **Reservation total:**  
  Same formula: `total price = night cost × (spot weight ÷ effective weight) × nights stayed × spots claimed`  
  (No per-night allocation by claimed spots; no load factors.)

---

## PER_BED — bed display (“X per night · Y total”)

- **Display and range high end use the same rule:**  
  `effective guests = max(min expected guests, yes RSVP guests)`  
  `effective weight = effective guests × average spot weight`  
  `spot price per night = night cost × (spot weight ÷ effective weight)`  
  `guest displayed total = spot price per night × nights stayed × spots claimed`
- **Per bed**  
  Display: `total = bed total`, `per night = spot price per night` (for that bed’s spots).  
  Bed type mapping (e.g. queen ≠ bunk) and spot count are respected via spot weight and spot count.

---

## PER_BED — estimate range (“My estimated share”)

- **Range high-end formula** (same denominator as displayed price):  
  `night cost × (guest claimed weight ÷ (max(min expected guests, yes RSVP guests) × average spot weight))`  
  i.e. `night cost × (spot weight ÷ effective weight) × nights stayed × spots claimed`

- **Range low-end formula:**  
  `night cost × (guest claimed weight ÷ (max capacity guests × average spot weight))`

- **Per assignment:**  
  `high end = night cost × (spot weight ÷ (effective guests × avg spot weight)) × nights stayed × spots claimed`  
  `low end = night cost × (spot weight ÷ (max capacity guests × avg spot weight)) × nights stayed × spots claimed`  
  Sum over each claimed bed/assignment when the guest has multiple beds.

- **Displayed price always lies within [lowEnd, highEnd].** Range shrinks as more guests RSVP.
- **UI**  
  Show displayed price as “My estimated share: $X” with “Range: $low–$high depending on final headcount.”

---

## PER_BED — “all beds claimed” (full lodging)

- **Single value (no range)**  
  `full stay amount = total trip cost × stay factor`  
  (Stay factor = nights stayed ÷ total trip nights.)

---

## Committed funds (dashboard “$ committed”)

- **Committed funds**  
  `committed funds = sum over every yes-RSVP of (that person’s current expected cost)`  
  Where “current expected cost” = reservation price using the same per-night logic as above (PER_BED: allocate night cost by weight across claimed spots only; PER_ROOM: per-night weighted denominator). Yes-RSVPs with no assignment (e.g. PER_PERSON before room pick): use first room and 1 slot at current rate.

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

- **Integer cents per spot**  
  For PER_BED, each night’s effective night cost (in cents) is allocated across claimed spots by weight. Use largest-remainder; tie-break by spot id so the sum of spot charges for that night equals effective night cost cents exactly. No unit mismatch (all in weighted or all in cents).
