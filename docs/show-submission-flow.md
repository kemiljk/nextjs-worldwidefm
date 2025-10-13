# Show Submission Flow

Complete documentation for the show submission and synchronization system.

## Overview

The show submission system allows users to submit shows via a web form, which then get approved in Cosmic CMS and automatically scheduled in RadioCult for broadcast.

## Architecture

```
User Form → Media Upload → Cosmic Draft → Approval → Cron Sync → RadioCult Schedule → Site Display
```

## Step-by-Step Flow

### 1. User Submits Show (via `/add-show` form)

**What happens:**

- User fills out show details:
  - Title, description, artist, broadcast date/time, duration
  - Tags (genres), location
  - Audio file upload
- Audio file uploaded to:
  - ✅ **RadioCult** (returns `media_id`)
  - ✅ **Cosmic Media Library** (for backup/display)
- Episode created in **Cosmic CMS** with status = `draft`

**Key metadata stored:**

```json
{
  "title": "Show Title",
  "slug": "show-title-123abc",
  "status": "draft",
  "metadata": {
    "subtitle": "Show Title",
    "description": "Show description",
    "broadcast_date": "2025-10-20",
    "broadcast_time": "14:00",
    "duration": "60:00",
    "radiocult_media_id": "media-abc123",
    "radiocult_artist_id": "artist-xyz789",
    "media_file": ["filename.mp3"],
    "regular_hosts": ["host-id-123"],
    "tags": ["tag-id-456"],
    "locations": ["location-id-789"],
    "source": "user-created-with-radiocult-sync"
  }
}
```

**Files involved:**

- `app/add-show/add-show-form.tsx` - Form component
- `app/api/upload-media/route.ts` - Handles audio upload to RadioCult + Cosmic
- `app/api/shows/create/route.ts` - Creates episode in Cosmic

### 2. Admin Approves Show (in Cosmic CMS)

**What you do:**

1. Log into Cosmic CMS dashboard
2. Navigate to Episodes
3. Find the draft episode
4. Review details, make any edits
5. Change status from **Draft** → **Published**
6. Save

**What happens:**

- Episode is now visible via Cosmic API
- Episode appears in queries for `status: 'published'`
- Next cron run will detect it

### 3. Cron Job Syncs to RadioCult (every 5 minutes)

**Automatic process:**

The cron job at `/api/cron/sync-episodes` runs every 5 minutes and:

1. **Queries Cosmic** for episodes:

   ```javascript
   {
     type: 'episodes',
     'metadata.status': 'published',
     // Has media uploaded
     'metadata.radiocult_media_id': { $exists: true },
     // Not yet synced
     'metadata.radiocult_event_id': { $exists: false }
   }
   ```

2. **For each episode found:**

   a. **Create RadioCult Show** (if not exists):

   ```javascript
   POST https://api.radiocult.fm/api/station/{stationId}/show
   {
     name: "Show Title",
     description: "Show description",
     artistId: "artist-xyz789"
   }
   // Returns: { show: { id: "show-abc123" } }
   ```

   b. **Create RadioCult Event** (scheduled broadcast):

   ```javascript
   POST https://api.radiocult.fm/api/station/{stationId}/event
   {
     showId: "show-abc123",
     startTime: "2025-10-20T14:00:00.000Z",
     endTime: "2025-10-20T15:00:00.000Z",
     mediaId: "media-abc123",  // Links the uploaded audio
     description: "Show description"
   }
   // Returns: { event: { id: "event-xyz789" } }
   ```

   c. **Update Cosmic Episode** (mark as synced):

   ```javascript
   PATCH cosmic/objects/{episodeId}
   {
     metadata: {
       radiocult_show_id: "show-abc123",
       radiocult_event_id: "event-xyz789",
       radiocult_synced: true,
       radiocult_synced_at: "2025-10-13T14:05:32.123Z"
     }
   }
   ```

3. **Logs results:**
   ```
   ✅ Synced: 3
   ❌ Failed: 0
   ```

**Files involved:**

- `app/api/cron/sync-episodes/route.ts` - Cron job handler
- `vercel.json` - Cron job configuration

**Cron configuration:**

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-episodes",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### 4. Show Appears on Site (60-second revalidation)

**Automatic process:**

- Pages revalidate every 60 seconds (ISR)
- Next visitor after 60 seconds triggers background rebuild
- Homepage/shows pages fetch latest data from Cosmic
- Show appears with all metadata

**Pages affected:**

- Homepage (`/`) - Shows in recent episodes
- Shows listing (`/shows`) - Force dynamic, always fresh
- Episode page (`/episode/[slug]`) - Individual show page
- Host page (`/hosts/[slug]`) - Host's shows list

## Timeline Summary

| Step                     | Time         | Total Elapsed    |
| ------------------------ | ------------ | ---------------- |
| 1. Form submitted        | Instant      | 0s               |
| 2. Approved in Cosmic    | Manual       | Variable         |
| 3. Cron detects & syncs  | 0-5 minutes  | 0-5 min          |
| 4. Page revalidates      | 0-60 seconds | 0-6 min          |
| **Total (best case)**    |              | **< 1 minute**   |
| **Total (typical case)** |              | **< 6 minutes**  |
| **Total (worst case)**   |              | **< 11 minutes** |

## Manual Triggers

