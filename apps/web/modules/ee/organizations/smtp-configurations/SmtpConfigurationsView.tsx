"use client";

import { useEffect, useState } from "react";

import { Dialog } from "@calcom/features/components/controlled-dialog";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { ConfirmationDialogContent } from "@calcom/ui/components/dialog";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@calcom/ui/components/dropdown";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { SkeletonContainer, SkeletonText } from "@calcom/ui/components/skeleton";
import { showToast } from "@calcom/ui/components/toast";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@coss/ui/components/collapsible";
import { ChevronDownIcon, MailIcon, UserIcon, ServerIcon, HashIcon, ShieldCheckIcon } from "lucide-react";

import LicenseRequired from "~/ee/common/components/LicenseRequired";
import AddSmtpConfigurationDialog from "./AddSmtpConfigurationDialog";

export const smtpConfigModalRef = {
  current: null as null | ((show: boolean) => void),
};

export const NewSmtpConfigurationButton = () => {
  const { t } = useLocale();
  return (
    <Button color="secondary" StartIcon="plus" onClick={() => smtpConfigModalRef.current?.(true)}>
      {t("add")}
    </Button>
  );
};

interface SmtpConfiguration {
  id: number;
  organizationId: number;
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  isEnabled: boolean;
  lastTestedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SkeletonLoader = () => {
  return (
    <SkeletonContainer>
      <div className="mb-8 mt-6 space-y-6">
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
      </div>
    </SkeletonContainer>
  );
};

const SmtpConfigurationItem = ({
  config,
  canEdit,
  onDelete,
  onToggleEnabled,
  onSendTestEmail,
  isSendingTestEmail,
}: {
  config: SmtpConfiguration;
  canEdit: boolean;
  onDelete: (config: SmtpConfiguration) => void;
  onToggleEnabled: (id: number, isEnabled: boolean) => void;
  onSendTestEmail: (id: number) => void;
  isSendingTestEmail: boolean;
}) => {
  const { t } = useLocale();

  return (
    <Collapsible className="bg-default border-subtle border-b last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-5 text-left">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="bg-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <MailIcon className="text-default h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-emphasis min-w-0 truncate text-base font-medium">{config.fromEmail}</span>
              {config.isEnabled && <Badge variant="blue">{t("enabled")}</Badge>}
              {!config.isEnabled && <Badge variant="gray">{t("disabled")}</Badge>}
            </div>
            <span className="text-subtle truncate text-sm">{config.fromName || t("no_name_provided")}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && (
            <Dropdown>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="icon"
                  color="secondary"
                  StartIcon="ellipsis"
                  onClick={(e) => e.stopPropagation()}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem className="cursor-pointer">
                  <DropdownItem
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendTestEmail(config.id);
                    }}
                    StartIcon="mail"
                    disabled={isSendingTestEmail}>
                    {t("send_test_email")}
                  </DropdownItem>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <DropdownItem
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEnabled(config.id, !config.isEnabled);
                    }}
                    StartIcon={config.isEnabled ? "x" : "check"}>
                    {config.isEnabled ? t("disable") : t("enable")}
                  </DropdownItem>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <DropdownItem
                    type="button"
                    color="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(config);
                    }}
                    StartIcon="trash">
                    {t("delete")}
                  </DropdownItem>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </Dropdown>
          )}
          <ChevronDownIcon className="text-subtle h-5 w-5 shrink-0 transition-transform duration-200 [[data-panel-open]_&]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsiblePanel className="px-5">
        <div className="pb-5">
          <div className="border-subtle divide-subtle divide-y overflow-hidden rounded-lg border">
            <div className="flex items-center gap-3 px-4 py-3">
              <MailIcon className="text-subtle h-4 w-4 shrink-0" />
              <span className="text-subtle w-24 shrink-0 text-sm">{t("from_email")}</span>
              <span className="text-emphasis min-w-0 truncate text-sm font-medium">{config.fromEmail}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <UserIcon className="text-subtle h-4 w-4 shrink-0" />
              <span className="text-subtle w-24 shrink-0 text-sm">{t("from_name")}</span>
              <span className="text-emphasis min-w-0 truncate text-sm font-medium">{config.fromName || "-"}</span>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <ServerIcon className="text-subtle mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-subtle w-24 shrink-0 text-sm">{t("smtp_host")}</span>
              <span className="text-emphasis min-w-0 break-all text-sm font-medium">{config.smtpHost}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <HashIcon className="text-subtle h-4 w-4 shrink-0" />
              <span className="text-subtle w-24 shrink-0 text-sm">{t("smtp_port")}</span>
              <span className="text-emphasis text-sm font-medium">{config.smtpPort}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <ShieldCheckIcon className="text-subtle h-4 w-4 shrink-0" />
              <span className="text-subtle w-24 shrink-0 text-sm">{t("connection")}</span>
              <span className="text-emphasis text-sm font-medium">{config.smtpSecure ? t("connection_ssl_tls") : t("connection_starttls")}</span>
            </div>
          </div>
          {config.lastError && (
            <div className="bg-error/10 text-error mt-4 rounded-lg p-3 text-sm">{config.lastError}</div>
          )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
};

