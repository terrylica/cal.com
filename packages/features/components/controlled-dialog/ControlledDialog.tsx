"use client";

import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { Dialog as BaseDialog } from "@calcom/ui/components/dialog";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type ControlledDialogProps = React.ComponentProps<typeof BaseDialog> & {
  name?: string;
  clearQueryParamsOnClose?: string[];
};

enum DIALOG_STATE {
  CLOSED = "CLOSED",
  CLOSING = "CLOSING",
  OPEN = "OPEN",
}

export function ControlledDialog(props: ControlledDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useCompatSearchParams();
  const { children, name, ...dialogProps } = props;

  const [dialogState, setDialogState] = useState(
    dialogProps.open ? DIALOG_STATE.OPEN : DIALOG_STATE.CLOSED
  );

  const shouldOpenDialog =
    new URLSearchParams(searchParams.toString()).get("dialog") === name;

  useEffect(() => {
    if (!name) return;

    if (dialogState === DIALOG_STATE.CLOSED && shouldOpenDialog) {
      setDialogState(DIALOG_STATE.OPEN);
    }

    if (dialogState === DIALOG_STATE.CLOSING && !shouldOpenDialog) {
      setDialogState(DIALOG_STATE.CLOSED);
    }
  }, [name, dialogState, shouldOpenDialog]);

  if (name) {
    const clearQueryParamsOnClose = [
      "dialog",
      ...(props.clearQueryParamsOnClose || []),
    ];

    dialogProps.onOpenChange = (open) => {
      if (props.onOpenChange) {
        props.onOpenChange(open);
      }

      const newSearchParams = new URLSearchParams(searchParams.toString());

      if (open) {
        newSearchParams.set("dialog", name);
        router.push(`${pathname}?${newSearchParams.toString()}`);
      } else {
        clearQueryParamsOnClose.forEach((queryParam) => {
          newSearchParams.delete(queryParam);
        });
        router.push(`${pathname}?${newSearchParams.toString()}`);
      }
      setDialogState(open ? DIALOG_STATE.OPEN : DIALOG_STATE.CLOSING);
    };

    if (!("open" in dialogProps)) {
      dialogProps.open = dialogState === DIALOG_STATE.OPEN;
    }
  }

  return <BaseDialog {...dialogProps}>{children}</BaseDialog>;
}
