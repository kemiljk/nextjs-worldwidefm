"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GenreTag } from "@/components/ui/genre-tag";
import { HighlightedText } from "@/components/ui/highlighted-text";
import { formatDateShort } from "@/lib/utils";
import { PlayButton } from "./play-button";

interface FeaturedCardProps {
    show: any; // can type more strictly if you have a Show type
    priority?: boolean;
    className?: string;
    href?: string;
    slug: string;
    playable?: boolean;
}

export function FeaturedCard({ show, priority = false, className = "", href }: FeaturedCardProps) {
    return (
        <Link href={href || `/episode/${show.slug}`} className={`block ${className}`}>

            <Card className="overflow-hidden shadow-none relative cursor-pointer border border-almostblack dark:border-white hover:shadow-lg transition-shadow w-full h-full">

                <CardContent className="p-0 h-full">
                    <div className="relative group w-full h-full">
                        <Image
                            src={show.pictures?.extra_large || show.enhanced_image || show.image || "/image-placeholder.svg"}
                            alt={show.name || show.title || "Show"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority={priority}
                        />
                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none z-10" />

                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-almostblack to-transparent flex flex-col justify-end p-4 z-20">
                            
                            
                            

                            <div className="bg-almostblack p-0.5 text-h9 sm:text-h8 leading-[1] font-display uppercase w-fit">
                                <HighlightedText variant="default">
                                    {show.broadcast_date ? formatDateShort(show.broadcast_date) : "RECENT SHOW"}
                                </HighlightedText>
                            </div>
                            <h3 className="text-h8 sm:text-h7 lg:text-h6 max-w-[80%] leading-[1] font-display w-fit">
                                <HighlightedText variant="white">{show.name || show.title}</HighlightedText>
                            </h3>
                            <div className="flex flex-wrap mt-4">
                                {(show.tags || show.genres || show.enhanced_genres || []).slice(0, 3).map((tag: any, tagIndex: number) => (
                                    <GenreTag key={tag.name || tag.title || tagIndex} variant="white">
                                        {tag.name || tag.title}
                                    </GenreTag>
                                ))}
                                <div className="absolute bottom-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PlayButton
                                        show={show}
                                        label={false}
                                        variant="default"
                                        className="text-white bg-almostblack rounded-full w-10 h-10 flex items-center justify-center ml-2 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}