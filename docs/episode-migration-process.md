# Episode Migration Process

The episode migration is now split into two steps to handle serverless limitations:

## Step 1: Cron Job (Serverless)

**File:** `app/api/cron/migrate-episodes/route.ts`
**Trigger:** Automated cron job or manual API call

**What it does:**

- Fetches new episodes from Craft CMS
- Creates episodes in Cosmic CMS with all metadata and relationships
- Stores the original image URL in `metadata.craft_image_url` for later processing
- **Does NOT download or upload images** (due to serverless limitations)

**Access:** `GET /api/cron/migrate-episodes`

## Step 2: Image Migration Script (Node.js)

**File:** `scripts/migrate-episode-images.js`
**Trigger:** Manual execution or separate cron job

**What it does:**

- Finds episodes with `craft_image_url` but no actual image
- Downloads images from Craft CMS URLs
- Uploads images to Cosmic Media
- Updates episodes with proper image references
- Cleans up temporary files

**Usage:**

```bash
# Dry run to see what would be processed
node scripts/migrate-episode-images.js --dry-run

# Actually process images
node scripts/migrate-episode-images.js
```

## Why This Approach?

1. **Serverless Limitations:** Vercel API routes have memory and timeout limits that make downloading/uploading images unreliable
2. **Reliability:** The cron job can focus on creating episodes quickly and reliably
3. **Flexibility:** Images can be processed separately, in batches, or retried if needed
4. **Resource Management:** The script runs in a proper Node.js environment with full file system access

## Current Status

✅ **Fixed Issues:**

- Genre object type corrected (`"genres"` instead of `"genre"`)
- Location object type corrected (`"locations"` instead of `"location"`)
- Host object type corrected (`"regular-hosts"` instead of `"regular_host"`)
- Takeover object type corrected (`"takeovers"` instead of `"takeover"`)
- Genre metafield validation fixed (only add fields when they have values)
- Episodes are now created successfully with proper relationships

🔄 **Next Steps:**

- Run the image migration script to process images for existing episodes
- Set up automated image processing (separate cron job or manual execution)
