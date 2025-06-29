require("dotenv").config();
const mysql = require("mysql2/promise");
const { createBucketClient } = require("@cosmicjs/sdk");

// Configuration
const config = {
  mysql: {
    host: "localhost",
    user: "root",
    database: "worldwidefm",
  },
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
};

// Global settings
const isDryRun = process.env.DRY_RUN === "true";

// Validate configuration
if (!config.cosmic.bucketSlug || !config.cosmic.readKey || !config.cosmic.writeKey) {
  console.error("Missing required Cosmic configuration. Please check your .env file.");
  process.exit(1);
}

// Initialize Cosmic client
const cosmic = createBucketClient(config.cosmic);

// Map Craft fields to Cosmic metafields
const fieldTypeMapping = {
  "craft\\fields\\Assets": {
    type: "file",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\fields\\PlainText": {
    type: "text",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\fields\\RichText": {
    type: "html-textarea",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\redactor\\Field": {
    type: "html-textarea",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\fields\\Date": {
    type: "date",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\fields\\Lightswitch": {
    type: "switch",
    value: false,
    options: "true,false",
    config: {
      required: false,
    },
  },
  "craft\\fields\\Entries": {
    type: "object",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\fields\\Dropdown": {
    type: "select-dropdown",
    value: "",
    config: {
      required: false,
      options: [], // Will be populated during migration
    },
  },
  "craft\\fields\\RadioButtons": {
    type: "radio-buttons",
    value: "",
    config: {
      required: false,
      options: [], // Will be populated during migration
    },
  },
  "craft\\fields\\Number": {
    type: "number",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\fields\\Matrix": {
    type: "json",
    value: [],
    config: {
      required: false,
    },
  },
  "craft\\fields\\Categories": {
    type: "objects",
    value: [],
    config: {
      required: false,
    },
  },
  "craft\\fields\\Url": {
    type: "text",
    value: "",
    config: {
      required: false,
    },
  },
  "craft\\fields\\Table": {
    type: "json",
    value: [],
    config: {
      required: false,
    },
  },
};

const matrixBlockTypeMapping = {
  fullWidthBanner: {
    type: "banner",
    fields: {
      image: { type: "image" },
      caption: { type: "text" },
    },
  },
  pageIntro: {
    type: "header",
    fields: {
      heading: { type: "text" },
      subheading: { type: "text" },
      author: { type: "text" },
    },
  },
  bodyText: {
    type: "content",
    fields: {
      content: { type: "html-textarea" },
    },
  },
  fullWidthQuote: {
    type: "quote",
    fields: {
      quote: { type: "text" },
      attribution: { type: "text" },
    },
  },
  doubleImage: {
    type: "image-grid",
    fields: {
      image1: { type: "image" },
      caption1: { type: "text" },
      image2: { type: "image" },
      caption2: { type: "text" },
    },
  },
  postsGrid: {
    type: "collection",
    fields: {
      heading: { type: "text" },
      items: { type: "objects" },
      layout: { type: "radio-buttons", options: ["vertical", "horizontal"] },
    },
  },
  announcementTicker: {
    type: "announcement",
    fields: {
      text: { type: "text" },
      style: { type: "radio-buttons", options: ["blackOnWhite", "whiteOnBlack", "blackOnYellow"] },
    },
  },
};

async function getConnection() {
  return mysql.createConnection(config.mysql);
}

async function getSections() {
  const connection = await getConnection();
  try {
    const [sections] = await connection.execute("SELECT * FROM craft_sections");
    return sections;
  } finally {
    await connection.end();
  }
}

async function getEntryTypes(sectionId) {
  const connection = await getConnection();
  try {
    const [types] = await connection.execute("SELECT * FROM craft_entrytypes WHERE sectionId = ?", [sectionId]);
    return types;
  } finally {
    await connection.end();
  }
}

async function getFields(layoutId) {
  const connection = await getConnection();
  try {
    const [fields] = await connection.execute(
      `
      SELECT f.* 
      FROM craft_fields f 
      JOIN craft_fieldlayoutfields fl ON f.id = fl.fieldId 
      WHERE fl.layoutId = ?
    `,
      [layoutId]
    );
    return fields;
  } finally {
    await connection.end();
  }
}

