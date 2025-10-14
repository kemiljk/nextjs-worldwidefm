import { Metadata } from "next";
import ContactForm from "./contact-form";
import { generateContactMetadata } from "@/lib/metadata-utils";

export async function generateMetadata(): Promise<Metadata> {
  return generateContactMetadata();
}

async function getContactInfo() {
  try {
    const { cosmic } = await import("@/cosmic/client");
    
    const response = await cosmic.objects.findOne({
      id: "67e7a9d799cf79c29934d8bc"
    }).props("slug,title,metadata,type");

    return response?.object || null;
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
