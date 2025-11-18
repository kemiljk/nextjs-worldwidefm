'use client';

import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function Combobox({
  options,
  value = [],
  onValueChange,
  placeholder = 'SELECT',
  searchPlaceholder = 'SEARCH',
  emptyMessage = 'No options found.',
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Sort options alphabetically
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }, [options]);

  const selectedLabels = React.useMemo(() => {
    return value.map(v => options.find(opt => opt.value === v)?.label).filter(Boolean);
  }, [value, options]);

  const displayText = selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder;

  const handleSelect = (selectedValue: string) => {
    const newValue = value.includes(selectedValue)
      ? value.filter(v => v !== selectedValue)
      : [...value, selectedValue];
    onValueChange(newValue);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn(
            'w-full justify-between border-almostblack dark:border-white text-almostblack dark:text-white',
            value.length > 0 && 'bg-almostblack text-white dark:bg-white dark:text-almostblack',
            className
          )}
        >
          <span className='truncate'>{displayText}</span>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='max-w-50 w-full p-0 font-mono uppercase' align='start' sideOffset={4}>
        <Command className='flex flex-col max-h-[300px]' onWheel={(e) => e.stopPropagation()}>
          <CommandInput className='font-mono uppercase flex-shrink-0' placeholder={searchPlaceholder} />
          <CommandList className='flex-1 min-h-0 overflow-y-auto overflow-x-hidden'>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {sortedOptions.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                  className='rounded-[90px] cursor-pointer'
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