### Force Sync Immediately

After publishing in Cosmic, you can manually trigger the sync:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://worldwidefm.net/api/cron/sync-episodes
```

### Force Page Update Immediately

After sync completes, you can force page revalidation:

```bash
curl -X POST \
  "https://worldwidefm.net/api/revalidate?secret=YOUR_REVALIDATION_SECRET"
```

### Full Force (Sync + Update)

```bash
# 1. Sync to RadioCult
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://worldwidefm.net/api/cron/sync-episodes

# 2. Revalidate pages
curl -X POST \
  "https://worldwidefm.net/api/revalidate?secret=YOUR_REVALIDATION_SECRET"

# Show appears in < 5 seconds!
```

## Environment Variables Required

```bash
# Cosmic CMS
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your-bucket-slug
NEXT_PUBLIC_COSMIC_READ_KEY=your-read-key
COSMIC_WRITE_KEY=your-write-key

# RadioCult
NEXT_PUBLIC_RADIOCULT_STATION_ID=your-station-id
RADIOCULT_SECRET_KEY=your-secret-key

# Cron Authentication
CRON_SECRET=your-cron-secret

# Revalidation
REVALIDATION_SECRET=your-revalidation-secret
```

## Monitoring & Debugging

### Check Cron Job Logs (Vercel)

1. Go to Vercel Dashboard
2. Select your project
3. Click "Functions" tab
4. Find `/api/cron/sync-episodes`
5. View logs

Look for:

```
🔄 [CRON] Starting sync of published episodes to RadioCult...
📋 [CRON] Found 3 episodes to sync
✅ [CRON] Successfully synced "My Show" to RadioCult (Event: event-xyz)
📊 [CRON] Sync complete: ✅ Synced: 3, ❌ Failed: 0
```

### Check Episode Sync Status (Cosmic)

In Cosmic CMS, check episode metadata:

- ✅ Has `radiocult_media_id` → Audio uploaded
- ✅ Has `radiocult_show_id` → Show created in RadioCult
- ✅ Has `radiocult_event_id` → Event scheduled in RadioCult
- ✅ Has `radiocult_synced: true` → Successfully synced
- ✅ Has `radiocult_synced_at` → Timestamp of sync

### Common Issues

#### Episode not syncing to RadioCult

**Check:**

1. Status is "Published" in Cosmic?
2. Has `radiocult_media_id`? (media uploaded)
3. Has `radiocult_artist_id`? (required for show creation)
4. Has `broadcast_date`? (required for event)
5. Check cron logs for errors

#### Episode synced but not visible on site

**Check:**

1. Wait 60 seconds for revalidation
2. Try incognito mode (clear browser cache)
3. Manually trigger revalidation
4. Check Vercel deployment logs

#### Media upload failed

**Check:**

1. RadioCult credentials configured?
2. File format supported? (MP3, WAV, FLAC)
3. File size within limits?
4. Check `/api/upload-media` logs

## Testing Locally

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Create `.env.local`:

```bash
# Cosmic
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=...
NEXT_PUBLIC_COSMIC_READ_KEY=...
COSMIC_WRITE_KEY=...

# RadioCult
NEXT_PUBLIC_RADIOCULT_STATION_ID=...
RADIOCULT_SECRET_KEY=...

# Local secrets
CRON_SECRET=local-test-secret
REVALIDATION_SECRET=local-test-secret
```

### 3. Test Media Upload

```bash
# Upload a test audio file
curl -X POST http://localhost:3000/api/upload-media \
  -F "media=@test-audio.mp3" \
  -F 'metadata={"title":"Test Show","artist":"Test Artist"}'
```

### 4. Test Show Creation

```bash
# Create a test show (use actual IDs from your RadioCult station)
curl -X POST http://localhost:3000/api/shows/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Show",
    "artistId": "artist-abc123",
    "startDate": "2025-10-20",
    "startTime": "14:00",
    "duration": "60",
    "radiocult_media_id": "media-xyz789"
  }'
```

### 5. Test Cron Sync

```bash
# Manually trigger sync
curl -H "Authorization: Bearer local-test-secret" \
  http://localhost:3000/api/cron/sync-episodes
```

## Future Improvements

### Option 1: Faster Cron (1 minute)

Change in `vercel.json`:

```json
{
  "schedule": "*/1 * * * *"
}
```

Trade-off: More function invocations = higher cost (minimal for low volume)

### Option 2: Enable Cosmic Webhooks ($29/month)

- Instant sync (< 1 second)
- No polling needed
- More reliable for high-volume stations

### Option 3: Client-Side Polling

After publishing in Cosmic admin, poll the sync status:

```javascript
// Check if episode is synced
const checkSync = async (episodeId) => {
  const episode = await cosmic.objects.findOne({
    id: episodeId,
  });
  return episode.metadata.radiocult_synced;
};
```

## Summary

✅ **Complete automation** - Submit → Approve → Sync → Display  
✅ **No webhooks needed** - Cron-based polling (every 5 minutes)  
✅ **Fast enough** - Shows appear within 6 minutes typically  
✅ **Manual override** - Can force immediate sync when needed  
✅ **Reliable** - Automatic retries, error logging  
✅ **Zero extra cost** - Included in Vercel/Next.js

The system provides a good balance between speed, reliability, and cost for a radio station workflow.
