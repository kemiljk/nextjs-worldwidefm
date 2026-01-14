'use client';

import { useState, useEffect } from 'react';
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
import { CosmicHost } from '@/lib/cosmic-host-service';

const hostFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});

type HostFormValues = z.infer<typeof hostFormSchema>;

interface AddNewHostProps {
  onHostCreated: (host: CosmicHost) => void;
  initialName?: string;
}

async function uploadToCosmicOnly(file: File): Promise<any> {
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
    return data.media || null;
  } catch (error) {
    console.error('Error uploading to Cosmic:', error);
    return null;
  }
}

export function AddNewHost({ onHostCreated, initialName = '' }: AddNewHostProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const form = useForm<HostFormValues>({
    resolver: zodResolver(hostFormSchema),
    defaultValues: {
      name: initialName,
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initialName,
        description: '',
      });
      setImageFile(null);
    }
  }, [open, initialName, form]);

  const onSubmit = async (values: HostFormValues) => {
    setIsLoading(true);

    try {
      let imageMedia: any = undefined;
      if (imageFile) {
        const uploadedMedia = await uploadToCosmicOnly(imageFile);
        if (!uploadedMedia) {
          throw new Error('Failed to upload image');
        }
        imageMedia = uploadedMedia;
      }

      const response = await fetch('/api/hosts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          image: imageMedia,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to create host');
      }

      const data = await response.json();

      toast.success('Host created successfully!');

      setOpen(false);
      form.reset({
        name: '',
        description: '',
      });
      setImageFile(null);

      onHostCreated(data.host);
    } catch (error) {
      console.error('Error creating host:', error);
      toast.error('Failed to create host', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' type='button'>
          Add Host
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Add a New Host</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder='Host name' {...field} />
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
                      placeholder='Host description (optional)'
                      rows={3}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    You can add more details later in Cosmic CMS if needed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Host Image</FormLabel>
              <Dropzone
                accept='image/jpeg,image/jpg,image/png,image/webp'
                disabled={isLoading}
                onFileSelect={setImageFile}
                selectedFile={imageFile}
                maxSize={10 * 1024 * 1024}
                placeholder='Drag and drop host image here (optional)'
              />
              <FormDescription>
                Upload an image for the host. Maximum file size is 10MB. Accepts JPG, PNG, or WebP.
              </FormDescription>
            </FormItem>

            <DialogFooter>
              <Button type='submit' disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Host'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
