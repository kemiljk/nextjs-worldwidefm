require('dotenv').config();
const { createBucketClient } = require('@cosmicjs/sdk');

// Check environment variables
console.log('Environment variables:');
console.log('COSMIC_BUCKET_SLUG:', process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
console.log('COSMIC_READ_KEY:', process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? 'Present' : 'Missing');
console.log('COSMIC_WRITE_KEY:', process.env.COSMIC_WRITE_KEY ? 'Present' : 'Missing');

function calculateMetadataScore(show) {
  let score = 0;
  const metadata = show.metadata || {};

  // Check description
  if (metadata.description && metadata.description.length > 0) score += 3;

  // Check player (required field)
  if (metadata.player && metadata.player.length > 0) score += 3;

  // Check tracklist
  if (metadata.tracklist && metadata.tracklist.length > 0) score += 2;

  // Check body text
  if (metadata.body_text && metadata.body_text.length > 0) score += 2;

  // Check broadcast details
  if (metadata.broadcast_date) score += 2;
  if (metadata.broadcast_time) score += 2;
  if (metadata.duration) score += 2;

  // Check image
  if (metadata.image) score += 2;

  // Check other fields
  if (metadata.subtitle) score += 1;
  if (metadata.page_link) score += 1;
  if (metadata.source) score += 1;

  return score;
}

async function deduplicateRadioShows() {
  try {
    const bucket = await createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    });

    // Fetch all radio shows
    console.log('Fetching all radio shows...');
    const { objects: shows } = await bucket.objects.find({
      type: 'radio-shows',
      limit: 1000 // Adjust if needed
    });

    console.log(`Found ${shows.length} total radio shows`);

    // Group shows by title
    const groupedShows = shows.reduce((acc, show) => {
      const title = show.title.toLowerCase().trim();
      if (!acc[title]) {
        acc[title] = [];
      }
      acc[title].push(show);
      return acc;
    }, {});

    // Find duplicates
    const duplicates = Object.entries(groupedShows)
      .filter(([_, shows]) => shows.length > 1)
      .map(([title, shows]) => ({
        title,
        shows: shows.sort((a, b) => calculateMetadataScore(b) - calculateMetadataScore(a))
      }));

    console.log(`Found ${duplicates.length} titles with duplicates`);

    // Process each group of duplicates
    for (const { title, shows } of duplicates) {
      console.log(`\nProcessing duplicates for title: ${title}`);
      console.log(`Found ${shows.length} duplicates`);

      // Keep the first show (highest score)
      const keepShow = shows[0];
      console.log(`Keeping show with ID: ${keepShow.id} (score: ${calculateMetadataScore(keepShow)})`);
      console.log('Metadata:', JSON.stringify(keepShow.metadata, null, 2));

      // Delete the rest
      for (let i = 1; i < shows.length; i++) {
        const showToDelete = shows[i];
        console.log(`Deleting show with ID: ${showToDelete.id} (score: ${calculateMetadataScore(showToDelete)})`);
        console.log('Metadata:', JSON.stringify(showToDelete.metadata, null, 2));

        try {
          await bucket.objects.deleteOne(showToDelete.id);
          console.log(`Successfully deleted show ${showToDelete.id}`);
        } catch (error) {
          console.error(`Error deleting show ${showToDelete.id}:`, error);
        }
      }
    }

    console.log('\nDeduplication completed');
  } catch (error) {
    console.error('Error during deduplication:', error);
  }
}

if (require.main === module) {
  deduplicateRadioShows();
} 