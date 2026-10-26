import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastVariant = "info" | "success" | "error" | "warning";

export interface ToastMessage {
  id: string;
  text: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (text: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, text, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem"
        }}
      >
        {toasts.map((toast) => {
          let bg = "var(--color-bg-card)";
          let border = "var(--color-border)";
          let text = "var(--color-text)";

          if (toast.variant === "success") {
            bg = "var(--color-success-subtle)";
            border = "var(--color-success)";
            text = "var(--color-success-text)";
          } else if (toast.variant === "error") {
            bg = "var(--color-danger-subtle)";
            border = "var(--color-danger)";
            text = "var(--color-danger-text)";
          } else if (toast.variant === "warning") {
            bg = "var(--color-warning-subtle)";
            border = "var(--color-warning)";
            text = "var(--color-warning-text)";
          }

          return (
            <div
              key={toast.id}
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: bg,
                border: `1px solid ${border}`,
                color: text,
                boxShadow: "var(--shadow-md)",
                fontSize: "0.875rem",
                minWidth: "260px",
                maxWidth: "400px"
              }}
            >
              <span>{toast.text}</span>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Close notification"
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {}
    };
  }
  return ctx;
}
