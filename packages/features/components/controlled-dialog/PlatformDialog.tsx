import * as DialogPrimitive from "@radix-ui/react-dialog";

export type PlatformDialogProps = React.ComponentProps<
  (typeof DialogPrimitive)["Root"]
>;

export function PlatformDialog(props: PlatformDialogProps) {
  return <DialogPrimitive.Root {...props} />;
}