const SmtpConfigurationList = ({
  configs,
  canEdit,
  onDelete,
  onToggleEnabled,
  onSendTestEmail,
  isSendingTestEmail,
}: {
  configs: SmtpConfiguration[];
  canEdit: boolean;
  onDelete: (config: SmtpConfiguration) => void;
  onToggleEnabled: (id: number, isEnabled: boolean) => void;
  onSendTestEmail: (id: number) => void;
  isSendingTestEmail: boolean;
}) => {
  return (
    <div className="bg-default border-subtle overflow-hidden rounded-xl border shadow-sm">
      {configs.map((config) => (
        <SmtpConfigurationItem
          key={config.id}
          config={config}
          canEdit={canEdit}
          onDelete={onDelete}
          onToggleEnabled={onToggleEnabled}
          onSendTestEmail={onSendTestEmail}
          isSendingTestEmail={isSendingTestEmail}
        />
      ))}
    </div>
  );
};

const SmtpConfigurationsView = ({ permissions }: { permissions: { canRead: boolean; canEdit: boolean } }) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<SmtpConfiguration | null>(null);

  useEffect(() => {
    smtpConfigModalRef.current = setShowAddDialog;
    return () => {
      smtpConfigModalRef.current = null;
    };
  }, []);

  const { data: configs, isPending } = trpc.viewer.organizations.listSmtpConfigurations.useQuery();

  const deleteMutation = trpc.viewer.organizations.deleteSmtpConfiguration.useMutation({
    onSuccess: () => {
      showToast(t("smtp_configuration_deleted"), "success");
      utils.viewer.organizations.listSmtpConfigurations.invalidate();
      setDeleteConfig(null);
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  const toggleMutation = trpc.viewer.organizations.toggleSmtpConfiguration.useMutation({
    onSuccess: (data) => {
      showToast(
        data.isEnabled ? t("smtp_configuration_enabled") : t("smtp_configuration_disabled"),
        "success"
      );
      utils.viewer.organizations.listSmtpConfigurations.invalidate();
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  const sendTestEmailMutation = trpc.viewer.organizations.sendSmtpTestEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        showToast(t("smtp_test_email_sent"), "success");
      } else {
        showToast(data.error || t("smtp_test_email_failed"), "error");
      }
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  const handleDelete = (config: SmtpConfiguration) => {
    setDeleteConfig(config);
  };

  const handleToggleEnabled = (id: number, isEnabled: boolean) => {
    toggleMutation.mutate({ id, isEnabled });
  };

  const handleSendTestEmail = (id: number) => {
    sendTestEmailMutation.mutate({ id });
  };

  if (isPending) return <SkeletonLoader />;

  return (
    <LicenseRequired>
      <div className="space-y-6">
        {configs && configs.length > 0 ? (
          <SmtpConfigurationList
            configs={configs as SmtpConfiguration[]}
            canEdit={permissions.canEdit}
            onDelete={handleDelete}
            onToggleEnabled={handleToggleEnabled}
            onSendTestEmail={handleSendTestEmail}
            isSendingTestEmail={sendTestEmailMutation.isPending}
          />
        ) : (
          <EmptyScreen
            Icon="mail"
            headline={t("no_smtp_configurations")}
            description={t("add_smtp_configuration_to_get_started")}
            className="rounded-b-lg"
            buttonRaw={
              permissions.canEdit ? (
                <Button color="primary" onClick={() => setShowAddDialog(true)}>
                  {t("add_smtp_configuration")}
                </Button>
              ) : undefined
            }
            border={true}
          />
        )}

        <AddSmtpConfigurationDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

        {deleteConfig && (
          <Dialog open={!!deleteConfig} onOpenChange={(open) => !open && setDeleteConfig(null)}>
            <ConfirmationDialogContent
              isPending={deleteMutation.isPending}
              variety="danger"
              title={t("delete_smtp_configuration")}
              confirmBtnText={t("confirm_delete_smtp_configuration")}
              loadingText={t("deleting")}
              onConfirm={() => {
                deleteMutation.mutate({ id: deleteConfig.id });
              }}>
              {t("delete_smtp_configuration_description", { email: deleteConfig.fromEmail })}
            </ConfirmationDialogContent>
          </Dialog>
        )}
      </div>
    </LicenseRequired>
  );
};

export default SmtpConfigurationsView;
