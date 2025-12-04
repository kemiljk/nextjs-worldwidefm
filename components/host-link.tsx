import Link from 'next/link';
import { getHostProfileUrl } from '@/lib/actions';

interface HostLinkProps {
  hostName: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Component that renders a link to host profile if it exists, otherwise renders plain text
 */
export async function HostLink({ hostName, className = '', children }: HostLinkProps) {
  // Handle missing or invalid hostName
  if (!hostName || typeof hostName !== 'string') {
    return <span className={className}>{children || 'Unknown Host'}</span>;
  }

  const profileUrl = await getHostProfileUrl(hostName);

  if (profileUrl) {
    return (
      <Link href={profileUrl} className={className}>
        {children || hostName}
      </Link>
    );
  }

  return <span className={className}>{children || hostName}</span>;
}

/**
 * Client-side version that uses a fallback approach
 */
export function ClientHostLink({ hostName, className = '', children }: HostLinkProps) {
  // Handle missing or invalid hostName
  if (!hostName || typeof hostName !== 'string') {
    return <span className={className}>{children || 'Unknown Host'}</span>;
  }

  // Generate a basic slug from the host name for fallback
  const fallbackSlug = hostName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return (
    <Link href={`/hosts/${fallbackSlug}`} className={className}>
      {children || hostName}
    </Link>
  );
}
