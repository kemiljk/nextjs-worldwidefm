import { NextResponse } from "next/server";
import { getPosts } from "@/lib/cosmic-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") || "0");
    const limit = parseInt(searchParams.get("limit") || "6");

    console.log(`[API] Fetching posts with skip: ${skip}, limit: ${limit}`);

    const postsResponse = await getPosts({
      skip,
      limit,
      sort: "-metadata.date",
      status: "published",
    });

    console.log(`[API] Found ${postsResponse.objects?.length || 0} posts`);

    if (!postsResponse.objects) {
      console.warn("[API] No posts found in response:", postsResponse);
      return NextResponse.json({ posts: [], total: 0 });
    }

    return NextResponse.json({
      posts: postsResponse.objects,
      total: postsResponse.total || 0,
    });
  } catch (error) {
    // Log the full error details
    console.error("[API] Error fetching posts:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        posts: [],
        total: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
