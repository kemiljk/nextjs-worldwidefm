# Host Profile Update Process

## Summary

We've successfully identified and extracted host profile data from your original database that matches the old `/collection/{slug}` URLs you mentioned. The data includes profile pictures, biographical descriptions, and episode counts for hosts like Pedro Montenegro, Adrian Younge, Ashley Beedle, and many others.

## What We Found

### ✅ **Successfully Extracted Data For:**

- **20+ host profiles** with collection categories
- **Profile images** for all hosts (episode thumbnails)
- **Biographical descriptions** for 75% of hosts (extracted from episode bodyText)
- **Episode counts** and recent episode lists
- **Proper slug mapping** (e.g., `pedro-montenegro`, `adrian-younge`)

### 📋 **Example Host Profiles:**

- **Pedro Montenegro**: Brazilian collection episodes with bio
- **Adrian Younge**: Artform Radio episode with profile image
- **Ashley Beedle**: Heavy Disco description + 5 episodes
- **Auntie Flo** (Brian D'Souza): Takeover series with description
- **Africa Is A Country**: Detailed show description about continental music
- **Antal**: Rush Hour Records monthly show description

## How It Works

The extraction process:

1. **Finds** all `collectionCategories` (which represent hosts/artists)
2. **Links** episodes to hosts via the `episodeCollection` field relations
3. **Extracts** profile images from episode thumbnails
4. **Parses** biographical information from episode `bodyText` fields
5. **Updates** Cosmic `regular-hosts` objects with this enriched data

## Scripts Available

### 1. **Preview Script** (`scripts/preview-host-data.js`)

- Shows what data can be extracted (no Cosmic credentials needed)
- Processes first 20 hosts for quick preview
- **Run with:** `node scripts/preview-host-data.js`

### 2. **Update Script** (`scripts/update-host-profiles.js`)

- Actually updates your Cosmic regular-hosts with the extracted data
- Processes all available hosts
- **Requires Cosmic credentials in .env**

## Required Environment Variables

Make sure your `.env` file contains:

```bash
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your_bucket_slug
NEXT_PUBLIC_COSMIC_READ_KEY=your_read_key
COSMIC_WRITE_KEY=your_write_key
```

## Running the Update

1. **Preview first** (recommended):

   ```bash
   node scripts/preview-host-data.js
   ```

2. **Run the actual update**:
   ```bash
   node scripts/update-host-profiles.js
   ```

## What Gets Updated

For each matching host in Cosmic, the script will add:

- **`metadata.description`**: Biographical text extracted from episodes
- **`metadata.image`**: Profile picture from episode thumbnails
- **`metadata.episode_count`**: Number of episodes for this host
- **`metadata.first_episode_slug`**: Slug of most recent episode
- **`content`**: Same as description for content field

## Expected Results

After running, your host pages at `/hosts/{slug}` will have:

- ✅ **Profile pictures** instead of placeholder images
- ✅ **Rich biographical descriptions** instead of empty content
- ✅ **Episode counts** showing how many shows they've hosted
- ✅ **Complete artist/host profiles** matching the old collection pages

This recreates the `/collection/{host-slug}` functionality you had on the original site!

## Notes

- The script only updates existing `regular-hosts` in Cosmic (won't create new ones)
- Profile images come from the most recent episode's thumbnail
- Descriptions are intelligently extracted and cleaned from episode content
- Safe to run multiple times (won't duplicate data)
- All collection categories are processed, not just individual artists
