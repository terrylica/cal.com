"use client";

import { useDebounce } from "@calcom/lib/hooks/useDebounce";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { TextField } from "@calcom/ui/components/form";
import { DropdownActions, Table } from "@calcom/ui/components/table";
import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const { Cell, ColumnTitle, Header, Row } = Table;

const FETCH_LIMIT = 25;

export function AdminTeamsTable() {
  const { t } = useLocale();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, fetchNextPage, isFetching } = trpc.viewer.admin.listTeamsPaginated.useInfiniteQuery(
    {
      limit: FETCH_LIMIT,
      searchTerm: debouncedSearchTerm,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    }
  );

  const flatData = useMemo(() => data?.pages?.flatMap((page) => page.rows) ?? [], [data]);
  const totalRowCount = data?.pages?.[0]?.meta?.totalRowCount ?? 0;
  const totalFetched = flatData.length;

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        if (scrollHeight - scrollTop - clientHeight < 300 && !isFetching && totalFetched < totalRowCount) {
          fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching, totalFetched, totalRowCount]
  );

  useEffect(() => {
    fetchMoreOnBottomReached(tableContainerRef.current);
  }, [fetchMoreOnBottomReached]);

  return (
    <div>
      <TextField
        placeholder={t("search_by_team_name_or_slug")}
        label={t("search")}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div
        className="rounded-md border border-subtle"
        ref={tableContainerRef}
        onScroll={() => fetchMoreOnBottomReached()}
        style={{
          height: "calc(100vh - 30vh)",
          overflow: "auto",
        }}>
        <Table>
          <Header>
            <ColumnTitle widthClassNames="w-auto">{t("team")}</ColumnTitle>
            <ColumnTitle>{t("slug")}</ColumnTitle>
            <ColumnTitle>{t("members")}</ColumnTitle>
            <ColumnTitle>{t("organization")}</ColumnTitle>
            <ColumnTitle widthClassNames="w-auto">
              <span className="sr-only">{t("edit")}</span>
            </ColumnTitle>
          </Header>

          <tbody className="divide-y divide-subtle rounded-md">
            {flatData.map((team) => (
              <Row key={team.id}>
                <Cell widthClassNames="w-auto">
                  <div className="flex min-h-10 items-center">
                    <div className="font-medium text-subtle">
                      <span className="text-default">{team.name}</span>
                    </div>
                  </div>
                </Cell>
                <Cell>
                  <span className="text-subtle">{team.slug ? `/${team.slug}` : "-"}</span>
                </Cell>
                <Cell>
                  <Badge variant="gray">{team.memberCount}</Badge>
                </Cell>
                <Cell>
                  {team.parent ? (
                    <span className="text-subtle">{team.parent.name}</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </Cell>
                <Cell widthClassNames="w-auto">
                  <div className="flex w-full justify-end">
                    <DropdownActions
                      actions={[
                        {
                          id: "edit",
                          label: t("edit"),
                          href: `/settings/admin/teams/${team.id}/edit`,
                          icon: "pencil" as const,
                        },
                      ]}
                    />
                  </div>
                </Cell>
              </Row>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default AdminTeamsTable;
