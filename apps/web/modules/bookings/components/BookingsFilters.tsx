"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@coss/ui/components/avatar";
import { Badge } from "@coss/ui/components/badge";
import { Button, buttonVariants } from "@coss/ui/components/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "@coss/ui/components/combobox";
import { Group, GroupSeparator, GroupText } from "@coss/ui/components/group";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@coss/ui/components/menu";
import { Separator } from "@coss/ui/components/separator";
import { cn } from "@coss/ui/lib/utils";
import {
  ChevronsUpDownIcon,
  CopyIcon,
  EllipsisIcon,
  FunnelIcon,
  ListFilterIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type FilterOption = {
  id: string;
  label: string;
  avatar?: string | null;
};

export type FilterCategory = {
  id: string;
  label: string;
  options: FilterOption[];
};

export type ActiveFilter = {
  f: string;
  v?: string[];
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]?.charAt(0).toUpperCase() ?? "";
  }
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts[parts.length - 1]?.charAt(0) ?? "";
  return (first + last).toUpperCase();
}

function CountBadge({ count }: { count: number }) {
  return (
    <Badge className="tabular-nums" variant="secondary">
      +{count}
    </Badge>
  );
}

function SelectionDisplay({
  children,
  label,
  remainingCount,
}: {
  children?: React.ReactNode;
  label: string;
  remainingCount: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <span className="truncate">{label}</span>
      {remainingCount > 0 && <CountBadge count={remainingCount} />}
    </div>
  );
}

function MemberAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-5", className)}>
      {avatarUrl ? <AvatarImage alt={name} src={avatarUrl} /> : null}
      <AvatarFallback className="text-[0.5rem]">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

function useActiveFilters() {
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const addFilter = (columnId: string) => {
    if (!activeFilters.some((filter) => filter.f === columnId)) {
      setActiveFilters([...activeFilters, { f: columnId }]);
    }
  };

  const updateFilter = (columnId: string, values: string[]) => {
    setActiveFilters((prev) => {
      const exists = prev.some((filter) => filter.f === columnId);
      if (exists) {
        return prev.map((filter) => (filter.f === columnId ? { ...filter, v: values } : filter));
      }
      return [...prev, { f: columnId, v: values }];
    });
  };

  const removeFilter = (columnId: string) => {
    setActiveFilters((prev) => prev.filter((filter) => filter.f !== columnId));
  };

  const clearAll = () => {
    setActiveFilters([]);
  };

  return {
    activeFilters,
    addFilter,
    clearAll,
    removeFilter,
    updateFilter,
  };
}

