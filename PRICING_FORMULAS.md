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

- **Full inventory weight**  
  `full inventory weight = sum over every sleeping spot in the trip of (that spot’s spot weight)`  
  (Each bed contributes `spot count × spot weight`; spot weight = bed type weight × room privacy.)

- **Total spot capacity**  
  `total spot capacity = sum over all beds of (spot count per bed)`

- **Average spot weight**  
  `average spot weight = full inventory weight ÷ total spot capacity`

- **Floor weight (minimum expected)**  
  `floor weight = minimum expected guest count × average spot weight`  
  (Minimum expected is trip’s expected guest count or similar, at least 1.)

- **Claimed weight (for a given night)**  
  `claimed weight = sum over all claimed spots that night of (that spot’s spot weight)`  
  (From current YES RSVP assignments active that night; include the prospective booking when calculating a reservation.)

- **Load factor (no host gap)**  
  When attendance is below minimum expected, current RSVPs absorb the shortfall.  
  `load factor = max(1, floor weight ÷ claimed weight)`  
  `effective night cost cents = round(night cost cents × load factor)`  
  Then allocate effective night cost cents across claimed spots by weight.

---

## PER_BED — reservation price (one guest’s total)

- **Do not use** full stay price × stay factor. Use **per-night summation**.
- For each night in the guest’s stay:  
  Build claimed spots (current YES RSVP assignments active that night + this booking).  
  `claimed weight` = sum of spot weights.  
  `load factor` = max(1, floor weight ÷ claimed weight).  
  `effective night cost cents` = round(night cost cents × load factor).  
  Allocate effective night cost cents across spots (largest remainder, tie-break by spot id).  
  Sum the cents allocated to this reservation’s spots (“booking” tag).
- **Total reservation price**  
  `total price = (sum of this reservation’s spot cents over all stayed nights) ÷ 100`

---

## PER_BED — bed display (“X per night · Y total”)

- **Driven by current YES RSVPs** (no prospective booking when showing the grid).
- For each trip night:  
  `night cost cents` = that night’s share of total trip cost.  
  Build claimed spots from YES RSVP assignments active that night.  
  `load factor` = max(1, floor weight ÷ claimed weight).  
  `effective night cost cents` = round(night cost cents × load factor).  
  Allocate across spots; aggregate allocated cents by bed id.
- **Per bed**  
  `bed total cents` = sum over trip nights of (cents allocated to that bed that night).  
  Display: `total = bed total cents ÷ 100`, `per night = bed total cents ÷ total trip nights ÷ 100`.

---

## PER_BED — estimate range (“My estimated share: $X–$Y”)

- **Low estimate (max capacity)**  
  `low estimate = nights stayed × night cost × (party size × spot weight) ÷ full inventory weight`  
  (Assumes “all spots filled”.)

- **High estimate (min expected)**  
  `high estimate = nights stayed × night cost × (party size × spot weight) ÷ floor weight`  
  (Assumes only minimum expected guests.)

---

## PER_BED — “all beds claimed” (full lodging)

- **Single value (no range)**  
  `full stay amount = total trip cost × stay factor`  
  (Stay factor = nights stayed ÷ total trip nights.)

---

## Committed funds (dashboard “$ committed”)

- **Committed funds**  
  `committed funds = sum over every yes-RSVP of (that person’s current expected cost)`  
  Where “current expected cost” = reservation price using the same per-night logic as above (PER_BED: loadFactor and spot allocation; PER_ROOM: per-night weighted denominator). No host gap; shortfall distributed across current RSVPs. Yes-RSVPs with no assignment (e.g. PER_PERSON before room pick): use first room and 1 slot at current rate.

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
