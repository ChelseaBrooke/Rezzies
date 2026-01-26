/**
 * Test VRBO GraphQL API with browser cookies
 * 
 * INSTRUCTIONS:
 * 1. Open https://www.vrbo.com/788798?chkin=2026-01-27&chkout=2026-01-30&adults=3...
 * 2. Open browser DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter
 * 6. Look for the "$381 for 3 nights" in the output
 */

(async function testGraphQL() {
  const body = [{
    "operationName": "AncillaryPropertyOffersQuery",
    "variables": {
      "propertyId": "18968197",
      "searchCriteria": {
        "primary": {
          "dateRange": {
            "checkInDate": { "day": 27, "month": 1, "year": 2026 },
            "checkOutDate": { "day": 30, "month": 1, "year": 2026 }
          },
          "destination": {
            "regionName": "Jersey Mills, Pennsylvania, United States of America",
            "regionId": "3000455107",
            "coordinates": { "latitude": 41.357292, "longitude": -77.406644 },
            "pinnedPropertyId": "18968197"
          },
          "rooms": [{ "adults": 3, "children": [] }]
        },
        "secondary": {
          "counts": [],
          "booleans": [],
          "selections": [
            { "id": "privacyTrackingState", "value": "CAN_TRACK" },
            { "id": "searchId", "value": "4310e2a6-ae6b-4ed3-afea-902e9ffb91d8" },
            { "id": "selected", "value": "18968197" },
            { "id": "sort", "value": "RECOMMENDED" },
            { "id": "useRewards", "value": "SHOP_WITHOUT_POINTS" }
          ],
          "ranges": []
        }
      },
      "shoppingContext": { "multiItem": null, "queryTriggeredBy": "OTHER" },
      "context": {
        "siteId": 9001001,
        "locale": "en_US",
        "eapid": 1,
        "tpid": 9001,
        "currency": "USD",
        "device": { "type": "DESKTOP" },
        "identity": { "duaid": "test", "authState": "ANONYMOUS" },
        "privacyTrackingState": "CAN_TRACK"
      }
    },
    "extensions": {
      "persistedQuery": {
        "version": 1,
        "sha256Hash": "342098639bb044c70b290892d183a8987ee1c33fbee0bf7140384af70bbe2b70"
      }
    }
  }];

  console.log("🔌 Testing VRBO GraphQL API with your browser's cookies...");
  
  try {
    const response = await fetch("https://www.vrbo.com/serp/g", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-info": "shopping-pwa,unknown,unknown",
        "x-page-id": "page.Hotels.Infosite.Information,H,30"
      },
      body: JSON.stringify(body)
    });

    console.log("✅ Response Status:", response.status);
    
    if (response.status === 429) {
      console.error("❌ Got 429 - Rate Limited. VRBO is blocking the request.");
      return;
    }

    const data = await response.json();
    console.log("📦 Full Response:", data);

    // Find price in response
    function findPrice(obj, path = "") {
      if (!obj || typeof obj !== "object") return;
      
      if (obj.value && typeof obj.value === "string" && obj.value.includes("for") && obj.value.includes("night")) {
        console.log(`💰 FOUND PRICE at ${path}:`, obj.value, `(state: ${obj.state})`);
      }
      
      for (const key in obj) {
        findPrice(obj[key], `${path}.${key}`);
      }
    }

    findPrice(data);
    
    console.log("\n✅ Test complete. Check the '$' amounts above.");
    console.log("If you see '$381 for 3 nights', your browser cookies work.");
    console.log("If you see '$366 for 3 nights' or rate limit, we need a different approach.");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
