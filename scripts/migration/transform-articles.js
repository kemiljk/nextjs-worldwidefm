require('dotenv').config();
const mysql = require('mysql2/promise');
const { createBucketClient } = require('@cosmicjs/sdk');
const config = require('./config');

// Check environment variables
console.log('Environment variables:');
console.log('COSMIC_BUCKET_SLUG:', process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG);
console.log('COSMIC_READ_KEY:', process.env.NEXT_PUBLIC_COSMIC_READ_KEY ? 'Present' : 'Missing');
console.log('COSMIC_WRITE_KEY:', process.env.COSMIC_WRITE_KEY ? 'Present' : 'Missing');

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function getArticles() {
  const connection = await getConnection();
  try {
    // Get editorial entries with their content and assets
    const [entries] = await connection.execute(`
      SELECT 
        e.*,
        c.*,
        s.slug,
        GROUP_CONCAT(DISTINCT r.fieldId, ':', r.targetId, ':', r.sourceId) as relations
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites s ON e.id = s.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId
      WHERE e.sectionId = (
        SELECT id FROM craft_sections WHERE handle = 'editorial'
      )
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND s.siteId = 1
      AND c.title IS NOT NULL
      GROUP BY e.id
      ORDER BY e.dateCreated DESC
    `);

    // Process entries to get assets
    for (const entry of entries) {
      if (entry.relations) {
        const relationParts = entry.relations.split(',');
        for (const relation of relationParts) {
          const [fieldId, targetId] = relation.split(':');
          if (fieldId === '4') { // Thumbnail field
            const [assets] = await connection.execute(`
              SELECT a.*, v.url as volumeUrl
              FROM craft_assets a
              JOIN craft_volumes v ON a.volumeId = v.id
              WHERE a.id = ?
            `, [targetId]);

            if (assets.length > 0) {
              const asset = assets[0];
              entry.thumbnail = `${asset.volumeUrl}/${asset.filename}`;
            }
          }
        }
      }
    }

    // Deduplicate entries based on title, keeping the most recent one
    const uniqueEntries = entries.reduce((acc, entry) => {
      if (!acc[entry.title] || new Date(entry.dateCreated) > new Date(acc[entry.title].dateCreated)) {
        acc[entry.title] = entry;
      }
      return acc;
    }, {});

    return Object.values(uniqueEntries);
  } finally {
    await connection.end();
  }
}

async function createAuthorIfNotExists() {
  try {
    const bucket = await createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    });

    // Check if author already exists
    const existingAuthors = await bucket.objects.find({
      type: 'authors',
      query: {
        slug: 'wwfm'
      }
    });

    if (existingAuthors.objects.length > 0) {
      console.log('Author already exists');
      return existingAuthors.objects[0].id;
    }

    // Create new author
    const result = await bucket.objects.insertOne({
      type: 'authors',
      title: 'WWFM',
      slug: 'wwfm',
      metadata: {
        bio: 'Worldwide FM'
      }
    });

    console.log('Created author:', result.object.id);
    return result.object.id;
  } catch (error) {
    console.error('Error creating author:', error);
    throw error;
  }
}

