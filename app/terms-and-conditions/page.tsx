import { Metadata } from "next";
import LegalContent from "@/components/shared/legal-content";
import { generateTermsMetadata } from "@/lib/metadata-utils";

export async function generateMetadata(): Promise<Metadata> {
  return generateTermsMetadata();
}

async function getTermsAndConditionsContent() {
  try {
    const { cosmic } = await import("@/cosmic/client");
    
    const response = await cosmic.objects.findOne({
      id: "68b2caf1dea361e2db6caf84"
    }).props("slug,title,metadata,type");

    return response?.object || null;
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
