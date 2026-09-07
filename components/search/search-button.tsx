'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';

const loadSearchDialog = () => import('./search-dialog');
const SearchDialog = dynamic(loadSearchDialog);

export function SearchButton() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <>
      <Button
        aria-label='Open search'
        variant='ghost'
        onPointerEnter={() => void loadSearchDialog()}
        onFocus={() => void loadSearchDialog()}
        onClick={() => {
          setHasOpened(true);
          setOpen(true);
        }}
        className='w-10 h-10 font-mono uppercase text-muted-foreground hover:bg-almostblack hover:text-white dark:text-white transition-colors dark:hover:bg-white dark:hover:text-almostblack'
      >
        <Search className='shrink-0 overflow-visible' />
      </Button>
      {hasOpened && <SearchDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
