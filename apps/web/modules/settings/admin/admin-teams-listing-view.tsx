"use client";

import { useDataTable } from "@calcom/features/data-table/hooks";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { DropdownActions } from "@calcom/ui/components/table";
import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { DataTableProvider } from "@calcom/features/data-table/DataTableProvider";

import { DataTableWrapper } from "~/data-table/components/DataTableWrapper";
import { DataTableToolbar } from "~/data-table/components/DataTableToolbar";

type AdminTeamRow = {
  id: number;
  name: string;
  slug: string | null;
  memberCount: number;
  parent: { id: number; name: string; slug: string | null } | null;
};

function AdminTeamsTableContent() {
  const { t } = useLocale();
  const { limit, offset, searchTerm } = useDataTable();

  const { data, isPending } = trpc.viewer.admin.listTeamsPaginated.useQuery(
    {
      limit,
      offset,
      searchTerm,
    },
    {
      placeholderData: keepPreviousData,
    }
  );

  const flatData = useMemo<AdminTeamRow[]>(() => data?.rows ?? [], [data]);

  const columns = useMemo<ColumnDef<AdminTeamRow>[]>(
    () => [
      {
        id: "name",
        header: t("team"),
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div className="flex min-h-10 items-center">
            <span className="text-default font-medium">{row.original.name}</span>
          </div>
        ),
        size: 200,
        meta: {
          autoWidth: true,
        },
      },
      {
        id: "slug",
        header: t("slug"),
        accessorFn: (row) => row.slug,
        cell: ({ row }) => (
          <span className="text-subtle">{row.original.slug ? `/${row.original.slug}` : "-"}</span>
        ),
        size: 150,
      },
      {
        id: "members",
        header: t("members"),
        accessorFn: (row) => row.memberCount,
        cell: ({ row }) => <Badge variant="gray">{row.original.memberCount}</Badge>,
        size: 100,
        enableSorting: false,
      },
      {
        id: "organization",
        header: t("organization"),
        accessorFn: (row) => row.parent?.name ?? "",
        cell: ({ row }) =>
          row.original.parent ? (
            <span className="text-subtle">{row.original.parent.name}</span>
          ) : (
            <span className="text-muted">-</span>
          ),
        size: 200,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex w-full justify-end">
            <DropdownActions
              actions={[
                {
                  id: "edit",
                  label: t("edit"),
                  href: `/settings/admin/teams/${row.original.id}/edit`,
                  icon: "pencil" as const,
                },
              ]}
            />
          </div>
        ),
        size: 80,
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [t]
  );

  const table = useReactTable({
    data: flatData,
    columns,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => `${row.id}`,
    defaultColumn: {
      size: 150,
    },
  });

  return (
    <DataTableWrapper<AdminTeamRow>
      testId="admin-teams-data-table"
      table={table}
      isPending={isPending}
      totalRowCount={data?.meta?.totalRowCount}
      paginationMode="standard"
      ToolbarLeft={<DataTableToolbar.SearchBar />}
    />
  );
}

export function AdminTeamsTable() {
  const pathname = usePathname();
  if (!pathname) return null;
  return (
    <DataTableProvider tableIdentifier={pathname} defaultPageSize={25}>
      <AdminTeamsTableContent />
    </DataTableProvider>
  );
}

export default AdminTeamsTable;
