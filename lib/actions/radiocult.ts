'use server';

import { getHostByName, getHosts } from '../cosmic-service';

export async function getHostProfileUrl(hostName: string): Promise<string | null> {
  try {
    let host = await getHostByName(hostName);

    if (!host) {
      const allHosts = await getHosts({ limit: 1000 });
      host = allHosts.objects.find(
        (h: any) =>
          h.title.toLowerCase().includes(hostName.toLowerCase()) ||
          hostName.toLowerCase().includes(h.title.toLowerCase())
      );
    }

    if (host) {
      return `/hosts/${(host as any).slug}`;
    }

    return null;
  } catch (error) {
    console.error('Error getting host profile URL:', error);
    return null;
  }
}
