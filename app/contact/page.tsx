import { Metadata } from "next";
import ContactForm from "./contact-form";
import { generateContactMetadata } from "@/lib/metadata-utils";

export async function generateMetadata(): Promise<Metadata> {
  return generateContactMetadata();
}

async function getContactInfo() {
  try {
    const COSMIC_BUCKET_SLUG = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "worldwide-fm-production";
    const COSMIC_READ_KEY = process.env.NEXT_PUBLIC_COSMIC_READ_KEY || "Qo9hr8E9Vef66JrXQdyVrh29CVkd7Vz9GuGVdiQIClX6U7N9oh";

    const url = `https://api.cosmicjs.com/v3/buckets/${COSMIC_BUCKET_SLUG}/objects/67e7a9d799cf79c29934d8bc?read_key=${COSMIC_READ_KEY}&props=slug,title,metadata,type`;

    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    if (!response.ok) {
      throw new Error(`Failed to fetch contact info: ${response.status}`);
    }

    const data = await response.json();
    return data.object;
  } catch (error) {
    console.error("Error fetching contact info:", error);
    return null;
  }
}

export default async function ContactPage() {
  const contactInfo = await getContactInfo();

  if (!contactInfo) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-4xl font-display font-bold mb-4">Contact Us</h1>
        <p className="text-muted-foreground">Unable to load contact information at this time. Please try again later.</p>
      </div>
    );
  }

  return <ContactForm contactInfo={contactInfo} />;
}
