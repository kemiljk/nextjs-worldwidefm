"use server";

import { cosmic } from "./cosmic-config";
import { RadioShowObject } from "./cosmic-config";

// Function to check for approved shows that need to be synced to RadioCult
export async function syncApprovedShowsToRadioCult() {
  try {
    // Find radio shows that are:
    // 1. Published (approved)
    // 2. Don't have radiocult_synced flag or it's set to false
    const response = await cosmic.objects
      .find({
        type: "episodes",
        status: "published",
        $or: [{ "metadata.radiocult_synced": { $exists: false } }, { "metadata.radiocult_synced": false }],
      })
      .props("id,slug,title,metadata")
      .limit(50);

    const pendingShows = response.objects as RadioShowObject[];
    console.log(`Found ${pendingShows.length} shows to sync to RadioCult`);

    // Process each show
    for (const show of pendingShows) {
      await syncShowToRadioCult(show);
    }

    return { success: true, syncedCount: pendingShows.length };
  } catch (error) {
    console.error("Error syncing shows to RadioCult:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Function to sync a single show to RadioCult
async function syncShowToRadioCult(show: RadioShowObject) {
  try {
    // Get any custom metadata from the show
    const customMetadata = show.metadata as any;

    // RadioCult API requires a secret key for updates
    const RADIOCULT_SECRET_KEY = process.env.RADIOCULT_SECRET_KEY;
    const STATION_ID = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
    const RADIOCULT_API_BASE_URL = "https://api.radiocult.fm";

    if (!RADIOCULT_SECRET_KEY || !STATION_ID) {
      console.error("Missing RadioCult API credentials");
      return { success: false, error: "Missing API credentials" };
    }

    // Check if we're creating or updating an event
    const existingEventId = customMetadata.radiocult_event_id;
    let method = "POST";
    let endpoint = `/api/station/${STATION_ID}/events`;

    if (existingEventId) {
      method = "PATCH";
      endpoint = `/api/station/${STATION_ID}/events/${existingEventId}`;
    }

    // Calculate the event end time (start time + duration)
    const startTime = new Date(customMetadata.broadcast_date);
    const durationMinutes = parseInt(customMetadata.duration.split(":")[0], 10) || 60;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    // Prepare the data for RadioCult
    const eventData = {
      name: show.title,
      description: customMetadata.description || "",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      artistIds: [customMetadata.radiocult_artist_id],
      tags: customMetadata.radiocult_tag_ids || customMetadata.genres?.map((g: any) => g.title) || [],
    };

    // Send the request to RadioCult
    const response = await fetch(`${RADIOCULT_API_BASE_URL}${endpoint}`, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RADIOCULT_SECRET_KEY,
      },
      body: JSON.stringify(eventData),
    });

    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to ${method === "POST" ? "create" : "update"} RadioCult event:`, errorText);
      return { success: false, error: `API error: ${response.status} ${errorText}` };
    }

    // Parse the response to get the event ID
    const data = await response.json();
    const eventId = existingEventId || data.event?.id || data.id;

    if (!eventId) {
      console.error("No event ID in response:", data);
      return { success: false, error: "No event ID in response" };
    }

    // Update the Cosmic object to mark it as synced and store the event ID
    await cosmic.objects.updateOne(show.id, {
      metadata: {
        ...customMetadata,
        radiocult_event_id: eventId,
        radiocult_synced: true,
        radiocult_synced_at: new Date().toISOString(),
      },
    });

    console.log(`Successfully ${method === "POST" ? "created" : "updated"} RadioCult event ${eventId} for show ${show.id}`);

    // Create or update Episode object for this RadioCult show
    await createOrUpdateEpisodeObject(show, eventId, customMetadata);

    return { success: true, eventId };
  } catch (error) {
    console.error(`Error syncing show ${show.id} to RadioCult:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Function to create or update an Episode object for a RadioCult show
async function createOrUpdateEpisodeObject(show: RadioShowObject, eventId: string, customMetadata: any) {
  try {
    // Check if Episode object already exists for this RadioCult event
    const existingEpisode = await cosmic.objects.findOne({
      type: "episode",
      "metadata.radiocult_event_id": eventId,
    });

    const episodeData = {
      title: show.title,
      slug: show.slug,
      type: "episode",
      status: "published",
      metadata: {
        radiocult_event_id: eventId,
        radiocult_show_id: customMetadata.radiocult_show_id || null,
        radiocult_artist_id: customMetadata.radiocult_artist_id || null,
        radiocult_synced: true,
        radiocult_synced_at: new Date().toISOString(),
        broadcast_date: customMetadata.broadcast_date || null,
        broadcast_time: customMetadata.broadcast_time || null,
        duration: customMetadata.duration || null,
        description: customMetadata.description || null,
        image: customMetadata.image || null,
        player: customMetadata.player || null,
        tracklist: customMetadata.tracklist || null,
        body_text: customMetadata.body_text || null,
        genres: customMetadata.genres || [],
        locations: customMetadata.locations || [],
        regular_hosts: customMetadata.regular_hosts || [],
        takeovers: customMetadata.takeovers || [],
        featured_on_homepage: customMetadata.featured_on_homepage || false,
        source: "radiocult",
      },
    };

    if (existingEpisode?.object) {
      // Update existing Episode object
      await cosmic.objects.updateOne(existingEpisode.object.id, episodeData);
      console.log(`Updated Episode object for RadioCult event ${eventId}`);
    } else {
      // Create new Episode object
      await cosmic.objects.insertOne(episodeData);
      console.log(`Created new Episode object for RadioCult event ${eventId}`);
    }
  } catch (error) {
    console.error(`Error creating/updating Episode object for RadioCult event ${eventId}:`, error);
  }
}