function FilterMenu({
  hasFilters = false,
  onSelectFilter,
  activeFilterIds,
  filterCategories,
}: {
  hasFilters?: boolean;
  onSelectFilter: (categoryId: string) => void;
  activeFilterIds: string[];
  filterCategories: FilterCategory[];
}) {
  const availableCategories = filterCategories.filter((category) => !activeFilterIds.includes(category.id));

  if (availableCategories.length === 0 && hasFilters) {
    return null;
  }

  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="outline" />}>
        <ListFilterIcon />
        <span className="max-sm:sr-only">Add Filter</span>
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuGroup>
          <MenuGroupLabel>Filter by</MenuGroupLabel>
          {availableCategories.map((category) => (
            <MenuItem key={category.id} onClick={() => onSelectFilter(category.id)}>
              {category.label}
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

function ActiveFilterComponent({
  filter,
  category,
  onUpdate,
  onRemove,
  autoOpen = false,
}: {
  filter: ActiveFilter;
  category: FilterCategory;
  onUpdate: (values: string[]) => void;
  onRemove: () => void;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const hasAutoOpened = useRef(false);
  const [sortedItems, setSortedItems] = useState<FilterOption[]>(category.options);

  useEffect(() => {
    if (autoOpen && !hasAutoOpened.current) {
      setOpen(true);
      hasAutoOpened.current = true;
    }
  }, [autoOpen]);

  const selectedValues = filter.v ?? [];
  const selectedOptions = selectedValues
    .map((id) => category.options.find((opt) => opt.id === id))
    .filter((opt): opt is FilterOption => opt !== undefined);

  const renderTriggerContent = () => {
    if (selectedOptions.length === 0) return "Select";
    const firstOption = selectedOptions[0];
    const remainingCount = selectedOptions.length - 1;

    if (category.id === "userIds") {
      return (
        <SelectionDisplay label={firstOption?.label ?? ""} remainingCount={remainingCount}>
          <MemberAvatar avatarUrl={firstOption?.avatar} name={firstOption?.label ?? ""} />
        </SelectionDisplay>
      );
    }

    if (remainingCount > 0) {
      return <SelectionDisplay label={firstOption?.label ?? ""} remainingCount={remainingCount} />;
    }

    return firstOption?.label ?? "Select";
  };

  const handleValueChange = (newValue: FilterOption | FilterOption[] | null) => {
    if (Array.isArray(newValue)) {
      const newIds = newValue.map((v) => v.id);
      const existingIds = selectedValues.filter((id) => newIds.includes(id));
      const addedIds = newIds.filter((id) => !selectedValues.includes(id));
      onUpdate([...existingIds, ...addedIds]);
    } else if (newValue) {
      onUpdate([newValue.id]);
    } else {
      onUpdate([]);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const selected = category.options.filter((opt) => selectedValues.includes(opt.id));
      const unselected = category.options.filter((opt) => !selectedValues.includes(opt.id));
      setSortedItems([...selected, ...unselected]);
    }
    if (!isOpen && selectedValues.length === 0) {
      onRemove();
    }
  };

  return (
    <Group>
      <GroupText
        className={cn(
          buttonVariants({
            size: "sm",
            variant: "outline",
          }),
          "pointer-events-none"
        )}>
        <FunnelIcon />
        {category.label}
      </GroupText>
      <GroupSeparator />
      <Combobox
        autoHighlight
        items={sortedItems}
        multiple
        onOpenChange={handleOpenChange}
        onValueChange={handleValueChange}
        open={open}
        value={selectedOptions}>
        <ComboboxTrigger
          render={
            <Button
              className={selectedOptions.length === 0 ? "justify-between" : undefined}
              size="sm"
              variant="outline"
            />
          }>
          {renderTriggerContent()}
          {selectedOptions.length === 0 && <ChevronsUpDownIcon className="-me-1!" />}
        </ComboboxTrigger>
        <ComboboxPopup aria-label={`Select ${category.label}`}>
          <div className="border-b p-2">
            <ComboboxInput
              className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
              placeholder={`Search ${category.label.toLowerCase()}...`}
              showTrigger={false}
              startAddon={<SearchIcon />}
            />
          </div>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <ComboboxList>
            {(option: FilterOption) => (
              <ComboboxItem key={option.id} value={option}>
                {category.id === "userIds" ? (
                  <div className="flex items-center gap-2">
                    <MemberAvatar avatarUrl={option.avatar} name={option.label} />
                    <span>{option.label}</span>
                  </div>
                ) : (
                  option.label
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
      <GroupSeparator />
      <Button aria-label="Remove filter" onClick={onRemove} size="icon-sm" variant="outline">
        <XIcon />
      </Button>
    </Group>
  );
}

type SavedFilter = {
  id: string;
  isDefault?: boolean;
  label: string;
};

const defaultSavedFilters: SavedFilter[] = [
  { id: "my-bookings", isDefault: true, label: "My bookings" },
  { id: "team-meetings", label: "Team meetings" },
  { id: "client-calls", label: "Client calls" },
];

function SavedFiltersCombobox({ savedFilters = defaultSavedFilters }: { savedFilters?: SavedFilter[] }) {
  const [selectedFilter, setSelectedFilter] = useState<SavedFilter | null>(null);

  const handleClearSelection = () => {
    setSelectedFilter(null);
  };

  if (!selectedFilter) {
    return (
      <Combobox items={savedFilters} onValueChange={setSelectedFilter} value={selectedFilter}>
        <ComboboxTrigger render={<Button size="sm" variant="outline" />}>
          Saved Filters
          <ChevronsUpDownIcon />
        </ComboboxTrigger>
        <ComboboxPopup align="end" aria-label="Select saved filter">
          <div className="border-b p-2">
            <ComboboxInput
              className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
              placeholder="Search saved filters..."
              showTrigger={false}
              startAddon={<SearchIcon />}
            />
          </div>
          <ComboboxEmpty>No saved filters.</ComboboxEmpty>
          <ComboboxList>
            {(filter: SavedFilter) => (
              <ComboboxItem key={filter.id} value={filter}>
                {filter.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Group>
        <Combobox items={savedFilters} onValueChange={setSelectedFilter} value={selectedFilter}>
          <ComboboxTrigger render={<Button size="sm" variant="outline" />}>
            {selectedFilter.label}
            <ChevronsUpDownIcon />
          </ComboboxTrigger>
          <ComboboxPopup align="end" aria-label="Select saved filter">
            <div className="border-b p-2">
              <ComboboxInput
                className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                placeholder="Search saved filters..."
                showTrigger={false}
                startAddon={<SearchIcon />}
              />
            </div>
            <ComboboxEmpty>No saved filters.</ComboboxEmpty>
            <ComboboxList>
              {(filter: SavedFilter) => (
                <ComboboxItem key={filter.id} value={filter}>
                  {filter.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
        <GroupSeparator />
        <Button aria-label="Clear saved filter" onClick={handleClearSelection} size="icon-sm" variant="outline">
          <XIcon />
        </Button>
      </Group>
      <Menu>
        <MenuTrigger render={<Button aria-label="Edit saved filter" size="icon-sm" variant="outline" />}>
          <EllipsisIcon />
        </MenuTrigger>
        <MenuPopup align="end">
          {!selectedFilter.isDefault && (
            <MenuItem>
              <PencilIcon />
              Rename
            </MenuItem>
          )}
          <MenuItem>
            <CopyIcon />
            Duplicate
          </MenuItem>
          {!selectedFilter.isDefault && (
            <>
              <MenuSeparator />
              <MenuItem variant="destructive">
                <TrashIcon />
                Delete
              </MenuItem>
            </>
          )}
        </MenuPopup>
      </Menu>
    </div>
  );
}

export interface BookingsFiltersProps {
  filterCategories: FilterCategory[];
  savedFilters?: SavedFilter[];
}

export function BookingsFilters({ filterCategories, savedFilters }: BookingsFiltersProps) {
  const { activeFilters, addFilter, updateFilter, removeFilter, clearAll } = useActiveFilters();
  const [newlyAddedFilter, setNewlyAddedFilter] = useState<string | null>(null);

  const handleSelectFilter = (categoryId: string) => {
    addFilter(categoryId);
    setNewlyAddedFilter(categoryId);
  };

  const handleUpdateFilter = (columnId: string, values: string[]) => {
    updateFilter(columnId, values);
  };

  const handleRemoveFilter = (columnId: string) => {
    removeFilter(columnId);
    if (newlyAddedFilter === columnId) {
      setNewlyAddedFilter(null);
    }
  };

  const hasFilters = activeFilters.length > 0;
  const activeFilterIds = activeFilters.map((f) => f.f);

  return (
    <div className="mt-6 grid grid-cols-[auto_1fr] items-start justify-between gap-2 sm:flex">
      <div className="flex flex-1 flex-wrap gap-2 max-sm:contents">
        <FilterMenu
          activeFilterIds={activeFilterIds}
          filterCategories={filterCategories}
          hasFilters={hasFilters}
          onSelectFilter={handleSelectFilter}
        />
        <div className="flex flex-wrap gap-2 max-sm:order-1 max-sm:col-span-2 sm:contents">
          {activeFilters.map((filter) => {
            const category = filterCategories.find((c) => c.id === filter.f);
            if (!category) return null;
            return (
              <ActiveFilterComponent
                autoOpen={newlyAddedFilter === filter.f}
                category={category}
                filter={filter}
                key={filter.f}
                onRemove={() => handleRemoveFilter(filter.f)}
                onUpdate={(values) => handleUpdateFilter(filter.f, values)}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {hasFilters && (
          <>
            <div className="flex items-center gap-1">
              <Button onClick={clearAll} size="sm" variant="ghost">
                Clear
              </Button>
              <Button size="sm" variant="outline">
                Save
              </Button>
            </div>
            <Separator className="my-1" orientation="vertical" />
          </>
        )}
        <SavedFiltersCombobox savedFilters={savedFilters} />
      </div>
    </div>
  );
}
