# Episode Image Cold Storage Migration

This system automatically migrates old episode images from Cosmic CMS to Vercel Blob to reduce storage costs.

## Overview

- **Hot Storage (Cosmic)**: Latest 1,000 episodes keep images on Cosmic
- **Cold Storage (Vercel Blob)**: Episodes beyond position 1,000 have images on Vercel Blob
- **Cost Savings**: Cosmic charges for media storage; Vercel Pro includes 5 GB Blob storage

## How It Works

1. Episodes are ranked by `broadcast_date` (newest first)
2. Episodes 1-1000 keep their images on Cosmic (hot storage)
3. Episodes 1001+ have images migrated to Vercel Blob (cold storage)
4. Episode metadata is updated to point to the new Blob URL
5. Original Cosmic media is deleted to free up storage

```
Position 1-1000:    Cosmic (hot) ← Fast imgix transforms available
Position 1001+:     Vercel Blob (cold) ← Static images, free storage
```

## Setup

### 1. Create Vercel Blob Store

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Storage** tab
4. Click **Create Database** → **Blob**
5. Name it (e.g., `wwfm-media`)
6. The `BLOB_READ_WRITE_TOKEN` is automatically added to your environment

### 2. Verify Environment Variables

The cron job needs:
- `CRON_SECRET` - Already configured
- `BLOB_READ_WRITE_TOKEN` - Auto-added by Vercel when you create a Blob store

### 3. Deploy

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
DRY_RUN=true bun run scripts/migrate-images-to-blob.mjs

# Actually migrate
DRY_RUN=false bun run scripts/migrate-images-to-blob.mjs
```

### Script Options

| Variable | Default | Description |
|----------|---------|-------------|
| `DRY_RUN` | `true` | Set to `false` to actually migrate |
| `HOT_STORAGE_LIMIT` | `1000` | Number of episodes to keep on Cosmic |
| `BATCH_SIZE` | `50` | Episodes to fetch per API call |

### Output Files

- `blob-migration-state.json` - Progress state for resumability
- `blob-migration-report.json` - Full migration report

## Cron Job Details

**Endpoint**: `/api/cron/migrate-cold-storage`

**Schedule**: Weekly (Sundays 2 AM UTC)

**Behavior**:
- Processes up to 100 episodes per run to avoid timeouts
- Skips episodes already migrated
- Deletes Cosmic media after successful migration
- Reports remaining episodes to migrate

**Response Example**:
```json
{
  "success": true,
  "stats": {
    "totalEpisodes": 11805,
    "coldEpisodes": 10805,
    "needsMigration": 8500,
    "processedThisRun": 100,
    "remainingToMigrate": 8400
  },
  "results": {
    "migrated": 98,
    "failed": 2,
    "cosmicMediaDeleted": 98
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

- ~10,800 cold episodes × ~350 KB avg = **~3.7 GB**
- Well within Vercel Pro's 5 GB limit
- No additional cost beyond your Pro plan

## Monitoring

### Check Migration Status

```bash
# Via API (locally)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/migrate-cold-storage

# Via script
DRY_RUN=true bun run scripts/migrate-images-to-blob.mjs
```

### Vercel Dashboard

1. Go to **Storage** → Your Blob store
2. View usage and files

## Troubleshooting

### "BLOB_READ_WRITE_TOKEN not configured"

1. Ensure you've created a Blob store in Vercel
2. The token should auto-populate in deployments
3. For local dev, copy from Vercel Dashboard → Storage → Your store → Settings

### Migration Fails for Specific Episodes

- Check `blob-migration-report.json` for error details
- Common issues: 404 (image deleted), timeout (large image)
- Failed episodes will retry on next cron run

### Images Not Showing After Migration

- Check episode metadata in Cosmic - should show Blob URL
- Blob URLs look like: `https://xxx.public.blob.vercel-storage.com/episodes/slug.jpg`

## Reverting a Migration

If needed, you can manually update an episode's image back to Cosmic:

1. Re-upload the image to Cosmic Media
2. Update the episode metadata with the new Cosmic URL
3. The image will be in "hot storage" temporarily
4. Next migration run will move it back to cold if position > 1000

## Files

| File | Purpose |
|------|---------|
| `lib/blob-client.ts` | Vercel Blob utilities |
| `scripts/migrate-images-to-blob.mjs` | Manual migration script |
| `app/api/cron/migrate-cold-storage/route.ts` | Automated cron job |
| `vercel.json` | Cron schedule configuration |

