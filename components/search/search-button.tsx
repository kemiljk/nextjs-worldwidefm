"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import SearchDialog from "./search-dialog";

export function SearchButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" className="lg:w-[200px] h-16 lg:border-l border-foreground justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <Search className="mr-2 h-4 w-4" />
        Search
      </Button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
