require("dotenv").config({ path: ".env.local" });
const { createBucketClient } = require("@cosmicjs/sdk");

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

async function checkSpecificEpisode() {
  try {
    console.log("🔍 Checking specific episode in Cosmic...");
    
    // Check the "Worldwide Breakfast: Valentine Comar" episode that showed Genres: 0
    const response = await cosmic.objects.findOne({
      type: "episode",
      slug: "worldwide-breakfast-valentine-comar-8",
      depth: 2,
    });

    if (!response.object) {
      console.log("❌ Episode not found");
      return;
    }

    const episode = response.object;
    console.log(`🎯 Episode: ${episode.title}`);
    console.log(`   Slug: ${episode.slug}`);
    console.log(`   ID: ${episode.id}`);
    
    if (episode.metadata) {
      console.log(`   📊 Metadata structure:`);
      
      // Check genres specifically
      if (episode.metadata.genres) {
        console.log(`     🎵 Genres: ${JSON.stringify(episode.metadata.genres, null, 2)}`);
        console.log(`     Genres type: ${typeof episode.metadata.genres}`);
        console.log(`     Genres is array: ${Array.isArray(episode.metadata.genres)}`);
        if (Array.isArray(episode.metadata.genres)) {
          console.log(`     Genres length: ${episode.metadata.genres.length}`);
          episode.metadata.genres.forEach((genre, index) => {
            console.log(`       Genre ${index}: ${JSON.stringify(genre, null, 2)}`);
          });
        }
      } else {
        console.log(`     🎵 Genres: undefined/null`);
      }

      // Check other fields
      if (episode.metadata.locations) {
        console.log(`     🌍 Locations: ${JSON.stringify(episode.metadata.locations, null, 2)}`);
      }
      if (episode.metadata.regular_hosts) {
        console.log(`     👤 Regular Hosts: ${JSON.stringify(episode.metadata.regular_hosts, null, 2)}`);
      }
      if (episode.metadata.takeovers) {
        console.log(`     🎭 Takeovers: ${JSON.stringify(episode.metadata.takeovers, null, 2)}`);
      }
    } else {
      console.log(`   📊 Metadata: undefined/null`);
    }

  } catch (error) {
    console.error("❌ Error checking episode:", error);
  }
}

if (require.main === module) {
  checkSpecificEpisode().catch(console.error);
}

module.exports = { checkSpecificEpisode };
