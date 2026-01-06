# Cold Storage Migration

This system keeps Cosmic media storage at or below 1,000 items by automatically migrating older media to Vercel Blob.

## Overview

- **Hot Storage (Cosmic)**: 1,000 most recently uploaded media items stay on Cosmic
- **Cold Storage (Vercel Blob)**: Older media migrated to Vercel Blob
- **Cost Savings**: Cosmic charges for media storage; Vercel Pro includes 5 GB Blob storage
- **All Object Types**: Works across episodes, hosts, takeovers, posts, videos, events, genres, locations

## How It Works

1. Media items are ranked by upload date (newest first)
2. The 1,000 newest items stay on Cosmic (hot storage)
3. Older items are migrated to Vercel Blob (cold storage)
4. Objects referencing migrated media are updated with `external_image_url`
5. Original Cosmic media is deleted to free up storage

```
Newest 1,000:      Cosmic (hot) ← Fast imgix transforms available
Older media:       Vercel Blob (cold) ← Static images, free storage
```

### Frontend Handling

All frontend components check `external_image_url` first, then fall back to `image`:

```typescript
const imageUrl = 
  item.metadata?.external_image_url ||
  item.metadata?.image?.imgix_url || 
  item.metadata?.image?.url || 
  '/image-placeholder.png';
```

## Setup

### 1. Add `external_image_url` Field to Object Types

Run this once to add the field to all object types:

```bash
bun run scripts/update-object-types.ts
```

This adds `external_image_url` (text field) to:
- episode
- hosts
- takeovers
- posts
- videos
- events
- genres
- locations

### 2. Create Vercel Blob Store

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Storage** tab
4. Click **Create Database** → **Blob**
5. Name it (e.g., `wwfm-media`)
6. The `BLOB_READ_WRITE_TOKEN` is automatically added to your environment

### 3. Verify Environment Variables

The cron job needs:
- `CRON_SECRET` - Already configured
- `BLOB_READ_WRITE_TOKEN` - Auto-added by Vercel when you create a Blob store

### 4. Deploy

The cron job is configured in `vercel.json` to run weekly:
```json
{
  "path": "/api/cron/migrate-cold-storage",
  "schedule": "0 2 * * 0"
}
```
This runs every Sunday at 2 AM UTC.

## Manual Migration

For initial bulk migration or testing, use the script:

```bash
# Preview what would be migrated (DRY RUN)
DRY_RUN=true bun run scripts/migrate-media-to-blob.mjs

# Actually migrate
DRY_RUN=false bun run scripts/migrate-media-to-blob.mjs
```

### Script Options

| Variable | Default | Description |
|----------|---------|-------------|
| `DRY_RUN` | `true` | Set to `false` to actually migrate |
| `HOT_STORAGE_LIMIT` | `1000` | Number of media items to keep on Cosmic |
| `BATCH_SIZE` | `100` | Items to fetch per API call |

### Output Files

- `media-migration-state.json` - Progress state for resumability
- `media-migration-report.json` - Full migration report

## Cron Job Details

**Endpoint**: `/api/cron/migrate-cold-storage`

**Schedule**: Weekly (Sundays 2 AM UTC)

**Behavior**:
- Processes up to 100 media items per run to avoid timeouts
- Finds all objects referencing each media item
- Updates objects with `external_image_url`
- Deletes Cosmic media after successful migration
- Reports remaining items to migrate

**Response Example**:
```json
{
  "success": true,
  "stats": {
    "totalMedia": 5000,
    "hotMedia": 1000,
    "coldMedia": 4000,
    "processedThisRun": 100,
    "remainingToMigrate": 3900
  },
  "results": {
    "migrated": 98,
    "failed": 2,
    "objectsUpdated": 95
  },
  "duration": "45.2s"
}
```

## Storage Costs Comparison

| Service | Storage | Transfer | Notes |
|---------|---------|----------|-------|
| **Cosmic** | Variable | Variable | Higher costs for media |
| **Vercel Blob (Pro)** | 5 GB included | 100 GB/mo included | Perfect for cold storage |

### Your Estimated Usage

- ~4,000 cold media items × ~350 KB avg = **~1.4 GB**
- Well within Vercel Pro's 5 GB limit
- No additional cost beyond your Pro plan

## Monitoring

### Check Migration Status

```bash
# Via API (locally)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/migrate-cold-storage

# Via script (dry run)
DRY_RUN=true bun run scripts/migrate-media-to-blob.mjs
```

### Vercel Dashboard

1. Go to **Storage** → Your Blob store
2. View usage and files

## Troubleshooting

### "BLOB_READ_WRITE_TOKEN not configured"

1. Ensure you've created a Blob store in Vercel
2. The token should auto-populate in deployments
3. For local dev, copy from Vercel Dashboard → Storage → Your store → Settings

### Migration Fails for Specific Items

- Check `media-migration-report.json` for error details
- Common issues: 404 (already deleted), timeout (large file)
- Failed items will retry on next cron run

### Images Not Showing After Migration

1. Check object metadata in Cosmic - should have `external_image_url` set
2. Blob URLs look like: `https://xxx.public.blob.vercel-storage.com/cosmic-archive/filename.jpg`
3. Ensure frontend components check `external_image_url` first

## Reverting a Migration

If needed, you can manually update an object's image back to Cosmic:

1. Re-upload the image to Cosmic Media
2. Clear the `external_image_url` field
3. Update the `image` field with the new Cosmic media reference
4. The media will be in "hot storage" temporarily
5. If Cosmic media count exceeds 1000, it will be migrated again

## Files

| File | Purpose |
|------|---------|
| `lib/blob-client.ts` | Vercel Blob utilities |
| `scripts/migrate-media-to-blob.mjs` | Manual migration script |
| `scripts/update-object-types.ts` | Add `external_image_url` field |
| `app/api/cron/migrate-cold-storage/route.ts` | Automated cron job |
| `vercel.json` | Cron schedule configuration |
