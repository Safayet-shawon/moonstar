import Link from "next/link";
import clsx from "clsx";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export type Variant = "clay" | "clay-navy" | "glass" | "glass-dark" | "fabric" | "fabric-light" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

export function btnClass(variant: Variant = "clay", size: Size = "md", extra?: string) {
  return clsx("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", extra);
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; children: ReactNode };
export function Button({ variant, size, className, children, type = "button", ...rest }: BtnProps) {
  return (
    <button type={type} className={btnClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

type LinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };
export function ButtonLink({ variant, size, className, children, ...rest }: LinkProps) {
  return (
    <Link className={btnClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden />;
}
