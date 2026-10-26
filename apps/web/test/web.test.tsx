// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "../src/pages/LandingPage.js";
import { LoginPage } from "../src/pages/LoginPage.js";
import { RegisterPage } from "../src/pages/RegisterPage.js";
import { ProtectedRoute } from "../src/components/layout/ProtectedRoute.js";
import { AuthProvider } from "../src/context/AuthContext.js";
import { apiFetch, setCsrfToken, getCsrfToken } from "../src/lib/api.js";
import fs from "node:fs";
import path from "node:path";

describe("StackDoctor Web Foundation (Run 3D)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCsrfToken(null);
    localStorage.clear();
  });

  describe("1. Landing Page Rendering & Integrity", () => {
    it("renders hero, problem statement, workflow, and clearly labeled sample data", () => {
      render(
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      );

      // Hero content
      expect(screen.getByText(/Find the cause/i)).toBeInTheDocument();
      expect(screen.getByText(/Fix the environment/i)).toBeInTheDocument();
      expect(screen.getByText(/Ship the code/i)).toBeInTheDocument();

      // Core workflow steps
      expect(screen.getByText("Run Diagnostics")).toBeInTheDocument();
      expect(screen.getByText("Review Evidence")).toBeInTheDocument();
      expect(screen.getByText("Optional Team Collaboration")).toBeInTheDocument();

      // Sample data disclaimer clearly labeled
      expect(screen.getByText("Illustrative Sample Data")).toBeInTheDocument();

      // Ensure NO fabricated metrics or fake testimonials
      const bodyText = document.body.textContent || "";
      expect(bodyText).not.toMatch(/10M\+|100,000\+ developers|trusted by fortune/i);
      expect(bodyText).not.toMatch(/testimonial|what our users say/i);

      // Verify all external anchor links have rel="noopener noreferrer"
      const externalLinks = Array.from(document.querySelectorAll("a[target='_blank']"));
      expect(externalLinks.length).toBeGreaterThan(0);
      for (const link of externalLinks) {
        expect(link.getAttribute("rel")).toContain("noopener");
        expect(link.getAttribute("rel")).toContain("noreferrer");
      }
    });
  });

  describe("2. Auth Forms & Validation", () => {
    it("validates required fields on login form", async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>
      );

      const submitBtn = screen.getByRole("button", { name: /sign in/i });
      const form = submitBtn.closest("form")!;

      // Missing email
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password/i);

      fireEvent.change(passwordInput, { target: { value: "somepassword" } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Email address is required.");
      });

      // Missing password
      fireEvent.change(emailInput, { target: { value: "user@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "" } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Password is required.");
      });
    });

    it("validates password length and match on register form", async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </BrowserRouter>
      );

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password \(min 12/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);
      const submitBtn = screen.getByRole("button", { name: /create account/i });

      fireEvent.change(nameInput, { target: { value: "Grace Hopper" } });
      fireEvent.change(emailInput, { target: { value: "grace@example.com" } });

      // Short password (< 12 chars)
      fireEvent.change(passwordInput, { target: { value: "short123" } });
      fireEvent.change(confirmInput, { target: { value: "short123" } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("at least 12 characters");
      });

      // Passwords mismatch
      fireEvent.change(passwordInput, { target: { value: "LongSecurePassword123" } });
      fireEvent.change(confirmInput, { target: { value: "DifferentPassword123" } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
      });
    });
  });

  describe("3. Protected Route Security", () => {
    it("redirects unauthenticated users to /login", async () => {
      // Mock /api/v1/auth/me to return 401
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        })
      );

      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div>Secret Dashboard</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<div>Login Page Redirect Target</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Login Page Redirect Target")).toBeInTheDocument();
      });
      expect(screen.queryByText("Secret Dashboard")).not.toBeInTheDocument();
    });

    it("renders protected content when user is authenticated", async () => {
      // Mock /api/v1/auth/me to return user
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            user: { id: "123", email: "user@test.com", displayName: "Tester" },
            csrfToken: "test-token"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );

      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div>Secret Dashboard Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Secret Dashboard Content")).toBeInTheDocument();
      });
    });
  });

  describe("4. API Client & CSRF Token Injection", () => {
    it("attaches X-CSRF-Token on state-changing requests and manages token state", async () => {
      setCsrfToken("csrf-token-abc-123");

      let capturedHeader: string | null = null;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, opts) => {
        const headers = opts?.headers as Headers;
        capturedHeader = headers.get("X-CSRF-Token");
        return new Response(JSON.stringify({ success: true, csrfToken: "new-csrf-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      });

      const res = await apiFetch<{ success: boolean }>("/api/v1/auth/logout", {
        method: "POST"
      });

      expect(res.success).toBe(true);
      expect(capturedHeader).toBe("csrf-token-abc-123");
      expect(getCsrfToken()).toBe("new-csrf-token");
    });
  });

  describe("5. Codebase Security Verification", () => {
    it("ensures zero occurrences of dangerouslySetInnerHTML in apps/web/src", () => {
      const srcDir = path.resolve(__dirname, "../src");
      function checkDir(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            checkDir(fullPath);
          } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
            const content = fs.readFileSync(fullPath, "utf-8");
            expect(content).not.toContain("dangerouslySetInnerHTML");
          }
        }
      }
      checkDir(srcDir);
    });
  });
});
