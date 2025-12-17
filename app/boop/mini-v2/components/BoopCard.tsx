// app/boop/mini-v2/components/BoopCard.tsx

import React from "react";
import { cn, theme } from "../styles/theme";

type BoopCardProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;

  children?: React.ReactNode;
  footer?: React.ReactNode;

  variant?: "default" | "soft" | "inset";
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

export default function BoopCard({
  title,
  subtitle,
  right,
  children,
  footer,
  variant = "default",
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
}: BoopCardProps) {
  const surface =
    variant === "inset"
      ? theme.surface.inset
      : variant === "soft"
      ? theme.surface.cardSoft
      : theme.surface.card;

  return (
    <div
      className={cn(
        theme.radius.card,
        surface,
        theme.shadow.card,
        "p-4",
        className
      )}
    >
      {(title || subtitle || right) && (
        <div className={cn("flex items-start justify-between gap-3", headerClassName)}>
          <div className="min-w-0">
            {title && <div className={cn(theme.text.title, "truncate")}>{title}</div>}
            {subtitle && <div className={cn(theme.text.subtitle, "mt-0.5")}>{subtitle}</div>}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}

      {children ? (
        <div className={cn((title || subtitle || right) ? "mt-3" : "", bodyClassName)}>
          {children}
        </div>
      ) : null}

      {footer ? (
        <div className={cn("mt-4 pt-3 border-t border-white/10", footerClassName)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
