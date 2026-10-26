import React, { useEffect, useState, useId } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, ProjectItem, DiagnosticRunItem } from "../lib/api.js";
import { Card, CardBody } from "../components/ui/Card.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import type { ReportComparison } from "@stackdoctor/core";

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const baseParam = searchParams.get("base") || "";
  const headParam = searchParams.get("head") || "";
  const projectParam = searchParams.get("project") || "";

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectParam);
  const [runs, setRuns] = useState<DiagnosticRunItem[]>([]);

  const [baseRunId, setBaseRunId] = useState<string>(baseParam);
  const [headRunId, setHeadRunId] = useState<string>(headParam);

  const [comparison, setComparison] = useState<ReportComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectSelectId = useId();
  const baseRunSelectId = useId();
  const headRunSelectId = useId();

  // Load project list on mount
  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      try {
        const data = await api.projects.list();
        if (mounted) {
          setProjects(data.projects);
          if (!selectedProjectId && data.projects.length > 0) {
            setSelectedProjectId(data.projects[0].id);
          }
        }
      } catch {
        // Fallback or unauthenticated
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  // Load runs when project changes
  useEffect(() => {
    let mounted = true;
    async function loadRuns() {
      if (!selectedProjectId) return;
      try {
        const data = await api.runs.list(selectedProjectId);
        if (mounted) {
          setRuns(data.runs);
          // If base and head are not set, preset them with the latest two runs if available
          if (!baseRunId && !headRunId && data.runs.length >= 2) {
            setHeadRunId(data.runs[0].id);
            setBaseRunId(data.runs[1].id);
          } else if (!headRunId && data.runs.length >= 1) {
            setHeadRunId(data.runs[0].id);
          }
        }
      } catch {
        if (mounted) setRuns([]);
      }
    }
    loadRuns();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  // Execute comparison when base and head IDs are available
  const runComparison = async (baseId: string, headId: string) => {
    if (!baseId || !headId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.runs.compare(baseId, headId);
      setComparison(res.comparison);
      setSearchParams({ base: baseId, head: headId, ...(selectedProjectId ? { project: selectedProjectId } : {}) });
    } catch (err) {
      setComparison(null);
      setError(err instanceof Error ? err.message : "Failed to compare diagnostic runs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (baseParam && headParam) {
      setBaseRunId(baseParam);
      setHeadRunId(headParam);
      runComparison(baseParam, headParam);
    }
  }, [baseParam, headParam]);

  const handleCompareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseRunId || !headRunId) {
      setError("Please select both a base run and a head run to compare.");
      return;
    }
    runComparison(baseRunId, headRunId);
  };

  const getSeverityBadgeVariant = (severity: string): "critical" | "high" | "medium" | "low" | "info" => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "critical";
      case "high":
        return "high";
      case "medium":
        return "medium";
      case "low":
        return "low";
      default:
        return "info";
    }
  };

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link to="/dashboard" style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          ← Back to Dashboard
        </Link>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Diagnostic Report Comparison
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          Compare two diagnostic runs to detect newly introduced flaws, resolved issues, and environmental drift.
        </p>
      </div>

      {/* Comparison Selector Card */}
      <Card style={{ marginBottom: "2rem" }}>
        <CardBody>
          <form onSubmit={handleCompareSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
            {projects.length > 0 && (
              <div style={{ flex: "1 1 200px" }}>
                <label
                  htmlFor={projectSelectId}
                  style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem", textTransform: "uppercase" }}
                >
                  Project
                </label>
                <select
                  id={projectSelectId}
                  className="input"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setBaseRunId("");
                    setHeadRunId("");
                    setComparison(null);
                  }}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ flex: "1 1 250px" }}>
              <label
                htmlFor={baseRunSelectId}
                style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem", textTransform: "uppercase" }}
              >
                Base Run (Previous / Before)
              </label>
              <select
                id={baseRunSelectId}
                className="input"
                value={baseRunId}
                onChange={(e) => setBaseRunId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}
              >
                <option value="">Select Base Run...</option>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.createdAt).toLocaleString()} ({r.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 250px" }}>
              <label
                htmlFor={headRunSelectId}
                style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem", textTransform: "uppercase" }}
              >
                Head Run (Latest / After)
              </label>
              <select
                id={headRunSelectId}
                className="input"
                value={headRunId}
                onChange={(e) => setHeadRunId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}
              >
                <option value="">Select Head Run...</option>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.createdAt).toLocaleString()} ({r.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Button type="submit" variant="primary" disabled={loading || !baseRunId || !headRunId}>
                {loading ? "Comparing..." : "Compare Runs"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {error && (
        <div
          role="alert"
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "var(--color-danger-subtle)",
            color: "var(--color-danger-text)",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.5rem"
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-muted)" }}>
          <p>Analyzing and comparing diagnostic runs...</p>
        </div>
      )}

      {comparison && !loading && (
        <div>
          {/* Regression Banner */}
          {comparison.hasRegressions ? (
            <div
              style={{
                padding: "1rem 1.25rem",
                backgroundColor: "var(--color-danger-subtle)",
                color: "var(--color-danger-text)",
                borderRadius: "var(--radius-md)",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <span>⚠️</span>
              <strong>Regressions Detected:</strong> Newly introduced findings or escalated severities detected in head run.
            </div>
          ) : (
            <div
              style={{
                padding: "1rem 1.25rem",
                backgroundColor: "var(--color-success-subtle)",
                color: "var(--color-success-text)",
                borderRadius: "var(--radius-md)",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <span>✓</span>
              <strong>Clean Run:</strong> No new regressions or escalated issues detected between runs.
            </div>
          )}

          {/* Side-by-Side Summary Delta Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "2rem"
            }}
          >
            <Card>
              <CardBody>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    New Findings
                  </span>
                  <Badge variant={comparison.newFindings.length > 0 ? "danger" : "neutral"}>
                    +{comparison.newFindings.length}
                  </Badge>
                </div>
                <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.5rem" }}>
                  {comparison.newFindings.length}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    Resolved Findings
                  </span>
                  <Badge variant={comparison.resolvedFindings.length > 0 ? "success" : "neutral"}>
                    -{comparison.resolvedFindings.length}
                  </Badge>
                </div>
                <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.5rem" }}>
                  {comparison.resolvedFindings.length}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    Changed Findings
                  </span>
                  <Badge variant={comparison.changedFindings.length > 0 ? "warning" : "neutral"}>
                    ~{comparison.changedFindings.length}
                  </Badge>
                </div>
                <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.5rem" }}>
                  {comparison.changedFindings.length}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    Unchanged
                  </span>
                  <Badge variant="neutral">
                    ={comparison.unchangedFindings.length}
                  </Badge>
                </div>
                <p style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.5rem" }}>
                  {comparison.unchangedFindings.length}
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Group 1: New Findings */}
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>New Findings</h2>
              <Badge variant={comparison.newFindings.length > 0 ? "danger" : "neutral"}>
                {comparison.newFindings.length}
              </Badge>
            </div>
            {comparison.newFindings.length === 0 ? (
              <Card>
                <CardBody style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  No new findings introduced in this run.
                </CardBody>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {comparison.newFindings.map((f, i) => (
                  <Card key={`${f.ruleId}-${i}`} style={{ borderLeft: "4px solid var(--color-danger)" }}>
                    <CardBody>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <Badge variant={getSeverityBadgeVariant(f.severity)}>{f.severity.toUpperCase()}</Badge>
                            <span style={{ fontWeight: 600, fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>
                              {f.ruleId}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>• {f.category}</span>
                          </div>
                          <p style={{ fontWeight: 600, marginTop: "0.25rem" }}>{f.title}</p>
                          {f.possibleCauses && f.possibleCauses.length > 0 && (
                            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                              {f.possibleCauses[0]}
                            </p>
                          )}
                          {f.evidence && f.evidence.length > 0 && f.evidence[0].observed && (
                            <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-sm)", fontSize: "0.8125rem", fontFamily: "var(--font-mono)" }}>
                              {f.evidence[0].observed}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Group 2: Resolved Findings */}
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Resolved Findings</h2>
              <Badge variant={comparison.resolvedFindings.length > 0 ? "success" : "neutral"}>
                {comparison.resolvedFindings.length}
              </Badge>
            </div>
            {comparison.resolvedFindings.length === 0 ? (
              <Card>
                <CardBody style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  No findings resolved in this run.
                </CardBody>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {comparison.resolvedFindings.map((f, i) => (
                  <Card key={`${f.ruleId}-${i}`} style={{ borderLeft: "4px solid var(--color-success)" }}>
                    <CardBody>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <Badge variant="success">RESOLVED</Badge>
                        <span style={{ fontWeight: 600, fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>
                          {f.ruleId}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>• {f.category}</span>
                      </div>
                      <p style={{ fontWeight: 600, marginTop: "0.25rem" }}>{f.title}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Group 3: Changed Findings */}
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Changed Findings</h2>
              <Badge variant={comparison.changedFindings.length > 0 ? "warning" : "neutral"}>
                {comparison.changedFindings.length}
              </Badge>
            </div>
            {comparison.changedFindings.length === 0 ? (
              <Card>
                <CardBody style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  No findings changed severity, confidence, or status.
                </CardBody>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {comparison.changedFindings.map((cf, i) => (
                  <Card key={`${cf.finding.ruleId}-${i}`} style={{ borderLeft: "4px solid var(--color-warning)" }}>
                    <CardBody>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <Badge variant="warning">MODIFIED</Badge>
                        <span style={{ fontWeight: 600, fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>
                          {cf.finding.ruleId}
                        </span>
                      </div>
                      <p style={{ fontWeight: 600, marginTop: "0.25rem" }}>{cf.finding.title}</p>
                      <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.875rem" }}>
                        {cf.changes.severity && (
                          <div>
                            <strong>Severity:</strong> {cf.changes.severity.before.toUpperCase()} → {cf.changes.severity.after.toUpperCase()}
                          </div>
                        )}
                        {cf.changes.confidence && (
                          <div>
                            <strong>Confidence:</strong> {cf.changes.confidence.before} → {cf.changes.confidence.after}
                          </div>
                        )}
                        {cf.changes.status && (
                          <div>
                            <strong>Status:</strong> {cf.changes.status.before} → {cf.changes.status.after}
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Group 4: Environment & Technology Differences */}
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
              Environment & Technology Changes
            </h2>
            <Card>
              <CardBody>
                {(!comparison.environmentChanges.operatingSystem &&
                  !comparison.environmentChanges.toolVersion &&
                  comparison.environmentChanges.runtimeVersions.length === 0 &&
                  comparison.technologyChanges.added.length === 0 &&
                  comparison.technologyChanges.removed.length === 0) ? (
                  <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                    No environment or technology changes detected.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
                    {comparison.environmentChanges.operatingSystem && (
                      <div>
                        <strong>Operating System:</strong> {comparison.environmentChanges.operatingSystem.before} → {comparison.environmentChanges.operatingSystem.after}
                      </div>
                    )}
                    {comparison.environmentChanges.toolVersion && (
                      <div>
                        <strong>StackDoctor Version:</strong> {comparison.environmentChanges.toolVersion.before} → {comparison.environmentChanges.toolVersion.after}
                      </div>
                    )}
                    {comparison.environmentChanges.runtimeVersions.map((rt, i) => (
                      <div key={i}>
                        <strong>Runtime {rt.runtime}:</strong> {rt.before ?? "(none)"} → {rt.after ?? "(none)"}
                      </div>
                    ))}
                    {comparison.technologyChanges.added.map((t, i) => (
                      <div key={i} style={{ color: "var(--color-success)" }}>
                        <strong>+ Added Technology:</strong> {t.name} ({t.confidence})
                      </div>
                    ))}
                    {comparison.technologyChanges.removed.map((t, i) => (
                      <div key={i} style={{ color: "var(--color-warning)" }}>
                        <strong>- Removed Technology:</strong> {t.name}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
