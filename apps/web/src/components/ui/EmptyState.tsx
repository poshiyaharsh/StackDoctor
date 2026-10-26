import React from "react";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = "🔍", title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "3rem 1.5rem",
        border: "1px dashed var(--color-border)",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "var(--color-surface-subtle)"
      }}
    >
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{icon}</div>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>{title}</h3>
      <p style={{ color: "var(--color-text-muted)", maxWidth: "450px", margin: "0 auto 1.5rem" }}>
        {description}
      </p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
