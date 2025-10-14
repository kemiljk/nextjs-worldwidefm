import { createBucketClient } from "@cosmicjs/sdk";

if (!process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG) console.error("Error: Environment variables missing. You need to create an environment variable file and include NEXT_PUBLIC_COSMIC_BUCKET_SLUG, NEXT_PUBLIC_COSMIC_READ_KEY, and COSMIC_WRITE_KEY environment variables.");

export const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "You need to add your NEXT_PUBLIC_COSMIC_BUCKET_SLUG environment variable.",
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || "You need to add your NEXT_PUBLIC_COSMIC_READ_KEY environment variable.",
  writeKey: process.env.COSMIC_WRITE_KEY || "You need to add your COSMIC_WRITE_KEY environment variable.",
});
