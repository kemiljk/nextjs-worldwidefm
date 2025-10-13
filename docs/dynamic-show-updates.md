# Dynamic Show Updates Strategy

## Overview

Shows published in Cosmic CMS will appear on the main site **within 60 seconds** (1 minute), without requiring Cosmic webhooks.

## How It Works

### Incremental Static Regeneration (ISR)

Next.js automatically regenerates pages every 60 seconds when:

1. A user requests the page
2. 60 seconds have passed since the last generation
3. The page is regenerated in the background with fresh data from Cosmic

This means:

- ✅ **First visitor after 60 seconds** triggers a background rebuild
- ✅ **Subsequent visitors** get the updated content immediately
- ✅ **No additional cost** - built into Next.js
- ✅ **No webhooks required**

## Revalidation Settings

### Pages with 60-second revalidation:

| Page                                | Revalidation | Why                                  |
| ----------------------------------- | ------------ | ------------------------------------ |
| Homepage (`/`)                      | 60 seconds   | Shows new episodes immediately       |
| Episode page (`/episode/[slug]`)    | 60 seconds   | New shows appear quickly             |
| Host page (`/hosts/[slug]`)         | 60 seconds   | Host's new shows appear quickly      |
| Takeover page (`/takeovers/[slug]`) | 60 seconds   | New takeover episodes appear quickly |

### Fully Dynamic Pages:

| Page                     | Setting         | Why                                  |
| ------------------------ | --------------- | ------------------------------------ |
| Shows listing (`/shows`) | `force-dynamic` | Always fetches latest data           |
| Schedule (`/schedule`)   | No cache        | Always shows live RadioCult schedule |

## Timeline: Show Submission to Live Site

### Complete Flow (Form → Cosmic → RadioCult → Site):

1. **User submits show via add-show form**

   - Audio file uploaded to RadioCult (gets `media_id`)
   - Audio file uploaded to Cosmic media library
   - Episode created in Cosmic as **Draft** with `radiocult_media_id`

2. **You approve in Cosmic CMS**

   - Change status from Draft → **Published**
   - Episode now visible in Cosmic API

3. **Cron job syncs to RadioCult (runs every 5 minutes)**

   - Detects newly published episode with `radiocult_media_id`
   - Creates RadioCult **Show** (if needed)
   - Creates RadioCult **Event** (scheduled instance)
   - Links the uploaded media to the event
   - Marks episode as synced with `radiocult_event_id`

4. **Show appears on site**
   - Within 60 seconds, homepage revalidates
   - Show visible with all metadata
   - RadioCult live player will play the scheduled show at broadcast time

### Best Case (< 6 minutes):

```
00:00 - Show published in Cosmic
00:01 - Cron runs, syncs to RadioCult
00:02 - RadioCult show/event created
01:00 - User visits homepage
01:00 - Page regenerates, show visible
```

### Typical Case (< 7 minutes):

```
00:00 - Show published in Cosmic
00:03 - Cron runs (every 5 minutes)
00:04 - RadioCult show/event created
06:00 - User visits homepage
06:00 - Page regenerates, show visible
```

### Worst Case (< 11 minutes):

```
00:00 - Show published in Cosmic
04:59 - Last cron ran 59 seconds ago
05:00 - Cron runs, syncs to RadioCult
05:01 - RadioCult show/event created
10:59 - Last page regeneration was 59 seconds ago
11:00 - User visits, page regenerates
11:00 - Show visible on site
```

## Manual Sync & Revalidation

### Option 1: Force RadioCult Sync (Don't wait for cron)

If you just published an episode and want it synced to RadioCult immediately:

```bash
# Manually trigger the sync cron job
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://worldwidefm.net/api/cron/sync-episodes
```

This will:

- Find all published episodes with media that haven't been synced
- Create RadioCult shows/events for them
- Mark them as synced

### Option 2: Force Page Revalidation (Don't wait 60 seconds)

If the show is already synced but you want it visible on the site immediately:

```bash
curl -X POST "https://worldwidefm.net/api/revalidate?secret=YOUR_REVALIDATION_SECRET"
```

This will:

- Clear all episode/show caches
- Revalidate homepage
- Revalidate shows page

### Option 3: Full Force Update (Sync + Revalidate)

For immediate end-to-end update:

```bash
# 1. Sync to RadioCult
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://worldwidefm.net/api/cron/sync-episodes

# 2. Revalidate pages
curl -X POST "https://worldwidefm.net/api/revalidate?secret=YOUR_REVALIDATION_SECRET"
```

Show appears within seconds!

### Option 2: Specific Path Revalidation

```bash
# Revalidate a specific episode
curl -X POST "https://new.worldwidefm.net/api/revalidate?secret=YOUR_SECRET&path=/episode/my-show-slug"

# Revalidate homepage
curl -X POST "https://new.worldwidefm.net/api/revalidate?secret=YOUR_SECRET&path=/"

# Revalidate shows page
curl -X POST "https://new.worldwidefm.net/api/revalidate?secret=YOUR_SECRET&path=/shows"
```

### Required Environment Variables:

```bash
# For page revalidation
REVALIDATION_SECRET=your-secret-key-here

# For cron job authentication
CRON_SECRET=your-cron-secret-here

# RadioCult credentials (for syncing shows)
RADIOCULT_SECRET_KEY=your-radiocult-secret-key
NEXT_PUBLIC_RADIOCULT_STATION_ID=your-station-id
```

Set these in Vercel environment variables (Settings → Environment Variables).

## Automated Sync: How It Works

### Cron Job (Runs Every 5 Minutes)

The cron job at `/api/cron/sync-episodes`:

1. **Queries Cosmic** for episodes with:

   - Status = `published`
   - Has `radiocult_media_id` (media was uploaded)
   - Missing `radiocult_event_id` (not yet synced)

