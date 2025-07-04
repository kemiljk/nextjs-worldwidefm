import { PageHeader } from "@/components/shared/page-header";
import { getAboutPage } from "@/lib/cosmic-service";
import type { AboutPage } from "@/lib/cosmic-service";

export default async function AboutPage() {
  const about = await getAboutPage();

  return (
    <main>
      <PageHeader title={about.metadata.hero_title} description={about.metadata.hero_subtitle} breadcrumbs={[{ href: "/", label: "Home" }, { label: "About" }]} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 py-16">
        <div className="md:col-span-5">
          <div className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: about.metadata.mission_content }} />
        </div>

        <div className="md:col-span-7">
          <div className="border-l-2 border-bronze-500 pl-6">
            <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">{about.metadata.connect_title}</h2>
            <div className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: about.metadata.connect_content }} />

            <div className="mt-8 space-y-4">
              <div>
                <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white">Contact</h3>
                <p className="text-muted-foreground mt-1">
                  {about.metadata.contact_info.metadata.email}
                  <br />
                  {about.metadata.contact_info.metadata.phone}
                  <br />
                  {about.metadata.contact_info.metadata.location}
                </p>
              </div>

              <div>
                <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white">Social</h3>
                <div className="flex gap-4 mt-2">
                  <a href={about.metadata.social_links.metadata.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    Instagram
                  </a>
                  <a href={about.metadata.social_links.metadata.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    Twitter
                  </a>
                  <a href={about.metadata.social_links.metadata.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    Facebook
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="md:col-span-5">
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">{about.metadata.partner_with_us_title}</h2>
          <div className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: about.metadata.partner_with_us_description }} />
        </div>
        <div className="md:col-span-7">
          <div className="border-l-2 border-bronze-500 pl-6">
            <h3 className="text-m5 font-mono font-normal text-almostblack dark:text-white mb-4">Partners</h3>
            <div className="flex flex-wrap gap-4">
              {about.metadata.partner_with_us.map((partner) => (
                <div key={partner.name}>
                  <img src={partner.logo.url} alt={partner.name} className="size-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
