import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cosmic } from '@/lib/cosmic-config';

const createHostSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  image: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createHostSchema.parse(body);

    const slug = validatedData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const createData: any = {
      type: 'regular-hosts',
      title: validatedData.name,
      slug: slug,
      status: 'published',
    };

    const metadata: any = {};
    
    if (validatedData.description) {
      metadata.description = validatedData.description;
    }

    if (validatedData.image && validatedData.image.name) {
      metadata.image = validatedData.image.name;
    }

    if (Object.keys(metadata).length > 0) {
      createData.metadata = metadata;
    }

    const hostObject = await cosmic.objects.insertOne(createData);

    if (!hostObject || !hostObject.object) {
      return NextResponse.json({ error: 'Failed to create host' }, { status: 500 });
    }

    const createdHost = {
      id: hostObject.object.id,
      slug: hostObject.object.slug,
      title: hostObject.object.title,
      type: 'regular-hosts' as const,
      metadata: hostObject.object.metadata || null,
    };

    return NextResponse.json({
      success: true,
      host: createdHost,
    });
  } catch (error) {
    console.error('Error creating host:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create host',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
