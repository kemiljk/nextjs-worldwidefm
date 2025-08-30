import { Metadata } from "next";
import LegalContent from "@/components/shared/legal-content";
import { generatePrivacyMetadata } from "@/lib/metadata-utils";

export async function generateMetadata(): Promise<Metadata> {
  return generatePrivacyMetadata();
}

async function getPrivacyPolicyContent() {
  try {
    const COSMIC_BUCKET_SLUG = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "worldwide-fm-production";
    const COSMIC_READ_KEY = process.env.NEXT_PUBLIC_COSMIC_READ_KEY || "Qo9hr8E9Vef66JrXQdyVrh29CVkd7Vz9GuGVdiQIClX6U7N9oh";
    
    const url = `https://api.cosmicjs.com/v3/buckets/${COSMIC_BUCKET_SLUG}/objects/68b2cb04dea361e2db6caf86?read_key=${COSMIC_READ_KEY}&props=slug,title,metadata,type`;
    
    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    if (!response.ok) {
      throw new Error(`Failed to fetch privacy policy: ${response.status}`);
    }
    
    const data = await response.json();
    return data.object;
  } catch (error) {
    console.error("Error fetching privacy policy:", error);
    return null;
  }
}

export default async function PrivacyPolicyPage() {
  const privacyPolicy = await getPrivacyPolicyContent();
  
  if (!privacyPolicy) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-4xl font-display font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground">
          Unable to load privacy policy content at this time. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <LegalContent
      title={privacyPolicy.title}
      content={privacyPolicy.metadata.text}
    />
  );
}
