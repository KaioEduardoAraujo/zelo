"use client";

import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

// shadcn/ui Sheet (Radix Dialog) customizado. Usado como BottomSheet no mobile
// (aceite do cliente, pré-visualização) e como painel lateral quando preciso.

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({
  className,
  children,
  side = "bottom",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "bottom" | "right";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-navy-950/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col bg-surface text-navy-900 shadow-[var(--shadow-overlay)] duration-200 ease-out outline-none",
          "data-open:animate-in data-closed:animate-out data-closed:fade-out-0",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[var(--radius-card)] border-t border-line pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:left-1/2 md:w-full md:max-w-xl md:-translate-x-1/2 data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10",
          side === "right" &&
            "inset-y-0 right-0 h-full w-full max-w-md border-l border-line data-open:slide-in-from-right-10 data-closed:slide-out-to-right-10",
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <span
            aria-hidden="true"
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong"
          />
        )}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-[var(--radius-control)] text-slate-600 hover:bg-surface-2 hover:text-navy-900"
            aria-label="Fechar"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 px-4 pt-3 pr-14 md:px-6", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("overflow-y-auto px-4 py-4 md:px-6", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 border-t border-line px-4 py-3 md:px-6",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-h3 text-navy-950", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-support text-slate-600", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
