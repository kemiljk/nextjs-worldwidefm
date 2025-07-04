import { Suspense } from "react";
import ShowsClient from "./shows-client";
import { getCanonicalGenres } from "@/lib/get-canonical-genres";

// Force dynamic mode to prevent the issue with ISR and repeated POST requests
export const dynamic = "force-dynamic";

export default async function ShowsPage() {
  const canonicalGenres = await getCanonicalGenres();
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShowsClient canonicalGenres={canonicalGenres} />
    </Suspense>
  );
}
