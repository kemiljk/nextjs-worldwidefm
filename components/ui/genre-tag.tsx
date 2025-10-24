import { cn } from '@/lib/utils';
import Link from 'next/link';

interface GenreTagProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'white' | 'transparent' | 'light';
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const GenreTag: React.FC<GenreTagProps> = ({
  children,
  className = '',
  variant = 'default',
  href,
  onClick,
}) => {
  const baseClasses = 'border-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase';

  const variantClasses = {
    default: 'border-almostblack dark:border-white text-almostblack dark:text-white',
    white: 'border-white text-white',
    transparent:
      'border-almostblack dark:border-white text-almostblack dark:text-white bg-transparent',
    light: 'border-black text-black',
  };

  const tagClasses = cn(baseClasses, variantClasses[variant], className);

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          tagClasses,
          'hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack transition-colors cursor-pointer'
        )}
        onClick={onClick}
      >
        {children}
      </Link>
    );
  }

  return (
    <span
      className={cn(
        tagClasses,
        onClick &&
          'hover:bg-almostblack hover:text-white dark:hover:bg-white dark:hover:text-almostblack transition-colors cursor-pointer'
      )}
      onClick={onClick}
    >
      {children}
    </span>
  );
};
