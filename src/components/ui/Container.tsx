import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type ContainerProps = ComponentPropsWithoutRef<"div">;

/** Centered, responsive page gutter used by every section. */
export function Container({ className, ...rest }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}
      {...rest}
    />
  );
}
