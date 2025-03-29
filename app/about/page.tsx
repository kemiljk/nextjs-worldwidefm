import { PageHeader } from "@/components/shared/page-header";
import { getAboutPage } from "@/lib/cosmic-service";
import type { AboutPage } from "@/lib/cosmic-service";

export default async function AboutPage() {
  const about = await getAboutPage();

  return (
    <main className="mt-24">
      <PageHeader title={about.metadata.hero_title} breadcrumbs={[{ href: "/", label: "Home" }, { label: "About" }]} />

      <div className="relative h-[50vh] mb-16 rounded-none overflow-hidden">
        <img src={about.metadata.hero_image.imgix_url} alt={about.metadata.hero_title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8 md:p-12 text-white max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-medium mb-4">{about.metadata.hero_title}</h1>
          <p className="text-xl md:text-2xl opacity-90">{about.metadata.hero_subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 py-12">
        <div className="md:col-span-5">
          <h2 className="text-3xl font-medium">{about.metadata.mission_title}</h2>
          <div className="prose mt-4" dangerouslySetInnerHTML={{ __html: about.metadata.mission_content }} />
        </div>

        <div className="md:col-span-7">
          <div className="border-l-2 border-brand-orange pl-6 space-y-8">
            {about.metadata.timeline?.map((item, index) => (
              <div key={index}>
                <h3 className="text-xl font-medium">{item.year}</h3>
                <h4 className="text-lg text-brand-orange">{item.title}</h4>
                <p className="text-muted-foreground mt-1">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 py-12">
        <div className="md:col-span-5">
          <h2 className="text-3xl font-medium">{about.metadata.what_we_believe}</h2>
          <div className="prose mt-4" dangerouslySetInnerHTML={{ __html: about.metadata.what_we_believe_content }} />
        </div>

        <div className="md:col-span-7">
          <div className="border-l-2 border-brand-orange pl-6">
            <h2 className="text-3xl font-medium">{about.metadata.connect_title}</h2>
            <div className="prose mt-4" dangerouslySetInnerHTML={{ __html: about.metadata.connect_content }} />

            <div className="mt-8 space-y-4">
              <div>
                <h3 className="text-xl font-medium">Contact</h3>
                <p className="text-muted-foreground mt-1">
                  {about.metadata.contact_info.metadata.email}
                  <br />
                  {about.metadata.contact_info.metadata.phone}
                  <br />
                  {about.metadata.contact_info.metadata.location}
                </p>
              </div>

              <div>
                <h3 className="text-xl font-medium">Social</h3>
                <div className="flex gap-4 mt-2">
                  <a href={about.metadata.social_links.metadata.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-orange transition-colors">
                    Instagram
                  </a>
                  <a href={about.metadata.social_links.metadata.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-orange transition-colors">
                    Twitter
                  </a>
                  <a href={about.metadata.social_links.metadata.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-orange transition-colors">
                    Facebook
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <hr className="mb-12" />
        <div className="prose max-w-none space-y-4 dark:prose-invert mb-12" dangerouslySetInnerHTML={{ __html: about.metadata.staff_inclusivity_action_policy }} />
      </div>
    </main>
  );
}
