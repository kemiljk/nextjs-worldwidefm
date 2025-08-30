"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import SearchDialog from "./search-dialog";

export function SearchButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" className="rounded-full border border-almostblack dark:border-white lg:w-[128px] h-10 text-base font-mono uppercase justify-start text-muted-foreground hover:bg-almostblack hover:text-white dark:text-white transition-colors px-4 mr-4 dark:hover:bg-white dark:hover:text-almostblack" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
        Search
      </Button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