async function getMetafieldsForSection(section) {
  const connection = await getConnection();
  try {
    const [entryTypes] = await connection.execute("SELECT * FROM craft_entrytypes WHERE sectionId = ?", [section.id]);

    if (entryTypes.length === 0) {
      return [];
    }

    const [fields] = await connection.execute(
      `
      SELECT f.* 
      FROM craft_fields f 
      JOIN craft_fieldlayoutfields fl ON f.id = fl.fieldId 
      WHERE fl.layoutId = ?
    `,
      [entryTypes[0].fieldLayoutId]
    );

    return fields
      .map((field) => {
        const mapping = fieldTypeMapping[field.type];
        if (!mapping) {
          console.log(`No mapping found for field type: ${field.type}`);
          return null;
        }

        return {
          title: field.name,
          key: field.handle,
          type: mapping.type,
          value: mapping.value,
          required: false,
          ...(mapping.config || {}),
        };
      })
      .filter(Boolean);
  } finally {
    await connection.end();
  }
}

async function getEntries(sectionId) {
  const connection = await getConnection();
  try {
    // Get the latest version of each entry
    const [entries] = await connection.execute(
      `
      SELECT 
        e.*,
        c.*,
        GROUP_CONCAT(DISTINCT r.fieldId, ':', r.targetId) as relations,
        s.slug as entry_slug
      FROM craft_entries e
      JOIN craft_content c ON e.id = c.elementId
      JOIN craft_elements el ON e.id = el.id
      JOIN craft_elements_sites es ON e.id = es.elementId
      LEFT JOIN craft_relations r ON e.id = r.sourceId
      LEFT JOIN craft_elements_sites s ON e.id = s.elementId
      WHERE e.sectionId = ? 
      AND el.dateDeleted IS NULL
      AND es.enabled = 1
      ORDER BY e.dateCreated DESC 
      LIMIT 1
    `,
      [sectionId]
    );

    // For each entry, get its matrix blocks with their content
    for (const entry of entries) {
      const [blocks] = await connection.execute(
        `
        SELECT 
          mb.*,
          mbt.handle as type,
          mc.*
        FROM craft_matrixblocks mb
        JOIN craft_matrixblocktypes mbt ON mb.typeId = mbt.id
        JOIN craft_elements el ON mb.id = el.id
        JOIN craft_elements_sites es ON mb.id = es.elementId
        LEFT JOIN craft_matrixcontent_flexiblecontent mc ON mb.id = mc.elementId
        WHERE mb.ownerId = ?
        AND mb.fieldId = (
          SELECT id FROM craft_fields WHERE handle = 'flexibleContent'
        )
        AND el.dateDeleted IS NULL
        AND es.enabled = 1
        ORDER BY mb.sortOrder
      `,
        [entry.id]
      );

      entry.matrixBlocks = blocks;
      console.log(`Found ${blocks.length} matrix blocks for entry ${entry.id}`);
    }

    return entries;
  } finally {
    await connection.end();
  }
}

