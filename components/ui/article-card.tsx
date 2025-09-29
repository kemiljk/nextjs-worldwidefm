"use client";

import Link from "next/link";

interface ArticleCardProps {
    title: string;
    slug: string;
    image: string;
    excerpt?: string;
    date?: string;
    tags?: string[];
    variant?: "default" | "white" | "featured";
}

export function ArticleCard({ title, slug, image, date, tags, variant = "default" }: ArticleCardProps) {
    const borderClass = variant === "white" ? "" : "border-black";
    const dateTextClass = variant === "white" ? "text-white" : "text-almostblack";
    const tagBorderClass = variant === "white" ? "border-white" : "border-black";
    const tagTextClass = variant === "white" ? "text-white" : "text-black";

    return (
        <Link href={`/editorial/${slug}`} className="block group">
            <div className={`relative w-full ${variant === "featured" ? "p-10 md:p-20 flex flex-col md:flex-row gap-6 items-start" : ""}`}>
                <div className={`flex-1 relative ${variant === "featured" ? "h-auto" : ""}`}>
                    <img
                        src={image}
                        alt={title}
                        className={`w-full ${variant === "featured" ? "max-h-100 h-full object-cover" : "h-full object-fill"} border-1 ${borderClass}`}
                    />
                </div>
                <div className={`pt-4 pb-4 ${variant === "featured" ? "flex-1" : "w-[90%]"} ${variant === "featured" ? "flex flex-col justify-center " : ""}`}>
                    <div className={`pl-1 pb-6 font-sans ${variant === "featured" ? "text-b1 md:text-[40px] leading-none" : "text-b2"}`}>{title}</div>
                    {date && (
                        <p className={`pl-1 pb-3 text-m8 font-mono dark:text-white ${dateTextClass}`}>
                            {new Date(date)
                                .toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "2-digit",
                                })
                                .replace(/\//g, ".")}
                        </p>
                    )}
                    {tags && tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className={`border-1 dark:border-white rounded-full px-2 py-0.5 text-[9px] lg:text-[10px] dark:text-white font-mono uppercase ${tagBorderClass} ${tagTextClass}`}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}