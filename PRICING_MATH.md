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

## Privacy factors

Used in both per-room and per-bed pricing. Stored per room.

| Room type            | Privacy factor |
|----------------------|----------------|
| Shared room          | 1.0            |
| Private room         | 1.25           |
| Private room + ensuite | 1.4         |

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

In this model, bed type does not matter—only the room and its privacy factor. Each person in a room pays the same share of the room’s weighted portion.

**Formula:**
```
Price per person =
  Total trip cost
  × (room privacy factor)
  ÷ (sum of (room privacy factor × number of people in that room) for all occupied rooms,
     or the minimum expected guests equivalent — whichever is higher)
```

**Denominator:** For each occupied room, add `(room privacy factor × number of people in that room)`. Sum over all occupied rooms. Use that sum, or a minimum based on expected guest count, whichever is higher.

**Example:** Total cost $5,000. Room A: private (1.25), 2 people. Room B: shared (1.0), 3 people.  
Denominator = (1.25 × 2) + (1.0 × 3) = 2.5 + 3 = 5.5.  
Each person in Room A: 5000 × 1.25 / 5.5 ≈ $1,136.36.  
Each person in Room B: 5000 × 1.0 / 5.5 ≈ $909.09.

---

### 4. PER_BED (with privacy)

Everyone pays based on the bed they choose. Larger beds cost more; beds in private rooms cost more.

**Formula:**
```
Price per person =
  Total trip cost
  × (bed weight × privacy factor)
  ÷ (sum of (bed weight × privacy factor) for everyone who RSVP’d yes,
     or the minimum expected guests equivalent — whichever is higher)
```

That is the whole calculation: one term per person (bed weight × room privacy factor), sum in the denominator, then scale so the total equals the trip cost.

**Example:** Total cost $5,000. One guest: King (1.3) in private room (1.25). Another: Twin (1.0) in shared room (1.0).  
Denominator = (1.3 × 1.25) + (1.0 × 1.0) = 1.625 + 1.0 = 2.625.  
Guest 1: 5000 × 1.625 / 2.625 ≈ $3,095.24.  
Guest 2: 5000 × 1.0 / 2.625 ≈ $1,904.76.

---

## Minimum expected guests equivalent

For both per-room and per-bed, the denominator is never lower than a “minimum expected guests equivalent” so that:

- Early bookers don’t overpay when few people have RSVP’d.
- The total still reconciles to the trip cost as more people are added.

Implementation typically uses the trip’s expected guest count (or total bed capacity) to compute a floor on the denominator (e.g. assuming average weight × average privacy per slot).

---

## Partial stays

If `allowPartialStays` is enabled, guests can book for fewer nights than the full trip.

**Formula:**
```
stayFactor = nightsStayed / totalNights
priceForStay = fullStayPrice × stayFactor
```

---

## Notes

- All prices are stored in cents (integers) in the database where applicable.
- Display prices are rounded to 2 decimal places.
- Room privacy factor is stored on the Room model (default 1.0 = shared). Private = 1.25, private + ensuite = 1.4.
- Bed weights are configurable per trip (JSON) but default to the universal table above.
