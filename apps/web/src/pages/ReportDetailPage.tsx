import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, DiagnosticRunItem, FindingItem, ExplanationResponse } from "../lib/api.js";
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
  const [prevRunId, setPrevRunId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadRun() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await api.runs.get(id);
        if (mounted) setRun(data.run);

        if (data.run?.projectId) {
          try {
            const listData = await api.runs.list(data.run.projectId);
            const runsList = listData.runs || [];
            const currentIndex = runsList.findIndex((r) => r.id === id);
            if (currentIndex !== -1 && currentIndex < runsList.length - 1) {
              if (mounted) setPrevRunId(runsList[currentIndex + 1].id);
            }
          } catch {
            // Ignore list failure
          }
        }

        // Check for cached AI explanation
        try {
          const cachedExp = await api.ai.getExplanation(id);
          if (mounted) setExplanation(cachedExp);
        } catch {
          // No cached explanation yet
        }
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

  const handleExplain = async () => {
    if (!id) return;
    try {
      setExplaining(true);
      setExplanationError(null);
      const res = await api.ai.explain(id);
      setExplanation(res);
    } catch (err) {
      setExplanationError(err instanceof Error ? err.message : "Failed to generate AI explanation.");
    } finally {
      setExplaining(false);
    }
  };

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

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExplain}
            disabled={explaining}
          >
            {explaining ? "Explaining with AI..." : explanation ? "Re-explain with AI" : "Explain with AI"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (prevRunId) {
                navigate(`/compare?base=${prevRunId}&head=${id}${run.projectId ? `&project=${run.projectId}` : ""}`);
              } else {
                navigate(`/compare?head=${id}${run.projectId ? `&project=${run.projectId}` : ""}`);
              }
            }}
          >
            Compare with previous run
          </Button>
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

      {/* AI Explanation Section */}
      {explanationError && (
        <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--color-danger)", borderRadius: "var(--radius-md)", color: "var(--color-danger)" }}>
          <strong>Explanation Error:</strong> {explanationError}
        </div>
      )}

      {explaining && (
        <Card style={{ marginBottom: "2rem", border: "1px solid var(--color-primary)" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem" }}>
              <div style={{ fontWeight: 600 }}>Analyzing diagnostic findings with AI...</div>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                Validating grounding against observed evidence and generating plain-text checklist.
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {explanation && !explaining && (
        <Card style={{ marginBottom: "2rem", border: "1px solid var(--color-border)" }}>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🤖</span>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  {explanation.ai ? "AI Diagnostic Explanation" : "Diagnostic Explanation (Fallback)"}
                </h2>
                <Badge variant={explanation.ai ? "success" : "warning"}>
                  {explanation.ai ? "AI-GENERATED" : "DETERMINISTIC FALLBACK"}
                </Badge>
                {explanation.cached && (
                  <Badge variant="default">CACHED</Badge>
                )}
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                {explanation.ai
                  ? "AI-generated explanation. Hypotheses are unverified. Verify before acting."
                  : "AI disabled or unavailable. Generated deterministically from findings."}
              </span>
            </div>
          </CardHeader>

          <CardBody>
            {/* Summary */}
            {explanation.explanation?.summary && (
              <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", backgroundColor: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)", borderLeft: "4px solid var(--color-primary)" }}>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>{explanation.explanation.summary}</p>
              </div>
            )}

            {/* 1. CONFIRMED FACTS */}
            {explanation.explanation?.confirmedFacts && explanation.explanation.confirmedFacts.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  ✓ Confirmed Facts (Tied to Evidence)
                </h3>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {explanation.explanation.confirmedFacts.map((fact, i) => (
                    <li key={i} style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                      <span>{fact.statement}</span>
                      {fact.evidenceIds && fact.evidenceIds.length > 0 && (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>
                          [{fact.evidenceIds.join(", ")}]
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2. HYPOTHESES */}
            {explanation.explanation?.hypotheses && explanation.explanation.hypotheses.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-warning)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  ? Probabilistic Hypotheses (Unverified)
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {explanation.explanation.hypotheses.map((hypo, i) => (
                    <div key={i} style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>{hypo.statement}</p>
                      <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                        <strong>Verification:</strong> {hypo.whatWouldConfirmIt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. RANKED ROOT CAUSES */}
            {explanation.explanation?.rootCauseRanking && explanation.explanation.rootCauseRanking.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  Ranked Root Causes
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {explanation.explanation.rootCauseRanking.map((cause, i) => (
                    <div key={i} style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>#{i + 1} {cause.cause}</span>
                        <Badge variant={cause.likelihood === "high" ? "danger" : cause.likelihood === "medium" ? "warning" : "default"}>
                          {cause.likelihood.toUpperCase()} LIKELIHOOD
                        </Badge>
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{cause.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. REMEDIATION CHECKLIST */}
            {explanation.explanation?.checklist && explanation.explanation.checklist.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  Remediation Checklist
                </h3>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {explanation.explanation.checklist.map((step, i) => (
                    <li key={i} style={{ fontSize: "0.875rem" }}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 5. SUGGESTED EXTRA CHECKS */}
            {explanation.explanation?.suggestedExtraChecks && explanation.explanation.suggestedExtraChecks.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  Suggested Extra Checks
                </h3>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {explanation.explanation.suggestedExtraChecks.map((check, i) => (
                    <li key={i} style={{ fontSize: "0.875rem" }}>{check}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6. REMOVED OR DOWNGRADED STATEMENTS */}
            {explanation.removed && explanation.removed.length > 0 && (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid var(--color-warning)", borderRadius: "var(--radius-md)" }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-warning)", marginBottom: "0.375rem" }}>
                  ⚠ {explanation.removed.length} statement(s) downgraded or removed by grounding checks:
                </p>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  {explanation.removed.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 7. UNVERIFIED COMMAND SUGGESTIONS */}
            {explanation.unverifiedSuggestions && explanation.unverifiedSuggestions.length > 0 && (
              <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--color-danger)", borderRadius: "var(--radius-md)" }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-danger)", marginBottom: "0.375rem" }}>
                  ⚠ Unallowlisted commands were stripped from display:
                </p>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  {explanation.unverifiedSuggestions.map((cmd, i) => (
                    <li key={i}>{cmd}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}

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

                        {rem.operationId ? (
                          <div style={{ marginTop: "0.5rem", padding: "0.75rem", backgroundColor: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "var(--radius-sm)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>
                                Safe Remediation CLI Command (Dry Run by Default)
                              </span>
                              <Badge variant="info">CLI ONLY</Badge>
                            </div>
                            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: "0.25rem 0" }}>
                              StackDoctor Web never executes remediation commands directly on your system. Run this in your local terminal:
                            </p>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--color-bg)", padding: "0.375rem 0.625rem", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                              <code>stackdoctor fix {rem.operationId}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(`stackdoctor fix ${rem.operationId}`, `cli_fix_${index}_${remIdx}`)}
                              >
                                {copiedKey === `cli_fix_${index}_${remIdx}` ? "✓ Copied" : "Copy CLI Fix"}
                              </Button>
                            </div>
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
