"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { SearchResult, SearchResultType } from "@/lib/search-context";
import { getAllSearchableContent } from "@/lib/actions";

export default function ArchivePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | SearchResultType>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [allContent, setAllContent] = useState<SearchResult[]>([]);
  const [filteredContent, setFilteredContent] = useState<SearchResult[]>([]);

  // Fetch all content on mount
  useEffect(() => {
    async function fetchContent() {
      setIsLoading(true);
      try {
        const content = await getAllSearchableContent();
        setAllContent(content);
        setFilteredContent(content);
      } catch (error) {
        console.error("Error fetching content:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchContent();
  }, []);

  // Filter content based on search term and type
  useEffect(() => {
    let filtered = allContent;

    // Filter by type
    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.type === selectedType);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => item.title.toLowerCase().includes(term) || (item.description || "").toLowerCase().includes(term) || (item.genres || []).some((genre) => genre.toLowerCase().includes(term)));
    }

    setFilteredContent(filtered);
  }, [searchTerm, selectedType, allContent]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto pt-32 pb-32">
        {/* Header with breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-brand-orange transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Archive</span>
          </div>
          <h1 className="text-3xl font-medium text-foreground">Show Archive</h1>
          <p className="text-muted-foreground mt-2">Explore our collection of past broadcasts and shows.</p>
        </div>

        {/* Search and filter bar */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Filter shows and articles..." className="pl-10 bg-background border-none focus-visible:ring-brand-orange" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className={`${selectedType === "all" ? "text-brand-orange border-brand-orange hover:bg-brand-orange/10" : "text-muted-foreground border-muted hover:bg-muted/10"}`} onClick={() => setSelectedType("all")}>
              All Content
            </Button>
            <Button variant="outline" className={`${selectedType === "radio-shows" ? "text-brand-orange border-brand-orange hover:bg-brand-orange/10" : "text-muted-foreground border-muted hover:bg-muted/10"}`} onClick={() => setSelectedType("radio-shows")}>
              Radio Shows
            </Button>
            <Button variant="outline" className={`${selectedType === "posts" ? "text-brand-orange border-brand-orange hover:bg-brand-orange/10" : "text-muted-foreground border-muted hover:bg-muted/10"}`} onClick={() => setSelectedType("posts")}>
              Articles
            </Button>
          </div>
        </div>

        {/* Archive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            <div className="col-span-full flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
            </div>
          ) : filteredContent.length > 0 ? (
            filteredContent.map((item) => (
              <Card key={item.id} className="overflow-hidden border-none shadow-md">
                <CardContent className="p-0 relative">
                  <div className="aspect-square relative">
                    <Image src={item.image || "/placeholder.svg"} alt={item.title} fill className="object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{item.type === "radio-shows" ? "Radio Show" : "Article"}</span>
                      {item.genres && item.genres.length > 0 && <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{item.genres[0]}</span>}
                    </div>
                    <h3 className="font-medium line-clamp-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description || ""}</p>
                    <p className="text-xs text-muted-foreground mt-3 mb-3">
                      {item.date
                        ? new Date(item.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "No date available"}
                    </p>
                    <div className="flex justify-between items-center">
                      <Link href={`/${item.type}/${item.slug}`} className="text-sm text-brand-orange hover:underline">
                        View Details
                      </Link>
                      <Button size="sm" variant="ghost" className="text-brand-orange hover:bg-brand-orange/10 rounded-full p-2">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">{searchTerm ? "No results found for your search." : "No content available at the moment."}</p>
              {searchTerm && (
                <Button variant="outline" className="text-brand-orange border-brand-orange hover:bg-brand-orange/10" onClick={() => setSearchTerm("")}>
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
