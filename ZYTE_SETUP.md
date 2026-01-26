# Zyte API Setup Guide

Zyte API is a professional web scraping service that automatically handles bot detection, rate limiting, and JavaScript rendering. This makes it perfect for scraping VRBO and Airbnb.

## Why Use Zyte API?

✅ **Bypasses bot detection** - No more "Bot or Not?" pages  
✅ **Handles rate limiting** - Automatic retries and proxy rotation  
✅ **JavaScript rendering** - Gets fully rendered HTML  
✅ **Reliable** - Professional infrastructure designed for scraping  
✅ **Automatic** - No manual workarounds needed  

## Setup Steps

### 1. Get a Zyte API Key

1. Go to [https://www.zyte.com/](https://www.zyte.com/)
2. Sign up for an account
3. Navigate to your dashboard
4. Find your API key (usually under "API Keys" or "Settings")
5. Copy the API key

### 2. Add to Environment Variables

**Local Development (.env file):**
```bash
ZYTE_API_KEY=97cece0154e24cb397398da5c8189b91
```

**Vercel (Production):**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add a new variable:
   - **Name**: `ZYTE_API_KEY`
   - **Value**: Your Zyte API key
   - **Environment**: Production, Preview, Development (select all)
4. Save and redeploy

### 3. Test It

1. Restart your dev server (if running locally)
2. Go to `/admin/trips/new`
3. Enter a VRBO URL (e.g., `https://www.vrbo.com/788798`)
4. Click "Try Auto-Fetch"
5. It should now work automatically! ✅

## How It Works

When `ZYTE_API_KEY` is set, the scraper will:
1. Use Zyte API instead of direct fetching
2. Send the VRBO/Airbnb URL to Zyte
3. Zyte handles all the complexity (bot detection, proxies, etc.)
4. Returns the HTML content
5. Your app extracts the property data from the HTML

## Pricing

Zyte API uses pay-as-you-go pricing:
- Typically $0.001-0.01 per request
- Check [Zyte's pricing page](https://www.zyte.com/pricing/) for current rates
- Much cheaper than dealing with failed requests and manual workarounds

## Troubleshooting

### "Invalid API key" error
- Double-check your `ZYTE_API_KEY` in `.env` and Vercel
- Make sure there are no extra spaces or quotes
- Restart your dev server after adding the key

### "Insufficient credits" error
- Check your Zyte account balance
- Add credits to your Zyte account

### Still getting errors?
- Check the server logs for detailed error messages
- Verify the API key is correct in your Zyte dashboard
- Make sure you've restarted your server after adding the environment variable

## Fallback Behavior

If `ZYTE_API_KEY` is not set, the app will:
- Try direct fetching (may fail due to bot detection)
- Show bookmarklet instructions as an alternative

The bookmarklet method still works as a free alternative if you prefer not to use Zyte API.
