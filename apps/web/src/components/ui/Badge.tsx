import React from "react";

export type BadgeVariant =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info"
  | "success"
  | "neutral"
  | "warning"
  | "danger"
  | "default";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ children, variant = "neutral", className = "", ...props }: BadgeProps) {
  let normalized = variant;
  if (normalized === "danger") normalized = "critical";
  if (normalized === "warning") normalized = "medium";
  if (normalized === "default") normalized = "neutral";

  return (
    <span className={`badge badge-${normalized} ${className}`} {...props}>
      {children}
    </span>
  );
}
