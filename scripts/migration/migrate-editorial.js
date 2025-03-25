const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');
const { createBucketClient } = require('@cosmicjs/sdk');

// Configuration
const config = {
  mysql: {
    host: 'localhost',
    user: 'root',
    database: 'worldwidefm',
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  }
};

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: config.cosmic.bucketSlug,
  readKey: config.cosmic.readKey,
  writeKey: config.cosmic.writeKey
});

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function getEditorialEntries() {
  const connection = await getConnection();
  try {
    // Get editorial section ID
    const [sections] = await connection.execute(
      'SELECT id FROM craft_sections WHERE handle = ?',
      ['editorial']
    );
    const sectionId = sections[0].id;

    // Get all editorial entries with their content and assets
    const [entries] = await connection.execute(`
      SELECT 
        e.*,
        c.*,
        s.slug as entry_slug,
        GROUP_CONCAT(DISTINCT r.fieldId, ':', r.targetId) as relations
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId
      WHERE e.sectionId = ? 
      AND e.dateDeleted IS NULL
      GROUP BY e.id
    `, [sectionId]);

    // For each entry, get its thumbnail if it exists
    for (const entry of entries) {
      if (entry.relations) {
        const assetRelations = entry.relations.split(',')
          .filter(r => r.includes(':'))
          .map(r => ({ fieldId: r.split(':')[0], targetId: r.split(':')[1] }));

        // Get thumbnail asset
        if (assetRelations.length > 0) {
          const [assets] = await connection.execute(`
            SELECT a.*, v.url
            FROM craft_assets a
            JOIN craft_volumes v ON a.volumeId = v.id
            WHERE a.id IN (?)
          `, [assetRelations.map(r => r.targetId)]);

          if (assets.length > 0) {
            entry.thumbnail = {
              url: assets[0].url,
              imgix_url: assets[0].url
            };
          }
        }
      }
    }

    return entries;
  } finally {
    await connection.end();
  }
}

async function migrateEditorialToArticles() {
  try {
    console.log('Starting editorial to articles migration...');

    // Get all editorial entries
    const entries = await getEditorialEntries();
    console.log(`Found ${entries.length} editorial entries to migrate`);

    // Migrate each entry to an article
    for (const entry of entries) {
      try {
        const articleData = {
          title: entry.title,
          type: 'articles',
          slug: entry.entry_slug,
          metadata: {
            image: entry.thumbnail || null,
            date: entry.postDate ? new Date(entry.postDate).toISOString().split('T')[0] : null,
            excerpt: entry.excerpt || '',
            content: entry.content || '',
            featured_on_homepage: entry.featuredOnHomepage === '1'
          }
        };

        // Check if article already exists
        const existingArticle = await cosmic.objects.findOne({
          type: 'articles',
          slug: entry.entry_slug
        });

        if (existingArticle) {
          console.log(`Updating article: ${entry.entry_slug}`);
          await cosmic.objects.updateOne(existingArticle.id, articleData);
        } else {
          console.log(`Creating new article: ${entry.entry_slug}`);
          await cosmic.objects.insertOne(articleData);
        }
      } catch (error) {
        console.error(`Failed to migrate editorial entry ${entry.entry_slug}:`, error);
      }
    }

    console.log('Editorial to articles migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateEditorialToArticles();
} 