async function getFieldValue(connection, field, entry, contentColumn) {
  switch (field.type) {
    case "craft\\fields\\Assets":
      // Get asset data
      const [assets] = await connection.execute(
        `
        SELECT a.* FROM craft_assets a
        JOIN craft_relations r ON a.id = r.targetId
        WHERE r.sourceId = ? AND r.fieldId = ?
      `,
        [entry.id, field.id]
      );
      return assets.length > 0
        ? {
            url: assets[0].url,
            imgix_url: assets[0].url,
            title: assets[0].title,
            filename: assets[0].filename,
          }
        : null;

    case "craft\\fields\\Matrix":
      const blocks = entry.matrixBlocks?.filter((block) => block.fieldId === field.id) || [];
      return blocks.map((block) => ({
        type: block.type,
        fields: {
          ...block,
        },
      }));

    case "craft\\fields\\Categories":
      const categoryRelations =
        entry.relations
          ?.split(",")
          .filter((r) => r.split(":")[0] === field.id.toString())
          .map((r) => r.split(":")[1]) || [];

      if (categoryRelations.length === 0) return null;

      const [categories] = await connection.execute(
        `
        SELECT c.*, cc.title
        FROM craft_categories c
        JOIN craft_content cc ON c.id = cc.elementId
        WHERE c.id IN (?)
      `,
        [categoryRelations]
      );

      return categories.map((cat) => ({
        id: cat.id,
        title: cat.title,
        slug: cat.slug,
      }));

    case "craft\\fields\\Entries":
      const entryRelations =
        entry.relations
          ?.split(",")
          .filter((r) => r.split(":")[0] === field.id.toString())
          .map((r) => r.split(":")[1]) || [];

      if (entryRelations.length === 0) return null;

      const [relatedEntries] = await connection.execute(
        `
        SELECT e.*, c.title
        FROM craft_entries e
        JOIN craft_content c ON e.id = c.elementId
        WHERE e.id IN (?)
      `,
        [entryRelations]
      );

      return relatedEntries.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
      }));

    case "craft\\fields\\Date":
      // Special handling for broadcast dates and times
      if (field.handle.includes("broadcast_date")) {
        const date = entry[contentColumn] ? new Date(entry[contentColumn]) : null;
        return date ? date.toISOString().split("T")[0] : null;
      }
      if (field.handle.includes("broadcast_time")) {
        const date = entry[contentColumn] ? new Date(entry[contentColumn]) : null;
        return date ? date.toISOString().split("T")[1].substring(0, 5) : null;
      }
      return entry[contentColumn] ? new Date(entry[contentColumn]).toISOString() : null;

    case "craft\\fields\\Lightswitch":
      return entry[contentColumn] === "1" ? "true" : "false";

    case "craft\\fields\\Number":
      // Special handling for duration fields
      if (field.handle.includes("duration")) {
        const minutes = parseInt(entry[contentColumn]);
        return minutes ? `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, "0")}` : null;
      }
      return entry[contentColumn] ? parseFloat(entry[contentColumn]) : null;

    case "craft\\fields\\Dropdown":
      // Special handling for broadcast day field
      if (field.handle === "broadcastDay") {
        const day = entry[contentColumn]?.toUpperCase() || null;
        return day;
      }
      // Return the selected value as is - options will be populated during object type creation
      return entry[contentColumn] || null;

    case "craft\\fields\\RichText":
      // Return HTML content as is
      return entry[contentColumn] || null;

    case "craft\\fields\\Url":
      return entry[contentColumn] || null;

    default:
      // Check if the field handle contains 'link' or 'url' and treat it as a URL
      if (field.handle.toLowerCase().includes("link") || field.handle.toLowerCase().includes("url")) {
        return {
          type: "url",
          value: entry[contentColumn] || "",
        };
      }
      return entry[contentColumn] || null;
  }
}

async function createObjectType(section, isDryRun = false) {
  try {
    const objectTypeTitle = section.name;
    const objectTypeSlug = section.handle;

    // Special handling for pages with Matrix content
    const isMatrixPage = ["about", "privacy", "terms", "cookies"].includes(objectTypeSlug);

    let metafields = [];

    if (isMatrixPage) {
      metafields = [
        {
          type: "repeater",
          title: "Page Sections",
          key: "sections",
          value: [],
          required: true,
          children: [
            {
              type: "radio-buttons",
              title: "Section Type",
              key: "type",
              value: "",
              required: true,
              options: [
                { value: "banner", label: "Full Width Banner" },
                { value: "header", label: "Page Header" },
                { value: "content", label: "Body Content" },
                { value: "quote", label: "Full Width Quote" },
                { value: "image-grid", label: "Double Image Grid" },
                { value: "collection", label: "Posts Collection" },
                { value: "announcement", label: "Announcement" },
              ],
            },
            {
              type: "json",
              title: "Section Content",
              key: "content",
              value: {},
              required: true,
            },
          ],
        },
      ];
    } else {
      // Handle other section types as before
      metafields = await getMetafieldsForSection(section);
    }

    const objectType = {
      title: objectTypeTitle,
      slug: objectTypeSlug,
      metafields,
    };

    if (isDryRun) {
      console.log(`Would create object type:`, JSON.stringify(objectType, null, 2));
      return;
    }

    const response = await cosmic.objectTypes.insertOne(objectType);
    console.log(`Created object type ${objectTypeSlug}`);
    return response;
  } catch (error) {
    console.error(`Error creating object type for section ${section.handle}:`, error);
    throw error;
  }
}

