import { Metadata } from "next";
import MembershipSignupClient from "@/cosmic/blocks/user-management/MembershipSignupClient";
import { generateBaseMetadata } from "@/lib/metadata-utils";
import { getMembershipPage } from "@/lib/cosmic-service";

export const generateMetadata = async (): Promise<Metadata> => {
  try {
    const membership = await getMembershipPage();
    return generateBaseMetadata({
      title: membership.title || "Membership - Worldwide FM",
      description: membership.metadata.description || "Subscribe to Worldwide FM membership for exclusive content, ad-free listening, and premium features.",
      noIndex: true, // Don't index subscription pages
    });
  } catch (error) {
    console.error("Error generating membership metadata:", error);
    return generateBaseMetadata({
      title: "Membership - Worldwide FM",
      description: "Subscribe to Worldwide FM membership for exclusive content, ad-free listening, and premium features.",
      noIndex: true,
    });
  }
};

export default async function MembershipPage() {
  const membership = await getMembershipPage();

  return (
    <div className="mx-auto">
      <MembershipSignupClient heading={membership.title} body={membership.metadata.body} />
    </div>
  );
}
