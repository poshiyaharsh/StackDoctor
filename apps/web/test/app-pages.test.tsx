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
import { SettingsPage } from "../src/pages/SettingsPage.js";
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

    it("renders disabled AI Explanations tab and data retention settings", async () => {
      vi.spyOn(api.tokens, "list").mockResolvedValue({ tokens: [] });

      renderWithProviders(<SettingsPage />);

      // Switch to AI tab
      const aiTab = screen.getByRole("tab", { name: /AI Explanations/i });
      fireEvent.click(aiTab);

      expect(screen.getByText(/Strict Offline & Privacy Guarantee/i)).toBeInTheDocument();
      expect(screen.getByText(/Coming Later/i)).toBeInTheDocument();

      // Switch to Data Retention tab
      const retentionTab = screen.getByRole("tab", { name: /Data Retention/i });
      fireEvent.click(retentionTab);

      expect(screen.getByText("Report Retention Policy")).toBeInTheDocument();
      expect(screen.getByText("Run Retention Cleanup Now")).toBeInTheDocument();
    });
  });
});
