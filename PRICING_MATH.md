# Pricing Calculation Documentation

This document explains how pricing is calculated for rooms and beds based on the selected pricing model.

## Pricing Models

### 1. PER_PERSON (Equal Split)

**Calculation:**
- Total trip cost divided by total capacity (sum of all room max occupancies)
- Each person pays the same amount regardless of which room they stay in

**Formula:**
```
perPersonPrice = totalCost / totalCapacity
totalPrice = perPersonPrice * numberOfGuests
```

**Example:**
- Total cost: $5,000
- Total capacity: 10 people
- Per person: $500
- If 3 people book: $1,500 total

---

### 2. PER_PERSON_PER_NIGHT

**Calculation:**
- Total trip cost divided by total nights and total capacity
- Each person pays per night they stay

**Formula:**
```
perPersonPerNightPrice = totalCost / totalNights / totalCapacity
nightlyRate = perPersonPerNightPrice * numberOfGuests
totalPrice = nightlyRate * nightsStayed
```

**Example:**
- Total cost: $5,000
- Total nights: 5
- Total capacity: 10 people
- Per person per night: $100
- If 3 people stay for 3 nights: $900 total ($100 × 3 × 3)

---

### 3. PER_ROOM (Equal Split)

**Calculation:**
- Uses canonical pricing model with bed weights and sharing discounts
- Total trip cost divided by number of rooms
- Each room pays the same amount

**Formula (Canonical):**
```
roomPriceFullStay = totalCost / numberOfRooms
roomPricePerNight = roomPriceFullStay / totalNights
```

**Example:**
- Total cost: $5,000
- Number of rooms: 5
- Per room: $1,000 for full stay
- Per room per night (5 nights): $200/night

---

### 4. PER_BED (Weighted by Bed Type)

**Calculation:**
- Uses canonical pricing model with bed weights
- Beds are weighted: King (1.00), Queen (0.75), Full (0.70), Twin (0.50), Bunk (0.50), Sofa (0.40)
- Sharing discount applied: rooms with more beds cost less per bed
- Privacy premium: private rooms (single bed) cost more

**Formula (Canonical):**
```
1. Calculate bed weight sum per room:
   bedWeightSum = Σ (bedWeight[bedType] × capacitySlots)

2. Calculate per-slot value with sharing discount:
   roomValueDiscounted = bedWeightSum / (occMax ^ sharingExponentAlpha)
   slotValueBase = roomValueDiscounted / occMax

3. Apply privacy premium (if enabled):
   privacyMultiplier = 1 + (privacyPremiumP × privacyNorm)
   slotValue = slotValueBase × privacyMultiplier

4. Scale to dollars:
   totalValueAllSlots = Σ (slotValue × occMax)
   dollarsPerValueUnit = totalCost / totalValueAllSlots
   slotPriceFullStay = dollarsPerValueUnit × slotValue
   bedPriceFullStay = slotPriceFullStay × bedCapacitySlots
   bedPricePerNight = bedPriceFullStay / totalNights
```

**Example:**
- Total cost: $5,000
- Bedroom 1: 1 King Bed (weight 1.00, 2 slots)
- Bedroom 2: 1 Queen Bed (weight 0.75, 2 slots)
- Bedroom 3: 1 Twin Bed (weight 0.50, 1 slot)

**Calculation:**
1. Bed weight sums:
   - Room 1: 1.00 × 2 = 2.00
   - Room 2: 0.75 × 2 = 1.50
   - Room 3: 0.50 × 1 = 0.50
   - Total: 4.00

2. With sharing discount (alpha = 0.60):
   - Room 1: 2.00 / (2^0.60) = 1.32 → 1.32 / 2 = 0.66 per slot
   - Room 2: 1.50 / (2^0.60) = 0.99 → 0.99 / 2 = 0.50 per slot
   - Room 3: 0.50 / (1^0.60) = 0.50 → 0.50 / 1 = 0.50 per slot

3. Scale to $5,000:
   - Total value: (0.66 × 2) + (0.50 × 2) + (0.50 × 1) = 2.82
   - Dollars per unit: $5,000 / 2.82 = $1,773.05
   - King bed: $1,773.05 × 0.66 × 2 = $2,340.43
   - Queen bed: $1,773.05 × 0.50 × 2 = $1,773.05
   - Twin bed: $1,773.05 × 0.50 × 1 = $886.52

---

## Partial Stays

If `allowPartialStays` is enabled, guests can book for fewer nights than the full trip duration.

**Formula:**
```
stayFactor = nightsStayed / totalNights
priceForStay = fullStayPrice × stayFactor
```

**Example:**
- Full stay price: $1,000 (5 nights)
- Guest stays: 3 nights
- Stay factor: 3 / 5 = 0.6
- Price: $1,000 × 0.6 = $600

---

## Bed Weights (Default)

| Bed Type | Weight | Capacity |
|----------|--------|----------|
| King     | 1.00   | 2 people |
| Queen    | 0.75   | 2 people |
| Full     | 0.70   | 2 people |
| Twin     | 0.50   | 1 person |
| Bunk     | 0.50   | 1 person per slot |
| Sofa     | 0.40   | 1-2 people |
| Other    | 0.60   | Varies |

---

## Sharing Discount

The sharing discount makes rooms with more beds cheaper per bed. Controlled by `sharingExponentAlpha` (default: 0.60).

- **Lower alpha (0.3)**: Less discount, beds cost more similar
- **Higher alpha (0.9)**: More discount, shared rooms much cheaper

**Formula:**
```
roomValueDiscounted = bedWeightSum / (occMax ^ sharingExponentAlpha)
```

---

## Privacy Premium

Optional premium for private rooms (single bed). Controlled by `privacyPremiumP` (default: 0.00, range: 0-0.25).

**Formula:**
```
privacyNorm = 1 - ((occMax - 1) / (occMaxMax - 1))
privacyMultiplier = 1 + (privacyPremiumP × privacyNorm)
```

- **privacyPremiumP = 0.00**: No premium (default)
- **privacyPremiumP = 0.25**: Private rooms cost 25% more

---

## Notes

- All prices are stored in cents (integers) in the database
- Display prices are rounded to 2 decimal places
- The canonical pricing model ensures all pricing modes reconcile to the exact total trip cost
- Prices are calculated when rooms are created and can be locked at reservation time
