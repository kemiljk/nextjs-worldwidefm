'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Download, List, X } from 'lucide-react';
import type { ShowListItem } from '@/lib/export-shows-service';
import { toast } from 'sonner';

export interface HostOrSeriesOption {
  id: string;
  slug: string;
  title: string;
}

interface ExportShowsFormProps {
  options: HostOrSeriesOption[];
}

export function ExportShowsForm({ options }: ExportShowsFormProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HostOrSeriesOption | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [shows, setShows] = useState<ShowListItem[] | null>(null);
  const [isLoadingShows, setIsLoadingShows] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options.slice(0, 50);
    const term = search.trim().toLowerCase();
    return options.filter(option => option.title.toLowerCase().includes(term)).slice(0, 50);
  }, [options, search]);

  const handleViewShows = async () => {
    if (!selected) return;

    setIsLoadingShows(true);
    try {
      const params = new URLSearchParams({
        slug: selected.slug,
        includeDrafts: String(includeDrafts),
        format: 'json',
      });
      const response = await fetch(`/api/export-shows?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load shows');
      setShows(data.shows || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load shows');
    } finally {
      setIsLoadingShows(false);
    }
  };

  const handleDownload = async () => {
    if (!selected) {
      toast.error('Please select a host or series first');
      return;
    }

    setIsDownloading(true);

    try {
      const params = new URLSearchParams({
        slug: selected.slug,
        includeDrafts: String(includeDrafts),
      });

      const response = await fetch(`/api/export-shows?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed');
      }

      const blob = await response.blob();
      const filename =
        response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ||
        `${selected.slug}.csv`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('CSV downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className='space-y-6 max-w-xl'>
      <div className='space-y-2'>
        <Label htmlFor='host-or-series'>Host or Series</Label>
        <Command className='w-full border border-input rounded-none relative' shouldFilter={false}>
          <div className='relative'>
            <CommandInput
              id='host-or-series'
              placeholder='Search for a host or series'
              value={selected ? selected.title : search}
              onFocus={() => {
                if (!selected) setIsOpen(true);
              }}
              onValueChange={value => {
                setSearch(value);
                setIsOpen(true);
                if (selected) setSelected(null);
              }}
              disabled={isDownloading}
            />
            {selected && (
              <button
                type='button'
                aria-label='Clear selection'
                onClick={() => {
                  setSelected(null);
                  setShows(null);
                  setSearch('');
                  setIsOpen(true);
                }}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                <X className='w-4 h-4' />
              </button>
            )}
          </div>
          {isOpen && !selected && (
            <CommandList onClickOutside={() => setIsOpen(false)}>
              {filteredOptions.map(option => (
                <CommandItem
                  key={option.id}
                  value={option.slug}
                  onSelect={() => {
                    setSelected(option);
                    setShows(null);
                    setSearch(option.title);
                    setIsOpen(false);
                  }}
                  className='cursor-pointer'
                >
                  {option.title}
                </CommandItem>
              ))}
              {filteredOptions.length === 0 && (
                <CommandEmpty>
                  {options.length === 0
                    ? 'No hosts or series available.'
                    : `No matches for “${search.trim()}”.`}
                </CommandEmpty>
              )}
            </CommandList>
          )}
        </Command>
        {options.length > 0 && (
          <p className='text-sm text-muted-foreground'>{options.length} hosts available</p>
        )}
      </div>

      <div className='flex items-center gap-2'>
        <Checkbox
          id='include-drafts'
          checked={includeDrafts}
          onCheckedChange={checked => setIncludeDrafts(checked === true)}
          disabled={isDownloading}
        />
        <Label htmlFor='include-drafts' className='font-normal cursor-pointer'>
          Include draft episodes
        </Label>
      </div>

      <div className='flex flex-wrap gap-3'>
        <Button
          type='button'
          onClick={handleDownload}
          disabled={!selected || isDownloading}
          className='gap-2'
        >
          <Download className='w-4 h-4' />
          {isDownloading ? 'Preparing download...' : 'Download CSV'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={handleViewShows}
          disabled={!selected || isLoadingShows}
          className='gap-2'
        >
          <List className='w-4 h-4' />
          {isLoadingShows ? 'Loading shows...' : 'View shows'}
        </Button>
      </div>

      {shows && (
        <div className='space-y-2'>
          <p className='text-sm text-muted-foreground'>
            {shows.length} show{shows.length === 1 ? '' : 's'}, newest first. Search Cosmic by slug
            to open one.
          </p>
          {shows.length > 0 && (
            <div className='overflow-x-auto border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted text-left'>
                  <tr>
                    <th className='px-3 py-2 font-medium'>Date</th>
                    <th className='px-3 py-2 font-medium'>Title</th>
                    <th className='px-3 py-2 font-medium'>Slug</th>
                    <th className='px-3 py-2 font-medium'>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shows.map(show => (
                    <tr key={show.id} className='border-t align-top'>
                      <td className='px-3 py-2 whitespace-nowrap font-mono'>
                        {show.broadcastDate.split('-').reverse().join('/')}
                      </td>
                      <td className='px-3 py-2'>
                        {show.episodeUrl ? (
                          <a
                            href={show.episodeUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='underline underline-offset-2'
                          >
                            {show.title}
                          </a>
                        ) : (
                          show.title
                        )}
                      </td>
                      <td className='px-3 py-2 font-mono text-xs break-all'>{show.slug}</td>
                      <td className='px-3 py-2 capitalize'>{show.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
