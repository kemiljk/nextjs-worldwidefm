const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'worldwidefm',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  },
  paths: {
    outputDir: path.resolve(__dirname, '../data'),
  },
  isDryRun: process.env.DRY_RUN === 'true',
};

function validateConfig() {
  const missingCosmicVars = [];
  if (!config.cosmic.bucketSlug) missingCosmicVars.push('NEXT_PUBLIC_COSMIC_BUCKET_SLUG');
  if (!config.cosmic.readKey) missingCosmicVars.push('NEXT_PUBLIC_COSMIC_READ_KEY');
  if (!config.cosmic.writeKey) missingCosmicVars.push('COSMIC_WRITE_KEY');

  if (missingCosmicVars.length > 0) {
    console.error('Missing required configuration variables:');
    console.error('Cosmic variables:', missingCosmicVars.join(', '));
    process.exit(1);
  }
}

validateConfig();

module.exports = config; 