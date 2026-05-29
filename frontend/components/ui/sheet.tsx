"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

export function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: DialogPrimitive.DialogContentProps & { side?: "left" | "right" }) {
  const sideClasses = side === "right" ? "right-0 border-l" : "left-0 border-r";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/30" />
      <DialogPrimitive.Content
        className={cn("fixed inset-y-0 z-50 w-72 bg-card p-4 shadow-card focus:outline-none", sideClasses, className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
