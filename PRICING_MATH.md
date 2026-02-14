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

Everyone pays based on the bed they choose. Pricing is **per sleeping spot, per night**: larger beds and beds in rooms with fewer beds cost more (bed-type weight × effective room privacy). **partySize** = sleeping spots claimed by that RSVP.

**Displayed price** assumes at least the host’s minimum expected guest count attend. If more guests RSVP, the price decreases proportionally.

**Range** shows:
- **High end:** price at effectiveGuests (same denominator as displayed price).
- **Low end:** price at maxCapacityGuests.

**Spot weight:**  
```
spotWeight = bedTypeWeight × effectiveRoomPrivacyFactor
```

**Night cost:**  
```
nightCost = totalTripCost ÷ totalTripNights
```

**avgSpotWeight:**  
```
avgSpotWeight = fullInventoryWeight ÷ totalSpotCapacity
```

**effectiveGuests** (used for both displayed price and range high end):  
```
effectiveGuests = max(minExpectedGuests, yesRsvpGuests)
```

**effectiveWeight:**  
```
effectiveWeight = effectiveGuests × avgSpotWeight
```

**Displayed price and reservation total:**  
```
spotPricePerNight = nightCost × (spotWeight ÷ effectiveWeight)
guestDisplayedTotal = spotPricePerNight × nightsStayed × spotsClaimed
```

**Range:**  
```
highEnd = nightCost × (spotWeight ÷ (effectiveGuests × avgSpotWeight)) × nightsStayed × spotsClaimed
lowEnd  = nightCost × (spotWeight ÷ (maxCapacityGuests × avgSpotWeight)) × nightsStayed × spotsClaimed
```

Display and high end use the same denominator (effectiveWeight), so displayed price always lies within [lowEnd, highEnd]. Early RSVPs are not front-loaded; the range shrinks as more guests RSVP.

**UI implications**

- Prices shown next to beds use effectiveGuests; adding unused rooms does not change prices.
- A bed with multiple spots can be partially claimed; show **claimedSpots / spotCount** (e.g. “1/2” for one of two spots on a King).
- Enforce availability: a bed cannot exceed spotCount for any overlapping night.

---

## Partial stays

Partial stays are **model-dependent**.

- **PER_PERSON and PER_PERSON_PER_NIGHT:** Multiplying by a stay factor (e.g. `nightsStayed / totalNights`) is valid.
- **PER_ROOM:** Do **not** use “full stay price × stayFactor”. Allocate cost **per night**: for each night in the guest’s stay, compute that night’s share (nightly denominator in weighted units), then **sum** across the guest’s stayed nights. Minimum expected floor in weighted units.
- **PER_BED:** Do **not** use “full stay price × stayFactor”. Reservation total = nightCost × (spotWeight ÷ effectiveWeight) × nightsStayed × spotsClaimed (single formula; no per-night allocation by claimed spots or load factors).

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
