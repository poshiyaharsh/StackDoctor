import React from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  badgeVariant?: "default" | "success" | "danger" | "warning" | "info";
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = "" }: TabsProps) {
  return (
    <div
      role="tablist"
      className={`tabs-nav ${className}`}
      style={{
        display: "flex",
        gap: "0.5rem",
        borderBottom: "1px solid var(--color-border)",
        marginBottom: "1.5rem",
        overflowX: "auto"
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            style={{
              padding: "0.5rem 1rem",
              background: "none",
              border: "none",
              borderBottom: isActive ? "2px solid var(--color-primary)" : "2px solid transparent",
              color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              fontSize: "0.875rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              whiteSpace: "nowrap",
              transition: "color 0.15s ease, border-color 0.15s ease"
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "9999px",
                  backgroundColor: isActive
                    ? "var(--color-primary)"
                    : "var(--color-bg-alt)",
                  color: isActive ? "#ffffff" : "var(--color-text-muted)"
                }}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
