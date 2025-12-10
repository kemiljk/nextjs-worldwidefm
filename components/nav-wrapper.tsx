import { unstable_cache } from 'next/cache';
import { getNavigation } from '@/lib/cosmic-service';
import Navbar from './navbar';

const getCachedNavigation = unstable_cache(
  async () => getNavigation(),
  ['navigation'],
  { revalidate: 3600, tags: ['navigation'] }
);

export default async function NavWrapper() {
  let navItems = [];

  try {
    const response = await getCachedNavigation();
    if (response.object?.metadata?.item && Array.isArray(response.object.metadata.item)) {
      navItems = response.object.metadata.item;
    }
  } catch (error) {
    console.error('Error fetching navigation:', error);
  }

  return <Navbar navItems={navItems} />;
}
