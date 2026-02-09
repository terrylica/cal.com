"use client";

import type { RouterOutputs } from "@calcom/trpc/react";
import { Avatar, AvatarFallback, AvatarImage } from "@coss/ui/components/avatar";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "@coss/ui/components/combobox";
import { Group, GroupSeparator } from "@coss/ui/components/group";
import { FilterIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

type WebhookGroup = RouterOutputs["viewer"]["webhook"]["getByViewer"]["webhookGroups"][number];

interface ProfileOption {
  id: string;
  label: string;
  avatar?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getUniqueProfiles(groups: WebhookGroup[]): ProfileOption[] {
  const seen = new Set<string>();
  const profiles: ProfileOption[] = [];

  for (const group of groups) {
    const slug = group.profile.slug ?? "";
    if (seen.has(slug)) continue;
    seen.add(slug);
    profiles.push({
      id: slug,
      label: group.profile.name ?? slug,
      avatar: group.profile.image,
    });
  }

  return profiles;
}

interface WebhooksFilterProps {
  groups: WebhookGroup[];
  selectedProfileIds: string[];
  onSelectionChange: (selectedProfileIds: string[]) => void;
}

export function WebhooksFilter({ groups, selectedProfileIds, onSelectionChange }: WebhooksFilterProps) {
  const uniqueProfiles = useMemo(() => getUniqueProfiles(groups), [groups]);
  const selectedProfiles = useMemo(
    () => uniqueProfiles.filter((p) => selectedProfileIds.includes(p.id)),
    [uniqueProfiles, selectedProfileIds]
  );

  const [open, setOpen] = useState(false);

  const handleValueChange = (value: ProfileOption | ProfileOption[] | null) => {
    let newSelection: ProfileOption[];
    if (Array.isArray(value)) {
      newSelection = value;
    } else if (value) {
      newSelection = [value];
    } else {
      newSelection = [];
    }
    onSelectionChange(newSelection.map((p) => p.id));
  };

  const renderTriggerContent = () => {
    if (selectedProfiles.length === 0) {
      return <ListFilterIcon />;
    }
    const firstProfile = selectedProfiles[0];
    const remainingCount = selectedProfiles.length - 1;

    if (!firstProfile) return null;

    return (
      <>
        <FilterIcon />
        <span className="truncate">{firstProfile.label}</span>
        {remainingCount > 0 && (
          <Badge className="tabular-nums" variant="secondary">
            +{remainingCount}
          </Badge>
        )}
      </>
    );
  };

  const comboboxContent = (
    <Combobox
      autoHighlight
      items={uniqueProfiles}
      multiple
      onOpenChange={setOpen}
      onValueChange={handleValueChange}
      open={open}
      value={selectedProfiles}>
      <ComboboxTrigger
        render={
          <Button size={selectedProfiles.length === 0 ? "icon" : "default"} variant="outline" />
        }>
        {renderTriggerContent()}
      </ComboboxTrigger>
      <ComboboxPopup align="end" aria-label="Select user">
        <div className="border-b p-2">
          <ComboboxInput
            className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
            placeholder="Search users..."
            showTrigger={false}
            startAddon={<SearchIcon />}
          />
        </div>
        <ComboboxEmpty>No users found.</ComboboxEmpty>
        <ComboboxList>
          {(option: ProfileOption) => (
            <ComboboxItem key={option.id} value={option}>
              <div className="flex items-center gap-2">
                <Avatar className="size-5">
                  {option.avatar ? <AvatarImage alt={option.label} src={option.avatar} /> : null}
                  <AvatarFallback className="text-[.625rem]">{getInitials(option.label)}</AvatarFallback>
                </Avatar>
                <span>{option.label}</span>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );

  if (selectedProfileIds.length === 0) {
    return comboboxContent;
  }

  return (
    <Group>
      {comboboxContent}
      <GroupSeparator />
      <Button aria-label="Remove filter" onClick={() => onSelectionChange([])} size="icon" variant="outline">
        <XIcon />
      </Button>
    </Group>
  );
}
