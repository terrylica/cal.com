import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Badge } from "@calcom/ui/components/badge";
import { Icon } from "@calcom/ui/components/icon";
import Link from "next/link";

type Source = {
  id: string;
  type: string;
  label: string;
  editUrl?: string;
  fieldRequired?: boolean;
};

export function PhoneFieldSourcesInfo({ sources }: { sources: Source[] }) {
  const { t } = useLocale();

  const workflowSources = sources.filter((s) => s.type === "workflow");

  if (workflowSources.length === 0) {
    return null;
  }

  return (
    <div className="border-subtle mt-6 border-t pt-4">
      <p className="text-subtle mb-3 text-sm font-medium">
        {t("used_by_workflows")}
      </p>
      <ul className="space-y-2">
        {workflowSources.map((source) => (
          <li
            key={source.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <Icon name="zap" className="text-subtle h-4 w-4" />
              <span>{source.label}</span>
              {source.fieldRequired && (
                <Badge variant="gray" size="sm">
                  {t("required")}
                </Badge>
              )}
            </span>
            {source.editUrl && (
              <Link
                href={source.editUrl}
                className="text-emphasis hover:text-default text-sm hover:underline"
                target="_blank"
              >
                {t("edit")}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
