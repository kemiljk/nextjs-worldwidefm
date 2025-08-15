# Automated Episode Migration Cron Job

This document describes the automated episode migration system that runs daily via Vercel cron jobs.

## Overview

The cron job automatically migrates new episodes from Craft CMS to Cosmic CMS on a daily basis, ensuring that new content is continuously synced without manual intervention.

## How It Works

### 1. Automatic Detection
- **Daily at 2:00 AM UTC**, the cron job runs
- It queries Cosmic CMS to find the **most recent episode date** (`metadata.broadcast_date`)
- It then queries Craft CMS for episodes **after that date**
- Only **new episodes** are processed (existing ones are skipped)

### 2. Smart Filtering
- Uses the `after` parameter in GraphQL to fetch only episodes newer than the last migrated one
- Prevents duplicate migrations
- Handles cases where no episodes exist yet

### 3. Safe Migration
- Checks if episodes already exist in Cosmic before creating
- Skips media handling in the cron job (for performance reasons)
- Creates episodes with basic metadata first
- Media can be handled later via manual scripts if needed

## Configuration

### Vercel Cron Job
```json
{
  "path": "/api/cron/migrate-episodes",
  "schedule": "0 2 * * *"
}
```

**Schedule**: Daily at 2:00 AM UTC (`0 2 * * *`)

### Environment Variables Required
```bash
# Cosmic CMS
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your-bucket-slug
NEXT_PUBLIC_COSMIC_READ_KEY=your-read-key
COSMIC_WRITE_KEY=your-write-key

# Craft CMS GraphQL
CRAFT_GRAPHQL_URL=https://your-craft-cms.com/api
```

## API Endpoint

**URL**: `/api/cron/migrate-episodes`  
**Method**: GET  
**Authentication**: None (cron jobs are internal)

### Response Format
```json
{
  "success": true,
  "message": "Episode migration completed",
  "episodesProcessed": 5,
  "created": 4,
  "failed": 1,
  "mostRecentDate": "2025-08-15T16:00:00+00:00",
  "timestamp": "2025-01-27T02:00:00.000Z"
}
```

## Monitoring

### Vercel Logs
- Check Vercel dashboard → Functions → `/api/cron/migrate-episodes`
- View execution logs and any errors

### Manual Testing
You can test the endpoint manually by visiting:
```
https://your-domain.vercel.app/api/cron/migrate-episodes
```

## Limitations

### Current Limitations
1. **No Media Handling**: Images are not downloaded/uploaded in the cron job
2. **Basic Metadata**: Only essential fields are migrated
3. **No Genre/Host Mapping**: Reference objects are not linked

### Future Enhancements
1. **Full Media Migration**: Include image download/upload
2. **Complete Metadata**: Map all fields including genres, hosts, locations
3. **Error Recovery**: Handle failed migrations with retry logic
4. **Notifications**: Send alerts on failures or successful migrations

## Troubleshooting

### Common Issues

1. **No Episodes Found**
   - Check if Craft CMS has new episodes
   - Verify GraphQL endpoint is accessible
   - Check environment variables

2. **Authentication Errors**
   - Verify Cosmic write key is valid
   - Check bucket slug and permissions

3. **GraphQL Errors**
   - Verify Craft CMS GraphQL endpoint
   - Check if schema has changed

### Manual Override
If the cron job fails, you can:
1. Run the manual migration script: `node scripts/migrate-episodes.js`
2. Check Vercel function logs for specific errors
3. Verify environment variables in Vercel dashboard

## Security Considerations

- The endpoint is public but only intended for cron jobs
- Consider adding authentication if needed
- Environment variables are secure in Vercel
- No sensitive data is exposed in responses
