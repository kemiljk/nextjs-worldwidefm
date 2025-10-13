import { revalidateTag, revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Secret to prevent unauthorized revalidations
    const secret = request.nextUrl.searchParams.get("secret");
    if (secret !== process.env.REVALIDATION_SECRET) {
      console.warn("Invalid revalidation secret received");
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // Get optional parameters from query or body
    const tag = request.nextUrl.searchParams.get("tag");
    const path = request.nextUrl.searchParams.get("path");
    const type = request.nextUrl.searchParams.get("type"); // 'page' or 'layout'
    
    let body;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const revalidatedItems: string[] = [];

    // Revalidate by tag if specified
    if (tag || body.tag) {
      const tagToRevalidate = tag || body.tag;
      revalidateTag(tagToRevalidate);
      revalidatedItems.push(`tag:${tagToRevalidate}`);
      console.log(`Revalidated tag: ${tagToRevalidate}`);
    }

    // Revalidate by path if specified
    if (path || body.path) {
      const pathToRevalidate = path || body.path;
      const revalidationType = (type || body.type || 'page') as 'page' | 'layout';
      revalidatePath(pathToRevalidate, revalidationType);
      revalidatedItems.push(`path:${pathToRevalidate}(${revalidationType})`);
      console.log(`Revalidated path: ${pathToRevalidate} (${revalidationType})`);
    }

    // If no specific tag or path, revalidate common show-related tags
    if (!tag && !path && !body.tag && !body.path) {
      // Default: revalidate shows and episodes
      revalidateTag("episodes");
      revalidateTag("shows");
      revalidatePath("/", "page");
      revalidatePath("/shows", "page");
      revalidatedItems.push("tag:episodes", "tag:shows", "path:/(page)", "path:/shows(page)");
      console.log("Revalidated default show content");
    }

    console.log(`Revalidation completed at ${new Date().toISOString()}`);

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      items: revalidatedItems,
      message: `Successfully revalidated: ${revalidatedItems.join(", ")}`,
    });
  } catch (error) {
    console.error("Error revalidating content:", error);
    return NextResponse.json(
      {
        message: "Error revalidating content",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
