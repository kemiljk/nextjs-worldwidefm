import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ResolvedSocialLink } from '@/lib/social-links';

interface SocialIconsProps {
  links: ResolvedSocialLink[];
  className?: string;
  iconClassName?: string;
}

export function SocialIcons({ links, className, iconClassName }: SocialIconsProps) {
  if (links.length === 0) return null;

  return (
    <ul className={cn('flex items-center gap-3', className)}>
      {links.map(link => (
        <li key={link.href}>
          <Link
            href={link.href}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={link.label}
            className='flex text-almostblack dark:text-white hover:text-almostblack/40 dark:hover:text-white/40 transition-colors'
          >
            <span
              aria-hidden='true'
              dangerouslySetInnerHTML={{ __html: link.svg }}
              className={cn('h-4 w-4 [&_svg]:h-full [&_svg]:w-full', iconClassName)}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
