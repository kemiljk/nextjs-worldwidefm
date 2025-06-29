import { redirect } from "next/navigation";

export default function RadioShowsCatchAll({ params }: { params: { slug: string[] } }) {
  redirect(`/shows/${params.slug.join("/")}`);
  return null;
}
