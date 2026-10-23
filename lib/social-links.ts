import * as SimpleIcons from 'simple-icons';
import { getPublicObject } from '@/lib/cosmic-public';

export type SocialLink = { icon: string; link: string };

/** A social link with its icon SVG resolved on the server, safe to pass to client components. */
export type ResolvedSocialLink = { href: string; label: string; svg: string };

type SimpleIcon = { title: string; svg: string };

export function getSocialIcon(iconName: string): SimpleIcon | undefined {
  return (SimpleIcons as unknown as Record<string, SimpleIcon | undefined>)[iconName];
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const response = await getPublicObject(
      { type: 'social-links', slug: 'social-links' },
      { props: 'slug,title,metadata,type', depth: 1 }
    );
    return response.object?.metadata?.social_link || [];
  } catch (error) {
    console.error('Social links unavailable:', error);
    return [];
  }
}

export function resolveSocialLinks(links: SocialLink[]): ResolvedSocialLink[] {
  return links.flatMap(link => {
    const icon = getSocialIcon(link.icon);
    if (!icon || !link.link) return [];

    return [
      {
        href: link.link,
        label: icon.title,
        svg: icon.svg.replace(/<path /g, '<path fill="currentColor" '),
      },
    ];
  });
}
