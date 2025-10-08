# Migration Scripts Summary

This document provides a comprehensive overview of all migration scripts used during the Craft CMS to Cosmic CMS transition.

## Script Categories

### 1. Core Migration Scripts

#### Episode Migration

- **`migrate-episodes.js`** - Main episode migration script

  - Fetches episodes from Craft CMS GraphQL API
  - Downloads and uploads images to Cosmic Media
  - Creates episode objects in Cosmic with proper metadata
  - Handles relationship mapping (genres, hosts, locations, takeovers)

- **`migrate-episode-images.js`** - Image processing for migrated episodes
  - Processes episodes that were created by cron jobs but lack images
  - Downloads images from Craft CMS URLs
  - Uploads to Cosmic Media and updates episode references
  - Includes batch processing and cleanup

#### Tracklist Migration

- **`migrate-tracklist.ts`** - Migrates tracklist data

  - Copies content from `tracklist_old` to `tracklist` field
  - Preserves Rich Text formatting
  - Processes all episodes in Cosmic CMS

- **`cleanup-tracklist-old.ts`** - Cleanup after tracklist migration
  - Removes `tracklist_old` fields after successful migration
  - Includes safety checks to ensure `tracklist` has content

### 2. Host/Artist Management Scripts

#### Host Profile Creation

- **`create-host-profiles.js`** - Creates regular-hosts objects

  - Extracts host data from Craft collection categories
  - Creates complete host profiles with images and descriptions
  - Maps episode relationships to hosts

- **`update-host-profiles.js`** - Updates existing host profiles

  - Enriches existing regular-hosts with biographical data
  - Adds profile images from episode thumbnails
  - Updates episode counts and metadata

- **`preview-host-data.js`** - Preview host data extraction
  - Shows what data can be extracted without making changes
  - Useful for testing and validation

#### Host Analysis

- **`analyze-regular-hosts.ts`** - Analyzes host matching between systems

  - Compares Craft collection categories with Cosmic regular-hosts
  - Generates matching reports and statistics
  - Identifies unmatched hosts

- **`examine-host-data.js`** - Examines host data structure
  - Debugging script for understanding host data format
  - Shows relationships between hosts and episodes

### 3. Takeover Management Scripts

#### Takeover Assignment

- **`match-takeover-episodes.ts`** - Assigns takeovers to episodes

  - Matches episodes with "Takeover" in title to Cosmic takeovers
  - Uses title extraction and matching algorithms
  - Updates episode metadata with takeover assignments

- **`match-collections-to-takeovers.ts`** - Collection-based takeover matching
  - Matches Craft collections to Cosmic takeovers
  - Assigns episodes under collections to takeovers
  - Uses confidence scoring for matching

#### Takeover Analysis

- **`find-episode-without-takeover.ts`** - Finds episodes missing takeover assignments

  - Identifies episodes that should have takeovers but don't
  - Useful for data validation and cleanup

- **`test-single-takeover.ts`** - Tests takeover matching for single episodes
  - Debugging script for takeover assignment logic
  - Tests matching algorithms on specific episodes

### 4. Data Analysis and Exploration Scripts

#### API Exploration

- **`explore-episodes.ts`** - Explores Craft CMS episode data

  - Shows episode field structure and content
  - Identifies episodes with takeover-related content
  - Useful for understanding data format

- **`explore-graphql-schema.ts`** - Explores Craft CMS GraphQL API
  - Tests different GraphQL queries
  - Shows available data types and relationships
  - Helps understand API capabilities

#### Data Validation

- **`check-episode-structure.js`** - Validates episode data structure

  - Checks for required fields and data integrity
  - Identifies missing or malformed data

- **`check-episode-images.js`** - Validates episode images

  - Checks image references and availability
  - Identifies broken image links

- **`check-specific-episode.js`** - Checks specific episode data
  - Debugging script for individual episodes
  - Shows detailed episode information

### 5. Genre and Category Management

#### Genre Processing

- **`replace-genres.ts`** - Replaces genre assignments

  - Updates episode genre assignments
  - Handles genre mapping between systems

- **`update-existing-episode-genres.js`** - Updates episode genres

  - Modifies existing genre assignments
  - Ensures consistency across episodes

- **`fix-broken-genre-relationships.js`** - Fixes broken genre relationships
  - Repairs corrupted genre assignments
  - Validates genre relationships

