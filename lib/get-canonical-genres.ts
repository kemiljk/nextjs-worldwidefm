import { cosmic } from "./cosmic-config";

export interface CanonicalGenre {
  id: string;
  slug: string;
  title: string;
}

export async function getCanonicalGenres(): Promise<CanonicalGenre[]> {
  const res = await cosmic.objects.find({ type: "genres" }).props("id,slug,title,metadata,type").depth(1);
  return (res.objects || []).map((g: any) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
  }));
}
