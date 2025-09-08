'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Dropzone } from '@/components/ui/dropzone';
import { toast } from 'sonner';
import { RadioCultArtist } from '@/lib/radiocult-service';

// Form schema using zod
const artistFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  instagram: z
    .string()
    .optional()
    .refine((val) => !val || !val.includes('instagram.com'), {
      message: "Please enter just the handle (e.g., 'username'), not the full URL",
    }),
  twitter: z
    .string()
    .optional()
    .refine((val) => !val || (!val.includes('twitter.com') && !val.includes('x.com')), {
      message: "Please enter just the handle (e.g., 'username'), not the full URL",
    }),
  facebook: z
    .string()
    .optional()
    .refine((val) => !val || !val.includes('facebook.com'), {
      message: "Please enter just the handle (e.g., 'username'), not the full URL",
    }),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  mixcloud: z
    .string()
    .optional()
    .refine((val) => !val || !val.includes('mixcloud.com'), {
      message: "Please enter just the handle (e.g., 'username'), not the full URL",
    }),
  soundcloud: z
    .string()
    .optional()
    .refine((val) => !val || !val.includes('soundcloud.com'), {
      message: "Please enter just the handle (e.g., 'username'), not the full URL",
    }),
});

type ArtistFormValues = z.infer<typeof artistFormSchema>;

interface AddNewArtistProps {
  onArtistCreated: (artist: RadioCultArtist) => void;
}

// Function to upload image to Cosmic only via API route
async function uploadToCosmicOnly(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Error uploading to Cosmic:', error);
    return null;
  }
}

export function AddNewArtist({ onArtistCreated }: AddNewArtistProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Initialize form
  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(artistFormSchema),
    defaultValues: {
      name: '',
      description: '',
      instagram: '',
      twitter: '',
      facebook: '',
      website: '',
      mixcloud: '',
      soundcloud: '',
    },
  });

  // Handle form submission
  const onSubmit = async (values: ArtistFormValues) => {
    setIsLoading(true);

    try {
      // Upload image if provided
      let imageUrl: string | undefined = undefined;
      if (imageFile) {
        const uploadedUrl = await uploadToCosmicOnly(imageFile);
        if (!uploadedUrl) {
          throw new Error('Failed to upload image');
        }
        imageUrl = uploadedUrl;
      }

      // Create social links object
      const socialLinks: Record<string, string> = {};

      if (values.instagram) socialLinks.instagram = values.instagram;
      if (values.twitter) socialLinks.twitter = values.twitter;
      if (values.facebook) socialLinks.facebook = values.facebook;
      if (values.website) socialLinks.website = values.website;
      if (values.mixcloud) socialLinks.mixcloud = values.mixcloud;
      if (values.soundcloud) socialLinks.soundcloud = values.soundcloud;

      // Send request to create artist
      const response = await fetch('/api/artists/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          imageUrl,
          socialLinks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create artist');
      }

      const data = await response.json();

      toast.success('Artist created successfully!');

      // Close the dialog and reset form
      setOpen(false);
      form.reset();
      setImageFile(null);

      // Notify parent component
      onArtistCreated(data.artist);
    } catch (error) {
      console.error('Error creating artist:', error);
      toast.error('Failed to create artist', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
        >
          Add New Artist
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Add a New Artist</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Artist name'
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
                      placeholder='Artist description'
                      rows={3}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Artist Image</FormLabel>
              <Dropzone
                accept='image/*'
                disabled={isLoading}
                onFileSelect={setImageFile}
                selectedFile={imageFile}
                maxSize={10 * 1024 * 1024} // 10MB limit for images
                className='cursor-pointer'
              />
              <FormDescription>
                Upload an image of the artist. Maximum file size is 10MB.
              </FormDescription>
            </FormItem>

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='instagram'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Instagram handle'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='twitter'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Twitter</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Twitter handle'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='facebook'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facebook</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Facebook page'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='website'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://example.com'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='mixcloud'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mixcloud</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Mixcloud handle'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='soundcloud'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Soundcloud</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Soundcloud handle'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type='submit'
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Artist'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
