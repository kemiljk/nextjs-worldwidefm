import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Secret to prevent unauthorized revalidations
    const secret = request.nextUrl.searchParams.get("secret");
    if (secret !== process.env.REVALIDATION_SECRET) {
      console.warn("Invalid revalidation secret received");
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // Revalidate the cached Mixcloud data
    revalidateTag("mixcloud");
    console.log("Revalidated mixcloud content at", new Date().toISOString());

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      message: "Mixcloud content revalidated successfully",
    });
  } catch (error) {
    console.error("Error revalidating Mixcloud content:", error);
    return NextResponse.json(
      {
        message: "Error revalidating content",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
