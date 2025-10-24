'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MultiSelectOption {
  id: string;
  title: string;
  slug?: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
}

export function MultiSelectDropdown({
  options,
  selectedValues,
  onSelectionChange,
  placeholder,
  className,
}: MultiSelectDropdownProps) {
  const handleToggleSelection = (value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  const displayText =
    selectedValues.length > 0 ? `${placeholder} (${selectedValues.length})` : placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'border-almostblack dark:border-white justify-between text-almostblack dark:text-white',
            selectedValues.length > 0 &&
              'bg-almostblack text-white dark:bg-white dark:text-almostblack',
            className
          )}
        >
          {displayText}
          <ChevronDown
            className={cn(
              'h-4 w-4',
              selectedValues.length > 0
                ? 'text-white dark:text-almostblack'
                : 'opacity-50 text-almostblack dark:text-white'
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-56 max-h-60 overflow-y-auto'>
        {options.map(option => {
          const isSelected = selectedValues.includes(option.slug || option.title);
          return (
            <div
              key={option.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer uppercase rounded-xl font-mono',
                'hover:bg-almostblack hover:text-white dark:hover:bg-white',
                isSelected ? 'bg-almostblack text-white dark:bg-white dark:text-almostblack' : ''
              )}
              onClick={() => handleToggleSelection(option.slug || option.title)}
            >
              {option.title}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
