"use client";

import { useCopy } from "@calcom/lib/hooks/useCopy";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@calcom/ui/components/dialog";
import { Form, TextField } from "@calcom/ui/components/form";
import { Icon } from "@calcom/ui/components/icon";
import { SkeletonContainer, SkeletonText } from "@calcom/ui/components/skeleton";
import { showToast } from "@calcom/ui/components/toast";
import { Tooltip } from "@calcom/ui/components/tooltip";
import { useState } from "react";
import { useForm } from "react-hook-form";

type DomainFormValues = {
  domain: string;
};

const SkeletonLoader = () => {
  return (
    <SkeletonContainer>
      <div className="mb-8 mt-6 space-y-6">
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
      </div>
    </SkeletonContainer>
  );
};

const DomainVerificationStatus = ({
  status,
  domainJson,
  configJson,
}: {
  status: string;
  domainJson?: {
    apexName?: string;
    name?: string;
    verification?: Array<{ type: string; domain: string; value: string }>;
  };
  configJson?: { conflicts?: Array<{ name: string; type: string; value: string }> };
}) => {
  const { t } = useLocale();

  if (status === "Valid Configuration") {
    return (
      <div className="bg-success/10 text-success mt-4 flex items-center gap-2 rounded-lg p-4">
        <Icon name="circle-check" className="h-5 w-5" />
        <div>
          <p className="font-medium">{t("domain_verified")}</p>
          <p className="text-sm opacity-80">{t("domain_verified_description")}</p>
        </div>
      </div>
    );
  }

  if (status === "Pending Verification") {
    const txtVerification = domainJson?.verification?.find((v) => v.type === "TXT");

    return (
      <div className="mt-4 space-y-4">
        <div className="bg-attention/10 text-attention flex items-center gap-2 rounded-lg p-4">
          <Icon name="clock" className="h-5 w-5" />
          <div>
            <p className="font-medium">{t("domain_pending_verification")}</p>
            <p className="text-sm opacity-80">{t("domain_pending_verification_description")}</p>
          </div>
        </div>

        <DnsInstructions
          domain={domainJson?.name || ""}
          apexDomain={domainJson?.apexName || ""}
          txtVerification={txtVerification}
        />
      </div>
    );
  }

  if (status === "Conflicting DNS Records" && configJson?.conflicts) {
    return (
      <div className="mt-4 space-y-4">
        <div className="bg-error/10 text-error flex items-center gap-2 rounded-lg p-4">
          <Icon name="triangle-alert" className="h-5 w-5" />
          <div>
            <p className="font-medium">{t("conflicting_dns_records")}</p>
            <p className="text-sm opacity-80">{t("conflicting_dns_records_description")}</p>
          </div>
        </div>

        <div className="bg-subtle rounded-lg p-4">
          <p className="text-subtle mb-2 text-sm font-medium">{t("remove_these_records")}:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-subtle border-b text-left">
                  <th className="pb-2 pr-4">{t("type")}</th>
                  <th className="pb-2 pr-4">{t("name")}</th>
                  <th className="pb-2">{t("value")}</th>
                </tr>
              </thead>
              <tbody>
                {configJson.conflicts.map((conflict, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 font-mono">{conflict.type}</td>
                    <td className="py-2 pr-4 font-mono">{conflict.name}</td>
                    <td className="py-2 font-mono">{conflict.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (status === "Invalid Configuration" || status === "Domain Not Found") {
    return (
      <div className="mt-4 space-y-4">
        <div className="bg-error/10 text-error flex items-center gap-2 rounded-lg p-4">
          <Icon name="triangle-alert" className="h-5 w-5" />
          <div>
            <p className="font-medium">{t("domain_configuration_invalid")}</p>
            <p className="text-sm opacity-80">{t("domain_configuration_invalid_description")}</p>
          </div>
        </div>

        <DnsInstructions domain={domainJson?.name || ""} apexDomain={domainJson?.apexName || ""} />
      </div>
    );
  }

  return null;
};

type RecordType = "A" | "CNAME";

const DnsInstructions = ({
  domain,
  apexDomain,
  txtVerification,
}: {
  domain: string;
  apexDomain: string;
  txtVerification?: { type: string; domain: string; value: string };
}) => {
  const { t } = useLocale();
  const isSubdomain = domain !== apexDomain;
  const subdomain = isSubdomain ? domain.replace(`.${apexDomain}`, "") : null;
  const recommendedType: RecordType = isSubdomain ? "CNAME" : "A";

  const [recordType, setRecordType] = useState<RecordType>(recommendedType);

  const recordOptions: { value: RecordType; label: string }[] = [
    { value: "A", label: t("a_record") },
    { value: "CNAME", label: t("cname_record") },
  ];

  const getRecordName = () => {
    if (recordType === "A") {
      return isSubdomain ? subdomain : "@";
    }
    return isSubdomain ? subdomain : "www";
  };

  const getRecordValue = () => {
    if (recordType === "A") {
      return "76.76.21.21";
    }
    return "cname.vercel-dns.com";
  };

  return (
    <div className="bg-subtle rounded-lg p-4">
      <p className="text-default mb-4 text-sm">{t("configure_dns_instructions", { domain })}</p>

      <div className="mb-4 flex items-center gap-2">
        {recordOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRecordType(option.value)}
            className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              recordType === option.value ? "bg-emphasis text-emphasis" : "text-default hover:bg-muted"
            }`}>
            {option.label}
            {option.value === recommendedType && (
              <Badge variant="green" className="ml-2">
                {t("recommended")}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-subtle border-b text-left">
              <th className="pb-2 pr-4">{t("type")}</th>
              <th className="pb-2 pr-4">{t("name")}</th>
              <th className="pb-2 pr-4">{t("value")}</th>
              <th className="pb-2">{t("ttl")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 pr-4 font-mono">{recordType}</td>
              <td className="py-2 pr-4 font-mono">{getRecordName()}</td>
              <td className="py-2 pr-4 font-mono">
                <CopyableValue value={getRecordValue()} />
              </td>
              <td className="py-2 font-mono">86400</td>
            </tr>
            {txtVerification && (
              <tr>
                <td className="py-2 pr-4 font-mono">TXT</td>
                <td className="py-2 pr-4 font-mono">
                  {txtVerification.domain.replace(`.${apexDomain}`, "") || "_vercel"}
                </td>
                <td className="py-2 pr-4 font-mono">
                  <CopyableValue value={txtVerification.value} />
                </td>
                <td className="py-2 font-mono">86400</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recordType === "A" && !isSubdomain && (
        <p className="text-subtle mt-3 text-xs">{t("a_record_apex_info")}</p>
      )}
      {recordType === "CNAME" && !isSubdomain && (
        <p className="text-attention mt-3 text-xs">{t("cname_apex_warning")}</p>
      )}
    </div>
  );
};

const CopyableValue = ({ value }: { value: string }) => {
  const { t } = useLocale();
  const { copyToClipboard, isCopied } = useCopy();

  return (
    <span className="inline-flex items-center gap-1">
      <span className="max-w-[200px] truncate">{value}</span>
      <Tooltip content={isCopied ? t("copied") : t("copy")}>
        <button
          type="button"
          onClick={() => copyToClipboard(value)}
          className="text-subtle hover:text-default">
          <Icon name={isCopied ? "check" : "copy"} className="h-4 w-4" />
        </button>
      </Tooltip>
    </span>
  );
};

const CustomDomainCard = ({
  orgId,
  domain,
  onRemove,
}: {
  orgId: number;
  domain: { slug: string; verified: boolean };
  onRemove: () => void;
}) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const { data: verificationData } = trpc.viewer.organizations.verifyCustomDomain.useQuery(
    { teamId: orgId },
    { refetchInterval: domain.verified ? false : 10000 }
  );

  const removeMutation = trpc.viewer.organizations.removeCustomDomain.useMutation({
    onSuccess: () => {
      showToast(t("custom_domain_removed"), "success");
      // utils.viewer.organizations.({ teamId: orgId });
      onRemove();
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  return (
    <div className="border-subtle rounded-lg border">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Icon name="globe" className="text-subtle h-5 w-5" />
          <div>
            <p className="text-default font-medium">{domain.slug}</p>
            <p className="text-subtle text-sm">
              {domain.verified ? t("verified") : t("pending_verification")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {domain.verified ? (
            <span className="bg-success/10 text-success rounded-full px-2 py-1 text-xs font-medium">
              {t("active")}
            </span>
          ) : (
            <span className="bg-attention/10 text-attention rounded-full px-2 py-1 text-xs font-medium">
              {t("pending")}
            </span>
          )}
          <Button
            color="destructive"
            variant="icon"
            StartIcon="trash-2"
            onClick={() => setShowRemoveDialog(true)}
          />
        </div>
      </div>

      {!domain.verified && verificationData && (
        <div className="border-subtle border-t px-4 pb-4">
          <DomainVerificationStatus
            status={verificationData.status}
            domainJson={verificationData.domainJson}
            configJson={verificationData.configJson}
          />
        </div>
      )}

      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader title={t("remove_custom_domain")} />
          <p className="text-subtle text-sm">
            {t("remove_custom_domain_description", { domain: domain.slug })}
          </p>
          <DialogFooter>
            <Button color="secondary" onClick={() => setShowRemoveDialog(false)}>
              {t("cancel")}
            </Button>
            <Button
              color="destructive"
              loading={removeMutation.isPending}
              onClick={() => removeMutation.mutate({ teamId: orgId })}>
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AddDomainForm = ({ orgId, onSuccess }: { orgId: number; onSuccess: () => void }) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const form = useForm<DomainFormValues>({
    defaultValues: { domain: "" },
  });

  const addMutation = trpc.viewer.organizations.addCustomDomain.useMutation({
    onSuccess: () => {
      showToast(t("custom_domain_added"), "success");
      // utils.viewer.customDomains.get.invalidate({ teamId: orgId });
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  return (
    <Form
      form={form}
      handleSubmit={(values) => {
        addMutation.mutate({ teamId: orgId, slug: values.domain });
      }}>
      <div className="flex gap-2">
        <TextField
          {...form.register("domain", {
            required: t("domain_required"),
            pattern: {
              value: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
              message: t("invalid_domain_format"),
            },
          })}
          placeholder="booking.yourdomain.com"
          className="flex-1"
        />
        <Button type="submit" loading={addMutation.isPending}>
          {t("add_domain")}
        </Button>
      </div>
      {form.formState.errors.domain && (
        <p className="text-error mt-1 text-sm">{form.formState.errors.domain.message}</p>
      )}
    </Form>
  );
};

interface OrgCustomDomainViewProps {
  orgId: number;
  permissions: {
    canRead: boolean;
    canEdit: boolean;
  };
}

const OrgCustomDomainView = ({ orgId, permissions }: OrgCustomDomainViewProps) => {
  const { t } = useLocale();

  const {
    data: customDomain,
    isPending: isDomainLoading,
    refetch: refetchDomain,
  } = trpc.viewer.organizations.getCustomDomain.useQuery({ teamId: orgId }, { enabled: !!orgId });

  const [showAddForm, setShowAddForm] = useState(false);

  if (isDomainLoading) {
    return <SkeletonLoader />;
  }

  if (!permissions.canEdit) {
    return (
      <div className="border-subtle rounded-md border p-5">
        <span className="text-default text-sm">{t("only_owner_change")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {customDomain ? (
        <CustomDomainCard
          orgId={orgId}
          domain={{ slug: customDomain.slug, verified: customDomain.verified }}
          onRemove={() => refetchDomain()}
        />
      ) : showAddForm ? (
        <div className="border-subtle rounded-lg border p-4">
          <AddDomainForm orgId={orgId} onSuccess={() => setShowAddForm(false)} />
        </div>
      ) : (
        <Button onClick={() => setShowAddForm(true)} StartIcon="plus">
          {t("add_custom_domain")}
        </Button>
      )}
    </div>
  );
};

export default OrgCustomDomainView;
