import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "critical" | "high" | "medium" | "low" | "info" | "success" | "neutral";
}

export function Badge({ children, variant = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`} {...props}>
      {children}
    </span>
  );
}
