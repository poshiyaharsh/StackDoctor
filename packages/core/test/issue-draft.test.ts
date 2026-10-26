import { describe, it, expect } from "vitest";
import { buildIssueDraft } from "@stackdoctor/core";
import type { Report } from "@stackdoctor/schemas";

function createSampleReport(overrides: Partial<Report> = {}): Report {
  return {
    schemaVersion: "1.0.0",
    toolVersion: "0.1.0",
    operatingSystem: "linux",
    startedAt: "2026-10-26T12:00:00.000Z",
    completedAt: "2026-10-26T12:00:05.000Z",
    status: "failed",
    projectName: "my-web-app",
    technologies: [
      {
        name: "Node.js",
        confidence: "confirmed",
        evidence: [
          {
            id: "ev-node-1",
            kind: "file",
            description: "package.json found",
            observed: "v20.11.0 in engines field",
            source: "package.json",
            collectedAt: "2026-10-26T12:00:01.000Z"
          }
        ]
      }
    ],
    checks: [
      {
        id: "check-node-version",
        title: "Node.js Version Check",
        category: "runtime",
        status: "failed",
        evidence: [
          {
            id: "ev-check-1",
            kind: "command",
            description: "node --version output",
            observed: "v18.16.0",
            source: "node -v",
            collectedAt: "2026-10-26T12:00:02.000Z"
          }
        ]
      }
    ],
    findings: [
      {
        ruleId: "NODE_VERSION_MISMATCH",
        title: "Node.js Version Mismatch",
        category: "runtime",
        severity: "critical",
        confidence: "confirmed",
        status: "failed",
        evidence: [
          {
            id: "ev-finding-1",
            kind: "file",
            description: "Observed engine mismatch",
            observed: "Required >=20.0.0, running v18.16.0",
            source: "package.json / process",
            collectedAt: "2026-10-26T12:00:03.000Z"
          }
        ],
        possibleCauses: [
          "Global Node.js version in PATH takes precedence over nvmrc",
          "Node version manager not loaded in shell session"
        ],
        recommendations: [
          {
            problem: "Current Node.js version is v18.16.0 but project requires >=20.0.0",
            relevance: "Dependencies rely on Node 20 features",
            commandOrAction: "nvm use 20 || n 20",
            expectedResult: "node -v prints v20.x.x",
            risks: "None; switches user shell runtime",
            undo: "nvm use 18",
            verification: "node -v"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://nodejs.org/en/about/previous-releases"]
      },
      {
        ruleId: "ENV_EXAMPLE_NO_ENV",
        title: "Missing .env File",
        category: "configuration",
        severity: "medium",
        confidence: "likely",
        status: "warning",
        evidence: [
          {
            id: "ev-finding-2",
            kind: "filesystem",
            description: ".env.example found but .env does not exist",
            observed: ".env.example present with 5 variables",
            source: "fs.existsSync",
            collectedAt: "2026-10-26T12:00:04.000Z"
          }
        ],
        possibleCauses: [
          "Developer forgot to copy .env.example after cloning"
        ],
        recommendations: [
          {
            problem: ".env is missing",
            relevance: "App needs environment variables to start",
            commandOrAction: "cp .env.example .env",
            expectedResult: ".env file created with default values",
            risks: "None",
            verification: "test -f .env"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://12factor.net/config"]
      }
    ],
    summary: {
      totalChecks: 1,
      totalFindings: 2,
      bySeverity: {
        critical: 1,
        high: 0,
        medium: 1,
        low: 0,
        info: 0
      },
      byStatus: {
        failed: 1,
        passed: 0,
        warning: 1,
        skipped: 0,
        error: 0
      }
    },
    ...overrides
  };
}

describe("GitHub Issue Draft Generator (packages/core)", () => {
  it("generates a structured issue draft with title, body, and labels", () => {
    const report = createSampleReport();
    const draft = buildIssueDraft(report);

    expect(draft.title).toContain("[Environment Issue] my-web-app: Node.js Version Mismatch (+1 more)");
    expect(draft.labels).toEqual(["environment", "stackdoctor", "bug"]);

    // Required sections in body
    expect(draft.body).toContain("## Summary");
    expect(draft.body).toContain("## Environment");
    expect(draft.body).toContain("## Detected Technologies");
    expect(draft.body).toContain("## Findings");
    expect(draft.body).toContain("## Observed Evidence");
    expect(draft.body).toContain("## Possible Causes (Hypotheses)");
    expect(draft.body).toContain("## Steps Already Suggested");
    expect(draft.body).toContain("## Steps to Reproduce");
    expect(draft.body).toContain("## Additional Context");
  });

  it("strictly maintains separation between observed evidence and hypothetical causes", () => {
    const report = createSampleReport();
    const draft = buildIssueDraft(report);

    // Evidence section must declare Observed Only
    expect(draft.body).toContain("## Observed Evidence");
    expect(draft.body).toContain("> **Observed Only:**");
    expect(draft.body).toContain("Required >=20.0.0, running v18.16.0");

    // Hypotheses section must declare Hypotheses Only
    expect(draft.body).toContain("## Possible Causes (Hypotheses)");
    expect(draft.body).toContain("> **Hypotheses Only:**");
    expect(draft.body).toContain("Global Node.js version in PATH takes precedence over nvmrc");

    // Verify evidence note appears before possible causes
    const evidenceIndex = draft.body.indexOf("## Observed Evidence");
    const causesIndex = draft.body.indexOf("## Possible Causes (Hypotheses)");
    expect(evidenceIndex).toBeGreaterThan(-1);
    expect(causesIndex).toBeGreaterThan(evidenceIndex);
  });

  it("sanitizes secrets, tokens, AWS keys, JWTs, and URL credentials (canary test)", () => {
    const CANARY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const CANARY_AWS = "AKIAIOSFODNN7EXAMPLE";
    const CANARY_PASS = "SuperSecretCanaryPassword123!";
    const CANARY_BEARER = "Authorization: Bearer canary_bearer_token_xyz_987";
    const CANARY_KEY = `-----BEGIN RSA PRIVATE KEY-----
CANARY_PRIVATE_KEY_BODY_DATA
-----END RSA PRIVATE KEY-----`;

    const report = createSampleReport({
      findings: [
        {
          ruleId: "LEAKED_CREDENTIALS_TEST",
          title: `Leaked Key in JWT: ${CANARY_JWT}`,
          category: "security",
          severity: "critical",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-canary",
              kind: "config",
              description: `Found secret in config: password="${CANARY_PASS}" and ${CANARY_BEARER}`,
              observed: `url=mongodb://adminUser:${CANARY_PASS}@10.0.0.5:27017/prod and key=${CANARY_AWS}\n${CANARY_KEY}`,
              source: "auth.config",
              collectedAt: "2026-10-26T12:00:00.000Z"
            }
          ],
          possibleCauses: [`Database connection failed because password="${CANARY_PASS}"`],
          recommendations: [
            {
              problem: "Secret credentials exposed",
              relevance: "Credentials must be revoked",
              commandOrAction: `export DB_PASSWORD="${CANARY_PASS}"`,
              expectedResult: "Rotated credentials",
              risks: "None",
              verification: "check-creds"
            }
          ],
          verificationStatus: "unverified",
          docs: []
        }
      ]
    });

    const draft = buildIssueDraft(report);

    // Canaries must NEVER appear anywhere in draft body or title
    expect(draft.title).not.toContain(CANARY_JWT);
    expect(draft.title).toContain("[REDACTED_JWT]");

    expect(draft.body).not.toContain(CANARY_JWT);
    expect(draft.body).not.toContain(CANARY_AWS);
    expect(draft.body).not.toContain(CANARY_PASS);
    expect(draft.body).not.toContain("canary_bearer_token_xyz_987");
    expect(draft.body).not.toContain("CANARY_PRIVATE_KEY_BODY_DATA");
    expect(draft.body).not.toContain("adminUser:SuperSecretCanaryPassword123!@10.0.0.5");

    // Redaction tokens must be present
    expect(draft.body).toContain("[REDACTED_AWS_KEY]");
    expect(draft.body).toContain("[REDACTED_PRIVATE_KEY]");
    expect(draft.body).toContain("Authorization: Bearer [REDACTED]");
    expect(draft.body).toContain("[REDACTED_IP]");
  });

  it("sanitizes absolute paths, user home directory, username, hostname, and IPs", () => {
    const report = createSampleReport({
      findings: [
        {
          ruleId: "PATH_LEAK_TEST",
          title: "Path Leak Test",
          category: "runtime",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-path",
              kind: "filesystem",
              description: "Found broken module at C:\\Users\\AliceDeveloper\\workspace\\my-web-app\\src\\app.ts",
              observed: "Module loaded from /home/alicedev/my-web-app/node_modules/pkg on host laptop-of-alice with IP 192.168.1.150",
              source: "C:\\Users\\AliceDeveloper\\workspace\\my-web-app\\src\\app.ts",
              collectedAt: "2026-10-26T12:00:00.000Z"
            }
          ],
          possibleCauses: [
            "User AliceDeveloper did not run build on laptop-of-alice"
          ],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ]
    });

    const draft = buildIssueDraft(report, {
      projectPath: "C:\\Users\\AliceDeveloper\\workspace\\my-web-app",
      homeDir: "C:\\Users\\AliceDeveloper",
      username: "AliceDeveloper",
      hostname: "laptop-of-alice"
    });

    // Neither the username, hostname, nor raw absolute paths should appear
    expect(draft.body).not.toContain("AliceDeveloper");
    expect(draft.body).not.toContain("laptop-of-alice");
    expect(draft.body).not.toContain("C:\\Users\\AliceDeveloper");
    expect(draft.body).not.toContain("/home/alicedev");
    expect(draft.body).not.toContain("192.168.1.150");

    // Normalized tags must be present
    expect(draft.body).toContain("<user>");
    expect(draft.body).toContain("<host>");
    expect(draft.body).toContain("[REDACTED_IP]");
  });

  it("filters findings using minSeverity option", () => {
    const report = createSampleReport({
      findings: [
        {
          ruleId: "INFO_RULE",
          title: "Info Check Notice",
          category: "info",
          severity: "info",
          confidence: "confirmed",
          status: "passed",
          evidence: [],
          possibleCauses: [],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        },
        {
          ruleId: "LOW_RULE",
          title: "Low Check Notice",
          category: "optimization",
          severity: "low",
          confidence: "likely",
          status: "warning",
          evidence: [],
          possibleCauses: [],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        },
        {
          ruleId: "HIGH_RULE",
          title: "High Severity Problem",
          category: "security",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [],
          possibleCauses: ["Security flaw detected"],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ]
    });

    // Filter by high: only HIGH_RULE should appear, INFO_RULE and LOW_RULE omitted
    const highDraft = buildIssueDraft(report, { minSeverity: "high" });
    expect(highDraft.body).toContain("HIGH_RULE");
    expect(highDraft.body).not.toContain("INFO_RULE");
    expect(highDraft.body).not.toContain("LOW_RULE");
    expect(highDraft.title).toContain("High Severity Problem");

    // Filter by critical: nothing meets threshold
    const critDraft = buildIssueDraft(report, { minSeverity: "critical" });
    expect(critDraft.body).toContain('No findings reported matching minimum severity "critical"');
    expect(critDraft.body).not.toContain("HIGH_RULE");
  });

  it("omits observed evidence when includeEvidence is false (--no-evidence)", () => {
    const report = createSampleReport();
    const draft = buildIssueDraft(report, { includeEvidence: false });

    expect(draft.body).toContain("## Observed Evidence");
    expect(draft.body).toContain("Observed evidence omitted via options.");
    expect(draft.body).not.toContain("Required >=20.0.0, running v18.16.0");
  });

  it("truncates large reports exceeding maximum body size and appends warning note", () => {
    const longEvidence = "x".repeat(5000);
    const report = createSampleReport({
      findings: [
        {
          ruleId: "VERY_LONG_EVIDENCE",
          title: "Very Long Evidence Finding",
          category: "runtime",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-long",
              kind: "log",
              description: "Huge dump",
              observed: longEvidence,
              source: "logfile",
              collectedAt: "2026-10-26T12:00:00.000Z"
            }
          ],
          possibleCauses: ["Huge log output"],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ]
    });

    const maxLimit = 1500;
    const draft = buildIssueDraft(report, { maxBodyLength: maxLimit });

    expect(draft.body.length).toBeLessThanOrEqual(maxLimit);
    expect(draft.body).toContain("This diagnostic report was truncated to fit within GitHub's issue body size limit");
    expect(draft.body).toContain("[!WARNING]");
  });

  it("snapshot matches expected draft layout", () => {
    const report = createSampleReport();
    const draft = buildIssueDraft(report);

    expect(draft).toMatchSnapshot();
  });
});
