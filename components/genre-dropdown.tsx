'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GenreDropdownProps {
  genres: string[];
  onSelect: (genre: string | null) => void;
  selectedGenre: string | null;
}

export function GenreDropdown({ genres, onSelect, selectedGenre }: GenreDropdownProps) {
  return (
    <Select
      onValueChange={value => onSelect(value === 'all' ? null : value)}
      value={selectedGenre || 'all'}
    >
      <SelectTrigger className='w-auto hover:bg-almostblack'>
        <SelectValue placeholder='Select genre' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>All Genres</SelectItem>
        {genres.map(genre => (
          <SelectItem key={genre} value={genre}>
            {genre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