async function transformMatrixContent(matrixBlocks) {
  const sections = [];

  for (const block of matrixBlocks) {
    let section = {
      type: block.type,
      content: {},
    };

    // Handle specific block types
    switch (block.type) {
      case "pageIntro":
        section.content = {
          heading: block.field_pageIntro_postHeading,
          subheading: block.field_pageIntro_postSubHeading,
          author: block.field_pageIntro_postAuthor,
        };
        break;
      case "bodyText":
        section.content = {
          content: block.field_bodyText_textContent,
        };
        break;
      case "fullWidthQuote":
        section.content = {
          quote: block.field_fullWidthQuote_quoteBody,
          attribution: block.field_fullWidthQuote_quoteAttribute,
        };
        break;
      case "fullWidthBanner":
        section.content = {
          image: block.field_fullWidthBanner_bannerImage,
          caption: block.field_fullWidthBanner_imageCaption,
        };
        break;
      case "doubleImage":
        section.content = {
          image1: block.field_doubleImage_image1,
          caption1: block.field_doubleImage_caption1,
          image2: block.field_doubleImage_image2,
          caption2: block.field_doubleImage_caption2,
        };
        break;
      case "postsGrid":
        section.content = {
          heading: block.field_postsGrid_sectionHeading,
          items: block.field_postsGrid_postItem || [],
          layout: block.field_postsGrid_gridItemLayout || "vertical",
        };
        break;
      case "announcementTicker":
        section.content = {
          text: block.field_announcementTicker_announcementText,
          style: block.field_announcementTicker_announcementBackground || "blackOnWhite",
        };
        break;
      case "fullWidthVideo":
        section.content = {
          iframe: block.field_fullWidthVideo_iframe,
        };
        break;
      case "postSingleBanner":
        section.content = {
          heading: block.field_postSingleBanner_bannerHeading,
          description: block.field_postSingleBanner_bannerDescription,
          externalLink: block.field_postSingleBanner_optionalExternalLink,
        };
        break;
      case "postDoubleBanner":
        section.content = {
          leftHeading: block.field_postDoubleBanner_leftHeading,
          leftDescription: block.field_postDoubleBanner_leftDescription,
          leftExternalLink: block.field_postDoubleBanner_optionalExternalLinkLeft,
          rightHeading: block.field_postDoubleBanner_rightHeading,
          rightDescription: block.field_postDoubleBanner_rightDescription,
          rightExternalLink: block.field_postDoubleBanner_optionalExternalLinkRight,
        };
        break;
      case "schedule":
        section.content = {
          content: block.field_schedule_scheduleContent,
          heading: block.field_schedule_scheduleHeading,
        };
        break;
      case "announcementBubble":
        section.content = {
          text: block.field_announcementBubble_announcementText,
          background: block.field_announcementBubble_announcementBackground,
        };
        break;
      case "collectionGrid":
        section.content = {
          heading: block.field_collectionGrid_sectionHeading,
        };
        break;
      case "categoryGrid":
        section.content = {
          heading: block.field_categoryGrid_sectionHeading,
        };
        break;
      default:
        console.log(`Unknown block type: ${block.type}`);
        continue;
    }

    // Clean up null or undefined values
    section.content = Object.fromEntries(Object.entries(section.content).filter(([_, value]) => value !== null && value !== undefined));

    sections.push(section);
  }

  return sections;
}

async function migrateMatrixContent(entry, section, isDryRun = false) {
  try {
    const blocks = entry.matrixBlocks || [];
    console.log(`Processing ${blocks.length} matrix blocks for entry ${entry.id}`);

    const transformedBlocks = await transformMatrixContent(blocks);

    const metadata = {
      title: entry.title,
      sections: transformedBlocks,
    };

    if (isDryRun) {
      console.log(`Would create ${section.handle} object with metadata:`, JSON.stringify(metadata, null, 2));
      return;
    }

    await cosmic.objects.insertOne({
      title: entry.title,
      type: section.handle,
      metadata,
    });

    console.log(`Created ${section.handle} object: ${entry.title}`);
  } catch (error) {
    console.error(`Error migrating matrix content for entry ${entry.id}:`, error);
    throw error;
  }
}

