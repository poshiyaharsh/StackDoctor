import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge.js";
import { Card, CardBody } from "../components/ui/Card.js";

export function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <Badge variant="info" style={{ marginBottom: "1rem" }}>
            Open Source Developer Diagnostics
          </Badge>
          <h1 className="hero-tagline">
            Find the cause.
            <br />
            Fix the environment.
            <br />
            Ship the code.
          </h1>
          <p className="hero-subtitle">
            StackDoctor scans your project environment to diagnose missing dependencies,
            runtime version mismatches, port conflicts, database refusal, and pending migrations — 100% offline.
          </p>

          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">
              Get started free
            </Link>
            <a
              href="https://github.com/poshiyaharsh/StackDoctor"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-lg"
            >
              Star on GitHub
            </a>
          </div>

          {/* Quick Terminal Preview */}
          <div className="terminal-box">
            <div className="terminal-header">
              <span className="terminal-dot terminal-dot-red"></span>
              <span className="terminal-dot terminal-dot-yellow"></span>
              <span className="terminal-dot terminal-dot-green"></span>
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "auto" }}>bash</span>
            </div>
            <p style={{ color: "#38bdf8", marginBottom: "0.5rem" }}>
              $ npx stackdoctor scan
            </p>
            <p style={{ color: "#94a3b8" }}>=== StackDoctor Diagnostic Report ===</p>
            <p style={{ color: "#f87171" }}>
              • [HIGH] Port 3000 already in use (PORT_IN_USE)
            </p>
            <p style={{ color: "#cbd5e1", paddingLeft: "1rem" }}>
              Evidence : Port 3000 listening on 127.0.0.1 (PID: 4921)
            </p>
            <p style={{ color: "#cbd5e1", paddingLeft: "1rem" }}>
              Fix      : Terminate lingering process or run with PORT=3001
            </p>
            <p style={{ color: "#4ade80", marginTop: "0.5rem" }}>
              All diagnostics evaluated locally in 18ms. Zero network calls.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Statement & Core Philosophy */}
      <section style={{ padding: "4rem 0", backgroundColor: "var(--color-surface-subtle)" }}>
        <div className="container">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto 3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
              Environment errors cost engineering hours
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              Between stale lockfiles, conflicting node engines, missing Python virtualenvs,
              and broken database credentials, developers waste hours asking teammates why their app won't boot.
            </p>
          </div>

          <div className="feature-grid">
            <Card>
              <CardBody>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>⚡</div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  100% Offline by Default
                </h3>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
                  The CLI diagnostics engine operates entirely on your local machine. No code or environment
                  variables ever leave your computer unless you explicitly choose to upload a sanitized report.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>🔬</div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Facts vs. Hypotheses
                </h3>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
                  StackDoctor strictly separates verified observations (what was detected) from probable
                  causes (hypotheses) so you always know what is real vs. inferred.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>🛡️</div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Deep Secret Redaction
                </h3>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
                  Multi-layer regex scanning redacts passwords, private keys, AWS tokens, and JWTs
                  before logs or reports are written. Machine hostnames and IPs are never collected.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* 3-Step Workflow */}
      <section style={{ padding: "4rem 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              How StackDoctor Works
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              Three simple steps to a working development environment
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "2rem"
            }}
          >
            <div style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  marginBottom: "1rem"
                }}
              >
                1
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Run Diagnostics
              </h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
                Run <code>npx stackdoctor scan</code> in any project directory. It detects frameworks,
                checks dependencies, inspects ports, and verifies configs in milliseconds.
              </p>
            </div>

            <div style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  marginBottom: "1rem"
                }}
              >
                2
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Review Evidence
              </h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
                Review concrete evidence facts, root-cause hypotheses, and non-destructive remediation
                steps with explanations of risks and undo actions.
              </p>
            </div>

            <div style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  marginBottom: "1rem"
                }}
              >
                3
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Optional Team Collaboration
              </h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
                Optionally upload sanitized reports to the web platform to share diagnostic results with
                teammates or track historical environment reliability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Example Report (Sample Data Clearly Labeled) */}
      <section style={{ padding: "4rem 0", backgroundColor: "var(--color-surface-subtle)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <Badge variant="neutral" style={{ marginBottom: "0.5rem" }}>
              Illustrative Sample Data
            </Badge>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
              Example Diagnostic Findings
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              The following represents sample data demonstrating how findings and evidence are displayed.
            </p>
          </div>

          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <Card>
              <CardBody>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                      Missing Node Dependencies (sample data)
                    </h4>
                    <p style={{ color: "var(--color-text-dim)", fontSize: "0.8125rem" }}>Rule: NODE_DEPS_NOT_INSTALLED</p>
                  </div>
                  <Badge variant="high">HIGH</Badge>
                </div>

                <div style={{ marginBottom: "1rem", backgroundColor: "var(--color-surface-hover)", padding: "0.75rem", borderRadius: "var(--radius-md)" }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                    OBSERVED EVIDENCE:
                  </p>
                  <p style={{ fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>
                    package.json specifies 14 dependencies, but node_modules directory does not exist.
                  </p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                    POSSIBLE CAUSES:
                  </p>
                  <p style={{ fontSize: "0.875rem" }}>
                    Dependencies were not installed after cloning repository or switching branches.
                  </p>
                </div>

                <div style={{ padding: "0.75rem", borderLeft: "3px solid var(--color-primary)", backgroundColor: "var(--color-primary-subtle)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-primary)" }}>
                    RECOMMENDED REMEDIATION:
                  </p>
                  <p style={{ fontSize: "0.875rem", fontFamily: "var(--font-mono)", marginTop: "0.25rem" }}>
                    npm install
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "3rem 0", borderTop: "1px solid var(--color-border)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
        <div className="container">
          <p style={{ marginBottom: "0.75rem" }}>
            StackDoctor is open source software released under the MIT License.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem" }}>
            <a href="https://github.com/poshiyaharsh/StackDoctor" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
            <a href="https://github.com/poshiyaharsh/StackDoctor/blob/main/docs/contributing.md" target="_blank" rel="noopener noreferrer">
              Contributing Guide
            </a>
            <a href="https://github.com/poshiyaharsh/StackDoctor/blob/main/docs/security.md" target="_blank" rel="noopener noreferrer">
              Security Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
