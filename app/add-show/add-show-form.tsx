'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { RadioCultArtist, RadioCultTag, getArtists, getTags } from '@/lib/radiocult-service';
import { CosmicLocation, getCosmicLocations } from '@/lib/cosmic-location-service';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AddNewArtist } from './add-new-artist';
import { Badge } from '@/components/ui/badge';
import { X, CheckCircle, ArrowLeft } from 'lucide-react';
import { fetchTags } from '@/lib/actions';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { Dropzone } from '@/components/ui/dropzone';

// Form schema using zod
const formSchema = z.object({
  title: z.string().min(3, {
    message: 'Show title must be at least 3 characters',
  }),
  description: z.string().optional(),
  artistId: z.string({
    required_error: 'Please select an artist',
  }),
  startDate: z.string().min(1, {
    message: 'Please select a start date',
  }),
  startTime: z.string().min(1, {
    message: 'Please enter a start time',
  }),
  duration: z.string().min(1, {
    message: 'Please enter show duration',
  }),
  tracklist: z.string().optional(),
  extraDetails: z.string().optional(),
  tags: z.array(z.string()).default([]),
  featuredOnHomepage: z.boolean().default(false),
  location: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddShowForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedShowTitle, setSubmittedShowTitle] = useState<string>('');
  const [artists, setArtists] = useState<RadioCultArtist[]>([]);
  const [tags, setTags] = useState<RadioCultTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTagInput, setSelectedTagInput] = useState<string>('');
  const [locations, setLocations] = useState<CosmicLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CosmicLocation | undefined>(undefined);
  const [locationInput, setLocationInput] = useState<string>('');
  const [artistInput, setArtistInput] = useState<string>('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      startDate: '',
      startTime: '',
      duration: '60',
      tracklist: '',
      extraDetails: '',
      tags: [],
      featuredOnHomepage: false,
      location: undefined,
    },
  });

  // Fetch artists, tags, and locations when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch data in parallel
        const [artistList, tagsResult, locationsList] = await Promise.all([
          getArtists(),
          fetchTags(),
          getCosmicLocations(),
        ]);

        setArtists(artistList);
        if (tagsResult.success) {
          setTags(tagsResult.tags ?? []);
        } else {
          toast.error('Failed to load tags');
        }
        setLocations(locationsList);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle location selection
  const handleLocationSelect = (location: CosmicLocation) => {
    setSelectedLocation(location);
    setLocationInput(location.title);
    form.setValue('location', location.slug);
  };

  // Handle location input change
  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    if (selectedLocation && value !== selectedLocation.title) {
      setSelectedLocation(undefined);
      form.setValue('location', '');
    }
  };

  // Handle artist selection
  const handleArtistSelect = (artist: RadioCultArtist) => {
    form.setValue('artistId', artist.id);
    setArtistInput(artist.name);
  };

  // Handle artist input change
  const handleArtistInputChange = (value: string) => {
    setArtistInput(value);
    // Clear the selected artist if the input doesn't match the selected artist's name
    const selectedArtist = artists.find((a) => a.id === form.watch('artistId'));
    if (selectedArtist && value !== selectedArtist.name) {
      form.setValue('artistId', '');
    }
  };

  // Update form value when selected tags change
  useEffect(() => {
    form.setValue('tags', selectedTags);
  }, [selectedTags, form]);

  // Sync artist input with selected artist
  useEffect(() => {
    const selectedArtistId = form.watch('artistId');
    if (selectedArtistId) {
      const selectedArtist = artists.find((a) => a.id === selectedArtistId);
      if (selectedArtist) {
        setArtistInput(selectedArtist.name);
      }
    }
  }, [form.watch('artistId'), artists]);

  // Handle newly created artist
  const handleArtistCreated = (newArtist: RadioCultArtist) => {
    // Add the new artist to the artists list
    setArtists((prevArtists) => [newArtist, ...prevArtists]);

    // Select the newly created artist
    form.setValue('artistId', newArtist.id);

    toast.success(`Artist "${newArtist.name}" added to the list`);
  };

  // Handle tag selection
  const handleTagSelect = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      setSelectedTags([...selectedTags, tagId]);
      setSelectedTagInput('');
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
    setSubmittedShowTitle('');
    setArtistInput('');
    setLocationInput('');
    setSelectedLocation(undefined);
    setSelectedTags([]);
    setSelectedTagInput('');
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
        formData.append('media', mediaFile);
        formData.append(
          'metadata',
          JSON.stringify({
            title: values.title,
            artist: artists.find((a) => a.id === values.artistId)?.name || undefined,
          })
        );

        const uploadResponse = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          throw new Error(uploadError.error || 'Failed to upload media');
        }

        const uploadResult = await uploadResponse.json();
        radiocultMediaId = uploadResult.radiocultMediaId;
        cosmicMedia = uploadResult.cosmicMedia;

        console.log('🎵 Media upload result:', {
          radiocultMediaId: uploadResult.radiocultMediaId,
          hasCosmicMedia: !!uploadResult.cosmicMedia,
          message: uploadResult.message,
        });

        // Show info message if RadioCult upload was skipped
        if (!uploadResult.radiocultMediaId && uploadResult.message) {
          toast.info('Media Upload Info', {
            description: uploadResult.message,
          });
        } else if (uploadResult.radiocultMediaId) {
          toast.success('Media Upload Success', {
            description: `Successfully uploaded to both RadioCult (ID: ${uploadResult.radiocultMediaId}) and Cosmic`,
          });
        }
      }

      // Create the show in Cosmic
      const response = await fetch('/api/shows/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          status: 'draft', // Set as draft for approval
          radiocult_media_id: radiocultMediaId,
          media_file: cosmicMedia,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create show');
      }

      const data = await response.json();

      // Set success state
      setSubmittedShowTitle(values.title);
      setIsSubmitted(true);

      // Reset the form for potential next submission
      form.reset();
      setSelectedTags([]);
      setSelectedLocation(undefined);
      setLocationInput('');
      setArtistInput('');
      setMediaFile(null);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to submit show', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show success view if submitted
  if (isSubmitted) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center'>
        <div className='flex items-center justify-center w-16 h-16 bg-green-100 rounded-full'>
          <CheckCircle className='w-8 h-8 text-green-600' />
        </div>

        <div className='space-y-2'>
          <h2 className='text-2xl font-semibold text-gray-900'>Show Submitted Successfully!</h2>
          <p className='text-gray-600 max-w-md'>
            "<strong>{submittedShowTitle}</strong>" has been submitted for approval. Once approved,
            it will be published to RadioCult and appear on your station.
          </p>
        </div>

        <div className='flex flex-col sm:flex-row gap-3'>
          <Button
            onClick={handleCreateAnother}
            className='flex items-center gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            Upload Another Show
          </Button>
          <Button
            variant='outline'
            onClick={() => (window.location.href = '/')}
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='space-y-6'
      >
        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            Show Details
          </h2>

          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Show Title</FormLabel>
                <FormControl>
                  <Input
                    disabled={isLoading}
                    placeholder='Enter show title'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='description'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    disabled={isLoading}
                    placeholder='Enter show description'
                    rows={3}
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <FormField
              control={form.control}
              name='startDate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      type='date'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='startTime'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select start time' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <ScrollArea className='h-[200px]'>
                        {Array.from({ length: 96 }, (_, i) => {
                          const hour = Math.floor(i / 4);
                          const minute = (i % 4) * 15;
                          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                          return (
                            <SelectItem
                              key={timeString}
                              value={timeString}
                            >
                              {timeString}
                            </SelectItem>
                          );
                        })}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='duration'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select duration' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <ScrollArea className='h-[200px]'>
                        {Array.from({ length: 48 }, (_, i) => {
                          const minutes = (i + 1) * 15;
                          const hours = Math.floor(minutes / 60);
                          const remainingMinutes = minutes % 60;
                          const displayText =
                            hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
                          return (
                            <SelectItem
                              key={minutes.toString()}
                              value={minutes.toString()}
                            >
                              {displayText}
                            </SelectItem>
                          );
                        })}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            Artist
          </h2>

          <FormField
            control={form.control}
            name='artistId'
            render={({ field }) => (
              <FormItem>
                <div className='flex justify-between items-center'>
                  <FormLabel>Artist</FormLabel>
                  <AddNewArtist onArtistCreated={handleArtistCreated} />
                </div>
                <Command
                  className='w-full border rounded-none relative'
                  shouldFilter={false}
                >
                  <div className='relative'>
                    <CommandInput
                      placeholder='Type to search for an artist'
                      value={artistInput}
                      onValueChange={handleArtistInputChange}
                      disabled={isLoading || artists.length === 0}
                      style={{ width: '100%' }}
                    />
                    {field.value && (
                      <button
                        type='button'
                        aria-label='Clear artist selection'
                        onClick={() => {
                          field.onChange('');
                          setArtistInput('');
                        }}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden'
                        tabIndex={0}
                      >
                        <X className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                  {artistInput && (
                    <CommandList>
                      {artists
                        .filter((artist) =>
                          artist.name.toLowerCase().includes(artistInput.toLowerCase())
                        )
                        .map((artist) => (
                          <CommandItem
                            key={artist.id}
                            value={artist.id}
                            onSelect={() => handleArtistSelect(artist)}
                            className='cursor-pointer'
                          >
                            {artist.name}
                          </CommandItem>
                        ))}
                      {artists.filter((artist) =>
                        artist.name.toLowerCase().includes(artistInput.toLowerCase())
                      ).length === 0 && (
                        <CommandEmpty>No artists found matching "{artistInput}"</CommandEmpty>
                      )}
                    </CommandList>
                  )}
                </Command>
                <FormDescription>
                  Select the main artist for this show or add a new one
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            Additional Information
          </h2>

          <FormField
            control={form.control}
            name='tags'
            render={() => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <div className='space-y-2'>
                  <Command
                    className='w-full border rounded-none relative'
                    shouldFilter={false}
                  >
                    <div className='relative'>
                      <CommandInput
                        placeholder='Type to search for tags'
                        value={selectedTagInput}
                        onValueChange={setSelectedTagInput}
                        disabled={isLoading || tags.length === 0}
                        style={{ width: '100%' }}
                      />
                    </div>
                    {selectedTagInput && (
                      <CommandList>
                        {tags
                          .filter(
                            (tag) =>
                              !selectedTags.includes(tag.id) &&
                              tag.name.toLowerCase().includes(selectedTagInput.toLowerCase())
                          )
                          .map((tag) => (
                            <CommandItem
                              key={tag.id}
                              value={tag.id}
                              onSelect={() => handleTagSelect(tag.id)}
                              className='cursor-pointer'
                            >
                              <div className='flex items-center'>
                                <div
                                  className='w-3 h-3 rounded-full mr-2'
                                  style={{ backgroundColor: tag.color || '#6E6E6E' }}
                                />
                                {tag.name}
                              </div>
                            </CommandItem>
                          ))}
                        {tags.filter(
                          (tag) =>
                            !selectedTags.includes(tag.id) &&
                            tag.name.toLowerCase().includes(selectedTagInput.toLowerCase())
                        ).length === 0 && (
                          <CommandEmpty>No tags found matching "{selectedTagInput}"</CommandEmpty>
                        )}
                      </CommandList>
                    )}
                  </Command>

                  {selectedTags.length > 0 && (
                    <div className='flex flex-wrap gap-1 mt-2'>
                      {selectedTags.map((tagId) => (
                        <Badge
                          key={tagId}
                          variant='secondary'
                          className='flex items-center gap-1'
                        >
                          {getTagName(tagId)}
                          <X
                            className='h-3 w-3 cursor-pointer'
                            onClick={() => handleTagRemove(tagId)}
                          />
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
            name='tracklist'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tracklist</FormLabel>
                <FormControl>
                  <Textarea
                    disabled={isLoading}
                    placeholder='Enter the tracklist (one track per line)'
                    rows={5}
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Add each track on a new line in the format: Artist - Track Title
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='extraDetails'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Details</FormLabel>
                <FormControl>
                  <Textarea
                    disabled={isLoading}
                    placeholder='Any additional details or notes'
                    rows={3}
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            Location
          </h2>

          <FormField
            control={form.control}
            name='location'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Command
                  className='w-full border rounded-none relative'
                  shouldFilter={false}
                >
                  <div className='relative'>
                    <CommandInput
                      placeholder='Type to search for a location'
                      value={selectedLocation ? selectedLocation.title : locationInput}
                      onValueChange={handleLocationInputChange}
                      disabled={isLoading || locations.length === 0}
                      style={{ width: '100%' }}
                    />
                    {selectedLocation && (
                      <button
                        type='button'
                        aria-label='Clear location selection'
                        onClick={() => {
                          setSelectedLocation(undefined);
                          setLocationInput('');
                          field.onChange('');
                        }}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden'
                        tabIndex={0}
                      >
                        <X className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                  {locationInput && (
                    <CommandList>
                      {locations
                        .filter((location) =>
                          location.title.toLowerCase().includes(locationInput.toLowerCase())
                        )
                        .map((location) => (
                          <CommandItem
                            key={location.slug}
                            value={location.slug}
                            onSelect={() => handleLocationSelect(location)}
                            className='cursor-pointer'
                          >
                            {location.title}
                          </CommandItem>
                        ))}
                      {locations.filter((location) =>
                        location.title.toLowerCase().includes(locationInput.toLowerCase())
                      ).length === 0 && (
                        <CommandEmpty>No locations found matching "{locationInput}"</CommandEmpty>
                      )}
                    </CommandList>
                  )}
                </Command>
                <FormDescription>Select a location for this show</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            Media File
          </h2>
          <FormItem>
            <FormLabel>Upload Audio File</FormLabel>
            <Dropzone
              accept='audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/aac,audio/flac'
              disabled={isLoading}
              onFileSelect={setMediaFile}
              selectedFile={mediaFile}
              maxSize={600 * 1024 * 1024} // 600MB limit
            />
            <FormDescription>
              Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is
              600MB.
            </FormDescription>
          </FormItem>
        </div>

        <div className='flex justify-end'>
          <Button
            type='submit'
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
