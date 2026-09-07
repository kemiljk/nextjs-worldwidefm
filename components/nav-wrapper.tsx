import { getCachedNavigation } from '@/lib/cached-data';
import { getUserFromCookie } from '@/cosmic/blocks/user-management/actions';
import Navbar from './navbar';

export default async function NavWrapper() {
  let navItems = [];
  let user = null;

  try {
    const response = await getCachedNavigation();
    if (response.object?.metadata?.item && Array.isArray(response.object.metadata.item)) {
      navItems = response.object.metadata.item;
    }
    user = await getUserFromCookie();
  } catch (error) {
    console.error('Error fetching navigation or user:', error);
  }

  return <Navbar navItems={navItems} initialUser={user} />;
}
