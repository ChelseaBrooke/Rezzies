# Property Scraping Setup Guide

To enable automatic property information extraction from Airbnb/VRBO URLs, you need to set up a scraping service.

## ⭐ Recommended: Zyte API

**Zyte API is the recommended solution** - it's the most reliable and handles all bot detection automatically.

See **[ZYTE_SETUP.md](./ZYTE_SETUP.md)** for detailed setup instructions.

Quick setup:
1. Get API key from [zyte.com](https://www.zyte.com/)
2. Add `ZYTE_API_KEY=your-key` to `.env` and Vercel
3. Done! Automatic scraping will work.

---

## Alternative Options

## Option 1: ScraperAPI (Requires Paid Plan for VRBO/Airbnb)

**Important:** The free ScraperAPI plan does NOT support premium proxies, which are required for VRBO and Airbnb.

**For VRBO/Airbnb scraping, you need:**
- A **paid ScraperAPI plan** that includes premium proxies
- Set `SCRAPER_API_USE_PREMIUM=true` in your `.env` file
- Each request costs 30 credits (vs 1 credit for regular sites)

**Alternative:** For now, the app will work fine with manual entry. Just enter the property details yourself when creating a trip.

### Setup Steps (Paid Plan Required):

1. **Sign up for ScraperAPI Paid Plan**:
   - Go to https://www.scraperapi.com/
   - Sign up for a plan that includes premium proxies (Starter plan or higher)
   - Get your API key from the dashboard

2. **Add API key to environment variables**:
   - Add to your `.env` file:
     ```
     SCRAPER_API_KEY=your-api-key-here
     SCRAPER_API_USE_PREMIUM=true
     ```
   - For Vercel deployment, add both in Vercel dashboard > Settings > Environment Variables

3. **That's it!** The app will automatically use ScraperAPI premium proxies when enabled.

**Note:** Without a paid plan, the app will gracefully fall back to manual entry, which works perfectly fine!

## Option 2: Direct Fetch (No Setup, Less Reliable)

If you don't set up ScraperAPI, the app will attempt direct fetching, but this may fail due to:
- CORS restrictions
- Anti-bot measures
- JavaScript-rendered content

**Result**: Property info may not auto-populate, requiring manual entry.

## Option 3: Other Scraping Services

You can modify `src/lib/server/property-ingestion.ts` to use other services:

- **Bright Data** (formerly Luminati): https://brightdata.com/
- **Apify**: https://apify.com/
- **ScrapingBee**: https://www.scrapingbee.com/

## Testing

After setting up ScraperAPI:

1. Restart your dev server
2. Go to trip creation page
3. Enter a VRBO or Airbnb URL
4. Click "Fetch Info"
5. Property details should auto-populate including:
   - Title
   - Max guests (Sleeps X for VRBO, Accommodates X for Airbnb)
   - Cover photo (if available)

## Troubleshooting

**Scraping not working?**
- Check that `SCRAPER_API_KEY` is set in your `.env` file
- Restart your dev server after adding the key
- Check browser console for errors
- Verify your ScraperAPI account has remaining credits

**Getting incorrect data?**
- The extraction patterns may need adjustment
- Check the actual HTML structure of the listing page
- Modify the regex patterns in `property-ingestion.ts`
