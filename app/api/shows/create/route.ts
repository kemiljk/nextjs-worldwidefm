import { cosmic } from "@/lib/cosmic-config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getArtist } from "@/lib/radiocult-service";

// Input schema validation
const createShowSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  artistId: z.string(),
  startDate: z.string(),
  startTime: z.string(),
  duration: z.string(),
  tracklist: z.string().optional(),
  extraDetails: z.string().optional(),
  tags: z.array(z.string()).default([]),
  featuredOnHomepage: z.boolean().default(false),
  status: z.string().default("draft"),
  radiocult_media_id: z.string().nullable().optional(),
  media_file: z.any().nullable().optional(),
  image: z.any().nullable().optional(),
  location: z.string().optional(),
});

// Helper function to remove null/undefined/empty values from metadata
function cleanMetadata(metadata: any): any {
  const cleaned: any = {};

  // Relationship fields should be preserved even if empty
  const relationshipFields = ["genres", "locations", "regular_hosts", "takeovers"];

  for (const [key, value] of Object.entries(metadata)) {
    // Skip null, undefined values
    if (value === null || value === undefined) {
      continue;
    }

    // For strings, only include non-empty strings
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }

    // For arrays, preserve relationship fields even if empty, otherwise skip empty arrays
    if (Array.isArray(value)) {
      if (value.length === 0 && !relationshipFields.includes(key)) {
        continue;
      }
      cleaned[key] = value;
      continue;
    }

    // For objects, recursively clean and only include if not empty
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      const cleanedObj = cleanMetadata(value);
      if (Object.keys(cleanedObj).length > 0) {
        cleaned[key] = cleanedObj;
      }
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = createShowSchema.parse(body);

    console.log("📥 Show creation request received:", {
      title: validatedData.title,
      hasRadiocultMediaId: !!validatedData.radiocult_media_id,
      radiocultMediaId: validatedData.radiocult_media_id,
      radiocultMediaIdType: typeof validatedData.radiocult_media_id,
      hasMediaFile: !!validatedData.media_file,
      mediaFileType: typeof validatedData.media_file,
      mediaFileStructure: validatedData.media_file ? Object.keys(validatedData.media_file) : null,
      hasImage: !!validatedData.image,
      imageStructure: validatedData.image ? Object.keys(validatedData.image) : null,
    });

    // Get artist details from RadioCult
    const artist = await getArtist(validatedData.artistId);

    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    // Get all available genres from Cosmic (tags field now contains genre IDs)
    let allGenres: any[] = [];
    try {
      const genresResponse = await cosmic.objects.find({
        type: "genres",
        props: "id,slug,title",
        limit: 1000,
      });
      allGenres = genresResponse.objects || [];
    } catch (error) {
      console.error("Error fetching genres:", error);
    }

    const now = new Date().toISOString();
    const bucketSlug = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "";

    // Calculate broadcast date from startDate and startTime
    const broadcastDate = new Date(`${validatedData.startDate}T${validatedData.startTime}`);

    // Format broadcast time and day
    const broadcastTime = broadcastDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const broadcastDay = broadcastDate.toLocaleDateString([], { weekday: "long" });

    // Helper function to get or create a Cosmic object by title
    async function getOrCreateObject(type: string, title: string, additionalData: any = {}) {
      try {
        // First, try to find existing object by title
        try {
          const existingResponse = await cosmic.objects
            .find({
              type,
              title,
            })
            .limit(1);

          if (existingResponse.objects && existingResponse.objects.length > 0) {
            console.log(`✅ Found existing ${type}: "${title}" (ID: ${existingResponse.objects[0].id})`);
            return existingResponse.objects[0];
          }
        } catch (findError: any) {
          // 404 is expected when no objects exist - not an error, just means we need to create
          if (findError.status !== 404) {
            console.error(`❌ Unexpected error finding ${type} "${title}":`, findError);
            return null;
          }
          console.log(`🔍 No existing ${type} found for "${title}" (404 is expected)`);
        }

        console.log(`🆕 Creating new ${type}: "${title}"`);

        // Create new object
        const createData = {
          type,
          title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          status: "published",
          ...additionalData,
        };

        console.log(`📤 Creating ${type} with data:`, JSON.stringify(createData, null, 2));

        const createResponse = await cosmic.objects.insertOne(createData);

        if (createResponse && createResponse.object) {
          console.log(`✅ Successfully created ${type}: "${title}" (ID: ${createResponse.object.id})`);
          return createResponse.object;
        } else {
          console.error(`❌ No object returned from creation for ${type}: "${title}"`);
          return null;
        }
      } catch (error: any) {
        console.error(`❌ Error in getOrCreateObject for ${type} "${title}":`, error);
        return null;
      }
    }

    // Handle location if provided (location is a slug from the form)
    let locationObjects: any[] = [];
    if (validatedData.location) {
      console.log(`📍 Processing location slug: "${validatedData.location}"`);

      try {
        // Try to find the existing location by slug
        const locationResponse = await cosmic.objects
          .find({
            type: "locations",
            slug: validatedData.location,
          })
          .limit(1);

        if (locationResponse.objects && locationResponse.objects.length > 0) {
          const locationObj = locationResponse.objects[0];
          locationObjects = [locationObj.id];
          console.log(`✅ Location found: "${locationObj.title}" (ID: ${locationObj.id})`);
        } else {
          console.log(`❌ Location not found for slug: "${validatedData.location}"`);
        }
      } catch (error) {
        console.error(`❌ Error finding location: "${validatedData.location}"`, error);
      }
    }

    // Handle genres - the tags field now contains Cosmic genre IDs
    const genreObjects = [];
    for (const genreId of validatedData.tags) {
      const genre = allGenres.find((g) => g.id === genreId);
      if (genre) {
        console.log(`🎵 Adding genre: "${genre.title}" (ID: ${genre.id})`);
        // For Cosmic object relationships, we need to send the ID
        genreObjects.push(genre.id);
        console.log(`✅ Genre added: "${genre.title}" (ID: ${genre.id})`);
      } else {
        console.log(`❌ Genre not found for ID: "${genreId}"`);
      }
    }
    console.log(`📊 Total genres processed: ${genreObjects.length}`);

    // Create metadata for the Cosmic object - only including fields with valid values
    const rawMetadata: any = {
      featured_on_homepage: validatedData.featuredOnHomepage,
      broadcast_date: broadcastDate.toISOString().split("T")[0],
      broadcast_time: broadcastTime,
      duration: `${validatedData.duration}:00`,
      source: "user-created-with-radiocult-sync",
      radiocult_artist_id: validatedData.artistId,
      radiocult_synced: false,
    };

    // Only add optional fields if they have valid values
    if (validatedData.description && validatedData.description.trim()) {
      rawMetadata.description = validatedData.description.trim();
    }

    if (validatedData.tracklist) {
      rawMetadata.tracklist = validatedData.tracklist;
    }

    if (validatedData.extraDetails && validatedData.extraDetails.trim()) {
      rawMetadata.body_text = validatedData.extraDetails.trim();
    }

    if (validatedData.radiocult_media_id) {
      rawMetadata.radiocult_media_id = validatedData.radiocult_media_id;
    }

    if (validatedData.media_file) {
      // For Cosmic files field: extract media name and format as array
      if (validatedData.media_file.name) {
        rawMetadata.media_file = [validatedData.media_file.name];
      } else if (typeof validatedData.media_file === "string") {
        rawMetadata.media_file = [validatedData.media_file];
      }
    }

    // Handle image - store the filename for Cosmic file metafield
    let thumbnailName: string | undefined = undefined;
    if (validatedData.image && validatedData.image.media) {
      // For Cosmic file metafields, we need to send the filename
      rawMetadata.image = validatedData.image.media.name;
      thumbnailName = validatedData.image.media.name;
      console.log(`🖼️ Image uploaded: "${thumbnailName}" (URL: ${validatedData.image.media.url})`);
    }

    // Handle hosts - find or create host objects
    let hostObjects: any[] = [];
    if (artist) {
      console.log(`👤 Processing host: "${artist.name}"`);

      const hostObj = await getOrCreateObject("regular-hosts", artist.name);
      if (hostObj) {
        // For Cosmic object relationships, we need to send the ID, not the full object
        hostObjects = [hostObj.id];
        console.log(`✅ Host added: "${artist.name}" (ID: ${hostObj.id})`);
      } else {
        console.log(`❌ Failed to create/find host: "${artist.name}"`);
      }
    }

    // Add relationship arrays - include them even if empty so Cosmic knows they exist
    rawMetadata.genres = genreObjects;
    rawMetadata.locations = locationObjects;
    rawMetadata.regular_hosts = hostObjects;
    rawMetadata.takeovers = [];

    // Clean metadata to remove any null/undefined values
    const metadata = cleanMetadata(rawMetadata);

    // Log final summary
    console.log(`📋 Final show metadata summary:`);
    console.log(`  - Genres: ${metadata.genres ? metadata.genres.length : 0}`);
    console.log(`  - Locations: ${metadata.locations ? metadata.locations.length : 0}`);
    console.log(`  - Hosts: ${metadata.regular_hosts ? metadata.regular_hosts.length : 0}`);

    // Create the new object in Cosmic
    console.log("Creating Cosmic object with metadata:", JSON.stringify(metadata, null, 2));

    try {
      const objectData: any = {
        type: "episode",
        title: validatedData.title,
        slug: `${validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(16)}`,
        status: validatedData.status,
        metadata,
      };

      // Set thumbnail if image was uploaded
      if (thumbnailName) {
        objectData.thumbnail = thumbnailName;
      }

      const cosmicResponse = await cosmic.objects.insertOne(objectData);

      return NextResponse.json({
        success: true,
        object: cosmicResponse.object,
      });
    } catch (cosmicError: any) {
      console.error("Cosmic creation error:", cosmicError);

      // If it's a metafield validation error, try with minimal metadata
      if (cosmicError.message && cosmicError.message.includes("metafield")) {
        console.log("Retrying with minimal metadata...");

        const rawMinimalMetadata: any = {
          featured_on_homepage: false,
          broadcast_date: broadcastDate.toISOString().split("T")[0],
          broadcast_time: broadcastTime,
          duration: `${validatedData.duration}:00`,
          source: "user-created",
          radiocult_synced: false,
        };

        // Only add description if provided
        if (validatedData.description) {
          rawMinimalMetadata.description = validatedData.description;
        }

        // Only add media fields if they have values
        if (validatedData.radiocult_media_id) {
          rawMinimalMetadata.radiocult_media_id = validatedData.radiocult_media_id;
        }

        if (validatedData.media_file) {
          // For Cosmic files field: extract media name and format as array
          if (validatedData.media_file.name) {
            rawMinimalMetadata.media_file = [validatedData.media_file.name];
          } else if (typeof validatedData.media_file === "string") {
            rawMinimalMetadata.media_file = [validatedData.media_file];
          }
        }

        const minimalMetadata = cleanMetadata(rawMinimalMetadata);

        try {
          const retryData: any = {
            type: "episode",
            title: validatedData.title,
            slug: `${validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(16)}`,
            status: validatedData.status,
            metadata: minimalMetadata,
          };

          if (thumbnailName) {
            retryData.thumbnail = thumbnailName;
          }

          const retryResponse = await cosmic.objects.insertOne(retryData);

          return NextResponse.json({
            success: true,
            object: retryResponse.object,
            warning: "Show created with minimal metadata due to object type constraints",
          });
        } catch (secondError: any) {
          console.error("Second retry failed, creating basic object:", secondError);

          // Last resort: create with no metadata
          const basicData: any = {
            type: "episode",
            title: validatedData.title,
            slug: `${validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(16)}`,
            status: validatedData.status,
          };

          if (thumbnailName) {
            basicData.thumbnail = thumbnailName;
          }

          const basicResponse = await cosmic.objects.insertOne(basicData);

          return NextResponse.json({
            success: true,
            object: basicResponse.object,
            warning: "Show created with title only - Cosmic object type needs metafield configuration",
            note: "To store full show data, please configure the 'episode' object type in Cosmic with required metafields like: broadcast_date, broadcast_time, broadcast_day, duration, radiocult_artist_id, etc.",
          });
        }
      }

      throw cosmicError;
    }
  } catch (error) {
    console.error("Error creating show:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create show" }, { status: 500 });
  }
}
