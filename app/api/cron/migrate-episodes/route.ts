import { NextRequest, NextResponse } from 'next/server';
import { createBucketClient } from '@cosmicjs/sdk';

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG!,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY!,
  writeKey: process.env.COSMIC_WRITE_KEY!,
});

async function getMostRecentEpisodeDate(): Promise<string | null> {
  try {
    // Get the most recent episode from Cosmic
    const response = await cosmic.objects.find({
      type: "episode",
      status: "published",
      "metadata.source": "migrated_from_craft",
      sort: "-metadata.broadcast_date",
      limit: 1,
      props: "metadata.broadcast_date"
    });

    if (response && response.objects && response.objects.length > 0) {
      const mostRecent = response.objects[0];
      return mostRecent.metadata?.broadcast_date || null;
    }

    return null;
  } catch (error) {
    console.error("Error getting most recent episode date:", error);
    return null;
  }
}

async function fetchEpisodesFromCraft(afterDate: string | null, limit: number = 50) {
  try {
    console.log(`🔍 Fetching episodes from Craft CMS after: ${afterDate || 'beginning of time'}`);

    // Build the GraphQL query
    let query = `
      query {
        entries(type: "episode", limit: ${limit}) {
          id
          title
          slug
          broadcastDate
          broadcastTime
          duration
          description
          thumbnail {
            url
            filename
            id
          }
          tracklist
          bodyText
          categories {
            id
            title
            slug
            groupId
          }
          locations {
            id
            title
            slug
          }
          hosts {
            id
            title
            slug
          }
          takeovers {
            id
            title
            slug
          }
          featuredOnHomepage
          player
          dateCreated
          dateUpdated
        }
      }
    `;

    // If we have a date, filter episodes after that date
    if (afterDate) {
      query = `
        query {
          entries(type: "episode", limit: ${limit}, after: "${afterDate}") {
            id
            title
            slug
            broadcastDate
            broadcastTime
            duration
            description
            thumbnail {
              url
              filename
              id
            }
            tracklist
            bodyText
            categories {
              id
              title
              slug
              groupId
            }
            locations {
              id
              title
              slug
            }
            hosts {
              id
              title
              slug
            }
            takeovers {
              id
              title
              slug
            }
            featuredOnHomepage
            player
            dateCreated
            dateUpdated
          }
        }
      `;
    }

    const response = await fetch(process.env.CRAFT_GRAPHQL_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(data.errors, null, 2));
      throw new Error(JSON.stringify(data.errors, null, 2));
    }

    const episodes = data.data.entries || [];
    console.log(`✅ Found ${episodes.length} episodes from Craft CMS`);
    
    return episodes;
  } catch (error) {
    console.error("❌ Failed to fetch episodes from Craft:", error);
    return [];
  }
}

async function migrateEpisodes(episodes: any[]) {
  try {
    let created = 0;
    let failed = 0;

    for (const episode of episodes) {
      console.log(`\n🎯 Processing episode: ${episode.title} (${episode.slug})`);

      // Check if episode already exists in Cosmic
      try {
        const existingEpisode = await cosmic.objects.findOne({
          type: "episode",
          slug: episode.slug,
        });

        if (existingEpisode) {
          console.log(`   ⚠️ Episode already exists in Cosmic: ${episode.title}`);
          continue;
        }
      } catch (error) {
        // Episode doesn't exist, continue
      }

      // Handle thumbnail and create media item
      let mediaItem = null;
      if (episode.thumbnail && Array.isArray(episode.thumbnail) && episode.thumbnail.length > 0) {
        const thumbnail = episode.thumbnail[0];
        if (thumbnail.url && thumbnail.filename) {
          // For now, we'll skip media handling in the cron job
          // as it requires file downloads and uploads
          console.log(`   📸 Media handling skipped in cron job for: ${episode.title}`);
        }
      }

      // Create episode in Cosmic (without media for now)
      try {
        const episodeData = {
          title: episode.title,
          slug: episode.slug,
          type: "episode",
          metadata: {
            broadcast_date: episode.broadcastDate,
            body_text: episode.bodyText || null,
            featured_on_homepage: episode.featuredOnHomepage || false,
            source: "migrated_from_craft",
            radiocult_synced: false,
          },
          thumbnail: null, // Will be updated later when media is handled
        };

        // Add optional fields if they have values
        if (episode.broadcastTime) {
          episodeData.metadata.broadcast_time = episode.broadcastTime;
        }
        if (episode.duration) {
          episodeData.metadata.duration = episode.duration;
        }
        if (episode.description) {
          episodeData.metadata.description = episode.description;
        }
        if (episode.player) {
          episodeData.metadata.player = episode.player;
        }
        if (episode.tracklist) {
          episodeData.metadata.tracklist = episode.tracklist;
        }

        const result = await cosmic.objects.insertOne({
          ...episodeData,
          status: "published",
        });

        if (result && result.object) {
          console.log(`   ✅ Successfully created episode: ${result.object.title}`);
          created++;
        } else {
          console.log(`   ❌ Failed to create episode: ${episode.title}`);
          failed++;
        }
      } catch (error) {
        console.error(`   ❌ Error creating episode ${episode.title}:`, error);
        failed++;
      }
    }

    return { created, failed };
  } catch (error) {
    console.error("❌ Error in migration process:", error);
    return { created: 0, failed: 0 };
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("🚀 Starting automated episode migration...");

    // Get the most recent episode date from Cosmic
    const mostRecentDate = await getMostRecentEpisodeDate();
    console.log(`📅 Most recent episode date in Cosmic: ${mostRecentDate || 'None'}`);

    // Fetch new episodes from Craft CMS
    const episodes = await fetchEpisodesFromCraft(mostRecentDate, 100);
    
    if (episodes.length === 0) {
      console.log("✅ No new episodes found to migrate");
      return NextResponse.json({ 
        success: true, 
        message: "No new episodes found",
        episodesProcessed: 0 
      });
    }

    console.log(`🔧 Found ${episodes.length} new episodes to migrate`);

    // Migrate the episodes
    const result = await migrateEpisodes(episodes);

    console.log(`🎉 Migration completed! Created: ${result.created}, Failed: ${result.failed}`);

    return NextResponse.json({
      success: true,
      message: "Episode migration completed",
      episodesProcessed: episodes.length,
      created: result.created,
      failed: result.failed,
      mostRecentDate,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error in cron job:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
