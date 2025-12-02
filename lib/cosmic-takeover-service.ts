import { cosmic } from './cosmic-config';

export interface CosmicTakeover {
  id: string;
  slug: string;
  title: string;
  type: 'takeovers';
  metadata?: {
    description?: string | null;
    image?: { url: string; imgix_url: string } | null;
  } | null;
}

export async function getCosmicTakeovers(): Promise<CosmicTakeover[]> {
  try {
    const response = await cosmic.objects
      .find({ 
        type: 'takeovers',
        status: 'published',
      })
      .limit(1000)
      .props('id,slug,title,type,metadata')
      .depth(1);

    if (!response.objects || !Array.isArray(response.objects)) {
      throw new Error('Invalid response format from Cosmic API');
    }

    return response.objects.map((takeover: any) => ({
      id: takeover.id,
      slug: takeover.slug,
      title: takeover.title,
      type: 'takeovers' as const,
      metadata: takeover.metadata || null,
    }));
  } catch (error) {
    console.error('Error fetching Cosmic takeovers:', error);
    return [];
  }
}

