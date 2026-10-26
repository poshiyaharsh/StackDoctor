import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { Card, CardHeader, CardBody } from "../components/ui/Card.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";

interface RuleMetadata {
  id: string;
  title: string;
  category: string;
  description: string;
  technologies: string[];
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: "confirmed" | "likely" | "possible" | "tentative";
  recommendedChecks?: string[];
  remediation?: Array<{
    problem?: string;
    relevance?: string;
    commandOrAction: string;
    expectedResult?: string;
    risks?: string;
    verification?: string;
  }>;
  verification?: string;
  docs?: string[];
}

export function FindingDetailPage() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const [rule, setRule] = useState<RuleMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadRule() {
      if (!ruleId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await api.rules.get(ruleId);
        if (mounted) setRule(data.rule as unknown as RuleMetadata);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load rule details.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadRule();
    return () => {
      mounted = false;
    };
  }, [ruleId]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd(null), 2500);
    } catch {
      // Fallback
    }
  };

  const getSeverityBadgeVariant = (severity: string): "danger" | "warning" | "info" | "default" => {
    if (severity === "critical" || severity === "high") return "danger";
    if (severity === "medium") return "warning";
    if (severity === "low") return "info";
    return "default";
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        <p>Loading finding rule details...</p>
      </div>
    );
  }

  if (error || !rule) {
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
          {error || "Diagnostic rule not found"}
        </div>
        <Link to="/dashboard" className="btn btn-secondary btn-sm">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link to="/dashboard" style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          ← Back to Dashboard
        </Link>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <Badge variant={getSeverityBadgeVariant(rule.severity)}>
            {rule.severity.toUpperCase()}
          </Badge>
          <Badge variant="default">{rule.category}</Badge>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            {rule.id}
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            • Confidence: <strong>{rule.confidence}</strong>
          </span>
        </div>

        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          {rule.title}
        </h1>
        <p style={{ color: "var(--color-text)", fontSize: "1rem", lineHeight: 1.6 }}>
          {rule.description}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Recommended Checks */}
        {rule.recommendedChecks && rule.recommendedChecks.length > 0 ? (
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Recommended Diagnostic Probes</h2>
            </CardHeader>
            <CardBody>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--color-text)" }}>
                {rule.recommendedChecks.map((check, idx) => (
                  <li key={idx} style={{ marginBottom: "0.375rem" }}>
                    {check}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {/* Suggested Remediation */}
        {rule.remediation && rule.remediation.length > 0 ? (
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Suggested Remediation & Verification</h2>
            </CardHeader>
            <CardBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {rule.remediation.map((rem, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "1rem",
                      backgroundColor: "var(--color-bg-alt)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)"
                    }}
                  >
                    {rem.problem ? (
                      <p style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                        {rem.problem}
                      </p>
                    ) : null}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--color-bg)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontFamily: "var(--font-mono)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                      <code>{rem.commandOrAction}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(rem.commandOrAction, `rem_${idx}`)}
                      >
                        {copiedCmd === `rem_${idx}` ? "✓ Copied" : "Copy"}
                      </Button>
                    </div>

                    {rem.risks ? (
                      <p style={{ fontSize: "0.8125rem", color: "var(--color-warning-text)", marginBottom: "0.25rem" }}>
                        ⚠️ Potential Side Effects / Risks: {rem.risks}
                      </p>
                    ) : null}

                    {rem.verification ? (
                      <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                        Verification Command: <code>{rem.verification}</code>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ) : null}

        {/* Official Documentation Links */}
        {rule.docs && rule.docs.length > 0 ? (
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Documentation & References</h2>
            </CardHeader>
            <CardBody>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {rule.docs.map((docUrl, idx) => (
                  <li key={idx} style={{ marginBottom: "0.375rem" }}>
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-primary)", wordBreak: "break-all" }}
                    >
                      {docUrl} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
