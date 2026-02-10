"use client";

import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { Dialog as BaseDialog } from "@calcom/ui/components/dialog";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export type ControlledDialogProps = React.ComponentProps<typeof BaseDialog> & {
  name?: string;
  clearQueryParamsOnClose?: string[];
};

enum DIALOG_STATE {
  // Dialog is there in the DOM but not visible.
  CLOSED = "CLOSED",
  // State from the time b/w the Dialog is dismissed and the time the "dialog" query param is removed from the URL.
  CLOSING = "CLOSING",
  // Dialog is visible.
  OPEN = "OPEN",
}

export function ControlledDialog(props: ControlledDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useCompatSearchParams();
  const newSearchParams = new URLSearchParams(searchParams.toString());
  const { children, name, ...dialogProps } = props;

  // only used if name is set
  const [dialogState, setDialogState] = useState(
    dialogProps.open ? DIALOG_STATE.OPEN : DIALOG_STATE.CLOSED
  );
  const shouldOpenDialog = newSearchParams.get("dialog") === name;
  if (name) {
    const clearQueryParamsOnClose = [
      "dialog",
      ...(props.clearQueryParamsOnClose || []),
    ];
    dialogProps.onOpenChange = (open) => {
      if (props.onOpenChange) {
        props.onOpenChange(open);
      }

      if (open) {
        newSearchParams.set("dialog", name);
      } else {
        clearQueryParamsOnClose.forEach((queryParam) => {
          newSearchParams.delete(queryParam);
        });
        router.push(`${pathname}?${newSearchParams.toString()}`);
      }
      setDialogState(open ? DIALOG_STATE.OPEN : DIALOG_STATE.CLOSING);
    };

    if (dialogState === DIALOG_STATE.CLOSED && shouldOpenDialog) {
      setDialogState(DIALOG_STATE.OPEN);
    }

    if (dialogState === DIALOG_STATE.CLOSING && !shouldOpenDialog) {
      setDialogState(DIALOG_STATE.CLOSED);
    }

    if (!("open" in dialogProps)) {
      dialogProps.open = dialogState === DIALOG_STATE.OPEN;
    }
  }

  return <BaseDialog {...dialogProps}>{children}</BaseDialog>;
}
