import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Internal paths use next/link; hashes and external URLs render a plain anchor. */
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

const baseStyles =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-60";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-accent via-accent-2 to-accent-3 text-white shadow-[0_12px_32px_-14px_var(--glow)] hover:brightness-110 hover:shadow-[0_18px_44px_-14px_var(--glow)]",
  secondary:
    "border border-border bg-surface text-foreground backdrop-blur-xl hover:border-accent/40 hover:bg-surface-strong",
  ghost: "text-muted-foreground hover:bg-surface hover:text-foreground",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-7 text-[0.95rem]",
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  type = "button",
  disabled = false,
  onClick,
  className,
  children,
}: ButtonProps) {
  const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

  if (href !== undefined) {
    const isPlainAnchor = href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:");
    if (isPlainAnchor) {
      return (
        <a href={href} onClick={onClick} className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
