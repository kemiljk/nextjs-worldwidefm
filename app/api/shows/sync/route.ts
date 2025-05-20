import { NextRequest, NextResponse } from "next/server";
import { syncApprovedShowsToRadioCult } from "@/lib/sync-radiocult";

export async function POST(request: NextRequest) {
  try {
    // Check for API key in headers (basic security)
    const apiKey = request.headers.get("x-api-key");
    const expectedApiKey = process.env.SYNC_API_KEY;

    if (!apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Execute the sync process
    const result = await syncApprovedShowsToRadioCult();

    // Return the result
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error syncing shows:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also allow GET for easier testing in development
export async function GET(request: NextRequest) {
  // Only allow this in development mode
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Execute the sync process
    const result = await syncApprovedShowsToRadioCult();

    // Return the result
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error syncing shows:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
