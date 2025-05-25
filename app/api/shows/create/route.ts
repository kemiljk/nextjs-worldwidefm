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
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = createShowSchema.parse(body);

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

    // Map tag IDs to Cosmic genre format
    const genreObjects = validatedData.tags
      .map((tagId) => {
        const tag = allTags.find((t) => t.id === tagId);
        if (tag) {
          const slug = tag.name.toLowerCase().replace(/\s+/g, "-");
          return {
            id: tagId, // Use the actual tag ID
            slug: slug,
            title: tag.name,
            content: "",
            bucket: bucketSlug,
            created_at: now,
            modified_at: now,
            status: "published",
            published_at: now,
            type: "genres",
            metadata: {
              description: null,
              image: null,
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    // Calculate broadcast date from startDate and startTime
    const broadcastDate = new Date(`${validatedData.startDate}T${validatedData.startTime}`);

    // Format broadcast time and day
    const broadcastTime = broadcastDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const broadcastDay = broadcastDate.toLocaleDateString([], { weekday: "long" });

    // Create metadata for the Cosmic object
    const metadata = {
      subtitle: validatedData.title,
      description: validatedData.description || null,
      featured_on_homepage: validatedData.featuredOnHomepage,
      image: null, // Set to null initially
      // If the show has a tracklist, format it properly
      tracklist: validatedData.tracklist ? validatedData.tracklist.trim().split("\n").join("<br />") : null,
      body_text: validatedData.extraDetails || null,
      // Store scheduling information
      broadcast_date: broadcastDate.toISOString(),
      broadcast_time: broadcastTime,
      broadcast_day: broadcastDay,
      duration: `${validatedData.duration}:00`,
      // Store RadioCult references
      radiocult_artist_id: validatedData.artistId,
      radiocult_tag_ids: validatedData.tags,
      // Format tags as genre objects in Cosmic format
      genres: genreObjects,
      // Add the artist as a host
      regular_hosts: artist
        ? [
            {
              id: artist.id,
              slug: artist.slug,
              title: artist.name,
              content: artist.description || "",
              bucket: bucketSlug,
              created_at: now,
              modified_at: now,
              published_at: now,
              status: "published",
              type: "hosts",
              metadata: {
                description: artist.description || null,
                image: artist.imageUrl
                  ? {
                      url: artist.imageUrl,
                      imgix_url: artist.imageUrl,
                    }
                  : null,
              },
            },
          ]
        : [],
      // Set other required fields
      locations: [],
      takeovers: [],
      player: null,
      page_link: null,
      source: "user-created",
    };

    // Create the new object in Cosmic
    const cosmicResponse = await cosmic.objects.insertOne({
      type: "radio-shows",
      title: validatedData.title,
      slug: `${validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(16)}`,
      status: validatedData.status,
      metadata,
    });

    // Return the created object
    return NextResponse.json({
      success: true,
      object: cosmicResponse.object,
    });
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
