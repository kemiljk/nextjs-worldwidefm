"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import SearchDialog from "./search-dialog";

export function SearchButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="w-10 h-10 font-mono uppercase text-muted-foreground hover:bg-almostblack hover:text-white dark:text-white transition-colors dark:hover:bg-white dark:hover:text-almostblack"
      >
        <Search className="shrink-0 overflow-visible" />
      </Button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}