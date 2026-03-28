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

### 4. PER_BED — selection simulation + live split by occupied beds

Each **bed** in inventory has a weight:

```
bedWeight = bedTypeWeight × effectiveRoomPrivacyFactor
```

(one row in the `Bed` table = one priced unit; sharing the same physical bed splits that bed’s dollar share).

**Estimated range (preview / marketing):** Fix `simGuestCount = min(expectedPeopleCount, number of bed rows)`. For each bed row, simulate which *other* `simGuestCount − 1` beds are “taken” first:

- **Low (best case for this bed):** other guests take the **heaviest** remaining beds first.  
  `lowPrice = totalTripCost × w_this / (w_this + sum of next (simGuestCount−1) largest other weights)`
- **High (worst case):** other guests take the **lightest** remaining beds first.  
  `highPrice = totalTripCost × w_this / (w_this + sum of next (simGuestCount−1) smallest other weights)`

If `simGuestCount = 1`, that bed’s row is the only one in the denominator → it shows the full trip cost for the stay (before splitting among occupants).

**Live reservation price (after people pick beds):** Consider only beds that have at least one guest assigned (yes RSVPs with room assignments). Let `totalWeight = sum of bedWeight over occupied beds`.

```
bedShare = totalTripCost × bedWeight / totalWeight   (full trip, for that bed)
```

An assignment with `partySize` on that bed pays:

```
assignmentPrice = bedShare × (partySize / totalPartyOnThatBed) × (nightsStayed / totalTripNights)
```

**Quotes** (before save): merge the guest’s proposed bed into occupancy; optionally exclude that user’s existing assignments so changing beds re-prices correctly.

**UI implications**

- Show **low–high** per bed type or per bed row for estimates; show **live** amount from the occupied-bed formula once assignments exist.
- Guests sharing one bed split that bed’s share; occupancy does not change the bed’s weight, only how many people divide `bedShare`.

---

## Partial stays

Partial stays are **model-dependent**.

- **PER_PERSON and PER_PERSON_PER_NIGHT:** Multiplying by a stay factor (e.g. `nightsStayed / totalNights`) is valid.
- **PER_ROOM:** Do **not** use “full stay price × stayFactor”. Allocate cost **per night**: for each night in the guest’s stay, compute that night’s share (nightly denominator in weighted units), then **sum** across the guest’s stayed nights. Minimum expected floor in weighted units.
- **PER_BED:** Apply **stay factor** to the full-trip bed share: `bedShare × (party fraction on bed) × (nightsStayed / totalTripNights)`.

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
