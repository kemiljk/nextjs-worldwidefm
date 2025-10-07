import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("🚀 Starting episode image migration via Vercel cron...");

    // Import the migration function dynamically
    const { migrateEpisodeImages } = await import("../../../scripts/migrate-episode-images.js");
    
    // Run the migration
    await migrateEpisodeImages(false); // false = not a dry run

    console.log("✅ Episode image migration completed successfully");

    return NextResponse.json({
      success: true,
      message: "Episode image migration completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in image migration cron job:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
