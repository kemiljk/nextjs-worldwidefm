# Tracklist Migration Scripts

This directory contains scripts to migrate `tracklist_old` data to `tracklist` for all episodes in Cosmic CMS while preserving Rich Text formatting.

## Scripts

### 1. `migrate-tracklist.ts` - Main Migration Script

This script copies the content from `tracklist_old` to `tracklist` for all episodes.

**What it does:**

- Fetches all episodes from Cosmic CMS
- Checks for episodes with `tracklist_old` data
- Copies the content to the `tracklist` field
- Preserves all Rich Text formatting
- Provides detailed logging and progress tracking
- Includes safety checks and error handling

**Usage:**

```bash
# Make sure you're in the project root directory
cd /path/to/nextjs-worldwidefm

# Run the migration script
npx tsx scripts/migrate-tracklist.ts
```

### 2. `cleanup-tracklist-old.ts` - Cleanup Script

This script removes the `tracklist_old` fields after confirming the migration was successful.

**⚠️ IMPORTANT: Only run this AFTER confirming the migration was successful!**

**What it does:**

- Fetches all episodes from Cosmic CMS
- Removes the `tracklist_old` field from episodes
- Includes safety checks to ensure `tracklist` has content before cleanup
- Provides detailed logging and progress tracking

**Usage:**

```bash
# Make sure you're in the project root directory
cd /path/to/nextjs-worldwidefm

# Run the cleanup script (ONLY after confirming migration success)
npx tsx scripts/cleanup-tracklist-old.ts
```

## Migration Process

### Step 1: Run the Migration

1. Ensure your environment variables are set up correctly
2. Run the migration script: `npx tsx scripts/migrate-tracklist.ts`
3. Monitor the output for any errors
4. Verify the script completed successfully

### Step 2: Verify in Cosmic CMS

1. Log into your Cosmic CMS dashboard
2. Navigate to the Episodes object type
3. Check a few episodes to confirm:
   - The `tracklist` field now contains the content
   - The Rich Text formatting is preserved
   - The `tracklist_old` field still exists (for now)

### Step 3: Run Cleanup (Optional)

1. **ONLY after confirming the migration was successful**
2. Run the cleanup script: `npx tsx scripts/cleanup-tracklist-old.ts`
3. This will remove the `tracklist_old` fields permanently

## Safety Features

- **Backup**: The original `tracklist_old` data is preserved until cleanup
- **Validation**: Scripts check for existing content before overwriting
- **Error Handling**: Individual episode failures don't stop the entire process
- **Rate Limiting**: Built-in delays to avoid API rate limits
- **Progress Tracking**: Detailed logging of each step

## Environment Variables Required

Make sure these are set in your `.env` file:

```
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your_bucket_slug
NEXT_PUBLIC_COSMIC_READ_KEY=your_read_key
COSMIC_WRITE_KEY=your_write_key
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Check your Cosmic API keys
2. **Rate Limiting**: The script includes delays, but you may need to increase them
3. **Empty Episodes**: Episodes without `tracklist_old` data are safely skipped

### Recovery

If something goes wrong:

- The `tracklist_old` data remains intact
- You can re-run the migration script
- Check the logs for specific error messages

## Notes

- The migration preserves all Rich Text formatting exactly as it appears in `tracklist_old`
- The script processes episodes sequentially to avoid overwhelming the API
- Progress is logged for each episode with clear status indicators
- A summary report is provided at the end of each script run
