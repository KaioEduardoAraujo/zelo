import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "symbol";
  height?: number;
  className?: string;
};

const FULL_RATIO = 256 / 100;

export function Logo({ variant = "full", height = 32, className }: LogoProps) {
  const h = Math.max(height, 24);
  const isFull = variant === "full";
  return (
    <Image
      src={isFull ? "/brand/logo.svg" : "/brand/symbol.svg"}
      alt="Zelo"
      width={Math.round(isFull ? h * FULL_RATIO : h)}
      height={h}
      priority
      unoptimized
      className={cn("block", className)}
    />
  );
}
