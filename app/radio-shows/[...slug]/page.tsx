import { redirect } from "next/navigation";

export default async function RadioShowsCatchAll({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  redirect(`/shows/${slug.join("/")}`);
  return null;
}
