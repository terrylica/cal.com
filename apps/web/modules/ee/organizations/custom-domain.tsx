"use client";

import { DNS_CONFIG, DomainVerificationStatus } from "@calcom/features/custom-domains/lib";
import { useCopy } from "@calcom/lib/hooks/useCopy";
import { useDebounce } from "@calcom/lib/hooks/useDebounce";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import classNames from "@calcom/ui/classNames";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@calcom/ui/components/dialog";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@calcom/ui/components/dropdown";
import { Icon } from "@calcom/ui/components/icon";
import { SkeletonContainer, SkeletonText } from "@calcom/ui/components/skeleton";
import { showToast } from "@calcom/ui/components/toast";
import { Tooltip } from "@calcom/ui/components/tooltip";
import { useEffect, useState } from "react";

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

const DomainVerificationStatusView = ({
  status,
  domainJson,
  configJson,
}: {
  status: DomainVerificationStatus;
  domainJson?: {
    apexName?: string;
    name?: string;
    verification?: Array<{ type: string; domain: string; value: string }>;
  };
  configJson?: { conflicts?: Array<{ name: string; type: string; value: string }> };
}) => {
  const { t } = useLocale();

  if (status === DomainVerificationStatus.VALID) {
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

  if (status === DomainVerificationStatus.PENDING) {
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

  if (status === DomainVerificationStatus.CONFLICTING && configJson?.conflicts) {
    const txtVerification = domainJson?.verification?.find((v) => v.type === "TXT");

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

        <DnsInstructions
          domain={domainJson?.name || ""}
          apexDomain={domainJson?.apexName || ""}
          txtVerification={txtVerification}
        />
      </div>
    );
  }

  if (status === DomainVerificationStatus.INVALID || status === DomainVerificationStatus.NOT_FOUND) {
    const txtVerification = domainJson?.verification?.find((v) => v.type === "TXT");

    return (
      <div className="mt-4 space-y-4">
        <div className="bg-error/10 text-error flex items-center gap-2 rounded-lg p-4">
          <Icon name="triangle-alert" className="h-5 w-5" />
          <div>
            <p className="font-medium">{t("domain_configuration_invalid")}</p>
            <p className="text-sm opacity-80">{t("domain_configuration_invalid_description")}</p>
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
      return DNS_CONFIG.A_RECORD_IP;
    }
    return DNS_CONFIG.CNAME_TARGET;
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
              <td className="py-2 font-mono">{DNS_CONFIG.DEFAULT_TTL}</td>
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
                <td className="py-2 font-mono">{DNS_CONFIG.DEFAULT_TTL}</td>
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
  onEdit,
}: {
  orgId: number;
  domain: { slug: string; verified: boolean };
  onRemove: () => void;
  onEdit: () => void;
}) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const {
    data: verificationData,
    refetch: refetchVerification,
    isFetching: isRefreshing,
  } = trpc.viewer.organizations.verifyCustomDomain.useQuery(
    { teamId: orgId },
    { refetchInterval: domain.verified ? false : 10000 }
  );

  const removeMutation = trpc.viewer.organizations.removeCustomDomain.useMutation({
    onSuccess: () => {
      showToast(t("custom_domain_removed"), "success");
      utils.viewer.organizations.getCustomDomain.invalidate({ teamId: orgId });
      onRemove();
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const handleRefresh = async () => {
    await refetchVerification();
    showToast(t("domain_verification_refreshed"), "success");
  };

  return (
    <div className="border-subtle rounded-lg border">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Icon name="globe" className="text-subtle h-5 w-5" />
          <div>
            {domain.verified ? (
              <a
                href={`https://${domain.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-default font-medium hover:underline">
                {domain.slug}
              </a>
            ) : (
              <p className="text-default font-medium">{domain.slug}</p>
            )}
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
          <div className="border-subtle flex items-center divide-x overflow-hidden rounded-md border">
            <Tooltip content={t("refresh_verification")}>
              <Button
                variant="icon"
                color="minimal"
                StartIcon="refresh-cw"
                onClick={handleRefresh}
                loading={isRefreshing}
                className="rounded-none border-0"
              />
            </Tooltip>
            <Dropdown>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="icon"
                  color="minimal"
                  StartIcon="ellipsis"
                  className="rounded-none border-0"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <DropdownItem type="button" StartIcon="pencil" onClick={onEdit}>
                    {t("edit")}
                  </DropdownItem>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <DropdownItem
                    type="button"
                    StartIcon="refresh-cw"
                    onClick={handleRefresh}
                    disabled={isRefreshing}>
                    {t("refresh_verification")}
                  </DropdownItem>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <DropdownItem
                    type="button"
                    StartIcon="trash-2"
                    color="destructive"
                    onClick={() => setShowRemoveDialog(true)}>
                    {t("remove")}
                  </DropdownItem>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </Dropdown>
          </div>
        </div>
      </div>

      {!domain.verified && verificationData && (
        <div className="border-subtle border-t px-4 pb-4">
          <DomainVerificationStatusView
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

type DomainStatus = "idle" | "checking" | "valid" | "invalid" | "conflict";

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const isValidDomainFormat = (domain: string): boolean => {
  return DOMAIN_REGEX.test(domain);
};

const STATUS_CONFIG: Record<
  DomainStatus,
  {
    message: string;
    messageKey?: string;
    icon?: "loader" | "circle-check" | "circle-alert";
    containerClass: string;
    showDomain?: boolean;
  }
> = {
  idle: {
    message: "enter_domain_to_check",
    containerClass: "bg-subtle text-subtle",
  },
  checking: {
    message: "checking_availability",
    icon: "loader",
    containerClass: "bg-subtle text-subtle",
    showDomain: true,
  },
  valid: {
    message: "domain_available",
    icon: "circle-check",
    containerClass: "bg-success/10 text-success",
    showDomain: true,
  },
  invalid: {
    message: "invalid_domain_format",
    icon: "circle-alert",
    containerClass: "bg-error/10 text-error",
  },
  conflict: {
    message: "domain_already_in_use",
    icon: "circle-alert",
    containerClass: "bg-error/10 text-error",
    showDomain: true,
  },
};

const DomainStatusIndicator = ({ status, domain }: { status: DomainStatus; domain: string }) => {
  const { t } = useLocale();
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div
      className={classNames(
        "mt-2 flex items-center justify-between gap-2 rounded-lg p-3 text-sm",
        statusConfig.containerClass
      )}>
      <p>
        {statusConfig.showDomain && domain ? (
          <>
            <span className="font-medium">{domain}</span> {t(statusConfig.message)}
          </>
        ) : (
          t(statusConfig.message)
        )}
      </p>
      {statusConfig.icon && (
        <Icon
          name={statusConfig.icon}
          className={classNames("h-4 w-4 shrink-0", status === "checking" && "animate-spin")}
        />
      )}
    </div>
  );
};

const AddDomainModal = ({
  orgId,
  isOpen,
  onClose,
  onSuccess,
}: {
  orgId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<DomainStatus>("idle");
  const debouncedDomain = useDebounce(domain, 500);

  useEffect(() => {
    if (!debouncedDomain) {
      setStatus("idle");
      return;
    }

    if (!isValidDomainFormat(debouncedDomain)) {
      setStatus("invalid");
      return;
    }

    setStatus("valid");
  }, [debouncedDomain]);

  useEffect(() => {
    if (domain && domain !== debouncedDomain) {
      setStatus("checking");
    }
  }, [domain, debouncedDomain]);

  useEffect(() => {
    if (!isOpen) {
      setDomain("");
      setStatus("idle");
    }
  }, [isOpen]);

  const addMutation = trpc.viewer.organizations.addCustomDomain.useMutation({
    onSuccess: () => {
      showToast(t("custom_domain_added"), "success");
      utils.viewer.organizations.getCustomDomain.invalidate({ teamId: orgId });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      if (error.message.includes("already in use")) {
        setStatus("conflict");
      } else {
        showToast(error.message, "error");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "valid") return;
    addMutation.mutate({ teamId: orgId, slug: domain });
  };

  const canSubmit = status === "valid" && !addMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        type="creation"
        title={t("add_custom_domain")}
        description={t("custom_domain_description")}>
        <form onSubmit={handleSubmit}>
          <div>
            <label className="text-default mb-2 block text-sm font-medium">{t("domain")}</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase().trim())}
              placeholder="booking.yourdomain.com"
              className="border-default bg-default text-default placeholder:text-muted w-full rounded-md border px-3 py-2 text-sm focus:border-neutral-300 focus:outline-none focus:ring-0"
              autoFocus
            />
            <DomainStatusIndicator status={status} domain={domain} />
          </div>
          <DialogFooter showDivider className="mt-6">
            <DialogClose />
            <Button type="submit" disabled={!canSubmit} loading={addMutation.isPending}>
              {t("add_domain")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EditDomainModal = ({
  orgId,
  currentDomain,
  isOpen,
  onClose,
  onSuccess,
}: {
  orgId: number;
  currentDomain: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const [domain, setDomain] = useState(currentDomain);
  const [status, setStatus] = useState<DomainStatus>("valid");
  const [isUpdating, setIsUpdating] = useState(false);
  const debouncedDomain = useDebounce(domain, 500);

  const isDifferent = domain !== currentDomain;

  useEffect(() => {
    if (!debouncedDomain) {
      setStatus("idle");
      return;
    }

    if (!isValidDomainFormat(debouncedDomain)) {
      setStatus("invalid");
      return;
    }

    setStatus("valid");
  }, [debouncedDomain]);

  useEffect(() => {
    if (domain && domain !== debouncedDomain) {
      setStatus("checking");
    }
  }, [domain, debouncedDomain]);

  useEffect(() => {
    if (isOpen) {
      setDomain(currentDomain);
      setStatus("valid");
    }
  }, [isOpen, currentDomain]);

  const removeMutation = trpc.viewer.organizations.removeCustomDomain.useMutation();
  const addMutation = trpc.viewer.organizations.addCustomDomain.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "valid" || !isDifferent) return;

    setIsUpdating(true);
    try {
      await removeMutation.mutateAsync({ teamId: orgId });
      await addMutation.mutateAsync({ teamId: orgId, slug: domain });
      showToast(t("custom_domain_updated"), "success");
      utils.viewer.organizations.getCustomDomain.invalidate({ teamId: orgId });
      onSuccess();
      onClose();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("already in use")) {
          setStatus("conflict");
        } else {
          showToast(error.message, "error");
        }
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const canSubmit = status === "valid" && isDifferent && !isUpdating;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        type="creation"
        title={t("edit_custom_domain")}
        description={t("edit_custom_domain_description")}>
        <form onSubmit={handleSubmit}>
          <div className="text-subtle mb-4 text-sm">
            {t("current_domain")}: <span className="text-default font-medium">{currentDomain}</span>
          </div>
          <div>
            <label className="text-default mb-2 block text-sm font-medium">{t("new_domain")}</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase().trim())}
              placeholder="booking.yourdomain.com"
              className="border-default bg-default text-default placeholder:text-muted w-full rounded-md border px-3 py-2 text-sm focus:border-neutral-300 focus:outline-none focus:ring-0"
              autoFocus
            />
            <DomainStatusIndicator status={status} domain={domain} />
          </div>
          {isDifferent && (
            <div className="bg-attention/10 text-attention mt-4 flex items-start gap-2 rounded-lg p-3 text-sm">
              <Icon name="triangle-alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("edit_domain_warning")}</p>
            </div>
          )}
          <DialogFooter showDivider className="mt-6">
            <DialogClose />
            <Button type="submit" disabled={!canSubmit} loading={isUpdating}>
              {t("save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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
          onEdit={() => setShowEditModal(true)}
        />
      ) : (
        <div className="border-subtle bg-default flex flex-col items-center justify-center rounded-lg border py-10">
          <div className="bg-emphasis text-emphasis flex h-12 w-12 items-center justify-center rounded-full">
            <Icon name="globe" className="h-6 w-6" />
          </div>
          <p className="text-subtle mt-4 text-sm">{t("no_custom_domain_configured")}</p>
          <Button className="mt-4" onClick={() => setShowAddModal(true)} StartIcon="plus" color="secondary">
            {t("add_custom_domain")}
          </Button>
        </div>
      )}

      <AddDomainModal
        orgId={orgId}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => refetchDomain()}
      />

      {customDomain && (
        <EditDomainModal
          orgId={orgId}
          currentDomain={customDomain.slug}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => refetchDomain()}
        />
      )}
    </div>
  );
};

export const CustomDomainContent = ({
  orgId,
  customDomain,
  refetchCustomDomain,
}: {
  orgId: number;
  customDomain: { slug: string; verified: boolean } | null | undefined;
  refetchCustomDomain: () => void;
}) => {
  const { t } = useLocale();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <div className="p-6">
      {customDomain ? (
        <CustomDomainCard
          orgId={orgId}
          domain={{ slug: customDomain.slug, verified: customDomain.verified }}
          onRemove={() => refetchCustomDomain()}
          onEdit={() => setShowEditModal(true)}
        />
      ) : (
        <div className="bg-default flex flex-col items-center justify-center py-8">
          <div className="bg-emphasis text-emphasis flex h-10 w-10 items-center justify-center rounded-full">
            <Icon name="globe" className="h-5 w-5" />
          </div>
          <p className="text-subtle mt-3 text-sm">{t("no_custom_domain_configured")}</p>
          <Button
            className="mt-3"
            onClick={() => setShowAddModal(true)}
            StartIcon="plus"
            color="secondary"
            size="sm">
            {t("add_custom_domain")}
          </Button>
        </div>
      )}

      <AddDomainModal
        orgId={orgId}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => refetchCustomDomain()}
      />

      {customDomain && (
        <EditDomainModal
          orgId={orgId}
          currentDomain={customDomain.slug}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => refetchCustomDomain()}
        />
      )}
    </div>
  );
};

export default OrgCustomDomainView;
