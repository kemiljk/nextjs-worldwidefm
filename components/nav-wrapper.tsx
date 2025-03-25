import { getNavigation } from '@/lib/cosmic-service';
import Navbar from './navbar';

// Default navigation items as fallback
const defaultNavItems = [
  { name: 'Shows', link: '/shows' },
  { name: 'Schedule', link: '/schedule' },
  { name: 'Editorial', link: '/editorial' },
  { name: 'About', link: '/about' },
];

export default async function NavWrapper() {
  let navItems = defaultNavItems;

  try {
    const response = await getNavigation();
    if (response.object?.metadata?.item && Array.isArray(response.object.metadata.item)) {
      navItems = response.object.metadata.item;
    }
  } catch (error) {
    console.error('Error fetching navigation:', error);
    // Use default navItems as fallback
  }

  return <Navbar navItems={navItems} />;
}
