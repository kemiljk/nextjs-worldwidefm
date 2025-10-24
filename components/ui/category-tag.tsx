'use client';

import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CategoryTagProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'white' | 'transparent' | 'light';
  categorySlug?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const CategoryTag: React.FC<CategoryTagProps> = ({
  children,
  className = '',
  variant = 'default',
  categorySlug,
  onClick,
}) => {
  const router = useRouter();

  const baseClasses =
    'border-1 rounded-full px-2 py-0.5 text-[9px] md:text-[10px] font-mono uppercase';

  const variantClasses = {
    default: 'border-almostblack dark:border-white text-almostblack dark:text-white',
    white: 'border-white text-white',
    transparent:
      'border-almostblack dark:border-white text-almostblack dark:text-white bg-transparent',
    light: 'border-black text-black',
  };

  const tagClasses = cn(baseClasses, variantClasses[variant], className);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onClick) {
      onClick(e);
    } else if (categorySlug) {
      // Navigate to editorial page filtered by category
      router.push(`/editorial?categories=${categorySlug}`);
    }
  };

  return (
    <span
      className={cn(
        tagClasses,
        'hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack transition-colors cursor-pointer'
      )}
      onClick={handleClick}
    >
      {children}
    </span>
  );
};
