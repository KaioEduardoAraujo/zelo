import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-transparent font-semibold whitespace-nowrap transition-colors duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-teal-600 text-white hover:bg-teal-700",
        secondary: "border-navy-800 bg-surface text-navy-800 hover:bg-surface-2",
        ghost: "text-navy-700 hover:bg-surface-2 hover:text-navy-900",
        destructive: "bg-danger text-white hover:bg-[#9c2f27]",
        link: "h-auto px-0 text-teal-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 text-base md:h-10 md:px-4 md:text-[0.9375rem]",
        sm: "h-11 px-3 text-sm md:h-9",
        icon: "size-12 md:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
