# Pricing Calculation Documentation

This document explains how pricing is calculated for rooms and beds based on the selected pricing model. Privacy is a factor in both per-room and per-bed pricing.

## Bed-type weights (universal)

Used in per-bed pricing. Weights are relative; larger beds cost more than smaller beds.

| Bed type      | Bed weight |
|---------------|------------|
| Twin / Single | 1.0        |
| Bunk (per person) | 0.9   |
| Full / Double | 1.1        |
| Queen         | 1.2        |
| King          | 1.3        |
| Sofa bed      | 0.85       |
| Air mattress  | 0.75       |
| Other         | 1.0        |

## Privacy factor (evolving by bed count)

Used in both per-room and per-bed pricing. The **effective privacy factor** is derived from **how many beds are in the room**, so a room with one bed is treated as more private than a room with three.

**Important:** **bedCount** (for the privacy factor) means the number of **bed objects** in the room, not the number of sleeping spots.

| Beds in room | Effective privacy factor | Meaning        |
|--------------|--------------------------|----------------|
| 1            | 1.25                     | Most private   |
| 2            | 1.125                    | In between     |
| 3 or more    | 1.0                      | Shared         |

**Formula:** `factor = max(1.0, 1.25 - (bedCount - 1) × 0.125)`, clamped to the range 1.0–1.25.

So: one bed in a room → higher factor → that bed’s share of the trip cost is higher; multiple beds in a room → lower factor → each bed’s share is lower. The same bed type (e.g. sofa) in a 1-bed room therefore costs more than the same bed type in a 3-bed room.

---

## Sleeping spots (universal)

**Sleeping spot** is the atomic unit for PER_BED pricing.

- Each bed has **spotCount** = capacity in people (how many sleeping spots that bed provides).
- Each RSVP claims **spotsClaimed** = **partySize** sleeping spots on a bed (or across beds if supported later; for now assume a single bed selection must have enough spots).
- Beds can be partially claimed (e.g. a King has 2 spots; two separate guests can each claim 1 spot).

**Default spot count by bed type:**

| Bed type      | Spot count (default) |
|---------------|----------------------|
| Twin / Single | 1                    |
| Full / Double | 2                    |
| Queen         | 2                    |
| King          | 2                    |
| Bunk (per person) | 1 per bunk spot  |
| Sofa bed      | 2                    |
| Air mattress  | 1                    |
| Other         | 1                    |

(Sofa bed may be configured as 1 depending on product; document whichever is used.)

---

## Pricing models

### 1. PER_PERSON (Equal split)

**Calculation:** Total trip cost divided by total capacity. Each person pays the same amount.

**Formula:**
```
perPersonPrice = totalCost / totalCapacity
totalPrice = perPersonPrice × numberOfGuests
```

**Example:** Total cost $5,000, total capacity 10 → $500 per person.

---

### 2. PER_PERSON_PER_NIGHT

**Calculation:** Total trip cost divided by total nights and total capacity. Each person pays per night.

**Formula:**
```
perPersonPerNightPrice = totalCost / totalNights / totalCapacity
nightlyRate = perPersonPerNightPrice × numberOfGuests
totalPrice = nightlyRate × nightsStayed
```

**Example:** $5,000, 5 nights, capacity 10 → $100 per person per night.

---

### 3. PER_ROOM (with privacy)

In this model, bed type does not matter—only the room and its **effective privacy factor** (from bed count). Each person in a room pays the same share of the room’s weighted portion.

**Formula:**
```
Price per person =
  Total trip cost
  × (room effective privacy factor)
  ÷ (sum of (room effective privacy × number of people in that room) for all occupied rooms,
     or the minimum expected guests equivalent — whichever is higher)
```

**Denominator:** For each occupied room, add `(effective privacy × number of people in that room)`. Effective privacy is from the table above (1 bed → 1.25, 2 beds → 1.125, 3+ beds → 1.0).

**Example:** Total cost $5,000. Room A: 1 bed (factor 1.25), 2 people. Room B: 3 beds (factor 1.0), 3 people.  
Denominator = (1.25 × 2) + (1.0 × 3) = 2.5 + 3 = 5.5.  
Each person in Room A: 5000 × 1.25 / 5.5 ≈ $1,136.36.  
Each person in Room B: 5000 × 1.0 / 5.5 ≈ $909.09.

