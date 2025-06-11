import { cosmic } from "@/lib/cosmic-config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getArtist, getTags } from "@/lib/radiocult-service";

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
  locationId: z.string().optional(),
  locationType: z.string().optional(),
});

// Helper function to remove null/undefined/empty values from metadata
function cleanMetadata(metadata: any): any {
  const cleaned: any = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Skip null, undefined, or empty values
    if (value === null || value === undefined) {
      continue;
    }

    // For strings, only include non-empty strings
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }

    // For arrays, only include non-empty arrays
    if (Array.isArray(value) && value.length === 0) {
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
    });

    // Get artist details from RadioCult
    const artist = await getArtist(validatedData.artistId);

    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    // Get all available tags from RadioCult
    const allTags = await getTags(false, true);

    // Format tags for Cosmic
    // Current timestamp for created/modified/published dates
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

    // Handle location if provided
    let locationObjects: any[] = [];
    if (validatedData.locationId) {
      console.log(`📍 Processing location: ID="${validatedData.locationId}", type="${validatedData.locationType}"`);

      // For now, use the locationId as the location title
      // In the future, you might want to map this to actual country/city names
      let locationTitle = validatedData.locationId;

      // If it looks like an ID (contains hyphens), try to make it more readable
      if (locationTitle.includes("-")) {
        locationTitle = locationTitle.split("-").pop() || locationTitle;
      }

      console.log(`📍 Creating/finding location: "${locationTitle}"`);
      const locationObj = await getOrCreateObject("locations", locationTitle);
      if (locationObj) {
        // For Cosmic object relationships, we need to send the ID, not the full object
        locationObjects = [locationObj.id];
        console.log(`✅ Location added: "${locationTitle}" (ID: ${locationObj.id})`);
      } else {
        console.log(`❌ Failed to create/find location: "${locationTitle}"`);
      }
    }

    // Handle tags - map to Tags object type instead of genres
    const tagObjects = [];
    for (const tagId of validatedData.tags) {
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) {
        console.log(`🏷️ Creating/finding tag: "${tag.name}"`);
        const tagObj = await getOrCreateObject("tags", tag.name);
        if (tagObj) {
          // For Cosmic object relationships, we need to send the ID, not the full object
          tagObjects.push(tagObj.id);
          console.log(`✅ Tag added: "${tag.name}" (ID: ${tagObj.id})`);
        } else {
          console.log(`❌ Failed to create/find tag: "${tag.name}"`);
        }
      }
    }
    console.log(`📊 Total tags processed: ${tagObjects.length}`);

    // Create metadata for the Cosmic object - only including fields with valid values
    const rawMetadata: any = {
      subtitle: validatedData.title,
      featured_on_homepage: validatedData.featuredOnHomepage,
      // Store scheduling information
      broadcast_date: broadcastDate.toISOString().split("T")[0],
      broadcast_time: broadcastTime,
      duration: `${validatedData.duration}:00`,
      source: "user-created-with-radiocult-sync",
    };

    // Only add optional fields if they have valid values
    if (validatedData.description && validatedData.description.trim()) {
      rawMetadata.description = validatedData.description.trim();
    }

    if (validatedData.tracklist && validatedData.tracklist.trim()) {
      rawMetadata.tracklist = validatedData.tracklist.trim();
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

    // Add array fields only if they have content
    if (tagObjects.length > 0) {
      rawMetadata.tags = tagObjects;
    }

    if (locationObjects.length > 0) {
      rawMetadata.locations = locationObjects;
    }

    if (hostObjects.length > 0) {
      rawMetadata.regular_hosts = hostObjects;
    }

    // Clean metadata to remove any null/undefined values
    const metadata = cleanMetadata(rawMetadata);

    // Log final summary
    console.log(`📋 Final show metadata summary:`);
    console.log(`  - Tags: ${metadata.tags ? metadata.tags.length : 0}`);
    console.log(`  - Locations: ${metadata.locations ? metadata.locations.length : 0}`);
    console.log(`  - Hosts: ${metadata.regular_hosts ? metadata.regular_hosts.length : 0}`);

    // Create the new object in Cosmic
    console.log("Creating Cosmic object with metadata:", JSON.stringify(metadata, null, 2));

    try {
      const cosmicResponse = await cosmic.objects.insertOne({
        type: "radio-shows",
        title: validatedData.title,
        slug: `${validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(16)}`,
        status: validatedData.status,
        metadata,
      });

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
          subtitle: validatedData.title,
          featured_on_homepage: false,
          broadcast_date: broadcastDate.toISOString().split("T")[0],
          broadcast_time: broadcastTime,
          duration: `${validatedData.duration}:00`,
          source: "user-created",
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
          const retryResponse = await cosmic.objects.insertOne({
            type: "radio-shows",
            title: validatedData.title,
            slug: `${validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(16)}`,
            status: validatedData.status,
            metadata: minimalMetadata,
          });

          return NextResponse.json({
            success: true,
            object: retryResponse.object,
            warning: "Show created with minimal metadata due to object type constraints",
          });
        } catch (secondError: any) {
          console.error("Second retry failed, creating basic object:", secondError);

          // Last resort: create with no metadata
          const basicResponse = await cosmic.objects.insertOne({
            type: "radio-shows",
            title: validatedData.title,
            slug: `${validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(16)}`,
            status: validatedData.status,
          });

          return NextResponse.json({
            success: true,
            object: basicResponse.object,
            warning: "Show created with title only - Cosmic object type needs metafield configuration",
            note: "To store full show data, please configure the 'radio-shows' object type in Cosmic with required metafields like: broadcast_date, broadcast_time, broadcast_day, duration, radiocult_artist_id, etc.",
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
