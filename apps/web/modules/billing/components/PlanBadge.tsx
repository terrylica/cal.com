import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Badge } from "@coss/ui/components/badge";

export function TeamBadge() {
  const { t } = useLocale();
  return <Badge variant="warning">{t("teams")}</Badge>;
}

export function OrgBadge() {
  const { t } = useLocale();
  return (
    <Badge variant="warning" className="bg-purple-200 text-purple-700">
      {t("orgs")}
    </Badge>
  );
}
