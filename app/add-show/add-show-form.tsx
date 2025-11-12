'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { RadioCultArtist, getArtists } from '@/lib/radiocult-service';
import { CosmicLocation, getCosmicLocations } from '@/lib/cosmic-location-service';
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
import { fetchGenres } from '@/lib/actions';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { Dropzone } from '@/components/ui/dropzone';
import { FormTexts, getDefaultFormTexts } from '@/lib/form-text-service';
import { compressImage } from '@/lib/image-compression';

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
  const MAX_MEDIA_MB = Number(process.env.NEXT_PUBLIC_MAX_MEDIA_UPLOAD_MB || 600);
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
  const [artists, setArtists] = useState<RadioCultArtist[]>([]);
  const [genres, setGenres] = useState<CosmicGenre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedGenreInput, setSelectedGenreInput] = useState<string>('');
  const [locations, setLocations] = useState<CosmicLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CosmicLocation | undefined>(undefined);
  const [locationInput, setLocationInput] = useState<string>('');
  const [artistInput, setArtistInput] = useState<string>('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isArtistListOpen, setIsArtistListOpen] = useState<boolean>(false);
  const [isGenreListOpen, setIsGenreListOpen] = useState<boolean>(false);
  const [isLocationListOpen, setIsLocationListOpen] = useState<boolean>(false);
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
      duration: '60',
      tracklist: '',
      extraDetails: '',
      tags: [],
      featuredOnHomepage: false,
      location: undefined,
    },
  });

  // Fetch artists, genres, locations, and form texts when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch data in parallel
        const [artistList, genresResult, locationsList, formTextsResponse] = await Promise.all([
          getArtists(),
          fetchGenres(),
          getCosmicLocations(),
          fetch('/api/form-texts').then(res => res.json()),
        ]);

        setArtists(artistList);
        if (genresResult.success) {
          setGenres(genresResult.genres ?? []);
        } else {
          toast.error('Failed to load genres');
        }
        setLocations(locationsList);

        if (formTextsResponse.success && formTextsResponse.formTexts) {
          setFormTexts(formTextsResponse.formTexts);
        }
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

  // Handle artist selection
  const handleArtistSelect = (artist: RadioCultArtist) => {
    form.setValue('artistId', artist.id);
    setArtistInput(artist.name);
    setIsArtistListOpen(false);
  };

  // Handle artist input change
  const handleArtistInputChange = (value: string) => {
    setArtistInput(value);
    setIsArtistListOpen(true);
    const selectedArtist = artists.find(a => a.id === form.watch('artistId'));
    if (selectedArtist && value !== selectedArtist.name) {
      form.setValue('artistId', '');
    }
  };

  // Update form value when selected genres change
  useEffect(() => {
    form.setValue('tags', selectedGenres);
  }, [selectedGenres, form]);

  // Sync artist input with selected artist
  useEffect(() => {
    const selectedArtistId = form.watch('artistId');
    if (selectedArtistId) {
      const selectedArtist = artists.find(a => a.id === selectedArtistId);
      if (selectedArtist) {
        setArtistInput(selectedArtist.name);
      }
    }
  }, [form.watch('artistId'), artists]);

  // Handle newly created artist
  const handleArtistCreated = (newArtist: RadioCultArtist) => {
    // Add the new artist to the artists list
    setArtists(prevArtists => [newArtist, ...prevArtists]);

    // Select the newly created artist
    form.setValue('artistId', newArtist.id);

    toast.success(`Artist "${newArtist.name}" added to the list`);
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
    return genre ? genre.title : genreId;
  };

  // Handle creating another show
  const handleCreateAnother = () => {
    setIsSubmitted(false);
    setSubmittedShowTitle('');
    setArtistInput('');
    setLocationInput('');
    setSelectedLocation(undefined);
    setSelectedGenres([]);
    setSelectedGenreInput('');
    // Form is already reset from the previous submission
  };

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setPhase('preparing');

    try {
      let radiocultMediaId: string | undefined = undefined;
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
        console.log('🎵 Starting media upload...');
        const formData = new FormData();
        formData.append('media', mediaFile);
        formData.append(
          'metadata',
          JSON.stringify({
            title: values.title,
            artist: artists.find(a => a.id === values.artistId)?.name || undefined,
          })
        );

        try {
          const uploadResponse = await fetch('/api/upload-media', {
            method: 'POST',
            body: formData,
          });

          console.log('🎵 Media upload response status:', uploadResponse.status);

          if (!uploadResponse.ok) {
            const status = uploadResponse.status;
            const contentType = uploadResponse.headers.get('content-type') || '';
            let errorMessage = 'Failed to upload media';

            if (status === 413) {
              // Payload too large – likely exceeds platform proxy/function limits
              errorMessage =
                'The selected file is too large for the server to accept. Please upload a smaller file.';
            } else if (contentType.includes('application/json')) {
              try {
                const uploadError = await uploadResponse.json();
                errorMessage = uploadError.error || uploadError.message || errorMessage;
              } catch (parseError) {
                // Fall through to text/body-less handling
              }
            } else {
              try {
                const text = await uploadResponse.text();
                if (text && text.length < 500) {
                  errorMessage = `${errorMessage}: ${text}`;
                }
              } catch (_) {
                // ignore
              }
            }

            throw new Error(`${errorMessage} (HTTP ${status})`);
          }

          const uploadResult = await uploadResponse.json();
          radiocultMediaId = uploadResult.radiocultMediaId;
          cosmicMedia = uploadResult.cosmicMedia;

          console.log('✅ Media upload result:', {
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
          setPhase('uploadedMedia');
        } catch (mediaError) {
          console.error('❌ Media upload failed:', mediaError);
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
        setArtistInput('');
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
          <p className='text-gray-600 max-w-md'>
            "<strong>{submittedShowTitle}</strong>" has been submitted for approval. Once approved,
            it will be published to RadioCult and appear on your station.
          </p>
        </div>

        <div className='flex flex-col sm:flex-row gap-3'>
          <Button onClick={handleCreateAnother} className='flex items-center gap-2'>
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
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <Select disabled={isLoading} onValueChange={field.onChange} value={field.value}>
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
                              className='text-almostblack hover:bg-white hover:text-almostblack dark:hover:bg-almostblack dark:hover:text-white'
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
                  <Select disabled={isLoading} onValueChange={field.onChange} value={field.value}>
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
                              className='text-almostblack hover:bg-white hover:text-almostblack dark:hover:bg-almostblack dark:hover:text-white'
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
            {formTexts.artist?.title || 'Artist'}
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
                  className='w-full border border-input rounded-none relative'
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
                  {artistInput && isArtistListOpen && (
                    <CommandList onClickOutside={() => setIsArtistListOpen(false)}>
                      {artists
                        .filter(artist =>
                          artist.name.toLowerCase().includes(artistInput.toLowerCase())
                        )
                        .map(artist => (
                          <CommandItem
                            key={artist.id}
                            value={artist.id}
                            onSelect={() => handleArtistSelect(artist)}
                            className='cursor-pointer'
                          >
                            {artist.name}
                          </CommandItem>
                        ))}
                      {artists.filter(artist =>
                        artist.name.toLowerCase().includes(artistInput.toLowerCase())
                      ).length === 0 && (
                        <CommandEmpty>No artists found matching "{artistInput}"</CommandEmpty>
                      )}
                    </CommandList>
                  )}
                </Command>
                <FormDescription>
                  {formTexts.artist?.descriptions['artist-select'] ||
                    'Select the main artist for this show or add a new one'}
                </FormDescription>
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
                        {genres
                          .filter(
                            genre =>
                              !selectedGenres.includes(genre.id) &&
                              genre.title.toLowerCase().includes(selectedGenreInput.toLowerCase())
                          )
                          .map(genre => (
                            <CommandItem
                              key={genre.id}
                              value={genre.id}
                              onSelect={() => handleGenreSelect(genre.id)}
                              className='cursor-pointer'
                            >
                              {genre.title}
                            </CommandItem>
                          ))}
                        {genres.filter(
                          genre =>
                            !selectedGenres.includes(genre.id) &&
                            genre.title.toLowerCase().includes(selectedGenreInput.toLowerCase())
                        ).length === 0 && (
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
                            className='cursor-pointer'
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
              maxSize={600 * 1024 * 1024}
              placeholder='Drag and drop your audio file here'
            />
            <FormDescription>
              {formTexts['media-file']?.descriptions['upload-audio'] ||
                'Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is 600MB.'}
            </FormDescription>
          </FormItem>
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