// Modify the main migration function to handle object types in order
async function migrateContent() {
  try {
    console.log(`Starting migration in ${isDryRun ? "DRY RUN" : "LIVE"} mode...`);

    const sections = await getSections();
    console.log(`Found ${sections.length} sections to process`);

    // Define the order of sections to process based on dependencies
    const sectionOrder = [
      // Base content types first
      "categories", // For genre tags
      "radio-shows", // For episode collections
      "watch-and-listens", // For featured content
      "articles", // For featured articles
      "moods", // For featured moods

      // Then content types that depend on them
      "episode",
      "premiumContent",
      "editorial",

      // Then matrix-based pages
      "about",
      "privacy",
      "terms",
      "cookies",

      // Then the rest in any order
      "homepage",
      "subscriptions",
      "schedule",
      "scheduleDay",
      "offers",
      "register",
      "worldwideAwards",
      "studiomonkeyshoulder",
    ];

    // If a specific section is requested, only process that one
    if (process.env.SECTION) {
      const requestedSection = sections.find((s) => s.handle.toLowerCase() === process.env.SECTION.toLowerCase());
      if (!requestedSection) {
        console.error(`Section ${process.env.SECTION} not found in database`);
        process.exit(1);
      }

      console.log(`\nProcessing section: ${requestedSection.name}`);

      // Check if this is a matrix-based page
      const isMatrixPage = ["about", "privacy", "terms", "cookies"].includes(requestedSection.handle.toLowerCase());
      if (isMatrixPage) {
        const entries = await getEntries(requestedSection.id);
        console.log(`Found ${entries.length} entries for section ${requestedSection.name}`);

        for (const entry of entries) {
          await migrateMatrixContent(entry, requestedSection, isDryRun);
        }
      } else {
        // Process regular section
        const entryTypes = await getEntryTypes(requestedSection.id);
        console.log(`Found ${entryTypes.length} entry types`);

        for (const entryType of entryTypes) {
          console.log(`\nProcessing entry type: ${entryType.name}`);

          const fields = await getFields(entryType.fieldLayoutId);
          console.log(`Found ${fields.length} fields`);

          await createObjectType(requestedSection, isDryRun);
        }
      }
      return;
    }

    // Process sections in order
    for (const sectionHandle of sectionOrder) {
      const section = sections.find((s) => s.handle.toLowerCase() === sectionHandle.toLowerCase());
      if (!section) {
        console.log(`\nSkipping section ${sectionHandle} - not found in database`);
        continue;
      }

      console.log(`\nProcessing section: ${section.name}`);

      // Check if this is a matrix-based page
      const isMatrixPage = ["about", "privacy", "terms", "cookies"].includes(sectionHandle.toLowerCase());
      if (isMatrixPage) {
        const entries = await getEntries(section.id);
        console.log(`Found ${entries.length} entries for section ${section.name}`);

        for (const entry of entries) {
          await migrateMatrixContent(entry, section, isDryRun);
        }
        continue;
      }

      // Process regular section
      const entryTypes = await getEntryTypes(section.id);
      console.log(`Found ${entryTypes.length} entry types`);

      for (const entryType of entryTypes) {
        console.log(`\nProcessing entry type: ${entryType.name}`);

        const fields = await getFields(entryType.fieldLayoutId);
        console.log(`Found ${fields.length} fields`);

        await createObjectType(section, isDryRun);
      }
    }

    // Process any remaining sections that weren't in our order
    const processedHandles = new Set(sectionOrder.map((h) => h.toLowerCase()));
    const remainingSections = sections.filter((s) => !processedHandles.has(s.handle.toLowerCase()));

    if (remainingSections.length > 0) {
      console.log("\nProcessing remaining sections:");
      for (const section of remainingSections) {
        console.log(`\nProcessing section: ${section.name}`);

        const entryTypes = await getEntryTypes(section.id);
        console.log(`Found ${entryTypes.length} entry types`);

        for (const entryType of entryTypes) {
          console.log(`\nProcessing entry type: ${entryType.name}`);

          const fields = await getFields(entryType.fieldLayoutId);
          console.log(`Found ${fields.length} fields`);

          await createObjectType(section, isDryRun);
        }
      }
    }

    console.log("\nMigration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    console.error("Error details:", error.message);
    process.exit(1);
  }
}

// Run migration
migrateContent();
