'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CosmicLocation, getCosmicLocations } from '@/lib/cosmic-location-service';
import { CosmicTakeover, getCosmicTakeovers } from '@/lib/cosmic-takeover-service';
import { CosmicHost, getCosmicHosts } from '@/lib/cosmic-host-service';
import { usePlausible } from 'next-plausible';
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

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { X, CheckCircle, ArrowLeft, Check, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fetchGenres } from '@/lib/actions';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from '@/components/ui/command';
import { Dropzone } from '@/components/ui/dropzone';
import { FormTexts, getDefaultFormTexts } from '@/lib/form-text-service';
import { compressImage } from '@/lib/image-compression';
import { uploadMediaToRadioCultAndCosmic } from '@/lib/actions/radiocult';
import { upload } from '@vercel/blob/client';
import { AddNewHost } from './add-new-host';

// Form schema using zod
const formSchema = z.object({
  title: z.string().min(3, {
    message: 'Show title must be at least 3 characters',
  }),
  description: z.string().optional(),
  hostId: z.string({
    required_error: 'Please select a host or series',
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
  isLive: z.boolean().default(false),
  takeover: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CosmicGenre {
  id: string;
  slug: string;
  title: string;
  type: string;
  metadata?: {
    description?: string | null;
    image?: { url: string; imgix_url: string } | null;
  } | null;
}

export function AddShowForm() {
  const MAX_MEDIA_MB = Number(process.env.NEXT_PUBLIC_MAX_MEDIA_UPLOAD_MB || 300);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  type SubmissionPhase =
    | 'idle'
    | 'preparing'
    | 'uploadingImage'
    | 'uploadedImage'
    | 'uploadingMedia'
    | 'uploadedMedia'
    | 'creatingShow'
    | 'success'
    | 'error';
  const [phase, setPhase] = useState<SubmissionPhase>('idle');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedShowTitle, setSubmittedShowTitle] = useState<string>('');
  const [hosts, setHosts] = useState<CosmicHost[]>([]);
  const [genres, setGenres] = useState<CosmicGenre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedGenreInput, setSelectedGenreInput] = useState<string>('');
  const [locations, setLocations] = useState<CosmicLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CosmicLocation | undefined>(undefined);
  const [locationInput, setLocationInput] = useState<string>('');
  const [takeovers, setTakeovers] = useState<CosmicTakeover[]>([]);
  const [selectedTakeover, setSelectedTakeover] = useState<CosmicTakeover | undefined>(undefined);
  const [takeoverInput, setTakeoverInput] = useState<string>('');
  const [hostInput, setHostInput] = useState<string>('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isHostListOpen, setIsHostListOpen] = useState<boolean>(false);
  const [isGenreListOpen, setIsGenreListOpen] = useState<boolean>(false);
  const [isLocationListOpen, setIsLocationListOpen] = useState<boolean>(false);
  const [isTakeoverListOpen, setIsTakeoverListOpen] = useState<boolean>(false);
  const [openStartTime, setOpenStartTime] = useState<boolean>(false);
  const [openDuration, setOpenDuration] = useState<boolean>(false);
  const [formTexts, setFormTexts] = useState<FormTexts>(getDefaultFormTexts());
  const plausible = usePlausible();

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      startDate: '',
      startTime: '',
      duration: '1',
      tracklist: '',
      extraDetails: '',
      tags: [],
      featuredOnHomepage: false,
      location: undefined,
      isLive: false,
      takeover: undefined,
    },
  });

  // Fetch hosts, genres, locations, and form texts when component mounts
  useEffect(() => {
    const fetchData = async () => {
      // We don't set global isLoading to true here anymore so the form
      // is instantly interactive for text fields (title, desc, etc.)
      try {
        // Fetch data in parallel
        const [hostsList, genresResult, locationsList, takeoversList, formTextsResponse] =
          await Promise.all([
            getCosmicHosts(),
            fetchGenres(),
            getCosmicLocations(),
            getCosmicTakeovers(),
            fetch('/api/form-texts').then(res => res.json()),
          ]);

        setHosts(hostsList);
        if (genresResult.success) {
          setGenres(genresResult.genres ?? []);
        } else {
          toast.error('Failed to load genres');
        }
        setLocations(locationsList);
        setTakeovers(takeoversList);

        if (formTextsResponse.success && formTextsResponse.formTexts) {
          setFormTexts(formTextsResponse.formTexts);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      }
    };

    fetchData();
  }, []);

  // Handle location selection
  const handleLocationSelect = (location: CosmicLocation) => {
    setSelectedLocation(location);
    setLocationInput(location.title);
    form.setValue('location', location.slug);
    setIsLocationListOpen(false);
  };

  // Handle location input change
  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    setIsLocationListOpen(true);
    if (selectedLocation && value !== selectedLocation.title) {
      setSelectedLocation(undefined);
      form.setValue('location', '');
    }
  };

  // Handle takeover selection
  const handleTakeoverSelect = (takeover: CosmicTakeover) => {
    setSelectedTakeover(takeover);
    setTakeoverInput(takeover.title);
    form.setValue('takeover', takeover.id);
    setIsTakeoverListOpen(false);
  };

  // Handle takeover input change
  const handleTakeoverInputChange = (value: string) => {
    setTakeoverInput(value);
    setIsTakeoverListOpen(true);
    if (selectedTakeover && value !== selectedTakeover.title) {
      setSelectedTakeover(undefined);
      form.setValue('takeover', '');
    }
  };

  // Handle host selection
  const handleHostSelect = (host: CosmicHost) => {
    form.setValue('hostId', host.id);
    setHostInput(host.title);
    setIsHostListOpen(false);
  };

  // Handle host input change
  const handleHostInputChange = (value: string) => {
    setHostInput(value);
    setIsHostListOpen(true);
    const selectedHost = hosts.find(h => h.id === form.watch('hostId'));
    if (selectedHost && selectedHost.title && value !== selectedHost.title) {
      form.setValue('hostId', '');
    }
  };

  const matchingHosts = useMemo(() => {
    if (!hostInput) return hosts.slice(0, 50);
    const lowerInput = hostInput.toLowerCase();
    return hosts.filter(host => host.title && host.title.toLowerCase().includes(lowerInput));
  }, [hosts, hostInput]);

  const matchingTakeovers = useMemo(() => {
    if (!takeoverInput) return takeovers.slice(0, 50);
    const lowerInput = takeoverInput.toLowerCase();
    return takeovers.filter(t => t.title && t.title.toLowerCase().includes(lowerInput));
  }, [takeovers, takeoverInput]);

  const matchingGenres = useMemo(() => {
    const lowerInput = selectedGenreInput.toLowerCase();
    return genres.filter(
      genre =>
        genre.title &&
        !selectedGenres.includes(genre.id) &&
        genre.title.toLowerCase().includes(lowerInput)
    );
  }, [genres, selectedGenreInput, selectedGenres]);

  // Update form value when selected genres change
  useEffect(() => {
    form.setValue('tags', selectedGenres);
  }, [selectedGenres, form]);

  // Sync host input with selected host
  useEffect(() => {
    const selectedHostId = form.watch('hostId');
    if (selectedHostId) {
      const selectedHost = hosts.find(h => h.id === selectedHostId);
      if (selectedHost && selectedHost.title) {
        setHostInput(selectedHost.title);
      }
    }
  }, [form.watch('hostId'), hosts]);

  const handleHostCreated = (newHost: CosmicHost) => {
    setHosts(prevHosts => [newHost, ...prevHosts]);
    form.setValue('hostId', newHost.id);
    setHostInput(newHost.title);
    setIsHostListOpen(false);
    toast.success(`Host "${newHost.title || 'Unknown'}" added and selected`);
  };

  // Handle genre selection
  const handleGenreSelect = (genreId: string) => {
    if (!selectedGenres.includes(genreId)) {
      setSelectedGenres([...selectedGenres, genreId]);
      setSelectedGenreInput('');
      setIsGenreListOpen(false);
    }
  };

  // Handle genre removal
  const handleGenreRemove = (genreId: string) => {
    setSelectedGenres(selectedGenres.filter(id => id !== genreId));
  };

  // Get genre title by ID
  const getGenreTitle = (genreId: string) => {
    const genre = genres.find(g => g.id === genreId);
    return genre?.title || genreId;
  };

  // Handle creating another show
  const handleCreateAnother = () => {
    setIsSubmitted(false);
    setSubmittedShowTitle('');
    setHostInput('');
    setLocationInput('');
    setSelectedLocation(undefined);
    setTakeoverInput('');
    setSelectedTakeover(undefined);
    setSelectedGenres([]);
    setSelectedGenreInput('');
    // Form is already reset from the previous submission
  };

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setPhase('preparing');

    try {
      let radiocultMediaId: string | null | undefined = undefined;
      let cosmicMedia: any = undefined;
      let cosmicImage: any = undefined;

      console.log('🚀 Starting form submission:', {
        title: values.title,
        hasImageFile: !!imageFile,
        hasMediaFile: !!mediaFile,
        imageSize: imageFile ? `${(imageFile.size / 1024 / 1024).toFixed(2)}MB` : 'N/A',
        mediaSize: mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(2)}MB` : 'N/A',
      });

      // Upload image file separately if provided
      if (imageFile) {
        setPhase('uploadingImage');
        console.log('📸 Starting image upload...');

        try {
          let fileToUpload = imageFile;

          if (imageFile.size > 2 * 1024 * 1024) {
            console.log('📸 Compressing image before upload...');
            toast.info('Compressing image...');
            fileToUpload = await compressImage(imageFile, 2, 2000);
            console.log('📸 Image compressed successfully');
          }

          const imageFormData = new FormData();
          imageFormData.append('image', fileToUpload);

          const imageUploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            body: imageFormData,
          });

          console.log('📸 Image upload response status:', imageUploadResponse.status);

          if (!imageUploadResponse.ok) {
            let errorMessage = 'Failed to upload image';
            try {
              const imageError = await imageUploadResponse.json();
              errorMessage = imageError.error || errorMessage;
            } catch (parseError) {
              console.error('Failed to parse image error response:', parseError);
              errorMessage = `Failed to upload image (HTTP ${imageUploadResponse.status})`;
            }
            throw new Error(errorMessage);
          }

          const imageResult = await imageUploadResponse.json();
          cosmicImage = imageResult;

          console.log('✅ Image uploaded successfully:', imageResult);
          toast.success('Image uploaded successfully');
          setPhase('uploadedImage');
        } catch (imageError) {
          console.error('❌ Image upload failed:', imageError);
          setPhase('error');
          throw new Error(
            `Image upload failed: ${imageError instanceof Error ? imageError.message : 'Unknown error'}`
          );
        }
      }

      // Upload media file separately if provided
      if (mediaFile) {
        if (mediaFile.size > MAX_MEDIA_MB * 1024 * 1024) {
          throw new Error(
            `Selected audio file is ${(mediaFile.size / 1024 / 1024).toFixed(
              1
            )}MB which exceeds the ${MAX_MEDIA_MB}MB limit.`
          );
        }

        setPhase('uploadingMedia');
        console.log('🎵 Starting client-side media upload to Vercel Blob...');

        try {
          // Upload directly from client to bypass Vercel 4.5MB/15MB server action limit
          const blob = await upload(mediaFile.name, mediaFile, {
            access: 'public',
            handleUploadUrl: '/api/upload-media/token',
          });

          console.log('✅ Media uploaded to Vercel Blob:', blob.url);

          const mediaFormData = new FormData();
          // We pass the URL instead of the file to the server action
          mediaFormData.append('mediaUrl', blob.url);
          mediaFormData.append(
            'metadata',
            JSON.stringify({
              title: values.title,
              artist: hosts.find(h => h.id === values.hostId)?.title || undefined,
            })
          );

          console.log('📝 Calling server action to process media via URL...');
          const uploadResult = await uploadMediaToRadioCultAndCosmic(mediaFormData);

          console.log('🎵 Media processing result:', uploadResult);

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to process media');
          }

          radiocultMediaId = uploadResult.radiocultMediaId;
          cosmicMedia = uploadResult.cosmicMedia;

          // Show info message if RadioCult upload was skipped or failed
          if (!uploadResult.radiocultMediaId) {
            if (uploadResult.radiocultError) {
              toast.warning('RadioCult Upload Failed', {
                description: `Media uploaded to Cosmic but failed for RadioCult: ${uploadResult.radiocultError}`,
                duration: 6000,
              });
            } else if (uploadResult.message) {
              toast.info('Media Upload Info', {
                description: uploadResult.message,
              });
            }
          } else {
            toast.success('Media Upload Success', {
              description: `Successfully uploaded to both RadioCult (ID: ${uploadResult.radiocultMediaId}) and Cosmic`,
            });
          }
          setPhase('uploadedMedia');
        } catch (mediaError) {
          console.error('❌ Media upload/processing failed:', mediaError);
          // Do not abort submission; continue without media
          toast.warning('Audio upload failed — continuing without attaching media', {
            description:
              mediaError instanceof Error ? mediaError.message : 'Unknown error during upload',
          });
          // Reset media-related variables to ensure clean payload
          radiocultMediaId = undefined;
          cosmicMedia = undefined;
          setPhase('uploadedMedia');
        }
      }

      // Convert tracklist newlines to <br /> for rich text storage
      const processedTracklist = values.tracklist
        ? values.tracklist.replace(/\n/g, '<br />')
        : undefined;

      // Create the show in Cosmic
      console.log('📝 Creating show in Cosmic...');
      setPhase('creatingShow');
      try {
        const response = await fetch('/api/shows/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...values,
            tracklist: processedTracklist,
            status: 'draft',
            radiocult_media_id: radiocultMediaId,
            media_file: cosmicMedia,
            image: cosmicImage,
          }),
        });

        console.log('📝 Show creation response status:', response.status);

        if (!response.ok) {
          let errorMessage = 'Failed to create show';
          try {
            const error = await response.json();
            errorMessage = error.message || error.error || errorMessage;
          } catch (parseError) {
            console.error('Failed to parse show creation error response:', parseError);
            errorMessage = `Failed to create show (HTTP ${response.status})`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('✅ Show created successfully:', data);

        // Track successful show submission
        plausible('Show Submitted', {
          props: {
            title: values.title,
            hasMedia: !!mediaFile,
            hasImage: !!imageFile,
            genreCount: selectedGenres.length,
          },
        });

        // Set success state
        setSubmittedShowTitle(values.title);
        setIsSubmitted(true);
        setPhase('success');

        toast.success('Show submitted successfully!');

        // Reset the form for potential next submission
        form.reset();
        setSelectedGenres([]);
        setSelectedLocation(undefined);
        setLocationInput('');
        setSelectedTakeover(undefined);
        setTakeoverInput('');
        setHostInput('');
        setMediaFile(null);
        setImageFile(null);
      } catch (createError) {
        console.error('❌ Show creation failed:', createError);
        setPhase('error');
        throw new Error(
          `Show creation failed: ${createError instanceof Error ? createError.message : 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('❌ Form submission failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Track show submission error
      plausible('Show Submission Error', {
        props: {
          error: errorMessage,
          phase: phase,
        },
      });

      toast.error('Failed to submit show', {
        description: errorMessage,
        duration: 10000,
      });

      // Log to console for debugging
      console.error('Full error details:', {
        error,
        errorType: error?.constructor?.name,
        errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
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
          <h2 className='text-2xl font-semibold text-almostblack dark:text-white'>
            Show Submitted Successfully!
          </h2>
          <p className='text-neutral-600 max-w-md'>
            "<strong>{submittedShowTitle}</strong>" has been submitted for approval. Once approved,
            it will be published to RadioCult and appear on your station.
          </p>
        </div>

        <div className='flex flex-col sm:flex-row gap-3'>
          <Button onClick={handleCreateAnother} className='flex items-center gap-2 px-4'>
            <ArrowLeft className='w-4 h-4' />
            Upload Another Show
          </Button>
          <Button variant='outline' onClick={() => (window.location.href = '/')}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <div className='space-y-4 mb-12'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            {formTexts['show-details']?.title || 'Show Details'}
          </h2>

          <FormField
            control={form.control}
            name='isLive'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start space-x-3 space-y-0 border p-4'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className='space-y-1 leading-none'>
                  <FormLabel className='cursor-pointer'>Is this a live show?</FormLabel>
                  <FormDescription>
                    Check this box if the show is being broadcast live, otherwise it will be marked
                    as pre-recorded.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Show Title</FormLabel>
                <FormControl>
                  <Input disabled={isLoading} placeholder='Enter show title' {...field} />
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
                    <Input disabled={isLoading} type='date' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='startTime'
              render={({ field }) => (
                <FormItem className='flex flex-col mt-8 md:mt-0'>
                  <FormLabel>Start Time</FormLabel>
                  <Popover open={openStartTime} onOpenChange={setOpenStartTime}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant='outline'
                          role='combobox'
                          aria-expanded={openStartTime}
                          className={cn(
                            'z-60 flex h-auto w-full items-center justify-between gap-2 rounded-xl border-almostblack bg-almostblack px-3 py-1.5 font-mono uppercase text-[12px] text-white hover:bg-almostblack/90 hover:text-white dark:bg-white dark:text-almostblack dark:hover:bg-white/90',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? field.value : 'Select start time'}
                          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className='w-[200px] p-0' align='start'>
                      <Command>
                        <CommandInput placeholder='Search time...' className='h-9' />
                        <CommandList>
                          <CommandEmpty>No time found.</CommandEmpty>
                          <CommandGroup>
                            {Array.from({ length: 48 }, (_, i) => {
                              const hour = Math.floor(i / 2);
                              const minute = (i % 2) * 30;
                              const timeString = `${hour.toString().padStart(2, '0')}:${minute
                                .toString()
                                .padStart(2, '0')}`;
                              return (
                                <CommandItem
                                  key={timeString}
                                  value={timeString}
                                  onSelect={currentValue => {
                                    form.setValue('startTime', currentValue);
                                    setOpenStartTime(false);
                                  }}
                                  className='cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800 data-[selected=true]:text-almostblack dark:data-[selected=true]:text-white'
                                >
                                  {timeString}
                                  <Check
                                    className={cn(
                                      'ml-auto h-4 w-4',
                                      field.value === timeString ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='duration'
              render={({ field }) => (
                <FormItem className='flex flex-col'>
                  <FormLabel>Duration</FormLabel>
                  <Popover open={openDuration} onOpenChange={setOpenDuration}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant='outline'
                          role='combobox'
                          aria-expanded={openDuration}
                          className={cn(
                            'z-60 flex h-auto w-full items-center justify-between gap-2 rounded-xl border-almostblack bg-almostblack px-3 py-1.5 font-mono uppercase text-[12px] text-white hover:bg-almostblack/90 hover:text-white dark:bg-white dark:text-almostblack dark:hover:bg-white/90',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value
                            ? (() => {
                                // If the value is just a number (like "2"), append "h"
                                if (/^\d+$/.test(field.value)) return `${field.value}h`;
                                // If it's like "1:45", format as "1h 45m"
                                if (field.value.includes(':')) {
                                  const [hours, minutes] = field.value.split(':');
                                  return `${hours}h ${minutes}m`;
                                }
                                return field.value;
                              })()
                            : 'Select duration'}
                          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className='w-[200px] p-0' align='start'>
                      <Command>
                        <CommandInput placeholder='Search duration...' className='h-9' />
                        <CommandList>
                          <CommandEmpty>No duration found.</CommandEmpty>
                          <CommandGroup>
                            {Array.from({ length: 24 }, (_, i) => {
                              const minutes = (i + 1) * 30;
                              const hours = Math.floor(minutes / 60);
                              const remainingMinutes = minutes % 60;

                              let value = '';
                              let displayText = '';

                              if (hours > 0 && remainingMinutes === 0) {
                                // e.g. 1h, 2h
                                value = `${hours}`;
                                displayText = `${hours}h`;
                              } else if (hours > 0) {
                                // e.g. 1:15
                                value = `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
                                displayText = `${hours}h ${remainingMinutes}m`;
                              } else {
                                // e.g. 0:45
                                value = `0:${remainingMinutes.toString().padStart(2, '0')}`;
                                displayText = `${remainingMinutes}m`;
                              }

                              return (
                                <CommandItem
                                  key={value}
                                  value={`${value} ${displayText}`}
                                  onSelect={() => {
                                    form.setValue('duration', value);
                                    setOpenDuration(false);
                                  }}
                                  className='cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800 data-[selected=true]:text-almostblack dark:data-[selected=true]:text-white'
                                >
                                  {displayText}
                                  <Check
                                    className={cn(
                                      'ml-auto h-4 w-4',
                                      field.value === value ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            {formTexts['show-image']?.title || 'Show Image'}
          </h2>
          <FormItem>
            <FormLabel>Upload Show Image</FormLabel>
            <Dropzone
              accept='image/jpeg,image/jpg,image/png,image/webp'
              disabled={isLoading}
              onFileSelect={setImageFile}
              selectedFile={imageFile}
              maxSize={5 * 1024 * 1024}
              placeholder='Drag and drop your show image here'
            />
            <FormDescription>
              {formTexts['show-image']?.descriptions['upload-image'] ||
                'Upload a square image (1:1 aspect ratio recommended) for your show. Maximum file size is 5MB (images will be automatically compressed). Accepts JPG, PNG, or WebP.'}
            </FormDescription>
          </FormItem>
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            {formTexts.artist?.title || 'Host or Series'}
          </h2>

          <FormField
            control={form.control}
            name='hostId'
            render={({ field }) => {
              const showAddButton =
                hostInput &&
                hostInput.trim().length >= 2 &&
                matchingHosts.length === 0 &&
                !field.value;

              return (
                <FormItem>
                  <div className='flex justify-between items-center'>
                    <FormLabel>Host or Series</FormLabel>
                    {showAddButton && (
                      <AddNewHost onHostCreated={handleHostCreated} initialName={hostInput} />
                    )}
                  </div>
                  <Command
                    className='w-full border border-input rounded-none relative'
                    shouldFilter={false}
                  >
                    <div className='relative'>
                      <CommandInput
                        placeholder='Type to search for a host or series'
                        value={hostInput}
                        onValueChange={handleHostInputChange}
                        disabled={isLoading || hosts.length === 0}
                        style={{ width: '100%' }}
                      />
                      {field.value && (
                        <button
                          type='button'
                          aria-label='Clear host selection'
                          onClick={() => {
                            field.onChange('');
                            setHostInput('');
                          }}
                          className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden'
                          tabIndex={0}
                        >
                          <X className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                    {hostInput && isHostListOpen && (
                      <CommandList onClickOutside={() => setIsHostListOpen(false)}>
                        {matchingHosts.map(host => (
                          <CommandItem
                            key={host.id}
                            value={host.id}
                            onSelect={() => handleHostSelect(host)}
                            className='cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800 data-[selected=true]:text-almostblack dark:data-[selected=true]:text-white'
                          >
                            {host.title}
                          </CommandItem>
                        ))}
                        {matchingHosts.length === 0 && (
                          <CommandEmpty>
                            No hosts or series found matching "{hostInput}"
                          </CommandEmpty>
                        )}
                      </CommandList>
                    )}
                  </Command>
                  <FormDescription>
                    {formTexts.artist?.descriptions['artist-select'] ||
                      'Select the main host or series for this show'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name='takeover'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Takeover</FormLabel>
                <Command
                  className='w-full border border-input rounded-none relative'
                  shouldFilter={false}
                >
                  <div className='relative'>
                    <CommandInput
                      placeholder='Type to search for a takeover'
                      value={selectedTakeover ? selectedTakeover.title : takeoverInput}
                      onValueChange={handleTakeoverInputChange}
                      disabled={isLoading || takeovers.length === 0}
                      style={{ width: '100%' }}
                    />
                    {selectedTakeover && (
                      <button
                        type='button'
                        aria-label='Clear takeover selection'
                        onClick={() => {
                          setSelectedTakeover(undefined);
                          setTakeoverInput('');
                          field.onChange('');
                        }}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden'
                        tabIndex={0}
                      >
                        <X className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                  {takeoverInput && isTakeoverListOpen && (
                    <CommandList onClickOutside={() => setIsTakeoverListOpen(false)}>
                      {matchingTakeovers.map(takeover => (
                        <CommandItem
                          key={takeover.id}
                          value={takeover.id}
                          onSelect={() => handleTakeoverSelect(takeover)}
                          className='cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800 data-[selected=true]:text-almostblack dark:data-[selected=true]:text-white'
                        >
                          {takeover.title}
                        </CommandItem>
                      ))}
                      {matchingTakeovers.length === 0 && (
                        <CommandEmpty>No takeovers found matching "{takeoverInput}"</CommandEmpty>
                      )}
                    </CommandList>
                  )}
                </Command>
                <FormDescription>Select a takeover this show belongs to (optional)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            {formTexts['additional-information']?.title || 'Additional Information'}
          </h2>

          <FormField
            control={form.control}
            name='tags'
            render={() => (
              <FormItem>
                <FormLabel>Genres</FormLabel>
                <div className='space-y-2'>
                  <Command
                    className='w-full border border-input rounded-none relative'
                    shouldFilter={false}
                  >
                    <div className='relative'>
                      <CommandInput
                        placeholder='Type to search for genres'
                        value={selectedGenreInput}
                        onValueChange={value => {
                          setSelectedGenreInput(value);
                          setIsGenreListOpen(true);
                        }}
                        disabled={isLoading || genres.length === 0}
                        style={{ width: '100%' }}
                      />
                    </div>
                    {selectedGenreInput && isGenreListOpen && (
                      <CommandList onClickOutside={() => setIsGenreListOpen(false)}>
                        {matchingGenres.map(genre => (
                          <CommandItem
                            key={genre.id}
                            value={genre.id}
                            onSelect={() => handleGenreSelect(genre.id)}
                            className='cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800 data-[selected=true]:text-almostblack dark:data-[selected=true]:text-white'
                          >
                            {genre.title}
                          </CommandItem>
                        ))}
                        {matchingGenres.length === 0 && (
                          <CommandEmpty>
                            No genres found matching "{selectedGenreInput}"
                          </CommandEmpty>
                        )}
                      </CommandList>
                    )}
                  </Command>

                  {selectedGenres.length > 0 && (
                    <div className='flex flex-wrap gap-1 mt-2'>
                      {selectedGenres.map(genreId => (
                        <Badge
                          key={genreId}
                          variant='secondary'
                          className='flex items-center gap-1'
                        >
                          {getGenreTitle(genreId)}
                          <X
                            className='h-3 w-3 cursor-pointer'
                            onClick={() => handleGenreRemove(genreId)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <FormDescription>
                  {formTexts['additional-information']?.descriptions.genres ||
                    'Select genres to categorize this show'}
                </FormDescription>
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
                  {
                    'Add each track on a new line in the format: Artist - Track [Record Label]. Example: Aphex Twin - Avril 14th [Warp Records]. The record label in square brackets is optional.'
                  }
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
            {formTexts.location?.title || 'Location'}
          </h2>

          <FormField
            control={form.control}
            name='location'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Command
                  className='w-full border border-input rounded-none relative'
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
                  {locationInput && isLocationListOpen && (
                    <CommandList onClickOutside={() => setIsLocationListOpen(false)}>
                      {locations
                        .filter(location =>
                          location.title.toLowerCase().includes(locationInput.toLowerCase())
                        )
                        .map(location => (
                          <CommandItem
                            key={location.slug}
                            value={location.slug}
                            onSelect={() => handleLocationSelect(location)}
                            className='cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800 data-[selected=true]:text-almostblack dark:data-[selected=true]:text-white'
                          >
                            {location.title}
                          </CommandItem>
                        ))}
                      {locations.filter(location =>
                        location.title.toLowerCase().includes(locationInput.toLowerCase())
                      ).length === 0 && (
                        <CommandEmpty>No locations found matching "{locationInput}"</CommandEmpty>
                      )}
                    </CommandList>
                  )}
                </Command>
                <FormDescription>
                  {formTexts.location?.descriptions['location-select'] ||
                    'Select a location for this show'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='space-y-4'>
          <h2 className='text-h7 font-display uppercase font-normal text-almostblack dark:text-white'>
            {formTexts['media-file']?.title || 'Media File'}
          </h2>
          <FormItem>
            <FormLabel>Upload Audio File</FormLabel>
            <Dropzone
              accept='audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/aac,audio/flac'
              disabled={isLoading}
              onFileSelect={setMediaFile}
              selectedFile={mediaFile}
              maxSize={MAX_MEDIA_MB * 1024 * 1024}
              placeholder='Drag and drop your audio file here'
            />
            <FormDescription>
              {formTexts['media-file']?.descriptions['upload-audio'] ||
                `Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is ${MAX_MEDIA_MB}MB.`}
            </FormDescription>
          </FormItem>
        </div>

        <div className='bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 text-sm text-zinc-700 dark:text-zinc-300'>
          <p className='font-medium text-zinc-900 dark:text-white'>
            Please take the time to read this carefully, and double check everything before you
            upload. Please also be aware we will only broadcast shows that have been submitted via
            this form. Thank you for contributing to Worldwide FM!
          </p>

          <div className='space-y-3'>
            <p>
              We are a small station with limited resources and staff, so please follow these
              instructions carefully and correctly, else we cannot guarantee your show will be
              broadcast and archived correctly.
            </p>

            <div className='space-y-1.5'>
              <p className='font-medium text-zinc-900 dark:text-white'>Deadline</p>
              <p>
                We need to receive your show a minimum <strong>one week</strong> before its
                scheduled broadcast. As our staff are all part-time, delivering by this deadline is
                very important, and we will not be able to guarantee it is broadcast if we do not
                receive it by then.
              </p>
            </div>

            <div className='space-y-1.5'>
              <p className='font-medium text-zinc-900 dark:text-white'>Audio Requirements</p>
              <ul className='list-disc list-inside space-y-1 ml-1'>
                <li>Please add a WWFM Jingle at the beginning of your show</li>
                <li>
                  Audio Format: <strong>320 MP3</strong>
                </li>
              </ul>
            </div>

            <div className='space-y-1.5'>
              <p className='font-medium text-zinc-900 dark:text-white'>Mixcloud Limitations</p>
              <p>
                Mixcloud has licensing limitations: you may only play <strong>3 songs</strong> from
                the same album (no more than 2 consecutively), and maximum <strong>4 songs</strong>{' '}
                (no more than 3 consecutively) from the same artist. Stick to this else we will not
                be able to archive your show.
              </p>
            </div>

            <p className='pt-1'>
              Once you have completed this form, please drop an email to your point(s) of contact at
              the station and let us know everything has been submitted.
            </p>
          </div>
        </div>

        <div className='flex justify-end'>
          <Button type='submit' className='px-2' disabled={isLoading}>
            {isLoading
              ? phase === 'preparing'
                ? 'Preparing submission…'
                : phase === 'uploadingImage'
                  ? 'Uploading image…'
                  : phase === 'uploadedImage'
                    ? 'Image uploaded ✓'
                    : phase === 'uploadingMedia'
                      ? 'Uploading audio…'
                      : phase === 'uploadedMedia'
                        ? 'Audio uploaded ✓'
                        : phase === 'creatingShow'
                          ? 'Creating show…'
                          : 'Submitting…'
              : 'Submit for Approval'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
