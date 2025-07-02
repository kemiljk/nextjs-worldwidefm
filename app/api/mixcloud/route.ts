import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "20";
  const offset = searchParams.get("offset") || "0";
  const url = `https://api.mixcloud.com/worldwidefm/cloudcasts/?limit=${limit}&offset=${offset}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return new Response("Mixcloud fetch failed", { status: 500 });
  }
  const data = await response.json();
  return Response.json(data);
}
