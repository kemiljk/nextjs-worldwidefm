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

  // If no image is provided, don't render the hero section
  if (!imageUrl) {
    return (
      <article className="min-h-screen py-16">
        <div className="max-w-4xl mx-auto lg:px-4">
          <PageHeader title={post.title} description={description} breadcrumbs={breadcrumbs} />

          {/* Article Content */}
          {content && <div dangerouslySetInnerHTML={{ __html: content }} className="prose prose-lg dark:prose-invert mt-8 space-y-4" />}

          {/* Article Metadata */}
          <div className="mt-16 pt-8 border-t">
            <div className="flex flex-wrap gap-3">
              {categories.map((category: Category) => (
                <span key={category.slug} className="text-[10px] leading-none uppercase tracking-wider px-2 py-1 rounded-full border border-black dark:border-white">
                  {category.title}
                </span>
              ))}
            </div>
            {author && <div className="text-[12px] leading-none uppercase tracking-wider text-muted-foreground mt-4">By {typeof author === "string" ? author : author.title || "Unknown"}</div>}
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

  // With hero image layout
  return (
    <article className="min-h-screen">
      {/* Hero Section */}
      <div
        className={cn("relative w-full", {
          "aspect-video": imageAspectRatio === "16_9",
          "aspect-4/3": imageAspectRatio === "4_3",
          "aspect-square": imageAspectRatio === "1_1",
        })}
      >
        <Image src={imageUrl} alt={heroImageAlt} fill className="object-cover" priority />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />

        {/* Content overlay */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-4 pb-16">
            <div className="text-[12px] leading-none uppercase tracking-wider text-white/80 mb-4">{formattedDate}</div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl  text-white mb-4">{post.title}</h1>
            <p className="text-xl text-white/80">{description}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        {content && <div dangerouslySetInnerHTML={{ __html: content }} className="prose prose-lg dark:prose-invert mt-8 space-y-4" />}

        {/* Article Metadata */}
        <div className="mt-16 pt-8 border-t">
          <div className="flex flex-wrap gap-3">
            {categories.map((category: Category) => (
              <span key={category.slug} className="text-[10px] leading-none uppercase tracking-wider px-2 py-1 rounded-full border border-black dark:border-white">
                {category.title}
              </span>
            ))}
          </div>
          {author && <div className="text-[12px] leading-none uppercase tracking-wider text-muted-foreground mt-4">By {typeof author === "string" ? author : author.title || "Unknown"}</div>}
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
