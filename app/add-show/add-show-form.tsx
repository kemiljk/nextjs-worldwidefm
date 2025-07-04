"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { RadioCultArtist, RadioCultTag, getArtists, getTags } from "@/lib/radiocult-service";
import { Location, getCountries, getCities } from "@/lib/location-service";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AddNewArtist } from "./add-new-artist";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle, ArrowLeft } from "lucide-react";
import { fetchTags } from "@/lib/actions";
import { debounce } from "lodash";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Dropzone } from "@/components/ui/dropzone";

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
  locationType: z.enum(["city", "country"]).optional(),
  locationId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Helper to get city display label
const getCityLabel = (city: Location | undefined) => (city ? `${city.name}${city.region ? `, ${city.region}` : ""}` : "");

export function AddShowForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedShowTitle, setSubmittedShowTitle] = useState<string>("");
  const [artists, setArtists] = useState<RadioCultArtist[]>([]);
  const [tags, setTags] = useState<RadioCultTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTagInput, setSelectedTagInput] = useState<string>("");
  const [countries, setCountries] = useState<Location[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [cityError, setCityError] = useState<string>("");
  const [cityInput, setCityInput] = useState<string>("");
  const [cityOptions, setCityOptions] = useState<Location[]>([]);
  const [isCityLoading, setIsCityLoading] = useState<boolean>(false);
  const [selectedCityObj, setSelectedCityObj] = useState<Location | undefined>(undefined);
  // Track if the user is actively typing
  const [isTyping, setIsTyping] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: "",
      startTime: "",
      duration: "60",
      tracklist: "",
      extraDetails: "",
      tags: [],
      featuredOnHomepage: false,
      locationType: undefined,
      locationId: undefined,
    },
  });

  // Fetch artists, tags, and countries when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch data in parallel
        const [artistList, tagsResult, countriesList] = await Promise.all([getArtists(), fetchTags(), getCountries()]);

        setArtists(artistList);
        if (tagsResult.success) {
          setTags(tagsResult.tags ?? []);
        } else {
          toast.error("Failed to load tags");
        }
        setCountries(countriesList);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Debounced city fetcher
  const fetchCityOptions = debounce(async (country: string, name: string) => {
    if (!country || !name) {
      setCityOptions([]);
      return;
    }
    setIsCityLoading(true);
    setCityError("");
    try {
      const cities = await getCities(country, name);
      console.log("Fetched cities for:", { country, name, cities });
      setCityOptions(cities);
      if (cities.length === 0) {
        setCityError("No cities found matching your input");
      }
    } catch (error) {
      setCityError("Failed to load cities. Please check your API key.");
      console.error("City fetch error:", error);
    } finally {
      setIsCityLoading(false);
    }
  }, 400);

  // Watch for city input changes
  useEffect(() => {
    if (form.watch("locationType") === "city" && selectedCountry && cityInput.length > 1 && isTyping) {
      fetchCityOptions(selectedCountry, cityInput);
    } else if (isTyping) {
      setCityOptions([]);
    }
    // Cancel debounce on unmount
    return () => fetchCityOptions.cancel();
  }, [cityInput, selectedCountry, form.watch("locationType"), isTyping]);

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

  // Handle creating another show
  const handleCreateAnother = () => {
    setIsSubmitted(false);
    setSubmittedShowTitle("");
    // Form is already reset from the previous submission
  };

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      let radiocultMediaId: string | undefined = undefined;
      let cosmicMedia: any = undefined;

      // Upload media file separately if provided
      if (mediaFile) {
        const formData = new FormData();
        formData.append("media", mediaFile);
        formData.append(
          "metadata",
          JSON.stringify({
            title: values.title,
            artist: artists.find((a) => a.id === values.artistId)?.name || undefined,
          })
        );

        const uploadResponse = await fetch("/api/upload-media", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          throw new Error(uploadError.error || "Failed to upload media");
        }

        const uploadResult = await uploadResponse.json();
        radiocultMediaId = uploadResult.radiocultMediaId;
        cosmicMedia = uploadResult.cosmicMedia;

        console.log("🎵 Media upload result:", {
          radiocultMediaId: uploadResult.radiocultMediaId,
          hasCosmicMedia: !!uploadResult.cosmicMedia,
          message: uploadResult.message,
        });

        // Show info message if RadioCult upload was skipped
        if (!uploadResult.radiocultMediaId && uploadResult.message) {
          toast.info("Media Upload Info", {
            description: uploadResult.message,
          });
        } else if (uploadResult.radiocultMediaId) {
          toast.success("Media Upload Success", {
            description: `Successfully uploaded to both RadioCult (ID: ${uploadResult.radiocultMediaId}) and Cosmic`,
          });
        }
      }

      // Create the show in Cosmic
      const response = await fetch("/api/shows/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          status: "draft", // Set as draft for approval
          radiocult_media_id: radiocultMediaId,
          media_file: cosmicMedia,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create show");
      }

      const data = await response.json();

      // Set success state
      setSubmittedShowTitle(values.title);
      setIsSubmitted(true);

      // Reset the form for potential next submission
      form.reset();
      setSelectedTags([]);
      setMediaFile(null);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to submit show", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show success view if submitted
  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900">Show Submitted Successfully!</h2>
          <p className="text-gray-600 max-w-md">
            "<strong>{submittedShowTitle}</strong>" has been submitted for approval. Once approved, it will be published to RadioCult and appear on your station.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleCreateAnother} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Upload Another Show
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">Show Details</h2>

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
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">Artist</h2>

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
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">Additional Information</h2>

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

        <div className="space-y-4">
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">Location</h2>

          <FormField
            control={form.control}
            name="locationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location Type</FormLabel>
                <Select
                  disabled={isLoading}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("locationId", undefined);
                    setSelectedCountry("");
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="city">City</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Choose whether to specify a country or city</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("locationType") === "country" && (
            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select disabled={isLoading || countries.length === 0} onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        {countries.map((country) => (
                          <SelectItem key={country.id} value={country.id}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {form.watch("locationType") === "city" && (
            <>
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country (for city selection)</FormLabel>
                    <Select
                      disabled={isLoading || countries.length === 0}
                      onValueChange={(value) => {
                        setSelectedCountry(value);
                        field.onChange(undefined);
                        setCityInput("");
                        setCityOptions([]);
                        setSelectedCityObj(undefined);
                      }}
                      value={selectedCountry}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a country first" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-[200px]">
                          {countries.map((country) => (
                            <SelectItem key={country.id} value={country.id}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedCountry && (
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <Command className="w-full border rounded-none relative">
                        <div className="relative">
                          <CommandInput
                            placeholder="Type to search for a city"
                            value={selectedCityObj ? getCityLabel(selectedCityObj) : cityInput}
                            onValueChange={(val) => {
                              setCityInput(val);
                              setIsTyping(true);
                              setSelectedCityObj(undefined);
                              field.onChange("");
                            }}
                            disabled={!!selectedCityObj || isLoading}
                            style={{ width: "100%" }}
                          />
                          {selectedCityObj && (
                            <button
                              type="button"
                              aria-label="Clear city selection"
                              onClick={() => {
                                setSelectedCityObj(undefined);
                                setCityInput("");
                                setCityOptions([]);
                                field.onChange("");
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
                              tabIndex={0}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {!selectedCityObj && (
                          <CommandList>
                            {isCityLoading && <div className="p-2 text-sm text-muted-foreground">Loading cities...</div>}
                            {!isCityLoading && cityOptions.length === 0 && <CommandEmpty>No cities found</CommandEmpty>}
                            {cityOptions.map((city) => (
                              <CommandItem
                                key={city.id}
                                value={city.id}
                                onSelect={() => {
                                  field.onChange(city.id);
                                  setSelectedCityObj(city);
                                  setCityInput(getCityLabel(city));
                                  setCityOptions([]);
                                  setIsTyping(false);
                                }}
                              >
                                <span>{city.name}</span>
                                {city.region && <span style={{ color: "#888", marginLeft: 8, fontSize: "0.95em" }}>{city.region}</span>}
                              </CommandItem>
                            ))}
                          </CommandList>
                        )}
                      </Command>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-h7 font-display uppercase font-normal text-almostblack dark:text-white">Media File</h2>
          <FormItem>
            <FormLabel>Upload Audio File</FormLabel>
            <Dropzone
              accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/aac,audio/flac"
              disabled={isLoading}
              onFileSelect={setMediaFile}
              selectedFile={mediaFile}
              maxSize={100 * 1024 * 1024} // 100MB limit
            />
            <FormDescription>Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is 100MB.</FormDescription>
          </FormItem>
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
