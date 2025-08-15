import { NextRequest, NextResponse } from "next/server";
import { sanitizeTracklist, sanitizeEditorialContent } from "@/lib/sanitize-html";

export async function POST(request: NextRequest) {
  try {
    const { content, type = "default" } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required and must be a string" }, { status: 400 });
    }

    let sanitizedContent: string;

    switch (type) {
      case "tracklist":
        sanitizedContent = sanitizeTracklist(content);
        break;
      case "editorial":
        sanitizedContent = sanitizeEditorialContent(content);
        break;
      default:
        sanitizedContent = content; // Return as-is if no specific type
        break;
    }

    return NextResponse.json({
      originalLength: content.length,
      sanitizedLength: sanitizedContent.length,
      sanitizedContent,
      type,
    });
  } catch (error) {
    console.error("Error sanitizing content:", error);
    return NextResponse.json({ error: "Failed to sanitize content" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST method with content and type (tracklist|editorial|default)",
    example: {
      content: "<p>Your HTML content here</p>",
      type: "tracklist",
    },
  });
}
