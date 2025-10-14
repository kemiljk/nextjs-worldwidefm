# Craft CMS to Cosmic CMS Migration Findings

This document captures the important findings from our migration scripts and API usage patterns discovered during the transition from Craft CMS to Cosmic CMS.

## Overview

We successfully migrated a radio station website from Craft CMS to Cosmic CMS, involving:

- **307 episodes** with takeover content
- **39 takeovers** in Cosmic CMS
- **278 collection categories** (hosts/artists) from Craft
- **243 regular hosts** created in Cosmic
- **74.1% coverage** of host matching between systems

## Key API Patterns and Findings

### Craft CMS GraphQL API Usage

#### Base Configuration

```javascript
const config = {
  craft: {
    apiUrl: "https://vague-roadrunner-production.cl-eu-west-1.servd.dev/api",
  },
};
```

#### Common Query Patterns

**1. Fetching Episodes with Relationships**

```graphql
query {
  entries(type: "episode", limit: 100) {
    id
    title
    slug
    broadcastDate
    broadcastTime
    duration
    description
    thumbnail {
      url
      filename
      id
    }
    tracklist
    bodyText
    categories {
      id
      title
      slug
      groupId
    }
    genreTags {
      id
      title
      slug
    }
    locations {
      id
      title
      slug
    }
    hosts {
      id
      title
      slug
    }
    takeovers {
      id
      title
      slug
    }
    featuredOnHomepage
    player
    dateCreated
    dateUpdated
  }
}
```

**2. Fetching Categories (Collections/Hosts)**

```graphql
query {
  categories(limit: 1000) {
    id
    title
    slug
    groupId
    description
  }
}
```

**3. Filtering by Date Range**

```graphql
query {
  entries(type: "episode", broadcastDate: ">2025-07-24T11:00:00+00:00", limit: 100) {
    # ... fields
  }
}
```

#### Important Craft CMS Data Structure Insights

- **Categories**: Used `groupId=2` for collection categories (hosts/artists)
- **Thumbnails**: Stored as arrays, accessed via `thumbnail[0].url`
- **Relationships**: Episodes linked to categories via `categories` field
- **Rich Text**: `bodyText` and `tracklist` contained HTML/Rich Text content
- **Broadcast Data**: `broadcastDate` and `broadcastTime` stored separately

### Cosmic CMS API Usage

#### Base Configuration

```javascript
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});
```

#### Common Operations

**1. Fetching Objects with Pagination**

```javascript
const takeovers = [];
let page = 1;
const limit = 100;

while (true) {
  const response = await cosmic.objects.find({
    type: "takeovers",
    props: "id,slug,title,type,status,created_at,modified_at,published_at,metadata",
    limit: limit,
    skip: (page - 1) * limit,
    status: "published",
  });

  if (!response.objects || response.objects.length === 0) break;

  takeovers.push(...response.objects);
  if (response.objects.length < limit) break;
  page++;
}
```

**2. Creating Objects with Metadata**

```javascript
const episodeData = {
  title: episode.title,
  slug: episode.slug,
  type: "episode",
  metadata: {
    broadcast_date: episode.broadcastDate,
    genres: genreIds,
    locations: locationIds,
    regular_hosts: hostIds,
    takeovers: takeoverIds,
    featured_on_homepage: episode.featuredOnHomepage || false,
    source: "migrated_from_craft",
    radiocult_synced: false,
    body_text: episode.bodyText,
    broadcast_time: episode.broadcastTime,
    duration: episode.duration,
    description: episode.description,
    image: mediaItem.name, // Reference to media object
    player: episode.player,
    tracklist: episode.tracklist,
  },
  thumbnail: mediaItem.name, // Same reference for thumbnail
  status: "published",
};

const result = await cosmic.objects.insertOne(episodeData);
```

**3. Updating Objects**

```javascript
const updateData = {
  metadata: {
    ...existingMetadata,
    takeovers: newTakeoverIds,
  },
};

await cosmic.objects.updateOne(objectId, updateData);
```

**4. Media Upload**

```javascript
const file = {
  originalname: filename,
  buffer: fileBuffer,
};

const response = await cosmic.media.insertOne({
  media: file,
});

// Reference media in objects using response.media.name
```

#### Important Cosmic CMS Data Structure Insights

- **Media References**: Use `mediaItem.name` to reference uploaded media
- **Object Relationships**: Store IDs as arrays in metadata fields
- **Status**: Always set `status: "published"` for live content
- **Metadata**: All custom fields go in `metadata` object
- **Pagination**: Use `skip` and `limit` for large datasets
- **Props**: Specify which fields to fetch for performance

## Migration Strategies Discovered

### 1. Episode Migration Process

**Steps:**

1. Fetch episodes from Craft CMS with all relationships
2. Download and upload images to Cosmic Media
3. Map relationship IDs (genres, hosts, locations, takeovers)
4. Create episode objects in Cosmic with proper metadata structure
5. Handle Rich Text content preservation

**Key Challenges Solved:**

- Image handling: Craft stored URLs, Cosmic requires file uploads
- Relationship mapping: Craft used category IDs, Cosmic uses object IDs
- Rich Text preservation: Maintained HTML formatting during migration

### 2. Host/Artist Migration (Collection Categories)

**Process:**

1. Extract collection categories (groupId=2) from Craft
2. Match with existing regular-hosts in Cosmic (74.1% success rate)
3. Extract biographical data from episode bodyText
4. Use episode thumbnails as profile images
5. Update Cosmic regular-hosts with enriched data

**Matching Algorithm:**

- Case-insensitive title matching
- Confidence scoring based on match quality
- Fallback strategies for partial matches

