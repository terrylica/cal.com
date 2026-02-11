"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

import {
  AppRouterI18nContext,
  type AppRouterI18nContextType,
} from "@calcom/lib/hooks/i18nContexts";

export function AppRouterI18nProvider({
  children,
  translations,
  locale,
  ns,
}: AppRouterI18nContextType & {
  children: ReactNode;
}) {
  // Memoize the value to prevent re-renders unless the data changes
  const value = useMemo(
    () => ({
      translations,
      locale,
      ns,
    }),
    [locale, ns]
  );

  return <AppRouterI18nContext.Provider value={value}>{children}</AppRouterI18nContext.Provider>;
}
