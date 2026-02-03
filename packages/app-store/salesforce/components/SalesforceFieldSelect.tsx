import { useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Select } from "@calcom/ui/components/form";
import { Skeleton } from "@calcom/ui/components/skeleton";

type SalesforceObjectType = "Event" | "Contact" | "Lead" | "Account";

type SalesforceFieldSelectProps = {
  credentialId: number | undefined;
  objectType: SalesforceObjectType;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filterByType?: string[];
  disabled?: boolean;
};

type FieldOption = {
  label: string;
  value: string;
};

export default function SalesforceFieldSelect({
  credentialId,
  objectType,
  value,
  onChange,
  placeholder,
  filterByType,
  disabled = false,
}: SalesforceFieldSelectProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, error } = trpc.viewer.apps.salesforceFields.useQuery(
    { credentialId: credentialId!, objectType },
    {
      enabled: isOpen && !!credentialId,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    }
  );

  const fieldOptions: FieldOption[] =
    data?.fields
      ?.filter((field) => !filterByType || filterByType.includes(field.type))
      .map((field) => ({
        label: `${field.label} (${field.name})`,
        value: field.name,
      })) ?? [];

  const selectedOption = fieldOptions.find((option) => option.value === value) ?? (value ? { label: value, value } : null);

  if (!credentialId) {
    return (
      <Select
        size="sm"
        isDisabled
        placeholder={t("salesforce_connect_first")}
        className="w-full"
      />
    );
  }

  return (
    <Select<FieldOption, false>
      size="sm"
      className="w-full"
      options={fieldOptions}
      value={selectedOption}
      onChange={(option) => {
        if (option) {
          onChange(option.value);
        }
      }}
      onMenuOpen={() => setIsOpen(true)}
      onMenuClose={() => setIsOpen(false)}
      isLoading={isLoading && isOpen}
      isDisabled={disabled}
      placeholder={placeholder ?? t("select_field")}
      noOptionsMessage={() => {
        if (error) return t("error_loading_fields");
        if (isLoading) return t("loading");
        return t("no_fields_found");
      }}
      filterOption={(option, inputValue) => {
        const label = option.label.toLowerCase();
        const search = inputValue.toLowerCase();
        return label.includes(search);
      }}
    />
  );
}