### 3. Takeover Assignment Strategy

**Two Approaches Used:**

**A. Title-Based Matching**

- Extract takeover names from episode titles
- Match against existing takeovers in Cosmic
- Handle variations like "curates" vs "Takeover"

**B. Collection-Based Matching**

- Match Craft collections to Cosmic takeovers
- Assign episodes under collections to takeovers
- Use confidence scoring for ambiguous matches

**Results:**

- 307 episodes with takeover content identified
- 178 episodes successfully updated with takeover assignments
- 39 takeovers available for matching

### 4. Image Migration Strategy

**Process:**

1. Download images from Craft CMS URLs
2. Upload to Cosmic Media (creates unique media objects)
3. Reference media using `mediaItem.name` in objects
4. Clean up temporary files after upload

**Key Insights:**

- Each episode needs its own media object (no reuse)
- Use `originalname` and `buffer` for file uploads
- Reference media in both `thumbnail` and `metadata.image` fields

## Data Transformation Patterns

### Craft CMS → Cosmic CMS Field Mapping

| Craft Field          | Cosmic Field                    | Transformation                |
| -------------------- | ------------------------------- | ----------------------------- |
| `title`              | `title`                         | Direct copy                   |
| `slug`               | `slug`                          | Direct copy                   |
| `broadcastDate`      | `metadata.broadcast_date`       | Direct copy                   |
| `broadcastTime`      | `metadata.broadcast_time`       | Direct copy                   |
| `duration`           | `metadata.duration`             | Direct copy                   |
| `description`        | `metadata.description`          | Direct copy                   |
| `bodyText`           | `metadata.body_text`            | Direct copy                   |
| `tracklist`          | `metadata.tracklist`            | Direct copy                   |
| `player`             | `metadata.player`               | Direct copy                   |
| `thumbnail[0].url`   | `metadata.image` + `thumbnail`  | Download → Upload → Reference |
| `categories`         | `metadata.regular_hosts`        | ID mapping                    |
| `genreTags`          | `metadata.genres`               | ID mapping                    |
| `locations`          | `metadata.locations`            | ID mapping                    |
| `takeovers`          | `metadata.takeovers`            | ID mapping                    |
| `featuredOnHomepage` | `metadata.featured_on_homepage` | Boolean                       |

### Relationship ID Mapping Strategy

```javascript
// Fetch existing Cosmic objects
const cosmicGenres = await getCosmicGenres();
const cosmicHosts = await getCosmicRegularHosts();
const cosmicTakeovers = await getCosmicTakeovers();

// Map Craft IDs to Cosmic IDs
const genreIds = episode.genreTags?.map((tag) => findMatchingCosmicObject(cosmicGenres, tag, "genre")).filter(Boolean) || [];

const hostIds = episode.hosts?.map((host) => findMatchingCosmicObject(cosmicHosts, host, "host")).filter(Boolean) || [];
```

## Error Handling and Best Practices

### Rate Limiting

- Added 100ms delays between API calls
- Used batch processing for large datasets
- Implemented retry logic for failed requests

### Dry Run Mode

- All scripts supported `--dry-run` flag
- Generated detailed reports before actual execution
- Safe testing of migration logic

### Data Validation

- Checked for existing objects before creation
- Validated required fields before API calls
- Handled missing or malformed data gracefully

### Progress Tracking

- Detailed console logging with emojis for clarity
- Progress counters and percentage completion
- Summary reports with statistics

## Performance Optimizations

### Pagination Strategy

- Used consistent page sizes (100 items)
- Implemented proper pagination loops
- Added safety limits to prevent infinite loops

### Memory Management

- Processed data in batches
- Cleaned up temporary files
- Avoided loading entire datasets into memory

### API Efficiency

- Used `props` parameter to fetch only needed fields
- Implemented proper error handling
- Added timeout configurations

## Migration Results Summary

### Episodes

- **Total Processed**: 307 episodes with takeover content
- **Successfully Updated**: 178 episodes with takeover assignments
- **Success Rate**: 58% for takeover assignment

### Hosts/Artists

- **Craft Collections**: 278 collection categories
- **Cosmic Hosts**: 243 regular hosts created
- **Matching Success**: 74.1% coverage
- **High Confidence Matches**: 204 hosts

### Takeovers

- **Available Takeovers**: 39 in Cosmic CMS
- **Episodes with Takeover Content**: 307 identified
- **Successfully Assigned**: 178 episodes

### Data Quality

- Rich Text formatting preserved
- Image quality maintained through proper upload process
- Relationship integrity maintained through ID mapping
- Metadata structure standardized across all objects

## Lessons Learned

1. **API Differences**: Craft's GraphQL vs Cosmic's REST API required different approaches
2. **Media Handling**: File uploads vs URL references required significant transformation
3. **Relationship Mapping**: ID-based relationships needed careful mapping between systems
4. **Data Validation**: Extensive validation required due to data inconsistencies
5. **Performance**: Pagination and batching essential for large datasets
6. **Error Recovery**: Robust error handling prevented data loss during migration

## Recommendations for Future Migrations

1. **Start with Dry Runs**: Always test migration logic before execution
2. **Implement Pagination**: Handle large datasets with proper pagination
3. **Validate Data**: Check data quality before and after migration
4. **Monitor Progress**: Use detailed logging and progress tracking
5. **Handle Media Carefully**: Plan for file upload requirements
6. **Map Relationships**: Understand ID mapping requirements between systems
7. **Test Incrementally**: Migrate in small batches to identify issues early

This migration successfully transformed a complex radio station website from Craft CMS to Cosmic CMS while preserving data integrity and improving the content management experience.
