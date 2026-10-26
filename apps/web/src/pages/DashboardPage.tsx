import { useAuth } from "../context/AuthContext.js";
import { Card, CardHeader, CardBody } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          Welcome, {user?.displayName}!
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
          StackDoctor Environment Diagnostics Dashboard
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>
        <Card>
          <CardBody>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Total Projects
            </p>
            <p style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem" }}>0</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Diagnostic Runs
            </p>
            <p style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem" }}>0</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Environment Health
            </p>
            <p style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem", color: "var(--color-success)" }}>100%</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Recent Diagnostic Runs</h2>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon="📋"
            title="No diagnostic reports uploaded yet"
            description="Run diagnostics locally and upload your first report using the StackDoctor CLI."
            action={
              <div
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.875rem",
                  display: "inline-block"
                }}
              >
                stackdoctor upload
              </div>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
