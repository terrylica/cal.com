"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Form, Switch, TextField } from "@calcom/ui/components/form";
import { Table } from "@calcom/ui/components/table";
import { showToast } from "@calcom/ui/components/toast";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

const { Cell, ColumnTitle, Header, Row } = Table;

type TeamFormValues = {
  name: string;
  slug: string | null;
  bio: string | null;
  hideBranding: boolean;
  hideBookATeamMember: boolean;
  isPrivate: boolean;
  timeZone: string;
  weekStart: string;
  brandColor: string | null;
  darkBrandColor: string | null;
};

type Member = {
  id: number;
  role: MembershipRole;
  accepted: boolean;
  user: {
    id: number;
    name: string | null;
    email: string;
    username: string | null;
  };
};

type TeamData = TeamFormValues & {
  id: number;
  parentId: number | null;
  isOrganization: boolean;
  parent: {
    id: number;
    name: string;
    slug: string | null;
  } | null;
  members: Member[];
};

export function AdminTeamEditView({ team }: { team: TeamData }) {
  const { t } = useLocale();
  const router = useRouter();
  const utils = trpc.useUtils();

  const mutation = trpc.viewer.admin.updateTeam.useMutation({
    onSuccess: async () => {
      await utils.viewer.admin.listTeamsPaginated.invalidate();
      await utils.viewer.admin.getTeam.invalidate({ id: team.id });
      showToast(t("team_updated_successfully"), "success");
      router.replace("/settings/admin/teams");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const form = useForm<TeamFormValues>({
    defaultValues: {
      name: team.name,
      slug: team.slug,
      bio: team.bio,
      hideBranding: team.hideBranding,
      hideBookATeamMember: team.hideBookATeamMember,
      isPrivate: team.isPrivate,
      timeZone: team.timeZone,
      weekStart: team.weekStart,
      brandColor: team.brandColor,
      darkBrandColor: team.darkBrandColor,
    },
  });

  const onSubmit = (values: TeamFormValues) => {
    mutation.mutate({
      id: team.id,
      ...values,
    });
  };

  return (
    <div className="space-y-6">
      {team.parent && (
        <div className="text-sm text-subtle">
          {t("organization")}: <span className="font-medium text-default">{team.parent.name}</span>
        </div>
      )}

      <Form form={form} className="space-y-4" handleSubmit={onSubmit}>
        <TextField label={t("name")} placeholder="Team name" required {...form.register("name")} />
        <TextField label={t("slug")} placeholder="team-slug" {...form.register("slug")} />
        <TextField label={t("about")} placeholder={t("about")} {...form.register("bio")} />
        <TextField label={t("timezone")} placeholder="Europe/London" {...form.register("timeZone")} />
        <TextField label={t("start_of_week")} placeholder="Sunday" {...form.register("weekStart")} />
        <TextField label={t("brand_color")} placeholder="#000000" {...form.register("brandColor")} />
        <TextField label={t("dark_brand_color")} placeholder="#ffffff" {...form.register("darkBrandColor")} />

        <div className="space-y-4">
          <Switch
            label={t("hide_branding")}
            checked={form.watch("hideBranding")}
            onCheckedChange={(checked) => form.setValue("hideBranding", checked)}
          />
          <Switch
            label={t("hide_book_a_team_member")}
            checked={form.watch("hideBookATeamMember")}
            onCheckedChange={(checked) => form.setValue("hideBookATeamMember", checked)}
          />
          <Switch
            label={t("make_team_private")}
            checked={form.watch("isPrivate")}
            onCheckedChange={(checked) => form.setValue("isPrivate", checked)}
          />
        </div>

        <Button type="submit" color="primary" loading={mutation.isPending}>
          {t("save")}
        </Button>
      </Form>

      <div>
        <h3 className="mb-4 font-medium text-default text-lg">{t("members")}</h3>
        <div className="rounded-md border border-subtle">
          <Table>
            <Header>
              <ColumnTitle widthClassNames="w-auto">{t("member")}</ColumnTitle>
              <ColumnTitle>{t("role")}</ColumnTitle>
              <ColumnTitle>{t("status")}</ColumnTitle>
            </Header>
            <tbody className="divide-y divide-subtle rounded-md">
              {team.members.map((member) => (
                <Row key={member.id}>
                  <Cell widthClassNames="w-auto">
                    <div className="font-medium text-subtle">
                      <span className="text-default">{member.user.name}</span>
                      <br />
                      <span className="break-all text-sm">{member.user.email}</span>
                    </div>
                  </Cell>
                  <Cell>
                    <Badge
                      variant={member.role === MembershipRole.OWNER ? "red" : "gray"}
                      className="capitalize">
                      {member.role.toLowerCase()}
                    </Badge>
                  </Cell>
                  <Cell>
                    <Badge variant={member.accepted ? "green" : "orange"}>
                      {member.accepted ? t("accepted") : t("pending")}
                    </Badge>
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default AdminTeamEditView;
