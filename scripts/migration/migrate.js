const { createBucketClient } = require('@cosmicjs/sdk');
const config = require('./config');
const db = require('./db');
const logger = require('./logger');

const cosmic = createBucketClient(config.cosmic);

// Cache for object type metafields
const objectTypeMetafields = new Map();

async function getObjectTypeMetafields(type) {
  if (objectTypeMetafields.has(type)) {
    return objectTypeMetafields.get(type);
  }

  try {
    const { object_type } = await cosmic.objectTypes.findOne({
      id: type
    });

    if (!object_type || !object_type.metafields) {
      logger.warn(`No metafields found for object type: ${type}`);
      return [];
    }

    const metafields = object_type.metafields.map(field => field.key);
    objectTypeMetafields.set(type, metafields);
    return metafields;
  } catch (error) {
    logger.error(`Failed to get metafields for object type ${type}`, error);
    return [];
  }
}

async function checkObjectExists(type, slug) {
  try {
    const { object } = await cosmic.objects.findOne({
      type,
      slug
    });
    return !!object;
  } catch (error) {
    logger.error(`Failed to check if object exists: ${type}/${slug}`, error);
    return false;
  }
}

async function getSection(sectionHandle) {
  try {
    const sections = await db.query(
      'SELECT * FROM craft_sections WHERE handle = ?',
      [sectionHandle]
    );
    return sections[0];
  } catch (error) {
    logger.error(`Failed to get section ${sectionHandle}`, error);
    throw error;
  }
}

async function getEntries(sectionId) {
  try {
    const entries = await db.query(`
      SELECT 
        e.*,
        c.*,
        GROUP_CONCAT(DISTINCT r.fieldId, ':', r.targetId) as relations,
        s.slug as entry_slug
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId
      LEFT JOIN craft_elements_sites s ON e.id = s.elementId
      WHERE e.sectionId = ? 
      AND (e.deletedWithEntryType IS NULL OR e.deletedWithEntryType = 0)
      GROUP BY e.id
    `, [sectionId]);

    for (const entry of entries) {
      const blocks = await db.query(`
        SELECT 
          mb.*,
          mc.*,
          mf.handle as fieldHandle
        FROM craft_matrixblocks mb
        JOIN craft_content mc ON mb.id = mc.elementId
        JOIN craft_fields mf ON mb.fieldId = mf.id
        WHERE mb.ownerId = ?
        ORDER BY mb.sortOrder
      `, [entry.id]);

      entry.matrixBlocks = blocks;
    }

    return entries;
  } catch (error) {
    logger.error(`Failed to get entries for section ${sectionId}`, error);
    throw error;
  }
}

