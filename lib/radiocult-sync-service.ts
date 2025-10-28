import { cosmic } from '@/lib/cosmic-config';
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

    // Build metadata object - only include fields that have values
    const metadata: any = {
      broadcast_date: broadcastDate,
      broadcast_time: broadcastTime,
      description:
        event.description && typeof event.description === 'string' ? event.description.trim() : '',
      genres: [],
      locations: [],
      regular_hosts: [],
      takeovers: [],
      featured_on_homepage: false,
      source: 'radiocult-sync',
      radiocult_event_id: event.id,
    };

    // Add optional fields only if they have actual values
    if (duration) {
      metadata.duration = duration;
    }

    if (event.imageUrl) {
      metadata.image = {
        url: event.imageUrl,
      };
    }

    // Add host relationship if we have one
    if (hostId) {
      metadata.regular_hosts = [hostId];
    }

    const episodeData: any = {
      title: event.showName || 'Untitled Show',
      type: 'episode',
      status: 'published',
      metadata: metadata,
    };

    // Only set slug if RadioCult provides one (otherwise Cosmic auto-generates)
    if (event.slug) {
      episodeData.slug = event.slug;
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
    // Check for required environment variables
    const requiredEnvVars = {
      NEXT_PUBLIC_RADIOCULT_STATION_ID: process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID,
      NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY,
      NEXT_PUBLIC_COSMIC_BUCKET_SLUG: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
      COSMIC_WRITE_KEY: process.env.COSMIC_WRITE_KEY,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
      console.error(errorMsg);
      result.details.errors.push({
        show: 'Environment Check',
        error: errorMsg,
      });
      return result;
    }

    console.log(`Starting RadioCult sync: ${daysBack} days back, ${daysAhead} days ahead`);

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Fetch events from RadioCult
    console.log(
      `Fetching RadioCult events from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
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
        // Extract show name - could be in different fields
        const showName = event.showName || event.title || event.name;

        // Skip events without proper data (must have at least a name)
        if (!showName) {
          console.log(`Skipping event without name:`, {
            id: event.id,
            showName: event.showName,
            title: event.title,
            name: event.name,
          });
          result.skipped++;
          result.details.skipped.push(`${event.id} (missing name)`);
          continue;
        }

        // Update event with correct showName
        event.showName = showName;

        // Generate a slug if one doesn't exist (Cosmic will auto-generate from title)
        // For checking if episode exists, use the RadioCult event ID as primary identifier
        const slugToCheck = event.slug || event.id;

        // Check if episode already exists by RadioCult event ID
        const exists = await checkEpisodeExists(event.id, slugToCheck);

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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`Error processing event ${event.showName}:`, errorMessage);
        console.error('Error stack:', errorStack);
        console.error('Event data:', JSON.stringify(event, null, 2));
        result.errors++;
        result.details.errors.push({
          show: event.showName,
          error: errorMessage,
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
