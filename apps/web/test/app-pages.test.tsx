// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { DashboardPage } from "../src/pages/DashboardPage.js";
import { ProjectsPage } from "../src/pages/ProjectsPage.js";
import { ProjectDetailPage } from "../src/pages/ProjectDetailPage.js";
import { ReportDetailPage } from "../src/pages/ReportDetailPage.js";
import { FindingDetailPage } from "../src/pages/FindingDetailPage.js";
import { ComparePage } from "../src/pages/ComparePage.js";
import { SettingsPage } from "../src/pages/SettingsPage.js";
import type { ReportComparison } from "@stackdoctor/core";
import { AuthProvider } from "../src/context/AuthContext.js";
import { ToastProvider } from "../src/components/ui/Toast.js";
import { api, StatsResponse, ProjectItem, DiagnosticRunItem } from "../src/lib/api.js";

describe("StackDoctor Web Application Pages (Run 3E)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const mockUser = {
    id: "usr_12345",
    email: "dev@example.com",
    displayName: "Grace Hopper",
    retentionDays: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const renderWithProviders = (ui: React.ReactElement, initialRoute = "/") => {
    // Mock /api/v1/auth/me to return authenticated user
    vi.spyOn(api.auth, "getMe").mockResolvedValue({
      user: mockUser,
      csrfToken: "mock-csrf-token"
    });

    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <ToastProvider>
            {ui}
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe("1. Dashboard Page", () => {
    it("renders empty state with copyable CLI setup instructions when no reports exist", async () => {
      const emptyStats: StatsResponse = {
        totalRuns: 0,
        projectsScanned: 0,
        failedChecks: 0,
        commonCategories: [],
        recentReports: [],
        statusBreakdown: { passed: 0, warning: 0, failed: 0 }
      };

      vi.spyOn(api.stats, "get").mockResolvedValue(emptyStats);

      renderWithProviders(<DashboardPage />);

      // Shows loading initially
      expect(screen.getByText(/Loading dashboard metrics/i)).toBeInTheDocument();

      // Resolves to empty state
      await waitFor(() => {
        expect(screen.getByText(/No diagnostic reports uploaded yet/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/1\. npm install -g @stackdoctor\/cli/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. stackdoctor login/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. stackdoctor upload/i)).toBeInTheDocument();
    });

    it("renders stats, common categories, and recent reports when data exists", async () => {
      const populatedStats: StatsResponse = {
        totalRuns: 4,
        projectsScanned: 2,
        failedChecks: 3,
        commonCategories: [
          { category: "runtime", count: 2 },
          { category: "network", count: 1 }
        ],
        recentReports: [
          {
            id: "run_999",
            projectId: "proj_111",
            projectName: "Payment Service",
            status: "failed",
            findingsCount: 2,
            createdAt: new Date().toISOString()
          }
        ],
        statusBreakdown: { passed: 3, warning: 0, failed: 1 }
      };

      vi.spyOn(api.stats, "get").mockResolvedValue(populatedStats);

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Payment Service")).toBeInTheDocument();
      });

      expect(screen.getByText("4")).toBeInTheDocument(); // Total Runs
      expect(screen.getAllByText("3")).toHaveLength(2); // Failed Checks and Passed Scans
      expect(screen.getByText("runtime")).toBeInTheDocument();
      expect(screen.getByText("2 occurrences")).toBeInTheDocument();
    });
  });

  describe("2. Projects and Project Detail Pages", () => {
    it("lists registered projects with technologies", async () => {
      const mockProjects: ProjectItem[] = [
        {
          id: "proj_abc",
          ownerId: "usr_12345",
          name: "API Gateway",
          repositoryUrl: "https://github.com/org/gateway",
          detectedTechnologies: ["node", "docker"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      vi.spyOn(api.projects, "list").mockResolvedValue({ total: 1, projects: mockProjects });

      renderWithProviders(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText("API Gateway")).toBeInTheDocument();
      });

      expect(screen.getByText("node")).toBeInTheDocument();
      expect(screen.getByText("docker")).toBeInTheDocument();
      expect(screen.getByText("View Runs & Details →")).toBeInTheDocument();
    });

    it("renders project detail and run history", async () => {
      const project: ProjectItem = {
        id: "proj_abc",
        ownerId: "usr_12345",
        name: "API Gateway",
        detectedTechnologies: ["node"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const recentRuns: DiagnosticRunItem[] = [
        {
          id: "run_xyz",
          projectId: "proj_abc",
          ownerId: "usr_12345",
          toolVersion: "0.1.0",
          operatingSystem: "linux",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: "passed",
          summary: { totalChecks: 6, passedChecks: 6, failedChecks: 0 },
          findings: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      vi.spyOn(api.projects, "get").mockResolvedValue({ project, recentRuns });

      renderWithProviders(
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>,
        "/projects/proj_abc"
      );

      await waitFor(() => {
        expect(screen.getByText("API Gateway")).toBeInTheDocument();
      });

      expect(screen.getByText("Delete Project")).toBeInTheDocument();
      expect(screen.getByText(/PASSED/i)).toBeInTheDocument();
    });
  });

  describe("3. Diagnostic Report Page (Observed Evidence vs Possible Causes)", () => {
    it("renders findings distinctly labeling OBSERVED EVIDENCE and POSSIBLE CAUSES with severity filters", async () => {
      const mockRun: DiagnosticRunItem = {
        id: "run_report_123",
        projectId: "proj_abc",
        ownerId: "usr_12345",
        toolVersion: "0.1.0",
        operatingSystem: "win32",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "failed",
        summary: { totalChecks: 8, passedChecks: 7, failedChecks: 1, executionDurationMs: 42 },
        findings: [
          {
            id: "f_1",
            ruleId: "NODE_DEPS_NOT_INSTALLED",
            title: "Dependencies not installed in node_modules",
            category: "dependency",
            severity: "high",
            confidence: "confirmed",
            status: "failed",
            evidence: [
              {
                id: "ev_1",
                kind: "file_existence",
                description: "Directory node_modules is missing",
                observed: "Directory node_modules was not found in project root"
              }
            ],
            possibleCauses: [
              {
                id: "pc_1",
                description: "Fresh git clone before running package manager install",
                likelihood: "very_high"
              }
            ],
            remediation: [
              {
                problem: "Cannot run or test without installed node dependencies",
                commandOrAction: "npm install",
                risks: "Modifies package-lock.json if versions conflict",
                verification: "stackdoctor scan"
              }
            ]
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(api.runs, "get").mockResolvedValue({ run: mockRun });

      renderWithProviders(
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>,
        "/reports/run_report_123"
      );

      await waitFor(() => {
        expect(screen.getByText("Dependencies not installed in node_modules")).toBeInTheDocument();
      });

      // Must explicitly label observed facts vs hypotheses
      expect(screen.getByText(/OBSERVED EVIDENCE/i)).toBeInTheDocument();
      expect(screen.getByText(/Directory node_modules was not found/i)).toBeInTheDocument();

      expect(screen.getByText(/POSSIBLE CAUSES/i)).toBeInTheDocument();
      expect(screen.getByText(/Fresh git clone before running/i)).toBeInTheDocument();

      // Remediation command
      expect(screen.getByText("npm install")).toBeInTheDocument();
      expect(screen.getByText("Copy Command")).toBeInTheDocument();

      // Severity filters
      const criticalTab = screen.getByRole("tab", { name: /critical/i });
      fireEvent.click(criticalTab);

      // No critical findings in this report
      expect(screen.getByText(/No findings match the selected filter/i)).toBeInTheDocument();

      // Click High tab
      const highTab = screen.getByRole("tab", { name: /high/i });
      fireEvent.click(highTab);
      expect(screen.getByText("Dependencies not installed in node_modules")).toBeInTheDocument();
    });

    it("renders Copy Issue Draft button and copies draft markdown using shared buildIssueDraft", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      const mockRun: DiagnosticRunItem = {
        id: "run_report_draft",
        projectId: "proj_abc",
        ownerId: "usr_12345",
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "failed",
        summary: { totalChecks: 5, passedChecks: 4, failedChecks: 1 },
        findings: [
          {
            id: "f_draft_1",
            ruleId: "NODE_DEPS_NOT_INSTALLED",
            title: "Dependencies missing",
            category: "dependency",
            severity: "high",
            confidence: "confirmed",
            status: "failed",
            evidence: [
              {
                id: "ev_draft",
                kind: "filesystem",
                description: "node_modules is missing",
                observed: "Directory not found"
              }
            ],
            possibleCauses: [
              {
                id: "pc_draft",
                description: "Forgot npm install",
                likelihood: "high"
              }
            ]
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(api.runs, "get").mockResolvedValue({ run: mockRun });

      renderWithProviders(
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>,
        "/reports/run_report_draft"
      );

      await waitFor(() => {
        expect(screen.getByText("Copy Issue Draft")).toBeInTheDocument();
      });

      const copyBtn = screen.getByText("Copy Issue Draft");
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledTimes(1);
      });

      const copiedText = writeTextMock.mock.calls[0][0];
      expect(copiedText).toContain("## Summary");
      expect(copiedText).toContain("## Observed Evidence");
      expect(copiedText).toContain("## Possible Causes (Hypotheses)");
      expect(copiedText).toContain("NODE_DEPS_NOT_INSTALLED");
      expect(screen.getByText("✓ Copied Issue Draft")).toBeInTheDocument();
    });

    it("renders 'Compare with previous run' button and navigates to compare page", async () => {
      const mockRun: DiagnosticRunItem = {
        id: "run_head_123",
        projectId: "proj_999",
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        status: "completed",
        findings: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(api.runs, "get").mockResolvedValue({ run: mockRun });
      vi.spyOn(api.runs, "list").mockResolvedValue({
        total: 2,
        runs: [
          mockRun,
          {
            id: "run_base_456",
            projectId: "proj_999",
            toolVersion: "0.1.0",
            operatingSystem: "linux",
            status: "failed",
            findings: [],
            createdAt: new Date(Date.now() - 60000).toISOString(),
            updatedAt: new Date(Date.now() - 60000).toISOString()
          }
        ]
      });

      renderWithProviders(
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/compare" element={<div>Compare Target Page</div>} />
        </Routes>,
        "/reports/run_head_123"
      );

      await waitFor(() => {
        expect(screen.getByText("Compare with previous run")).toBeInTheDocument();
      });

      const compareBtn = screen.getByText("Compare with previous run");
      fireEvent.click(compareBtn);

      await waitFor(() => {
        expect(screen.getByText("Compare Target Page")).toBeInTheDocument();
      });
    });

    it("renders 'Explain with AI' button and renders AI explanations with inert XSS protection", async () => {
      const mockRun: DiagnosticRunItem = {
        id: "run_ai_test_123",
        projectId: "proj_999",
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        status: "failed",
        findings: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(api.runs, "get").mockResolvedValue({ run: mockRun });
      vi.spyOn(api.runs, "list").mockResolvedValue({ total: 1, runs: [mockRun] });
      vi.spyOn(api.ai, "getExplanation").mockRejectedValue(new Error("Not cached"));
      vi.spyOn(api.ai, "explain").mockResolvedValue({
        ai: true,
        status: "success",
        cached: false,
        explanation: {
          summary: "XSS Test Summary <script>alert('xss')</script>",
          confirmedFacts: [
            {
              statement: "Confirmed Fact with <img src=x onerror=alert(1)>",
              evidenceIds: ["ev-xss-1"]
            }
          ],
          hypotheses: [
            {
              statement: "Hypothesis with <svg onload=alert(2)>",
              whatWouldConfirmIt: "Check logs"
            }
          ],
          rootCauseRanking: [
            {
              cause: "Root cause <iframe src='javascript:alert(3)'>",
              likelihood: "high",
              reasoning: "Reasoning plain text",
              supportingEvidenceIds: ["ev-xss-1"]
            }
          ],
          checklist: ["Remediation step with <b onmouseover=alert(4)>action</b>"]
        },
        removed: ["Removed statement <script>"],
        unverifiedSuggestions: ["Unallowlisted rm -rf /"]
      });

      renderWithProviders(
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>,
        "/reports/run_ai_test_123"
      );

      await waitFor(() => {
        expect(screen.getByText("Explain with AI")).toBeInTheDocument();
      });

      const explainBtn = screen.getByText("Explain with AI");
      fireEvent.click(explainBtn);

      await waitFor(() => {
        expect(screen.getByText("AI Diagnostic Explanation")).toBeInTheDocument();
        expect(screen.getByText("AI-GENERATED")).toBeInTheDocument();
      });

      // Verify sections are rendered
      expect(screen.getByText(/Confirmed Facts \(Tied to Evidence\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Probabilistic Hypotheses \(Unverified\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Ranked Root Causes/i)).toBeInTheDocument();
      expect(screen.getByText(/Remediation Checklist/i)).toBeInTheDocument();

      // Verify XSS payloads are strictly inert plain text strings (no script tags or injected img tags in DOM)
      expect(screen.getByText(/XSS Test Summary <script>alert\('xss'\)<\/script>/)).toBeInTheDocument();
      expect(screen.getByText(/Confirmed Fact with <img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
      expect(document.querySelector("script[src*='alert']")).toBeNull();
      expect(document.querySelector("img[src='x']")).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
    });
  });

  describe("4. Finding Details Page", () => {
    it("renders rule documentation, confidence, probes, and secure external links", async () => {
      const mockRule = {
        id: "PORT_IN_USE",
        title: "Required network port is already in use",
        category: "network",
        description: "A network port required by the application is already bound by another process.",
        technologies: ["*"],
        severity: "high",
        confidence: "confirmed",
        recommendedChecks: ["Run TCP connection probe against required host and port"],
        remediation: [
          {
            problem: "Port collision prevents application server from binding its listening socket.",
            commandOrAction: "Stop the conflicting process or change PORT",
            risks: "Stopping another process may terminate background services.",
            verification: "stackdoctor scan"
          }
        ],
        docs: ["https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers"]
      };

      vi.spyOn(api.rules, "get").mockResolvedValue({ rule: mockRule });

      renderWithProviders(
        <Routes>
          <Route path="/findings/:ruleId" element={<FindingDetailPage />} />
        </Routes>,
        "/findings/PORT_IN_USE"
      );

      await waitFor(() => {
        expect(screen.getByText("Required network port is already in use")).toBeInTheDocument();
      });

      expect(screen.getByText(/Confidence:/i)).toBeInTheDocument();
      expect(screen.getByText("confirmed")).toBeInTheDocument();
      expect(screen.getByText("Run TCP connection probe against required host and port")).toBeInTheDocument();

      // External doc links have rel="noopener noreferrer"
      const docLink = screen.getByRole("link", { name: /en\.wikipedia\.org/i });
      expect(docLink).toHaveAttribute("target", "_blank");
      expect(docLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("5. Settings Page (Tokens, Password, Retention, AI, Danger Zone)", () => {
    it("manages API tokens and shows new token once with warning", async () => {
      vi.spyOn(api.tokens, "list").mockResolvedValue({
        tokens: [
          {
            id: "tok_1",
            name: "CI Runner",
            prefix: "stk_live_abcd",
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            expiresAt: null
          }
        ]
      });

      vi.spyOn(api.tokens, "create").mockResolvedValue({
        token: "stk_live_secret_token_123456789",
        apiToken: {
          id: "tok_2",
          name: "Laptop CLI",
          prefix: "stk_live_secr",
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          expiresAt: null
        }
      });

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText("CI Runner")).toBeInTheDocument();
      });

      // Open Generate Token Modal
      const generateBtn = screen.getByRole("button", { name: /\+ Generate New Token/i });
      fireEvent.click(generateBtn);

      expect(screen.getByText("Generate API Token")).toBeInTheDocument();
      const labelInput = screen.getByLabelText(/Token Label/i);
      fireEvent.change(labelInput, { target: { value: "Laptop CLI" } });

      const submitBtn = screen.getByRole("button", { name: /Generate Token/i });
      fireEvent.click(submitBtn);

      // Must display the plain token exactly once with warning
      await waitFor(() => {
        expect(screen.getByText("stk_live_secret_token_123456789")).toBeInTheDocument();
      });
      expect(screen.getByText(/This is the only time this token will ever be displayed/i)).toBeInTheDocument();

      // Dismiss modal
      const doneBtn = screen.getByRole("button", { name: /I Have Saved My Token/i });
      fireEvent.click(doneBtn);

      // Token modal closed
      expect(screen.queryByText(/This is the only time this token will ever be displayed/i)).toBeNull();
    });

    it("renders AI Explanations tab and data retention settings", async () => {
      vi.spyOn(api.tokens, "list").mockResolvedValue({ tokens: [] });
      vi.spyOn(api.ai, "getSettings").mockResolvedValue({
        enabled: false,
        hasKey: false,
        provider: "anthropic",
        model: ""
      });

      renderWithProviders(<SettingsPage />);

      // Switch to AI tab
      const aiTab = screen.getByRole("tab", { name: /AI Explanations/i });
      fireEvent.click(aiTab);

      expect(screen.getByText(/Strict Privacy & Grounding Guarantees/i)).toBeInTheDocument();
      expect(screen.getByText(/Enable AI Explanations/i)).toBeInTheDocument();
      expect(screen.getByText(/Bring Your Own API Key \(BYOK\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Save AI Settings/i)).toBeInTheDocument();

      // Switch to Data Retention tab
      const retentionTab = screen.getByRole("tab", { name: /Data Retention/i });
      fireEvent.click(retentionTab);

      expect(screen.getByText("Report Retention Policy")).toBeInTheDocument();
      expect(screen.getByText("Run Retention Cleanup Now")).toBeInTheDocument();
    });
  });

  describe("6. Compare Page (Run 4C)", () => {
    const mockComparison: ReportComparison = {
      baseProject: "Base App",
      headProject: "Head App",
      baseTimestamp: "2026-10-26T10:00:00Z",
      headTimestamp: "2026-10-26T11:00:00Z",
      newFindings: [
        {
          ruleId: "NEW_RULE_REGRESSION",
          title: "New Critical Regression Detected",
          category: "security",
          severity: "critical",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev_new",
              kind: "security_probe",
              description: "Secret key exposed",
              observed: "Found unencrypted private key",
              source: "probe",
              collectedAt: "2026-10-26T11:00:00Z"
            }
          ],
          possibleCauses: ["Accidentally committed private key"],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ],
      resolvedFindings: [
        {
          ruleId: "OLD_BUG_FIXED",
          title: "Resolved Database Timeout",
          category: "databases",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [],
          possibleCauses: [],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ],
      unchangedFindings: [],
      changedFindings: [
        {
          finding: {
            ruleId: "ESCALATED_ISSUE",
            title: "Memory leak escalated",
            category: "memory",
            severity: "critical",
            confidence: "confirmed",
            status: "failed",
            evidence: [],
            possibleCauses: [],
            recommendations: [],
            verificationStatus: "unverified",
            docs: []
          },
          previousFinding: {
            ruleId: "ESCALATED_ISSUE",
            title: "Memory leak escalated",
            category: "memory",
            severity: "medium",
            confidence: "possible",
            status: "warning",
            evidence: [],
            possibleCauses: [],
            recommendations: [],
            verificationStatus: "unverified",
            docs: []
          },
          changes: {
            severity: { before: "medium", after: "critical" },
            confidence: { before: "possible", after: "confirmed" },
            status: { before: "warning", after: "failed" }
          }
        }
      ],
      environmentChanges: {
        operatingSystem: { before: "ubuntu-20.04", after: "ubuntu-22.04" },
        toolVersion: { before: "0.0.9", after: "0.1.0" },
        runtimeVersions: [
          { runtime: "Node.js", before: "v18.0.0", after: "v20.0.0" }
        ]
      },
      technologyChanges: {
        added: [{ name: "Redis", confidence: "confirmed", evidence: [] }],
        removed: [{ name: "MySQL", confidence: "likely", evidence: [] }],
        unchanged: []
      },
      summaryDelta: {
        checksDelta: 0,
        findingsDelta: 0,
        severityDeltas: { critical: 1, high: -1, medium: 0, low: 0, info: 0 }
      },
      hasRegressions: true
    };

    it("renders comparison results with New, Resolved, Changed, and Environment groups", async () => {
      vi.spyOn(api.projects, "list").mockResolvedValue({
        total: 1,
        projects: [{ id: "proj_1", name: "Test Proj", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), runCount: 2 }]
      });
      vi.spyOn(api.runs, "list").mockResolvedValue({
        total: 2,
        runs: [
          { id: "run_head", projectId: "proj_1", toolVersion: "0.1.0", operatingSystem: "linux", status: "failed", findings: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: "run_base", projectId: "proj_1", toolVersion: "0.1.0", operatingSystem: "linux", status: "completed", findings: [], createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() }
        ]
      });
      vi.spyOn(api.runs, "compare").mockResolvedValue({ comparison: mockComparison });

      renderWithProviders(
        <Routes>
          <Route path="/compare" element={<ComparePage />} />
        </Routes>,
        "/compare?base=run_base&head=run_head&project=proj_1"
      );

      await waitFor(() => {
        expect(screen.getByText("Diagnostic Report Comparison")).toBeInTheDocument();
        expect(screen.getByText(/Regressions Detected/i)).toBeInTheDocument();
      });

      // New Findings group
      expect(screen.getByText("New Critical Regression Detected")).toBeInTheDocument();
      expect(screen.getByText("NEW_RULE_REGRESSION")).toBeInTheDocument();

      // Resolved Findings group
      expect(screen.getByText("Resolved Database Timeout")).toBeInTheDocument();
      expect(screen.getByText("OLD_BUG_FIXED")).toBeInTheDocument();

      // Changed Findings group
      expect(screen.getByText("Memory leak escalated")).toBeInTheDocument();
      expect(screen.getByText(/MEDIUM → CRITICAL/i)).toBeInTheDocument();

      // Environment & Technology Changes
      expect(screen.getByText(/ubuntu-20.04 → ubuntu-22.04/i)).toBeInTheDocument();
      expect(screen.getByText(/0.0.9 → 0.1.0/i)).toBeInTheDocument();
      expect(screen.getByText(/v18.0.0 → v20.0.0/i)).toBeInTheDocument();
      expect(screen.getByText(/\+ Added Technology:/i)).toBeInTheDocument();
      expect(screen.getByText(/Redis/i)).toBeInTheDocument();
      expect(screen.getByText(/- Removed Technology:/i)).toBeInTheDocument();
      expect(screen.getByText(/MySQL/i)).toBeInTheDocument();
    });

    it("safely renders potential injection payloads as plain text", async () => {
      const maliciousComparison: ReportComparison = {
        ...mockComparison,
        hasRegressions: false,
        newFindings: [
          {
            ruleId: "<script>alert('xss')</script>",
            title: "<img src=x onerror=alert(1)>Malicious Title",
            category: "<b>injection</b>",
            severity: "high",
            confidence: "confirmed",
            status: "failed",
            evidence: [
              {
                id: "ev_xss",
                kind: "<div style='color:red'>kind</div>",
                description: "<iframe src='evil.com'></iframe>",
                observed: "<svg onload=alert(2) />",
                source: "probe",
                collectedAt: "2026-10-26T11:00:00Z"
              }
            ],
            possibleCauses: ["<p>evil hypothesis</p>"],
            recommendations: [],
            verificationStatus: "unverified",
            docs: []
          }
        ],
        resolvedFindings: [],
        changedFindings: []
      };

      vi.spyOn(api.projects, "list").mockResolvedValue({ total: 0, projects: [] });
      vi.spyOn(api.runs, "list").mockResolvedValue({ total: 0, runs: [] });
      vi.spyOn(api.runs, "compare").mockResolvedValue({ comparison: maliciousComparison });

      renderWithProviders(
        <Routes>
          <Route path="/compare" element={<ComparePage />} />
        </Routes>,
        "/compare?base=b1&head=h1"
      );

      await waitFor(() => {
        expect(screen.getByText("<img src=x onerror=alert(1)>Malicious Title")).toBeInTheDocument();
      });

      // Confirm raw strings are in text content and no executable elements were injected
      expect(screen.getByText("<script>alert('xss')</script>")).toBeInTheDocument();
      expect(screen.getByText("<svg onload=alert(2) />")).toBeInTheDocument();
      expect(document.querySelector("script[src='x']")).toBeNull();
      expect(document.querySelector("img[src='x']")).toBeNull();
    });
  });
});