#### Category Analysis

- **`analyze-categories.js`** - Analyzes category structure
  - Shows category hierarchy and relationships
  - Identifies category types and groups

### 6. Image and Media Management

#### Image Processing

- **`migrate-host-images.js`** - Migrates host profile images

  - Downloads host images from Craft CMS
  - Uploads to Cosmic Media
  - Updates host profile references

- **`migrate-host-images-by-filename.js`** - Filename-based image migration

  - Matches images by filename patterns
  - Handles bulk image processing

- **`upload-host-media.js`** - Uploads host media files
  - Handles media file uploads to Cosmic
  - Manages file naming and organization

#### Image Analysis

- **`analyze-episode-image-structure.js`** - Analyzes episode image structure

  - Shows image data format and references
  - Identifies image processing requirements

- **`diagnose-episode-images.js`** - Diagnoses image issues
  - Identifies broken or missing images
  - Provides image processing recommendations

### 7. Schedule and Broadcast Management

#### Schedule Processing

- **`create-schedule.ts`** - Creates schedule objects

  - Migrates broadcast schedule data
  - Creates schedule objects in Cosmic

- **`update-schedule.ts`** - Updates schedule data

  - Modifies existing schedule information
  - Ensures schedule consistency

- **`update-schedule-type.ts`** - Updates schedule object type
  - Modifies schedule object structure
  - Handles schema changes

### 8. Utility and Helper Scripts

#### Environment and Configuration

- **`check-env.js`** - Validates environment variables

  - Checks required environment variables
  - Validates API credentials

- **`check-db-sections.js`** - Checks database sections
  - Validates database structure
  - Identifies data inconsistencies

#### Data Cleanup

- **`cleanup-broken-episodes.js`** - Cleans up broken episodes

  - Removes or fixes corrupted episode data
  - Handles data integrity issues

- **`fix-episode-image-references.js`** - Fixes image references
  - Repairs broken image references
  - Updates image URLs and paths

#### Testing and Validation

- **`test-graphql.js`** - Tests GraphQL API

  - Validates GraphQL queries
  - Tests API connectivity

- **`test-image-update.js`** - Tests image updates
  - Validates image upload process
  - Tests image reference updates

### 9. Report Generation Scripts

#### Matching Reports

- **`takeover-episode-matching-report-*.json`** - Takeover matching results

  - Detailed reports of takeover assignment results
  - Statistics and success rates

- **`collection-takeover-matching-report-*.json`** - Collection matching results

  - Reports on collection-to-takeover matching
  - Matching confidence scores

- **`regular-hosts-analysis.json`** - Host analysis results
  - Comprehensive host matching analysis
  - Coverage statistics and recommendations

## Script Execution Patterns

### Common Patterns Used

1. **Dry Run Mode**: Most scripts support `--dry-run` flag for testing
2. **Batch Processing**: Large datasets processed in batches to avoid memory issues
3. **Progress Tracking**: Detailed logging with emojis and progress indicators
4. **Error Handling**: Graceful error handling with detailed error messages
5. **Rate Limiting**: Built-in delays to avoid API rate limits
6. **Data Validation**: Extensive validation before and after operations

### Environment Requirements

All scripts require these environment variables:

```bash
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your_bucket_slug
NEXT_PUBLIC_COSMIC_READ_KEY=your_read_key
COSMIC_WRITE_KEY=your_write_key
```

### Execution Order

Recommended execution order for migration:

1. Environment validation (`check-env.js`)
2. Data exploration (`explore-episodes.ts`, `explore-graphql-schema.ts`)
3. Host profile creation (`create-host-profiles.js`)
4. Episode migration (`migrate-episodes.js`)
5. Image processing (`migrate-episode-images.js`)
6. Takeover assignment (`match-takeover-episodes.ts`)
7. Tracklist migration (`migrate-tracklist.ts`)
8. Data validation and cleanup scripts

## Script Maintenance Notes

- All scripts include comprehensive error handling
- Progress tracking and logging implemented throughout
- Dry run modes available for safe testing
- Detailed reports generated for audit trails
- Modular design allows for individual script execution
- Environment variable validation prevents runtime errors

This comprehensive script collection successfully migrated a complex radio station website from Craft CMS to Cosmic CMS while maintaining data integrity and providing detailed audit trails.
