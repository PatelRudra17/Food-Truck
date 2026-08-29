"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { globalSearchAction, type SearchResultGroup } from "@/lib/actions/search-actions";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const runSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setGroups([]);
      return;
    }
    startTransition(async () => {
      const result = await globalSearchAction(value);
      setGroups(result);
    });
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-full max-w-sm justify-start gap-2 text-muted-foreground sm:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search items, vehicles, drivers...</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Search across the system..."
          value={query}
          onValueChange={runSearch}
        />
        <CommandList>
          {!isPending && query.trim().length >= 2 && groups.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {query.trim().length < 2 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          )}
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
