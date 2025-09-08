import { cosmic } from './cosmic-config';

export interface CosmicLocation {
  slug: string;
  title: string;
  type: 'locations';
  metadata: {
    description: string | null;
    image: string | null;
  };
}

export async function getCosmicLocations(): Promise<CosmicLocation[]> {
  try {
    const response = await cosmic.objects
      .find({ type: 'locations' })
      .limit(1000)
      .props('slug,title,metadata,type')
      .depth(1);

    if (!response.objects || !Array.isArray(response.objects)) {
      throw new Error('Invalid response format from Cosmic API');
    }

    return response.objects.map((location: any) => ({
      slug: location.slug,
      title: location.title,
      type: 'locations' as const,
      metadata: {
        description: location.metadata?.description || null,
        image: location.metadata?.image || null,
      },
    }));
  } catch (error) {
    console.error('Error fetching Cosmic locations:', error);
    // Return a fallback list of major locations
    return getFallbackLocations();
  }
}

function getFallbackLocations(): CosmicLocation[] {
  return [
    {
      slug: 'berlin',
      title: 'Berlin',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'tokyo',
      title: 'Tokyo',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'new-york',
      title: 'New York',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'los-angeles',
      title: 'Los Angeles',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'miami',
      title: 'Miami',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'atlanta',
      title: 'Atlanta',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'portland',
      title: 'Portland',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'boston',
      title: 'Boston',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'asia',
      title: 'Asia',
      type: 'locations',
      metadata: { description: null, image: null },
    },
    {
      slug: 'europe',
      title: 'Europe',
      type: 'locations',
      metadata: { description: null, image: null },
    },
  ];
}