**Partial stays:** If partial stays are enabled, PER_ROOM should be computed per night (occupancy can vary by night), then summed across the guest’s stayed nights.

---

### 4. PER_BED (with privacy) — per sleeping spot, per night

Everyone pays based on the bed they choose. Pricing is **per sleeping spot, per night**: larger beds and beds in rooms with fewer beds cost more (bed-type weight × effective room privacy).

**Spot weight:**  
Every sleeping spot has a weight:

```
spotWeight = bedTypeWeight × effectiveRoomPrivacyFactor
```

**Night cost:**  
Each night has a fixed cost (cents; handle remainder deterministically):

```
nightCost = totalCost / totalNights
```

**Per-night allocation:**  
For each night *d*:

1. Determine all YES RSVPs active on night *d* (their selected stay dates include that night).
2. Expand each RSVP into **spotsClaimed** identical spots on the chosen bed(s).
3. Compute **total active weight** that night:
   ```
   W_d = sum(spotWeight for all active claimed spots that night)
   ```
4. Define **effective weight** for that night (see “Minimum expected” below), then allocate that night’s cost proportionally.

**Charge for a single claimed spot on night *d*:**

```
spotCharge_d = nightCost × (spotWeight / W_eff_d)
```

(If a guest claims *k* spots, their charge for that night is *k* × spotCharge_d for one spot’s weight.)

**Minimum expected (recommended default): host covers the gap below min expected**

Compute a floor weight that represents “min expected occupancy” using average spot weight:

```
W_full = sum(spotWeight for every spot in inventory)
totalSpotCapacity = total number of sleeping spots across all beds
avgW = W_full / totalSpotCapacity
W_floor = minExpectedGuests × avgW
```

Then:

```
W_eff_d = max(W_d, W_floor)
```

If *W_d* < *W_floor*, the host covers the nightly gap:

```
hostGap_d = nightCost × (1 - W_d / W_floor)
```

All guest spot charges still use *W_eff_d*, so early RSVPs don’t see extreme pricing swings.

**Guest total:**

```
guestTotal = sum(spotCharge_d over all their claimed spots and stayed nights)
```

**UI implications**

- **Price shown next to a bed** = the price for one spot on that bed for the guest’s selected nights (or show per-night and total).
- A bed with multiple spots can be partially claimed; show **claimedSpots / spotCount** (e.g. “1/2” for one of two spots on a King).

---

#### Estimate range (stable; does not use current YES RSVPs)

The bottom-of-UI range (“My estimated share: $X–$Y”) uses **simulated** occupancy, not current YES RSVPs.

**Two simulated denominators for PER_BED:**

- **Max capacity scenario:**  
  `W_max = W_full` (all spots filled).

- **Min expected scenario:**  
  `W_min = minExpectedGuests × avgW` (with *avgW* as above).

For a guest selecting a bed with **spotWeight** = *w*, **party size** *k*, **nights stayed** *n*:

```
lowEstimate  = n × nightCost × (k × w / W_max)
highEstimate = n × nightCost × (k × w / W_min)
```

**Disclaimer (plain language):**  
“Range assumes min expected guests represent average nightly occupancy; actual totals depend on who attends which nights and which beds they select.”

---

## Partial stays

Partial stays are **model-dependent**.

- **PER_PERSON and PER_PERSON_PER_NIGHT:** Multiplying by a stay factor (e.g. `nightsStayed / totalNights`) is valid.
- **PER_ROOM and PER_BED:** Do **not** compute “full stay price × stayFactor” unless occupancy is identical every night. Instead, allocate cost **per night**.
- For weighted models (PER_ROOM, PER_BED), pricing is calculated **per night** across the set of occupied selections for that night, then **summed** across the guest’s stayed nights.

---

## Rounding (cents)

- All calculations use **integer cents**.
- For each night, allocate *nightCost* across spots using fractional shares, then distribute **remaining cents** using a deterministic method (e.g. largest remainder or stable sort by spot id) so the sum of spot charges for that night equals *nightCost*.

---

## Notes

- All prices are stored in cents (integers) in the database where applicable.
- Display prices are rounded to 2 decimal places.
- **Effective privacy** is computed from the number of **bed objects** in the room (evolving factor), not from a stored setting.
- Bed weights are configurable per trip (JSON) but default to the universal table above.
