import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, DiagnosticRunItem, FindingItem } from "../lib/api.js";
import { Card, CardHeader, CardBody } from "../components/ui/Card.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import { Tabs } from "../components/ui/Tabs.js";
import type { Report } from "@stackdoctor/schemas";
import { buildIssueDraft } from "@stackdoctor/core/issue-draft";

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [run, setRun] = useState<DiagnosticRunItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadRun() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await api.runs.get(id);
        if (mounted) setRun(data.run);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load diagnostic report.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadRun();
    return () => {
      mounted = false;
    };
  }, [id]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await api.runs.delete(id);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete report.");
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const getSeverityBadgeVariant = (severity: string): "danger" | "warning" | "info" | "default" => {
    if (severity === "critical" || severity === "high") return "danger";
    if (severity === "medium") return "warning";
    if (severity === "low") return "info";
    return "default";
  };

  const getStatusBadgeVariant = (status: string): "success" | "danger" | "warning" | "default" => {
    if (status === "passed" || status === "completed") return "success";
    if (status === "failed") return "danger";
    if (status === "warning" || status === "completed_with_warnings") return "warning";
    return "default";
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        <p>Loading diagnostic report...</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
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
          {error || "Report not found"}
        </div>
        <Link to="/dashboard" className="btn btn-secondary btn-sm">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const findings = run.findings || [];
  const filteredFindings = findings.filter((f) => {
    if (activeTab === "all") return true;
    if (activeTab === "critical") return f.severity === "critical";
    if (activeTab === "high") return f.severity === "high";
    if (activeTab === "medium") return f.severity === "medium";
    if (activeTab === "low") return f.severity === "low";
    return true;
  });

  const tabItems = [
    { id: "all", label: "All Findings", count: findings.length },
    { id: "critical", label: "Critical", count: findings.filter((f) => f.severity === "critical").length },
    { id: "high", label: "High", count: findings.filter((f) => f.severity === "high").length },
    { id: "medium", label: "Medium", count: findings.filter((f) => f.severity === "medium").length },
    { id: "low", label: "Low", count: findings.filter((f) => f.severity === "low").length }
  ];

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link to="/dashboard" style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          ← Back to Dashboard
        </Link>
      </div>

      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Diagnostic Report</h1>
            <Badge variant={getStatusBadgeVariant(run.status)}>{run.status.toUpperCase()}</Badge>
          </div>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            Executed with StackDoctor CLI v{run.toolVersion} on {run.operatingSystem} • {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (run) {
                const draft = buildIssueDraft(run as unknown as Report);
                copyToClipboard(draft.body, "issue_draft");
              }
            }}
          >
            {copiedKey === "issue_draft" ? "✓ Copied Issue Draft" : "Copy Issue Draft"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copyToClipboard(JSON.stringify(run, null, 2), "report_json")}
          >
            {copiedKey === "report_json" ? "✓ Copied JSON" : "Copy Sanitized JSON"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete Report
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem"
        }}
      >
        <Card>
          <CardBody>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Checks</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {run.summary?.totalChecks ?? findings.length}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Passed Checks</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--color-success)" }}>
              {run.summary?.passedChecks ?? 0}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Failed Checks</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: (run.summary?.failedChecks ?? 0) > 0 ? "var(--color-danger)" : "var(--color-text)" }}>
              {run.summary?.failedChecks ?? findings.length}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Duration</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {run.summary?.executionDurationMs ? `${run.summary.executionDurationMs}ms` : "Fast"}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Severity Filter Tabs */}
      <Tabs tabs={tabItems} activeTab={activeTab} onChange={setActiveTab} />

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <Card>
          <CardBody>
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--color-text-muted)" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "0.25rem" }}>
                No findings match the selected filter
              </p>
              <p style={{ fontSize: "0.875rem" }}>All diagnostic checks passed in this category.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {filteredFindings.map((finding: FindingItem, index: number) => (
            <Card key={finding.id || finding.ruleId || index}>
              <CardHeader>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.375rem" }}>
                      <Badge variant={getSeverityBadgeVariant(finding.severity)}>
                        {finding.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="default">{finding.category}</Badge>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                        {finding.ruleId}
                      </span>
                    </div>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                      <Link to={`/findings/${finding.ruleId}`}>
                        {finding.title}
                      </Link>
                    </h2>
                  </div>
                  <Link to={`/findings/${finding.ruleId}`} className="btn btn-ghost btn-sm">
                    Rule Details →
                  </Link>
                </div>
              </CardHeader>

              <CardBody>
                {/* 1. OBSERVED EVIDENCE (Facts) */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--color-primary)",
                      letterSpacing: "0.05em"
                    }}
                  >
                    <span>🔍</span>
                    <span>OBSERVED EVIDENCE (Deterministic Facts)</span>
                  </div>

                  {finding.evidence && finding.evidence.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {finding.evidence.map((ev, evIdx) => (
                        <div
                          key={ev.id || evIdx}
                          style={{
                            padding: "0.75rem",
                            backgroundColor: "var(--color-bg-alt)",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            fontSize: "0.875rem"
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                            {ev.description}
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                            {ev.observed}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                      Probe confirmed status.
                    </p>
                  )}
                </div>

                {/* 2. POSSIBLE CAUSES (Hypotheses) */}
                {finding.possibleCauses && finding.possibleCauses.length > 0 ? (
                  <div style={{ marginBottom: "1.25rem" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: "var(--color-warning-text)",
                        letterSpacing: "0.05em"
                      }}
                    >
                      <span>💡</span>
                      <span>POSSIBLE CAUSES (Hypotheses)</span>
                    </div>

                    <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                      {finding.possibleCauses.map((pc, pcIdx) => (
                        <li key={pc.id || pcIdx} style={{ marginBottom: "0.25rem" }}>
                          <span style={{ color: "var(--color-text)" }}>{pc.description}</span>
                          {pc.likelihood ? ` (Likelihood: ${pc.likelihood})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* 3. RECOMMENDED REMEDIATION */}
                {finding.remediation && finding.remediation.length > 0 ? (
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "var(--color-surface-hover)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)"
                    }}
                  >
                    <div style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                      Recommended Fix
                    </div>

                    {finding.remediation.map((rem, remIdx) => (
                      <div key={remIdx} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {rem.problem ? (
                          <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                            <strong>Why: </strong>{rem.problem}
                          </div>
                        ) : null}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--color-bg)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                          <code>{rem.commandOrAction}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(rem.commandOrAction, `fix_${index}_${remIdx}`)}
                          >
                            {copiedKey === `fix_${index}_${remIdx}` ? "✓ Copied" : "Copy Command"}
                          </Button>
                        </div>

                        {rem.risks ? (
                          <div style={{ fontSize: "0.8125rem", color: "var(--color-warning-text)" }}>
                            ⚠️ Risk: {rem.risks}
                          </div>
                        ) : null}

                        {rem.verification ? (
                          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                            Verify: <code>{rem.verification}</code>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Diagnostic Report?"
      >
        <p style={{ fontSize: "0.9375rem", color: "var(--color-text)", marginBottom: "1.5rem" }}>
          Are you sure you want to delete this diagnostic report? This action cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            Yes, Delete Report
          </Button>
        </div>
      </Modal>
    </div>
  );
}
