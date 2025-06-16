# 🎵 Final Host Setup Guide

## 🎯 **Objective**

Create complete regular-hosts objects in Cosmic CMS with profile pictures, descriptions, and metadata extracted from your original database collection categories.

## ✅ **What We've Accomplished**

- ✅ **Identified collection data**: Found host profiles in `collectionCategories` linked to episodes
- ✅ **Extracted rich data**: Profile images, descriptions, episode counts for 100+ hosts
- ✅ **Created migration scripts**: Complete automation to create Cosmic objects
- ✅ **Tested extraction**: Previewed data for hosts like Pedro Montenegro, Ashley Beedle, Adrian Younge

## 📋 **Steps to Complete Setup**

### **Step 1: Set Up Object Type**

First, ensure the `regular-hosts` object type exists in Cosmic:

```bash
node scripts/setup-regular-hosts-type.js
```

This creates the object type with these metafields:

- `description` (textarea): Host biographical info
- `image` (file): Profile picture
- `episode_count` (number): Number of hosted episodes
- `first_episode_slug` (text): Most recent episode
- `last_episode_date` (date): When they last hosted
- `original_category_id` (text): Reference to original DB

### **Step 2: Preview the Data**

See what hosts will be created (no credentials needed):

```bash
node scripts/preview-host-data.js
```

Expected output: ~100+ hosts including Pedro Montenegro, Ashley Beedle, etc.

### **Step 3: Create Objects (Dry Run)**

Test the creation process without making changes:

```bash
node scripts/create-host-profiles.js --dry-run
```

### **Step 4: Create Objects (Live)**

Actually create the regular-hosts in Cosmic:

```bash
node scripts/create-host-profiles.js --live
```

## 🔧 **Required Environment Variables**

Make sure your `.env` contains:

```bash
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your_bucket_slug
NEXT_PUBLIC_COSMIC_READ_KEY=your_read_key
COSMIC_WRITE_KEY=your_write_key
```

## 📊 **Expected Results**

After running the live script, you'll have:

### **~100+ Host Objects** with data like:

```json
{
  "type": "regular-hosts",
  "title": "Ashley Beedle",
  "slug": "ashley-beedle",
  "content": "Co-founder of the infamous 'Heavy Disco' parties...",
  "metadata": {
    "description": "Co-founder of the infamous 'Heavy Disco' parties...",
    "image": {
      "url": "https://cdn.cosmicjs.com/A61E5C1E-2C30-42E7-AE55-BD8B88E4F7B7.jpeg",
      "imgix_url": "https://cdn.cosmicjs.com/A61E5C1E-2C30-42E7-AE55-BD8B88E4F7B7.jpeg"
    },
    "episode_count": 5,
    "first_episode_slug": "the-heavy-disco-spectacular-ashley-beedle",
    "last_episode_date": "2023-10-15T12:00:00Z"
  }
}
```

### **Host Pages Will Show:**

- ✅ **Profile pictures** instead of placeholders
- ✅ **Rich biographical content** extracted from episodes
- ✅ **Episode counts** in metadata
- ✅ **Complete artist profiles** matching old `/collection/{slug}` pages

## 🎉 **Final Result**

Your `/hosts/{slug}` pages will be transformed from empty placeholders into rich artist profiles with:

1. **Pedro Montenegro** → Brazilian collection curator profile + episodes
2. **Ashley Beedle** → Heavy Disco founder description + 5 episodes
3. **Adrian Younge** → Artform Radio profile + episode
4. **Africa Is A Country** → Continental music politics description + episodes
5. **100+ more hosts** with complete profiles

This perfectly recreates the `/collection/{host-slug}` functionality from your original site!

## 🚨 **Important Notes**

- **Safe to re-run**: Script handles slug conflicts gracefully
- **Only creates/updates**: Won't delete existing objects
- **Validates data**: Skips entries without meaningful content
- **Preserves originals**: Keeps reference to original category IDs

## 📞 **If Issues Arise**

1. **Database connection errors**: Check MySQL is running
2. **Cosmic errors**: Verify API credentials in `.env`
3. **No data found**: Run `scripts/preview-host-data.js` to debug
4. **Slug conflicts**: Script will update existing objects automatically

---

**Ready to transform your host pages? Run the scripts in order! 🎵**
