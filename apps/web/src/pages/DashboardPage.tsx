import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api, StatsResponse } from "../lib/api.js";
import { Card, CardHeader, CardBody } from "../components/ui/Card.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState } from "../components/ui/EmptyState.js";

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.stats.get();
        if (mounted) setStats(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load dashboard statistics.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadStats();
    return () => {
      mounted = false;
    };
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedCmd(label);
      setTimeout(() => setCopiedCmd(null), 2500);
    } catch {
      // Fallback
    }
  };

  const getStatusBadgeVariant = (status: string): "success" | "danger" | "warning" | "default" => {
    if (status === "passed" || status === "completed") return "success";
    if (status === "failed") return "danger";
    if (status === "warning" || status === "completed_with_warnings") return "warning";
    return "default";
  };

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            Welcome, {user?.displayName}!
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
            Overview of your uploaded developer environment diagnostic reports
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link to="/projects" className="btn btn-secondary btn-sm">
            View Projects
          </Link>
          <Link to="/settings" className="btn btn-ghost btn-sm">
            ⚙️ Settings
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--color-text-muted)" }}>
          <p>Loading dashboard metrics...</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "var(--color-danger-subtle)",
            color: "var(--color-danger-text)",
            borderRadius: "var(--radius-md)",
            marginBottom: "2rem"
          }}
        >
          {error}
        </div>
      ) : stats ? (
        <>
          {/* Key Metrics Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.25rem",
              marginBottom: "2rem"
            }}
          >
            <Card>
              <CardBody>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Total Runs
                </p>
                <p style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem" }}>
                  {stats.totalRuns}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Projects Scanned
                </p>
                <p style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem" }}>
                  {stats.projectsScanned}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Failed Checks
                </p>
                <p
                  style={{
                    fontSize: "2rem",
                    fontWeight: 800,
                    marginTop: "0.25rem",
                    color: stats.failedChecks > 0 ? "var(--color-danger)" : "var(--color-success)"
                  }}
                >
                  {stats.failedChecks}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Passed Scans
                </p>
                <p style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.25rem", color: "var(--color-success)" }}>
                  {stats.statusBreakdown?.passed ?? 0}
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Issue Categories Breakdown */}
          {stats.commonCategories.length > 0 ? (
            <Card style={{ marginBottom: "2rem" }}>
              <CardHeader>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 600 }}>Most Common Issue Categories</h2>
              </CardHeader>
              <CardBody>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {stats.commonCategories.map((cat) => (
                    <div
                      key={cat.category}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 0.75rem",
                        backgroundColor: "var(--color-bg-alt)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)"
                      }}
                    >
                      <Badge variant="warning">{cat.category}</Badge>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{cat.count} occurrences</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* Recent Reports / Empty State */}
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600 }}>Recent Diagnostic Reports</h2>
            </CardHeader>
            <CardBody>
              {stats.recentReports.length === 0 ? (
                <EmptyState
                  icon="🩺"
                  title="No diagnostic reports uploaded yet"
                  description="Run diagnostics locally with StackDoctor CLI and upload reports to review findings with your team."
                  action={
                    <div style={{ maxWidth: "540px", textAlign: "left", marginTop: "1rem" }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                        Quick Setup Guide:
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--color-bg-alt)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                          <code>1. npm install -g @stackdoctor/cli</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard("npm install -g @stackdoctor/cli", "step1")}
                          >
                            {copiedCmd === "step1" ? "✓ Copied" : "Copy"}
                          </Button>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--color-bg-alt)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                          <code>2. stackdoctor login --server http://localhost:3000</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard("stackdoctor login --server http://localhost:3000", "step2")}
                          >
                            {copiedCmd === "step2" ? "✓ Copied" : "Copy"}
                          </Button>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--color-bg-alt)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                          <code>3. stackdoctor upload</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard("stackdoctor upload", "step3")}
                          >
                            {copiedCmd === "step3" ? "✓ Copied" : "Copy"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  }
                />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                        <th style={{ padding: "0.75rem" }}>Project</th>
                        <th style={{ padding: "0.75rem" }}>Status</th>
                        <th style={{ padding: "0.75rem" }}>Findings</th>
                        <th style={{ padding: "0.75rem" }}>Uploaded</th>
                        <th style={{ padding: "0.75rem", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentReports.map((report) => (
                        <tr
                          key={report.id}
                          style={{
                            borderBottom: "1px solid var(--color-border)",
                            transition: "background-color 0.1s ease"
                          }}
                        >
                          <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                            <Link to={`/projects/${report.projectId}`}>
                              {report.projectName}
                            </Link>
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            <Badge variant={getStatusBadgeVariant(report.status)}>
                              {report.status}
                            </Badge>
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            {report.findingsCount} finding{report.findingsCount === 1 ? "" : "s"}
                          </td>
                          <td style={{ padding: "0.75rem", color: "var(--color-text-muted)" }}>
                            {new Date(report.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "0.75rem", textAlign: "right" }}>
                            <Link
                              to={`/reports/${report.id}`}
                              className="btn btn-secondary btn-sm"
                            >
                              View Report
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
