"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { getStringAsNumberRequiredSchema } from "@calcom/prisma/zod-utils";
import { trpc } from "@calcom/trpc/react";
import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";
import { Form, TextField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { zodResolver } from "@hookform/resolvers/zod";
import type { TFunction } from "next-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const getFormSchema = (t: TFunction) => {
  return z.object({
    teamId: z.number().or(getStringAsNumberRequiredSchema(t)),
    targetOrgId: z.number().or(getStringAsNumberRequiredSchema(t)),
    teamSlugInOrganization: z.string(),
  });
};

export default function MoveTeamToOrgView() {
  const { t } = useLocale();
  const formSchema = getFormSchema(t);
  const formMethods = useForm({
    mode: "onSubmit",
    resolver: zodResolver(formSchema),
  });

  const moveTeamMutation = trpc.viewer.admin.moveTeamToOrg.useMutation({
    onSuccess: (data) => {
      showToast(data.message, "success", 10000);
    },
    onError: (error) => {
      showToast(error.message, "error", 10000);
    },
  });

  const { register } = formMethods;
  return (
    <div className="space-y-6">
      <Form
        className="space-y-6"
        noValidate={true}
        form={formMethods}
        handleSubmit={async (values) => {
          const parsedValues = formSchema.parse(values);
          moveTeamMutation.mutate(parsedValues);
        }}>
        <div className="space-y-6">
          <TextField
            {...register("teamId")}
            label="Team ID"
            required
            placeholder="Enter teamId to move to org"
          />
          <TextField
            {...register("teamSlugInOrganization")}
            label="New Slug"
            required
            placeholder="Team slug in the Organization"
          />
          <TextField
            {...register("targetOrgId")}
            label="Target Organization ID"
            required
            placeholder="Enter Target organization ID"
          />
          <div className="mt-2 text-sm text-gray-600">
            Note: Team members will automatically be invited to the organization when the team is moved.
          </div>
        </div>
        <Button type="submit" loading={moveTeamMutation.isLoading}>
          Move Team to Org
        </Button>
      </Form>

      {moveTeamMutation.isSuccess && moveTeamMutation.data && (
        <Alert
          className="mt-6"
          severity="info"
          CustomIcon="check"
          title="Migration Successful"
          message={
            <div className="space-y-1">
              <p>
                <span className="font-medium">Team ID:</span> {moveTeamMutation.data.teamId}
              </p>
              {moveTeamMutation.data.teamSlug && (
                <p>
                  <span className="font-medium">Team Slug:</span> {moveTeamMutation.data.teamSlug}
                </p>
              )}
              <p>
                <span className="font-medium">Organization ID:</span> {moveTeamMutation.data.organizationId}
              </p>
              {moveTeamMutation.data.organizationSlug && (
                <p>
                  <span className="font-medium">Organization Slug:</span>{" "}
                  {moveTeamMutation.data.organizationSlug}
                </p>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
