# Custom Scraper Configuration Guide

This app uses a **free custom scraper** instead of paid services. You can configure exactly what to look for on each page.

## How to Configure Selectors

Edit `src/lib/server/property-scraper.ts` and update the `SCRAPING_CONFIGS` object.

### For VRBO

Tell me what to look for on the VRBO page, and I'll add the patterns. For example:

**To find "Sleeps X":**
- Look for text like "Sleeps 4" in the HTML
- Or find it in a data attribute like `data-sleeps="4"`
- Or in JSON data like `"sleeps": 4`

**To find the title:**
- Look for an `<h1>` tag with class "property-title"
- Or in meta tags
- Or in JSON data

**To find the cover photo:**
- Look for `<meta property="og:image">` tag
- Or an `<img>` with class "hero-image"

### Current Patterns

The scraper currently tries these patterns (in order):

**VRBO - Max Guests:**
1. `Sleeps\s+(\d+)` - Finds "Sleeps 4"
2. `Sleeps:\s*(\d+)` - Finds "Sleeps: 4"
3. `"sleeps":\s*(\d+)` - Finds JSON data
4. `sleepsCount[^0-9]*(\d+)` - Finds "sleepsCount: 4"
5. `data-sleeps="(\d+)"` - Finds data attribute

**VRBO - Cover Photo:**
1. `<meta property="og:image" content="...">`
2. `<meta name="og:image" content="...">`
3. Images with "hero" in class name

## How to Add New Patterns

1. **Inspect the VRBO page:**
   - Right-click on the page → Inspect
   - Find where "Sleeps 4" appears in the HTML
   - Copy the exact HTML structure

2. **Tell me what you found:**
   - Example: "I see `<span class="sleeps-count">Sleeps 4</span>`"
   - Or: "I see `data-sleeps="4"` in a div"
   - Or: "I see `"sleeps": 4` in a JSON script tag"

3. **I'll add the pattern:**
   - I'll convert it to a regex pattern
   - Add it to the config
   - Test it

## Testing

After I add patterns, test by:
1. Restart your dev server
2. Go to trip creation
3. Enter VRBO URL
4. Click "Fetch Info"
5. Check server logs to see which pattern matched (or if none matched)

## Example: What to Tell Me

**For VRBO "Sleeps X":**
> "On the VRBO page, I see the text 'Sleeps 4' inside a `<div class="property-details">` tag, and it's formatted as `<span>Sleeps</span> <strong>4</strong>`"

Then I'll add a pattern like: `<div[^>]*class="property-details"[^>]*>.*?Sleeps.*?<strong>(\d+)</strong>`

**For Title:**
> "The title is in an `<h1>` tag with class `property-title`"

Then I'll add: `<h1[^>]*class="property-title"[^>]*>([^<]+)</h1>`

## Current Status

Right now, the scraper uses generic patterns. **Tell me exactly what you see on the VRBO page** and I'll add the specific patterns!