2. **For each episode found:**

   - Creates RadioCult **Show** (if doesn't exist)
   - Creates RadioCult **Event** with:
     - Start time from `broadcast_date` + `broadcast_time`
     - Duration from `duration` field
     - Links the `radiocult_media_id` (uploaded audio)
   - Updates Cosmic episode with `radiocult_event_id` and `radiocult_synced: true`

3. **Logs results:**
   - Synced count
   - Failed count
   - Error messages

### Monitoring the Sync

Check Vercel logs for sync activity:

```
🔄 [CRON] Starting sync of published episodes to RadioCult...
📋 [CRON] Found 3 episodes to sync
🎵 [CRON] Syncing episode: "My Show Title"
📺 [CRON] Creating RadioCult show for "My Show Title"
✅ [CRON] Created RadioCult show: show-abc123
📅 [CRON] Scheduling RadioCult event for "My Show Title"
✅ [CRON] Successfully synced "My Show Title" to RadioCult (Event: event-xyz789)
📊 [CRON] Sync complete:
  ✅ Synced: 3
  ❌ Failed: 0
```

## Show Visibility Requirements

For a show to appear on the main site, it must be:

### In Cosmic CMS:

- ✅ Status: **Published** (not Draft)
- ✅ Type: **episode**
- ✅ Has required metadata:
  - Title
  - Slug
  - Broadcast date and time
  - Duration
  - RadioCult artist ID
  - RadioCult media ID (from upload)

### After Cron Sync:

- ✅ RadioCult show created
- ✅ RadioCult event scheduled
- ✅ Episode marked with `radiocult_event_id`
- ✅ Show will play at scheduled time in RadioCult player

## Monitoring

### Check if revalidation is working:

1. **Publish a show in Cosmic**
2. **Wait 60 seconds**
3. **Visit homepage in incognito/private mode**
4. **Check if show appears**

### Server Logs:

When a page revalidates, you'll see in Vercel logs:

```
Regenerating /episode/my-show-slug
```

### Force Revalidation (Testing):

```bash
# Test the revalidation endpoint
curl -X POST "http://localhost:3000/api/revalidate?secret=YOUR_SECRET"
```

Expected response:

```json
{
  "revalidated": true,
  "items": ["tag:episodes", "tag:shows", "path:/(page)", "path:/shows(page)"],
  "message": "Successfully revalidated: tag:episodes, tag:shows, path:/(page), path:/shows(page)"
}
```

## Comparison: With vs Without Webhooks

### Without Webhooks (Current Setup):

| Aspect                   | Status                               |
| ------------------------ | ------------------------------------ |
| **Site update speed**    | **60 seconds** (ISR revalidation)    |
| **RadioCult sync speed** | **5 minutes** (cron job polling)     |
| **Total publish time**   | **< 11 minutes** (worst case)        |
| **Cost**                 | **$0** (included in Next.js)         |
| **Reliability**          | **High** (passive, always works)     |
| **Setup complexity**     | **Low** (just environment variables) |
| **Maintenance**          | **None** (cron jobs are automatic)   |

### With Webhooks (If Enabled):

| Aspect                   | Status                                        |
| ------------------------ | --------------------------------------------- |
| **Site update speed**    | **Instant** (< 1 second via webhook)          |
| **RadioCult sync speed** | **Instant** (< 1 second via webhook)          |
| **Total publish time**   | **< 2 seconds**                               |
| **Cost**                 | **$29/month** (Cosmic webhooks)               |
| **Reliability**          | **Medium** (depends on webhook delivery)      |
| **Setup complexity**     | **Medium** (webhook configuration + endpoint) |
| **Maintenance**          | **Low** (monitor webhook failures)            |

## Performance Impact

The 60-second revalidation strategy is:

✅ **Fast enough** - Shows appear within 1-2 minutes  
✅ **Efficient** - Pages only regenerate when needed  
✅ **Scalable** - Works with any number of shows  
✅ **Cost-effective** - No additional charges

### Cache Behavior:

- **First 60 seconds**: Visitors get cached version (fast)
- **After 60 seconds**: Next visitor triggers rebuild (still fast)
- **Subsequent visitors**: Get fresh cached version (fast)

## Troubleshooting

### Show not appearing after 60 seconds?

**Check:**

1. Is show status "Published" in Cosmic? (not Draft)
2. Does show have all required metadata?
3. Try manual revalidation via API endpoint
4. Check Vercel deployment logs for errors
5. Try incognito mode (bypass browser cache)

### Show appears on some pages but not others?

**Solution:**
Manually revalidate all pages:

```bash
curl -X POST "https://new.worldwidefm.net/api/revalidate?secret=YOUR_SECRET"
```

### Need instant updates for important shows?

**Options:**

1. Manually revalidate after publishing
2. Consider Cosmic webhooks for instant updates
3. Use the revalidation API in your publishing workflow

## Best Practices

### For Regular Shows:

- Publish in Cosmic
- Wait 1-2 minutes
- Show will appear automatically

### For Time-Sensitive/Live Shows:

- Publish in Cosmic
- Immediately call revalidation API
- Show appears within seconds

### For Bulk Publishing:

- Publish multiple shows
- Call revalidation API once
- All shows appear together

## Future Improvements

If you decide to enable Cosmic webhooks later:

1. Uncomment webhook endpoint code
2. Configure webhook in Cosmic dashboard:
   - URL: `https://new.worldwidefm.net/api/cosmic-webhook`
   - Events: Object Created, Object Updated
   - Secret: Set in environment variables
3. Shows will appear **instantly** (<1 second)

Until then, 60-second revalidation provides excellent performance at zero cost.
