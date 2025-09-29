import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getPostBySlug, getRelatedPosts } from "@/lib/actions";
import { PageHeader } from "@/components/shared/page-header";
import { format } from "date-fns";
import EditorialSection from "@/components/editorial/editorial-section";
import { cn } from "@/lib/utils";
import { generatePostMetadata } from "@/lib/metadata-utils";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const response = await getPostBySlug(slug);

    if (response?.object) {
      return generatePostMetadata(response.object);
    }

    return generatePostMetadata({ title: "Article Not Found" });
  } catch (error) {
    console.error("Error generating editorial metadata:", error);
    return generatePostMetadata({ title: "Article Not Found" });
  }
}

interface Category {
  id: string;
  slug: string;
  title: string;
  content: string;
  bucket: string;
  created_at: string;
  modified_at: string;
  status: string;
  published_at: string;
  modified_by: string;
  created_by: string;
  type: string;
  metadata: null;
}

export default async function EditorialArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  // Await the entire params object first
  const resolvedParams = await params;

  const response = await getPostBySlug(resolvedParams.slug);

  if (!response?.object) {
    notFound();
  }

  const post = response.object;

  // Get related posts based on categories
  const relatedPosts = await getRelatedPosts(post);

  // Format the date
  const postDate = post.metadata?.date ? new Date(post.metadata.date) : null;
  const formattedDate = postDate ? format(postDate, "dd-MM-yyyy") : "";

  // Determine layout style from metadata with defaults
  const imageAspectRatio = post.metadata?.image_aspect_ratio?.key || "16_9";
  const imageUrl = post.metadata?.image?.imgix_url;
  const description = post.metadata?.excerpt || "";
  const content = post.metadata?.content || "";
  const categories = post.metadata?.categories || [];
  const author = post.metadata?.author;

  // Generate alt text for the hero image
  const heroImageAlt = `${post.title} - Featured image`;

  // Define breadcrumbs
  const breadcrumbs = [{ href: "/", label: "Home" }, { href: "/editorial", label: "Editorial" }, { label: post.title }];

  // With hero image layout
  return (
    <article className="w-full">
      {/* Hero Section */}
      <div className="w-full 
      mt-20
      mb-40
      px-20
      flex flex-col lg:flex-row 
      gap-20
      justify-center 
      items-center md:items-start">
        {/* Image */}
          <div className="sm:w-[80vw] lg:w-[50vw] flex items-center justify-center overflow-hidden relative">
            <Image
              src={imageUrl}
              alt={heroImageAlt}
              width={0} // can be omitted if using layout="intrinsic"
              height={0}
              style={{ width: "100%", height: "auto" }} // maintain aspect ratio
              className="object-contain"
            />
          </div>

        {/* Text */}
        <div className="w-full sm:w-[80vw] lg:w-[35vw] text-almostblack dark:text-white ">
            <p className="font-sans text-[40px] md:text-[50px] leading-none mb-4">{post.title}</p>
            <p className="text-sans text-b3">{description}</p>
            <div className="flex flex-col gap-1">
              <div className="pl-1 text-[12px] leading-none font-mono tracking-wider">{formattedDate}</div>
              {author && <div className="pl-1 text-[12px] font-mono leading-none uppercase tracking-wider text-muted-foreground">By {typeof author === "string" ? author : author.title || "Unknown"}</div>}
              <div className="flex pt-4 flex-wrap gap-3">
                {categories.map((category: Category) => (
                  <span key={category.slug} className="border-1 rounded-full px-2 py-0.5 text-[9px] md:text-[10px] font-mono uppercase">
                    {category.title}
                  </span>
                ))}
              </div>
            </div>
          {/* Main Content */}
          <div className="">
            {content && <div dangerouslySetInnerHTML={{ __html: content }} className="break-words font-sans text-b6 mt-10 md:mt-20 space-y-4" />}
          </div>

        </div>


      </div>

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <div className="border-t">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <EditorialSection title="Related Articles" posts={relatedPosts} layout="grid" />
          </div>
        </div>
      )}
    </article>
  );
}
