import { Metadata } from "next";
import LegalContent from "@/components/shared/legal-content";
import { generateTermsMetadata } from "@/lib/metadata-utils";

export async function generateMetadata(): Promise<Metadata> {
  return generateTermsMetadata();
}

async function getTermsAndConditionsContent() {
  try {
    const COSMIC_BUCKET_SLUG = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "worldwide-fm-production";
    const COSMIC_READ_KEY = process.env.NEXT_PUBLIC_COSMIC_READ_KEY || "Qo9hr8E9Vef66JrXQdyVrh29CVkd7Vz9GuGVdiQIClX6U7N9oh";
    
    const url = `https://api.cosmicjs.com/v3/buckets/${COSMIC_BUCKET_SLUG}/objects/68b2caf1dea361e2db6caf84?read_key=${COSMIC_READ_KEY}&props=slug,title,metadata,type`;
    
    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    if (!response.ok) {
      throw new Error(`Failed to fetch terms and conditions: ${response.status}`);
    }
    
    const data = await response.json();
    return data.object;
  } catch (error) {
    console.error("Error fetching terms and conditions:", error);
    return null;
  }
}

export default async function TermsAndConditionsPage() {
  const termsAndConditions = await getTermsAndConditionsContent();
  
  if (!termsAndConditions) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-4xl font-display font-bold mb-4">Terms and Conditions</h1>
        <p className="text-muted-foreground">
          Unable to load terms and conditions content at this time. Please try again later.
        </p>
      </div>
    );
  }

  // Extract the last updated date from the content if it exists
  const lastUpdatedMatch = termsAndConditions.metadata.text.match(/Last Updated (\d{2}\.\d{2}\.\d{2})/);
  const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1] : undefined;

  return (
    <LegalContent
      title={termsAndConditions.title}
      content={termsAndConditions.metadata.text}
      lastUpdated={lastUpdated}
    />
  );
}
