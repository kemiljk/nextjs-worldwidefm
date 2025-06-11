import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createArtist } from "@/lib/radiocult-artist";

// Input schema validation
const createArtistSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  socialLinks: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = createArtistSchema.parse(body);

    // Create the artist in RadioCult with social links
    // Note: Image is stored in Cosmic but not sent to RadioCult during creation
    const artist = await createArtist({
      name: validatedData.name,
      description: validatedData.description,
      imageUrl: validatedData.imageUrl || undefined, // Stored for future reference
      socialLinks: validatedData.socialLinks,
    });

    if (!artist) {
      return NextResponse.json({ error: "Failed to create artist" }, { status: 500 });
    }

    // Return the created artist
    return NextResponse.json({
      success: true,
      artist,
    });
  } catch (error) {
    console.error("Error creating artist:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create artist" }, { status: 500 });
  }
}
