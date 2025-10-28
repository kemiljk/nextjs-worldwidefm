import { cosmic } from '@/lib/cosmic-client';
import { getEvents, RadioCultEvent } from '@/lib/radiocult-service';

interface SyncResult {
  success: boolean;
  created: number;
  skipped: number;
  errors: number;
  details: {
    created: string[];
    skipped: string[];
    errors: { show: string; error: string }[];
  };
}

/**
 * Check if an episode exists in Cosmic by RadioCult event ID or slug
 */
async function checkEpisodeExists(eventId: string, slug: string): Promise<boolean> {
  try {
    // First try to find by radiocult_event_id
    const byIdResponse = await cosmic.objects
      .find({
        type: 'episode',
      })
      .props('slug,title,metadata')
      .limit(1000); // Get a large batch to check

    const byId = byIdResponse.objects?.find(
      (obj: any) => obj.metadata?.radiocult_event_id === eventId
    );

    if (byId) {
      return true;
    }

    // Fallback: Check by slug
    try {
      const bySlug = await cosmic.objects.findOne({
        type: 'episode',
        slug: slug,
      });

      return !!bySlug.object;
    } catch {
      return false;
    }
  } catch (error) {
    console.error('Error checking if episode exists:', error);
    return false;
  }
}

/**
 * Create an episode in Cosmic from a RadioCult event
 */
async function createEpisodeFromRadioCultEvent(event: RadioCultEvent): Promise<boolean> {
  try {
    // Find or create the artist/host in Cosmic
    let hostId: string | undefined;
    
    if (event.artists && event.artists.length > 0) {
      const artist = event.artists[0];
      
      try {
        // Try to find existing host by name
        const existingHost = await cosmic.objects
          .find({
            type: 'hosts',
          })
          .props('slug,title')
          .limit(1000);
        
        const foundHost = existingHost.objects?.find(
          (h: any) => h.title?.toLowerCase() === artist.name.toLowerCase()
        );

        if (foundHost) {
          hostId = foundHost.id;
        } else {
          // Create new host
          console.log(`Creating new host: ${artist.name}`);
          const newHost = await cosmic.objects.insertOne({
            title: artist.name,
            type: 'hosts',
            slug: artist.slug,
            metadata: {
              description: artist.description || null,
              image: artist.imageUrl
                ? {
                    url: artist.imageUrl,
                  }
                : null,
            },
          });
          
          hostId = newHost.object?.id;
        }
      } catch (error) {
        console.error('Error creating/finding host:', error);
      }
    }

    // Prepare episode data
    const startDate = new Date(event.startTime);
    const broadcastDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const broadcastTime = startDate.toTimeString().slice(0, 5); // HH:MM

    // Calculate duration in MM:SS format
    const durationMinutes = Math.floor(event.duration || 0);
    const duration = `${durationMinutes}:00`;

    const episodeData: any = {
      title: event.showName || 'Untitled Show',
      type: 'episode',
      slug: event.slug,
      status: 'published',
      metadata: {
        subtitle: event.showName || null,
        description: event.description || null,
        broadcast_date: broadcastDate,
        broadcast_time: broadcastTime,
        duration: duration,
        radiocult_event_id: event.id, // Store RadioCult event ID for future reference
        source: 'radiocult-sync', // Mark as auto-synced
        featured_on_homepage: false,
      },
    };

    // Add image if available
    if (event.imageUrl) {
      episodeData.metadata.image = {
        url: event.imageUrl,
      };
    }

    // Add host relationship if we have one
    if (hostId) {
      episodeData.metadata.regular_hosts = [hostId];
    }

    // Create the episode
    console.log(`Creating episode: ${event.showName} (${event.slug})`);
    await cosmic.objects.insertOne(episodeData);

    return true;
  } catch (error) {
    console.error(`Error creating episode from RadioCult event:`, error);
    throw error;
  }
}

/**
 * Sync RadioCult events to Cosmic episodes
 * This function fetches recent/upcoming events from RadioCult and creates
 * episodes in Cosmic for any that don't already exist.
 */
export async function syncRadioCultToCosmicEpisodes(
  daysBack: number = 7,
  daysAhead: number = 30
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    created: 0,
    skipped: 0,
    errors: 0,
    details: {
      created: [],
      skipped: [],
      errors: [],
    },
  };

  try {
    console.log(`Starting RadioCult sync: ${daysBack} days back, ${daysAhead} days ahead`);

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Fetch events from RadioCult
    console.log(`Fetching RadioCult events from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    const { events } = await getEvents(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 500, // Get a large batch
      },
      true // Force refresh to avoid cache
    );

    console.log(`Found ${events.length} RadioCult events`);

    if (!events || events.length === 0) {
      console.log('No events found in RadioCult');
      result.success = true;
      return result;
    }

    // Process each event
    for (const event of events) {
      try {
        // Skip events without proper data
        if (!event.showName || !event.slug) {
          console.log(`Skipping event without name or slug:`, event.id);
          result.skipped++;
          result.details.skipped.push(`${event.id} (missing data)`);
          continue;
        }

        // Check if episode already exists
        const exists = await checkEpisodeExists(event.id, event.slug);

        if (exists) {
          console.log(`Episode already exists: ${event.showName} (${event.slug})`);
          result.skipped++;
          result.details.skipped.push(event.showName);
          continue;
        }

        // Create the episode
        await createEpisodeFromRadioCultEvent(event);
        result.created++;
        result.details.created.push(event.showName);
        console.log(`✅ Created episode: ${event.showName}`);
      } catch (error) {
        console.error(`Error processing event ${event.showName}:`, error);
        result.errors++;
        result.details.errors.push({
          show: event.showName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.success = true;
    console.log(
      `Sync complete: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors`
    );

    return result;
  } catch (error) {
    console.error('Error in syncRadioCultToCosmicEpisodes:', error);
    result.success = false;
    return result;
  }
}

