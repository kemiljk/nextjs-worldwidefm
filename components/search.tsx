'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search as SearchIcon } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { useEffect, useRef } from 'react';

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Search({ value, onChange, placeholder = 'Search...', className }: SearchProps) {
  const plausible = usePlausible();
  const previousValueRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (value && value.length >= 3 && value !== previousValueRef.current) {
      timeoutRef.current = setTimeout(() => {
        plausible('Search Query Entered', {
          props: {
            searchLength: value.length,
          },
        });
        previousValueRef.current = value;
      }, 1000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, plausible]);

  return (
    <div className={cn('relative', className)}>
      <SearchIcon className='absolute h-4 w-4 text-muted-foreground' />
      <Input
        type='search'
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className=''
      />
    </div>
  );
}
