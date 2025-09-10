"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import InsertedSection from "@/components/inserted-section";
import { ChevronRight, ChevronLeft, Dice1 } from "lucide-react";

export default function ColouredSectionGallery({
    colouredSections,
    homepageData,
}: {
    colouredSections: any[];
    homepageData: any;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isPaused, setIsPaused] = useState(false);

    const scrollPrev = () => {
        if (scrollRef.current) {
            const childWidth = scrollRef.current.firstElementChild?.clientWidth || 0;
            scrollRef.current.scrollBy({ left: -childWidth, behavior: "smooth" });
        }
    };

    const scrollNext = () => {
        if (scrollRef.current) {
            const childWidth = scrollRef.current.firstElementChild?.clientWidth || 0;
            scrollRef.current.scrollBy({ left: childWidth, behavior: "smooth" });
        }
    };

    useEffect(() => {
        if (!isPaused) {
            const interval = setInterval(() => {
                if (!scrollRef.current) return;

                const container = scrollRef.current;
                const child = container.firstElementChild as HTMLElement;
                if (!child) return;

                const childWidth = child.clientWidth;
                const maxScrollLeft = container.scrollWidth - container.clientWidth;

                if (container.scrollLeft + childWidth > maxScrollLeft) {
                    // loop back to start
                    container.scrollTo({ left: 0, behavior: "smooth" });
                } else {
                    container.scrollBy({ left: childWidth, behavior: "smooth" });
                }
            }, 7000); // 7 seconds per slide

            return () => clearInterval(interval);
        }
    }, [isPaused]);

    return (
        <div className="relative w-full mt-20 mb-20">
            <div
                ref={scrollRef}
                className="overflow-x-auto snap-x snap-mandatory flex gap-0 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                {colouredSections.map((colouredSection: any, idx: number) => (
                    <div
                        key={idx}
                        className="snap-start flex-shrink-0 w-full"
                    >
                        <Suspense fallback={<div>Loading...</div>}>
                            <InsertedSection
                                section={colouredSection}
                                colouredSection={homepageData?.metadata?.coloured_sections?.[idx]}
                            />
                        </Suspense>
                    </div>
                ))}
            </div>
            <div className="relative w-full flex justify-end">
            <div className="absolute -translate-y-full z-40 w-auto bg-white flex flex-row items-center justify-end gap-0">
                <button
                    onClick={scrollPrev}
                    className="p-2 flex items-center justify-center text-almostblack hover:text-almostblack/50 cursor-pointer"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="flex items-center justify-center text-almostblack text-lg hover:text-almostblack/50 cursor-pointer"
                >
                    {isPaused ? "●" : "■" }
                </button>

                <button
                    onClick={scrollNext}
                    className="p-2 flex items-center justify-center text-almostblack hover:text-almostblack/50 cursor-pointer"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
        </div >
    );
}