"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { RadioCultArtist, RadioCultTag, getArtists, getTags } from "@/lib/radiocult-service";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AddNewArtist } from "./add-new-artist";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

// Form schema using zod
const formSchema = z.object({
  title: z.string().min(3, {
    message: "Show title must be at least 3 characters",
  }),
  description: z.string().optional(),
  artistId: z.string({
    required_error: "Please select an artist",
  }),
  startDate: z.string().min(1, {
    message: "Please select a start date",
  }),
  startTime: z.string().min(1, {
    message: "Please enter a start time",
  }),
  duration: z.string().min(1, {
    message: "Please enter show duration",
  }),
  tracklist: z.string().optional(),
  extraDetails: z.string().optional(),
  tags: z.array(z.string()).default([]),
  featuredOnHomepage: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export function AddShowForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [artists, setArtists] = useState<RadioCultArtist[]>([]);
  const [tags, setTags] = useState<RadioCultTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTagInput, setSelectedTagInput] = useState<string>("");

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: "",
      startTime: "",
      duration: "60", // Default 60 minutes
      tracklist: "",
      extraDetails: "",
      tags: [],
      featuredOnHomepage: false,
    },
  });

  // Fetch artists and tags when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch data in parallel
        const [artistList, tagsList] = await Promise.all([getArtists(), getTags()]);

        setArtists(artistList);
        setTags(tagsList);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update form value when selected tags change
  useEffect(() => {
    form.setValue("tags", selectedTags);
  }, [selectedTags, form]);

  // Handle newly created artist
  const handleArtistCreated = (newArtist: RadioCultArtist) => {
    // Add the new artist to the artists list
    setArtists((prevArtists) => [newArtist, ...prevArtists]);

    // Select the newly created artist
    form.setValue("artistId", newArtist.id);

    toast.success(`Artist "${newArtist.name}" added to the list`);
  };

  // Handle tag selection
  const handleTagSelect = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      setSelectedTags([...selectedTags, tagId]);
      setSelectedTagInput("");
    }
  };

  // Handle tag removal
  const handleTagRemove = (tagId: string) => {
    setSelectedTags(selectedTags.filter((id) => id !== tagId));
  };

  // Get tag name by ID
  const getTagName = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    return tag ? tag.name : tagId;
  };

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      // First we'll create the content in Cosmic to get approval
      const response = await fetch("/api/shows/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          status: "draft", // Set as draft for approval
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create show");
      }

      const data = await response.json();

      toast.success("Show submitted for approval!", {
        description: "Once approved, it will be published to RadioCult.",
      });

      // Reset the form
      form.reset();
      setSelectedTags([]);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to submit show", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">1. Show Details</h2>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Show Title</FormLabel>
                <FormControl>
                  <Input disabled={isLoading} placeholder="Enter show title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea disabled={isLoading} placeholder="Enter show description" rows={3} {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input disabled={isLoading} type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <Input disabled={isLoading} type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input disabled={isLoading} type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">2. Artist</h2>

          <FormField
            control={form.control}
            name="artistId"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel>Artist</FormLabel>
                  <AddNewArtist onArtistCreated={handleArtistCreated} />
                </div>
                <Select disabled={isLoading || artists.length === 0} onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an artist" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {artists.map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                <FormDescription>Select the main artist for this show or add a new one</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">3. Additional Information</h2>

          <FormField
            control={form.control}
            name="tags"
            render={() => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <div className="space-y-2">
                  <Select disabled={isLoading || tags.length === 0} onValueChange={handleTagSelect} value={selectedTagInput}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tags" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        {tags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id} disabled={selectedTags.includes(tag.id)}>
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color || "#6E6E6E" }} />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>

                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedTags.map((tagId) => (
                        <Badge key={tagId} variant="secondary" className="flex items-center gap-1">
                          {getTagName(tagId)}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => handleTagRemove(tagId)} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <FormDescription>Select tags to categorize this show</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tracklist"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tracklist</FormLabel>
                <FormControl>
                  <Textarea disabled={isLoading} placeholder="Enter the tracklist (one track per line)" rows={5} {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>Add each track on a new line in the format: Artist - Track Title</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="extraDetails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Details</FormLabel>
                <FormControl>
                  <Textarea disabled={isLoading} placeholder="Any additional details or notes" rows={3} {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Submitting..." : "Submit for Approval"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