async function transformEntryToCosmicObject(entry, section) {
  try {
    const baseObject = {
      type: section.handle,
      title: entry.title,
      slug: entry.entry_slug,
      status: entry.enabled ? 'published' : 'draft',
      metadata: {}
    };

    // Get available metafields for this object type
    const availableMetafields = await getObjectTypeMetafields(section.handle);
    logger.log(`Available metafields for ${section.handle}: ${availableMetafields.join(', ')}`);

    // Handle matrix blocks if they exist and content_blocks is an available metafield
    if (entry.matrixBlocks && entry.matrixBlocks.length > 0 && availableMetafields.includes('content_blocks')) {
      const blocks = entry.matrixBlocks.map(block => ({
        type: block.type,
        fields: {
          ...block
        }
      }));
      baseObject.metadata.content_blocks = blocks;
    }

    // Handle relations if they exist and related_objects is an available metafield
    if (entry.relations && availableMetafields.includes('related_objects')) {
      const relations = entry.relations.split(',')
        .map(r => {
          const [fieldId, targetId] = r.split(':');
          return { fieldId, targetId };
        })
        .filter(r => r.fieldId && r.targetId);

      if (relations.length > 0) {
        const relatedObjects = await Promise.all(
          relations.map(async ({ fieldId, targetId }) => {
            const [relatedEntry] = await db.query(`
              SELECT e.*, c.title, s.slug
              FROM craft_entries e
              JOIN craft_content c ON e.id = c.elementId
              JOIN craft_elements_sites s ON e.id = s.elementId
              WHERE e.id = ? AND s.siteId = 1
            `, [targetId]);
            return relatedEntry;
          })
        );
        const filteredObjects = relatedObjects.filter(Boolean);
        if (filteredObjects.length > 0) {
          baseObject.metadata.related_objects = filteredObjects.map(obj => ({
            id: obj.id,
            title: obj.title,
            slug: obj.slug
          }));
        }
      }
    }

    // Handle specific section types with field validation
    switch (section.handle) {
      case 'episode':
        if (availableMetafields.includes('broadcast_date')) baseObject.metadata.broadcast_date = entry.broadcastDate;
        if (availableMetafields.includes('broadcast_time')) baseObject.metadata.broadcast_time = entry.broadcastTime;
        if (availableMetafields.includes('duration')) baseObject.metadata.duration = entry.duration;
        if (availableMetafields.includes('description')) baseObject.metadata.description = entry.description;
        if (availableMetafields.includes('source')) baseObject.metadata.source = entry.source;
        break;

      case 'editorial':
        if (availableMetafields.includes('excerpt')) baseObject.metadata.excerpt = entry.excerpt || '';
        if (availableMetafields.includes('content')) baseObject.metadata.content = entry.content || '';
        if (availableMetafields.includes('publish_date')) baseObject.metadata.publish_date = entry.postDate || new Date().toISOString();
        if (availableMetafields.includes('featured_on_homepage')) baseObject.metadata.featured_on_homepage = entry.featuredOnHomepage === '1';
        break;

      case 'about':
        if (availableMetafields.includes('description')) baseObject.metadata.description = entry.description || '';
        if (availableMetafields.includes('page_content')) baseObject.metadata.page_content = entry.pageContent || '';
        break;
    }

    // Remove any undefined or null values from metadata
    Object.keys(baseObject.metadata).forEach(key => {
      if (baseObject.metadata[key] === undefined || baseObject.metadata[key] === null) {
        delete baseObject.metadata[key];
      }
    });

    return baseObject;
  } catch (error) {
    logger.error(`Failed to transform entry ${entry.title}`, error);
    throw error;
  }
}

async function migrateSection(sectionHandle) {
  try {
    logger.log(`Starting migration for section: ${sectionHandle}`);

    const section = await getSection(sectionHandle);
    if (!section) {
      throw new Error(`Section ${sectionHandle} not found`);
    }

    const entries = await getEntries(section.id);
    logger.log(`Found ${entries.length} entries to migrate`);

    let skipped = 0;
    let migrated = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        const exists = await checkObjectExists(section.handle, entry.entry_slug);

        if (exists) {
          logger.warn(`Skipping existing entry: ${entry.title} (${entry.entry_slug})`);
          skipped++;
          continue;
        }

        if (config.isDryRun) {
          logger.log(`[DRY RUN] Would migrate entry: ${entry.title}`);
          continue;
        }

        const cosmicObject = await transformEntryToCosmicObject(entry, section);
        await cosmic.objects.insertOne(cosmicObject);
        logger.success(`Migrated entry: ${entry.title}`);
        migrated++;
      } catch (error) {
        logger.error(`Failed to migrate entry ${entry.title}`, error);
        failed++;
      }
    }

    logger.success(`Completed migration for section: ${sectionHandle}. Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}`);
  } catch (error) {
    logger.error(`Failed to migrate section ${sectionHandle}`, error);
    throw error;
  }
}

async function main() {
  try {
    logger.log('Starting migration process');

    const sections = ['editorial', 'about'];  // Removed 'episode' since it's already migrated
    for (const section of sections) {
      await migrateSection(section);
    }

    logger.success(`Migration completed in ${logger.getDuration()}`);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  } finally {
    await logger.saveLog();
    await db.end();
  }
}

if (require.main === module) {
  main();
} 