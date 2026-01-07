#!/usr/bin/env node

/**
 * Verify Episode Image References
 * 
 * Checks how episodes reference images and verifies the cleanup script's detection logic
 */

import { createBucketClient } from '@cosmicjs/sdk';
import fs from 'fs';

const CONFIG = {
  bucketSlug: process.env.COSMIC_BUCKET_SLUG || process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
};

if (!CONFIG.bucketSlug || !CONFIG.readKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const cosmic = createBucketClient({
  bucketSlug: CONFIG.bucketSlug,
  readKey: CONFIG.readKey,
  writeKey: CONFIG.writeKey,
});

async function fetchAllEpisodes() {
  console.log('\n📄 Fetching all episodes...');
  const allEpisodes = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await cosmic.objects
        .find({ type: 'episode' })
        .limit(100)
        .skip(skip)
        .depth(2)
        .status('any');

      const episodes = response.objects || [];
      allEpisodes.push(...episodes);

      console.log(`  Fetched ${allEpisodes.length} episodes...`);

      hasMore = episodes.length === 100;
      skip += 100;
    } catch (error) {
      console.error(`  Error fetching episodes at skip=${skip}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`  ✅ Total episodes: ${allEpisodes.length}`);
  return allEpisodes;
}

async function fetchAllMedia() {
  console.log('\n📷 Fetching all media...');
  const allMedia = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await cosmic.media
        .find()
        .props(['id', 'name', 'url', 'imgix_url', 'original_name'])
        .limit(100)
        .skip(skip);

      const media = response.media || [];
      allMedia.push(...media);

      hasMore = media.length === 100;
      skip += 100;
    } catch (error) {
      console.error(`  Error fetching media at skip=${skip}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`  ✅ Total media: ${allMedia.length}`);
  return allMedia;
}

function analyzeEpisodeImages(episodes, allMedia) {
  console.log('\n🔍 Analyzing episode image references...\n');

  const mediaById = new Map(allMedia.map(m => [m.id, m]));
  const mediaByName = new Map(allMedia.map(m => [m.name, m]));
  const mediaByUrl = new Map();
  const mediaByImgixUrl = new Map();
  
  allMedia.forEach(m => {
    if (m.url) mediaByUrl.set(m.url, m);
    if (m.imgix_url) mediaByImgixUrl.set(m.imgix_url, m);
  });

  let episodesWithImage = 0;
  let episodesWithoutImage = 0;
  let episodesWithImageObject = 0;
  let episodesWithThumbnailString = 0;
  let episodesWithImageString = 0;
  let episodesWithNullImage = 0;
  
  const imageReferences = {
    byId: 0,
    byName: 0,
    byUrl: 0,
    byImgixUrl: 0,
    notFound: 0,
  };

  const unmatchedImages = [];

  for (const episode of episodes) {
    const metadata = episode.metadata || {};
    const image = metadata.image;
    const thumbnail = episode.thumbnail;

    if (image === null || image === undefined) {
      episodesWithNullImage++;
      if (!thumbnail) {
        episodesWithoutImage++;
      }
      continue;
    }

    episodesWithImage++;

    if (typeof image === 'object' && image !== null) {
      episodesWithImageObject++;
      
      const imageUrl = image.url || '';
      const imageImgixUrl = image.imgix_url || '';
      
      let found = false;
      let foundBy = null;

      if (image.id && mediaById.has(image.id)) {
        imageReferences.byId++;
        found = true;
        foundBy = 'id';
      } else if (image.name && mediaByName.has(image.name)) {
        imageReferences.byName++;
        found = true;
        foundBy = 'name';
      } else if (imageUrl && mediaByUrl.has(imageUrl)) {
        imageReferences.byUrl++;
        found = true;
        foundBy = 'url';
      } else if (imageImgixUrl && mediaByImgixUrl.has(imageImgixUrl)) {
        imageReferences.byImgixUrl++;
        found = true;
        foundBy = 'imgix_url';
      }

      if (!found) {
        imageReferences.notFound++;
        unmatchedImages.push({
          episodeId: episode.id,
          episodeTitle: episode.title,
          imageObject: image,
        });
      }
    } else if (typeof image === 'string') {
      episodesWithImageString++;
      
      if (mediaByName.has(image)) {
        imageReferences.byName++;
      } else if (mediaById.has(image)) {
        imageReferences.byId++;
      } else {
        imageReferences.notFound++;
        unmatchedImages.push({
          episodeId: episode.id,
          episodeTitle: episode.title,
          imageString: image,
        });
      }
    }

    if (typeof thumbnail === 'string' && thumbnail) {
      episodesWithThumbnailString++;
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  EPISODE IMAGE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total episodes: ${episodes.length}`);
  console.log(`  Episodes with image: ${episodesWithImage}`);
  console.log(`  Episodes without image: ${episodesWithoutImage}`);
  console.log(`  Episodes with null/undefined image: ${episodesWithNullImage}`);
  console.log(`  Episodes with image object: ${episodesWithImageObject}`);
  console.log(`  Episodes with image string: ${episodesWithImageString}`);
  console.log(`  Episodes with thumbnail string: ${episodesWithThumbnailString}`);
  console.log('\n  Image Reference Detection:');
  console.log(`    Found by ID: ${imageReferences.byId}`);
  console.log(`    Found by name: ${imageReferences.byName}`);
  console.log(`    Found by URL: ${imageReferences.byUrl}`);
  console.log(`    Found by imgix_url: ${imageReferences.byImgixUrl}`);
  console.log(`    NOT FOUND: ${imageReferences.notFound}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (unmatchedImages.length > 0) {
    console.log(`\n⚠️  ${unmatchedImages.length} episodes have image references that don't match any media:`);
    unmatchedImages.slice(0, 10).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.episodeTitle}`);
      if (item.imageObject) {
        console.log(`     Image object:`, JSON.stringify(item.imageObject, null, 2));
      } else if (item.imageString) {
        console.log(`     Image string: ${item.imageString}`);
      }
    });
    if (unmatchedImages.length > 10) {
      console.log(`  ... and ${unmatchedImages.length - 10} more`);
    }
  }

  return {
    episodesWithImage,
    episodesWithoutImage,
    imageReferences,
    unmatchedImages,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Episode Image Reference Verification');
  console.log('═══════════════════════════════════════════════════════════');

  const episodes = await fetchAllEpisodes();
  const allMedia = await fetchAllMedia();

  const analysis = analyzeEpisodeImages(episodes, allMedia);

  const report = {
    timestamp: new Date().toISOString(),
    totalEpisodes: episodes.length,
    totalMedia: allMedia.length,
    ...analysis,
  };

  fs.writeFileSync('./episode-image-verification.json', JSON.stringify(report, null, 2));
  console.log('\n📝 Full report saved to: episode-image-verification.json');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

