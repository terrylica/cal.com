"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

export type DialogProps = React.ComponentProps<(typeof DialogPrimitive)["Root"]> & {
  /** @deprecated Only works with ControlledDialog - import from ./ControlledDialog if you need URL state management */
  name?: string;
  /** @deprecated Only works with ControlledDialog */
  clearQueryParamsOnClose?: string[];
  /** @deprecated No longer needed - Dialog is now always simple */
  isPlatform?: boolean;
};

/**
 * Simple Dialog component without Next.js dependencies.
 * For URL-based state management, import ControlledDialog from "./ControlledDialog" directly.
 */
export function Dialog({ isPlatform: _isPlatform, name: _name, clearQueryParamsOnClose: _clear, ...props }: DialogProps) {
  return <DialogPrimitive.Root {...props} />;
}

// Keep PlatformDialog export for backwards compatibility (same as Dialog now)
export { PlatformDialog } from "./PlatformDialog";
export type { PlatformDialogProps } from "./PlatformDialog";
