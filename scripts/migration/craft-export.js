const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const config = {
  craftUrl: process.env.CRAFT_URL || 'http://your-craft-site.com',
  craftToken: process.env.CRAFT_TOKEN, // You'll need to create this in Craft's admin panel
  outputDir: path.join(__dirname, '../data/craft-export')
};

async function fetchEntries(section) {
  try {
    const response = await axios.get(`${config.craftUrl}/api/entries/${section}`, {
      headers: {
        Authorization: `Bearer ${config.craftToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${section}:`, error.message);
    return null;
  }
}

async function fetchAssets() {
  try {
    const response = await axios.get(`${config.craftUrl}/api/assets`, {
      headers: {
        Authorization: `Bearer ${config.craftToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching assets:', error.message);
    return null;
  }
}

async function exportAll() {
  try {
    // Create output directory
    await fs.mkdir(config.outputDir, { recursive: true });

    // Get sections structure first
    const sections = await fetchEntries('sections');
    await fs.writeFile(
      path.join(config.outputDir, 'sections.json'),
      JSON.stringify(sections, null, 2)
    );

    // Get all entries for each section
    if (sections && sections.data) {
      for (const section of sections.data) {
        const entries = await fetchEntries(section.handle);
        if (entries) {
          await fs.writeFile(
            path.join(config.outputDir, `${section.handle}.json`),
            JSON.stringify(entries, null, 2)
          );
        }
      }
    }

    // Get all assets
    const assets = await fetchAssets();
    if (assets) {
      await fs.writeFile(
        path.join(config.outputDir, 'assets.json'),
        JSON.stringify(assets, null, 2)
      );
    }

    console.log('Export completed! Check the data/craft-export directory.');
  } catch (error) {
    console.error('Export failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  if (!config.craftToken) {
    console.error('Please set CRAFT_TOKEN environment variable');
    process.exit(1);
  }
  exportAll();
} 