async function uploadImage(imageUrl) {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to download image ${imageUrl}: ${response.status} ${response.statusText}`);
      return null;
    }
    const buffer = await response.buffer();

    // Upload to Cosmic
    const result = await createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    }).media.insertOne({
      media: buffer,
      filename: 'article-image.jpg'
    });

    console.log('Successfully uploaded image');
    return result.media.url;
  } catch (error) {
    console.error(`Error uploading image:`, error);
    return null;
  }
}

async function getMatrixBlocks(entryId, connection) {
  try {
    // Query the matrixblocks table to get blocks for this entry
    const [blocks] = await connection.execute(`
      SELECT mb.id, mb.fieldId, mb.typeId, mc.field_bodyText_textContent as text
      FROM craft_matrixblocks mb
      LEFT JOIN craft_matrixcontent_body mc ON mb.id = mc.elementId
      WHERE mb.ownerId = ?
      ORDER BY mb.sortOrder
    `, [entryId]);

    // Log the blocks for debugging
    console.log(`Found ${blocks.length} matrix blocks for entry ${entryId}`);
    if (blocks.length > 0) {
      console.log('First block content:', blocks[0].text);
    }

    return blocks.map(block => ({
      type: 'text',
      text: block.text || ''
    }));
  } catch (error) {
    console.error(`Error fetching matrix blocks for entry ${entryId}:`, error);
    return [];
  }
}

async function transformArticle(article, connection, authorId) {
  try {
    // Format the date
    let formattedDate = null;
    try {
      const date = new Date(article.dateCreated);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toISOString().split('T')[0];
      } else {
        // If date is invalid, use current date
        formattedDate = new Date().toISOString().split('T')[0];
      }
    } catch (error) {
      console.error(`Error formatting date for article ${article.title}:`, error);
      // Use current date as fallback
      formattedDate = new Date().toISOString().split('T')[0];
    }

    // Get matrix blocks and transform them into HTML content
    const matrixBlocks = await getMatrixBlocks(article.id, connection);
    const content = matrixBlocks.map(block => {
      if (block.type === 'text' && block.text) {
        return `<p>${block.text}</p>`;
      }
      return '';
    }).join('');

    // Create excerpt from description or first paragraph
    const excerpt = article.field_description || content.split('</p>')[0].replace('<p>', '');

    // Create the article object
    const articleObject = {
      type: 'articles',
      title: article.title,
      slug: article.slug,
      status: 'published',
      metadata: {
        date: formattedDate,
        author: authorId,
        content: content || article.field_description || '',
        excerpt: excerpt
      }
    };

    return articleObject;
  } catch (error) {
    console.error(`Error processing article ${article.title}:`, error);
    throw error;
  }
}

async function uploadArticle(article) {
  try {
    const bucket = createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    });

    // Check if article already exists
    let existingArticle = null;
    try {
      const response = await bucket.objects.findOne({
        type: 'articles',
        slug: article.slug
      });
      existingArticle = response.object;
    } catch (error) {
      // Article doesn't exist, continue with creation
      console.log(`No existing article found with slug: ${article.slug}`);
    }

    let result;
    if (existingArticle) {
      console.log(`Updating article: ${article.title}`);
      result = await bucket.objects.updateOne({
        ...article,
        id: existingArticle.id
      });
    } else {
      console.log(`Creating new article: ${article.title}`);
      result = await bucket.objects.insertOne(article);
    }

    console.log(`Successfully processed article: ${article.title}`);
    return result;
  } catch (error) {
    console.error(`Error processing article ${article.title}:`, error);
    throw error;
  }
}

async function createArticleObjectType() {
  try {
    const bucket = await createBucketClient({
      bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
      writeKey: process.env.COSMIC_WRITE_KEY
    });

    // Check if object type already exists
    const existingTypes = await bucket.objectTypes.find({
      query: {
        slug: 'articles'
      }
    });

    if (existingTypes.object_types.length > 0) {
      console.log('Article object type already exists');
      return;
    }

    // Create object type with metafields
    const objectType = {
      title: 'Articles',
      slug: 'articles',
      singular: 'Article',
      metafields: [
        {
          type: 'file',
          title: 'Image',
          key: 'image',
          required: false
        },
        {
          type: 'object',
          title: 'Author',
          key: 'author',
          required: false,
          object_type: 'authors'
        },
        {
          type: 'date',
          title: 'Date',
          key: 'date',
          required: false
        },
        {
          type: 'text',
          title: 'Excerpt',
          key: 'excerpt',
          required: false
        },
        {
          type: 'html-textarea',
          title: 'Content',
          key: 'content',
          required: false
        },
        {
          type: 'switch',
          title: 'Featured on Homepage',
          key: 'featured_on_homepage',
          required: false
        }
      ]
    };

    const result = await bucket.objectTypes.insertOne(objectType);
    console.log('Created article object type:', result.object_type.slug);
  } catch (error) {
    console.error('Error creating article object type:', error);
    throw error;
  }
}

async function migrateArticles() {
  let connection;
  try {
    connection = await getConnection();

    // First create the article object type
    console.log('Setting up article object type...');
    await createArticleObjectType();

    // Use hardcoded author ID
    const authorId = '67d342e99d39f0511c3088a4';
    console.log('Using author ID:', authorId);

    // Get all articles from the editorial section
    const [articles] = await connection.execute(`
      SELECT DISTINCT
        e.id,
        e.dateCreated,
        es.slug,
        c.title,
        c.field_description,
        CONCAT(s.baseUrl, a.filename) as thumbnail
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements_sites es ON e.id = es.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId AND r.fieldId = 4
      LEFT JOIN craft_assets a ON r.targetId = a.id
      LEFT JOIN craft_volumes v ON a.volumeId = v.id
      LEFT JOIN craft_sites s ON es.siteId = s.id
      WHERE e.sectionId = (
        SELECT id FROM craft_sections WHERE handle = 'editorial'
      )
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      AND es.siteId = 1
      AND c.title IS NOT NULL
      ORDER BY e.dateCreated DESC
    `);

    console.log(`Found ${articles.length} articles to migrate`);

    // Process each article
    for (const article of articles) {
      console.log(`Processing article: ${article.title}`);
      try {
        const transformedArticle = await transformArticle(article, connection, authorId);
        await uploadArticle(transformedArticle);
      } catch (error) {
        console.error(`Failed to process article ${article.title}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
  console.log('Migration completed');
}

if (require.main === module) {
  migrateArticles();
}