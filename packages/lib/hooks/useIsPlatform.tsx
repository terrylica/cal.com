"use client";

import { createContext, useContext } from "react";

interface PlatformContextValue {
  isPlatform: boolean;
}

export const PlatformContext = createContext<PlatformContextValue>({
  isPlatform: false,
});

export const useIsPlatform = () => {
  const context = useContext(PlatformContext);
  return context.isPlatform;
};
