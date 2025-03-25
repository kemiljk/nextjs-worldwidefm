require('dotenv').config();
const { createBucketClient } = require('@cosmicjs/sdk');

// Check environment variables
console.log('Environment variables:');
console.log('COSMIC_BUCKET_SLUG:', process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
console.log('COSMIC_READ_KEY:', process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? 'Present' : 'Missing');
console.log('COSMIC_WRITE_KEY:', process.env.COSMIC_WRITE_KEY ? 'Present' : 'Missing');

function calculateMetadataScore(article) {
  let score = 0;
  const metadata = article.metadata || {};

  // Check content length
  if (metadata.content && metadata.content.length > 0) score += 3;

  // Check excerpt
  if (metadata.excerpt && metadata.excerpt.length > 0) score += 2;

  // Check date
  if (metadata.date) score += 2;

  // Check author
  if (metadata.author) score += 2;

  // Check image
  if (metadata.image) score += 2;

  // Check featured status
  if (metadata.featured_on_homepage !== undefined) score += 1;

  return score;
}

async function deduplicateArticles() {
  try {
    const bucket = await createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    });

    // Fetch all articles
    console.log('Fetching all articles...');
    const { objects: articles } = await bucket.objects.find({
      type: 'articles',
      limit: 1000 // Adjust if needed
    });

    console.log(`Found ${articles.length} total articles`);

    // Group articles by title
    const groupedArticles = articles.reduce((acc, article) => {
      const title = article.title.toLowerCase().trim();
      if (!acc[title]) {
        acc[title] = [];
      }
      acc[title].push(article);
      return acc;
    }, {});

    // Find duplicates
    const duplicates = Object.entries(groupedArticles)
      .filter(([_, articles]) => articles.length > 1)
      .map(([title, articles]) => ({
        title,
        articles: articles.sort((a, b) => calculateMetadataScore(b) - calculateMetadataScore(a))
      }));

    console.log(`Found ${duplicates.length} titles with duplicates`);

    // Process each group of duplicates
    for (const { title, articles } of duplicates) {
      console.log(`\nProcessing duplicates for title: ${title}`);
      console.log(`Found ${articles.length} duplicates`);

      // Keep the first article (highest score)
      const keepArticle = articles[0];
      console.log(`Keeping article with ID: ${keepArticle.id} (score: ${calculateMetadataScore(keepArticle)})`);

      // Delete the rest
      for (let i = 1; i < articles.length; i++) {
        const articleToDelete = articles[i];
        console.log(`Deleting article with ID: ${articleToDelete.id} (score: ${calculateMetadataScore(articleToDelete)})`);

        try {
          await bucket.objects.deleteOne(articleToDelete.id);
          console.log(`Successfully deleted article ${articleToDelete.id}`);
        } catch (error) {
          console.error(`Error deleting article ${articleToDelete.id}:`, error);
        }
      }
    }

    console.log('\nDeduplication completed');
  } catch (error) {
    console.error('Error during deduplication:', error);
  }
}

if (require.main === module) {
  deduplicateArticles();
} 