# RadioCult to Cosmic Sync Setup

This document explains how to set up automatic syncing of shows from RadioCult to Cosmic CMS.

## Overview

The sync system automatically fetches shows from RadioCult and creates corresponding episodes in Cosmic if they don't already exist. This ensures that shows added directly to RadioCult (bypassing the website's add-show form) still appear on your site.

## How It Works

1. **Cron Job**: A scheduled task runs every 6 hours (configurable)
2. **Fetch Events**: Retrieves shows from RadioCult within a date range (default: 7 days back, 30 days ahead)
3. **Check Existence**: For each show, checks if an episode already exists in Cosmic
4. **Create Episodes**: Creates new episodes in Cosmic for any missing shows
5. **Create Hosts**: Automatically creates host/artist records if they don't exist

## Setup Instructions

### 1. Add Environment Variable

Add the following to your `.env.local` file:

```bash
CRON_SECRET=your-secure-random-string-here
```

Generate a secure random string for the CRON_SECRET (you can use: `openssl rand -base64 32`)

### 2. Deploy to Vercel

The `vercel.json` file is already configured to run the cron job every 6 hours:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-radiocult",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Schedule Format** (cron syntax):
- `0 */6 * * *` = Every 6 hours at minute 0
- `0 */1 * * *` = Every hour
- `0 0 * * *` = Once per day at midnight
- `*/15 * * * *` = Every 15 minutes

### 3. Configure Vercel Environment Variable

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add `CRON_SECRET` with the same value from your `.env.local`
4. Make sure it's available for all environments (Production, Preview, Development)

### 4. Deploy

```bash
git add .
git commit -m "Add RadioCult sync cron job"
git push
```

Vercel will automatically detect the `vercel.json` and set up the cron job.

## Manual Testing

You can manually trigger the sync by making a POST request:

```bash
curl -X POST https://your-domain.com/api/cron/sync-radiocult \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or with custom parameters:

```bash
curl -X POST "https://your-domain.com/api/cron/sync-radiocult?daysBack=14&daysAhead=60" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Testing Locally

```bash
curl -X POST http://localhost:3000/api/cron/sync-radiocult \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## What Gets Synced

For each RadioCult show, the following data is synced to Cosmic:

- **Title**: Show name from RadioCult
- **Slug**: Show slug from RadioCult
- **Description**: Show description (if available)
- **Broadcast Date**: Extracted from start time
- **Broadcast Time**: Extracted from start time
- **Duration**: Show duration in MM:SS format
- **Image**: Show artwork (if available)
- **Host/Artist**: First artist from RadioCult (creates host record if needed)
- **RadioCult Event ID**: Stored in metadata for reference
- **Source**: Marked as "radiocult-sync" for tracking

## Episode Metadata

Synced episodes include a special metadata field:
- `radiocult_event_id`: The original RadioCult event ID
- `source`: Set to "radiocult-sync" to identify auto-synced episodes

This allows you to:
- Identify which episodes were auto-synced vs manually created
- Prevent duplicate creation on subsequent syncs
- Link back to RadioCult if needed

## Monitoring

Check the Vercel logs to see sync results:

1. Go to your Vercel project
2. Navigate to the "Logs" tab
3. Filter by `/api/cron/sync-radiocult`

Each sync will log:
- Number of episodes created
- Number of episodes skipped (already exist)
- Number of errors
- Details for each action

## Customization

### Change Sync Frequency

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-radiocult",
      "schedule": "0 */1 * * *"  // Every hour
    }
  ]
}
```

### Change Date Range

Modify the default parameters in the API endpoint or pass them as query params:

```typescript
// In app/api/cron/sync-radiocult/route.ts
const daysBack = parseInt(searchParams.get('daysBack') || '14', 10); // Change default
const daysAhead = parseInt(searchParams.get('daysAhead') || '60', 10); // Change default
```

## Troubleshooting

### Cron Job Not Running

1. Check Vercel project settings → Crons tab
2. Verify `CRON_SECRET` is set in environment variables
3. Check Vercel logs for errors

### Episodes Not Being Created

1. Check if RadioCult API is returning events:
   ```bash
   # Test the RadioCult API directly
   curl "https://api.radiocult.fm/api/station/YOUR_STATION_ID/schedule" \
     -H "x-api-key: YOUR_RADIOCULT_API_KEY"
   ```

2. Check Cosmic write permissions:
   - Ensure `COSMIC_WRITE_KEY` is set and valid
   - Verify the key has permissions to create episodes and hosts

3. Review the sync logs in Vercel for specific error messages

### Duplicate Episodes

If you're seeing duplicates:
1. The sync checks for existing episodes by `radiocult_event_id` and `slug`
2. If episodes were created before this sync system, they won't have `radiocult_event_id`
3. Solution: Run a one-time cleanup to add `radiocult_event_id` to existing episodes, or delete duplicates

## Alternative: GitHub Actions

If you're not on Vercel, you can use GitHub Actions instead:

Create `.github/workflows/sync-radiocult.yml`:

```yaml
name: Sync RadioCult to Cosmic

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST ${{ secrets.SITE_URL }}/api/cron/sync-radiocult \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secrets in GitHub repository settings:
- `SITE_URL`: Your production URL
- `CRON_SECRET`: Same secret from environment variables

## Support

If you encounter issues:
1. Check the logs in Vercel/GitHub Actions
2. Verify all environment variables are set correctly
3. Test the RadioCult API connection
4. Test the Cosmic API write permissions

