import { cosmic } from './cosmic-config';

export interface CosmicHost {
  id: string;
  slug: string;
  title: string;
  type: 'regular-hosts';
  metadata?: {
    description?: string | null;
    image?: { url: string; imgix_url: string } | null;
  } | null;
}

export async function getCosmicHosts(): Promise<CosmicHost[]> {
  try {
    const response = await cosmic.objects
      .find({ 
        type: 'regular-hosts',
        status: 'published',
      })
      .limit(1000)
      .props('id,slug,title,type,metadata')
      .depth(1);

    if (!response.objects || !Array.isArray(response.objects)) {
      throw new Error('Invalid response format from Cosmic API');
    }

    return response.objects.map((host: any) => ({
      id: host.id,
      slug: host.slug,
      title: host.title,
      type: 'regular-hosts' as const,
      metadata: host.metadata || null,
    }));
  } catch (error) {
    console.error('Error fetching Cosmic hosts:', error);
    return [];
  }
}

