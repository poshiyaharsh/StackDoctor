import type { ReportComparison } from "@stackdoctor/core";

let currentCsrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  currentCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return currentCsrfToken;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Core HTTP fetch wrapper with automatic CSRF token injection and error parsing.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  // State-changing requests must attach CSRF token
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (!currentCsrfToken) {
      // Lazy fetch CSRF token if not yet loaded
      try {
        const csrfRes = await fetch("/api/v1/auth/csrf", { credentials: "include" });
        if (csrfRes.ok) {
          const csrfData = (await csrfRes.json()) as { csrfToken: string };
          currentCsrfToken = csrfData.csrfToken;
        }
      } catch {
        // Fallback to sending request
      }
    }

    if (currentCsrfToken) {
      headers.set("X-CSRF-Token", currentCsrfToken);
    }
  }

  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: "include"
  });

  let data: unknown;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorJson = data as ApiErrorResponse | null;
    const message =
      errorJson?.error?.message || `Request failed with status ${response.status}`;
    const code = errorJson?.error?.code || "ApiError";
    throw new ApiError(message, code, response.status, errorJson?.error?.details);
  }

  // Update CSRF token if returned in response
  if (data && typeof data === "object" && "csrfToken" in data && typeof (data as { csrfToken: unknown }).csrfToken === "string") {
    currentCsrfToken = (data as { csrfToken: string }).csrfToken;
  }

  return data as T;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  retentionDays?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  ownerId: string;
  name: string;
  repositoryUrl?: string;
  detectedTechnologies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FindingItem {
  id?: string;
  ruleId: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: "confirmed" | "likely" | "possible" | "tentative";
  status: "failed" | "passed" | "warning";
  evidence: Array<{
    id: string;
    kind: string;
    description: string;
    observed: string;
    source?: string;
    collectedAt?: string;
  }>;
  possibleCauses?: Array<{
    id: string;
    description: string;
    likelihood: "very_high" | "high" | "medium" | "low";
  }>;
  recommendedChecks?: string[];
  remediation?: Array<{
    problem?: string;
    relevance?: string;
    commandOrAction: string;
    expectedResult?: string;
    risks?: string;
    verification?: string;
    operationId?: string;
  }>;
  verification?: string;
  docs?: string[];
}

export interface DiagnosticRunItem {
  id: string;
  projectId: string;
  ownerId: string;
  toolVersion: string;
  operatingSystem: string;
  startedAt: string;
  completedAt: string;
  status: "completed" | "completed_with_warnings" | "failed" | "cancelled" | "passed" | "warning";
  summary: {
    totalChecks?: number;
    passedChecks?: number;
    failedChecks?: number;
    warningChecks?: number;
    totalFindings?: number;
    executionDurationMs?: number;
  };
  findings: FindingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StatsResponse {
  totalRuns: number;
  projectsScanned: number;
  failedChecks: number;
  commonCategories: Array<{ category: string; count: number }>;
  recentReports: Array<{
    id: string;
    projectId: string;
    projectName: string;
    status: string;
    findingsCount: number;
    createdAt: string;
  }>;
  statusBreakdown: {
    passed: number;
    warning: number;
    failed: number;
    cancelled?: number;
  };
}

export interface ApiTokenItem {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
}

export const api = {
  auth: {
    async getMe(): Promise<{ user: User; csrfToken: string }> {
      const res = await apiFetch<{ user: User; csrfToken: string }>("/api/v1/auth/me");
      if (res.csrfToken) setCsrfToken(res.csrfToken);
      return res;
    },
    async login(credentials: { email: string; password: string }): Promise<{ user: User; csrfToken: string }> {
      const res = await apiFetch<{ user: User; csrfToken: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      if (res.csrfToken) setCsrfToken(res.csrfToken);
      return res;
    },
    async register(data: { email: string; password: string; displayName: string }): Promise<{ user: User; csrfToken: string }> {
      const res = await apiFetch<{ user: User; csrfToken: string }>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (res.csrfToken) setCsrfToken(res.csrfToken);
      return res;
    },
    async logout(): Promise<{ success: boolean }> {
      const res = await apiFetch<{ success: boolean }>("/api/v1/auth/logout", {
        method: "POST"
      });
      setCsrfToken(null);
      return res;
    },
    async updatePreferences(retentionDays: number): Promise<{ user: User }> {
      return apiFetch<{ user: User }>("/api/v1/auth/preferences", {
        method: "PATCH",
        body: JSON.stringify({ retentionDays })
      });
    },
    async changePassword(passwords: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
      return apiFetch<{ success: boolean; message: string }>("/api/v1/auth/password", {
        method: "PATCH",
        body: JSON.stringify(passwords)
      });
    },
    async triggerRetentionCleanup(): Promise<{ deletedRuns: number }> {
      return apiFetch<{ deletedRuns: number }>("/api/v1/auth/retention-cleanup", {
        method: "POST"
      });
    },
    async deleteAccount(password: string): Promise<{ success: boolean; message: string }> {
      return apiFetch<{ success: boolean; message: string }>("/api/v1/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password })
      });
    }
  },

  stats: {
    async get(): Promise<StatsResponse> {
      return apiFetch<StatsResponse>("/api/v1/stats");
    }
  },

  projects: {
    async list(): Promise<{ total: number; projects: ProjectItem[] }> {
      return apiFetch<{ total: number; projects: ProjectItem[] }>("/api/v1/projects");
    },
    async get(id: string): Promise<{ project: ProjectItem; recentRuns: DiagnosticRunItem[] }> {
      return apiFetch<{ project: ProjectItem; recentRuns: DiagnosticRunItem[] }>(`/api/v1/projects/${id}`);
    },
    async delete(id: string): Promise<{ success: boolean }> {
      return apiFetch<{ success: boolean }>(`/api/v1/projects/${id}`, {
        method: "DELETE"
      });
    }
  },

  runs: {
    async list(projectId?: string): Promise<{ total: number; runs: DiagnosticRunItem[] }> {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      return apiFetch<{ total: number; runs: DiagnosticRunItem[] }>(`/api/v1/diagnostic-runs${query}`);
    },
    async get(id: string): Promise<{ run: DiagnosticRunItem }> {
      const res = await apiFetch<{ run?: DiagnosticRunItem; diagnosticRun?: DiagnosticRunItem }>(`/api/v1/diagnostic-runs/${id}`);
      return { run: (res.run || res.diagnosticRun)! };
    },
    async compare(baseId: string, headId: string): Promise<{ comparison: ReportComparison }> {
      return apiFetch<{ comparison: ReportComparison }>(
        `/api/v1/diagnostic-runs/compare?base=${encodeURIComponent(baseId)}&head=${encodeURIComponent(headId)}`
      );
    },
    async delete(id: string): Promise<{ success: boolean }> {
      return apiFetch<{ success: boolean }>(`/api/v1/diagnostic-runs/${id}`, {
        method: "DELETE"
      });
    }
  },

  tokens: {
    async list(): Promise<{ tokens: ApiTokenItem[] }> {
      return apiFetch<{ tokens: ApiTokenItem[] }>("/api/v1/tokens");
    },
    async create(name: string, expiresAt?: string): Promise<{ token: string; apiToken: ApiTokenItem }> {
      return apiFetch<{ token: string; apiToken: ApiTokenItem }>("/api/v1/tokens", {
        method: "POST",
        body: JSON.stringify({ name, expiresAt })
      });
    },
    async revoke(id: string): Promise<{ success: boolean }> {
      return apiFetch<{ success: boolean }>(`/api/v1/tokens/${id}`, {
        method: "DELETE"
      });
    }
  },

  rules: {
    async list(): Promise<{ total: number; rules: Array<{ id: string; title: string; severity: string; description: string }> }> {
      return apiFetch("/api/v1/rules");
    },
    async get(id: string): Promise<{ rule: Record<string, unknown> }> {
      return apiFetch(`/api/v1/rules/${id}`);
    }
  },

  ai: {
    async getSettings(): Promise<AiSettingsResponse> {
      return apiFetch<AiSettingsResponse>("/api/v1/auth/ai-settings");
    },
    async updateSettings(body: {
      enabled?: boolean;
      apiKey?: string;
      provider?: string;
      model?: string;
    }): Promise<AiSettingsResponse> {
      return apiFetch<AiSettingsResponse>("/api/v1/auth/ai-settings", {
        method: "PUT",
        body: JSON.stringify(body)
      });
    },
    async deleteKey(): Promise<{ success: boolean; message: string; hasKey: boolean }> {
      return apiFetch<{ success: boolean; message: string; hasKey: boolean }>("/api/v1/auth/ai-settings/key", {
        method: "DELETE"
      });
    },
    async getExplanation(runId: string): Promise<ExplanationResponse> {
      return apiFetch<ExplanationResponse>(`/api/v1/diagnostic-runs/${runId}/explanation`);
    },
    async explain(runId: string): Promise<ExplanationResponse> {
      return apiFetch<ExplanationResponse>(`/api/v1/diagnostic-runs/${runId}/explanation`, {
        method: "POST"
      });
    }
  }
};

export interface AiSettingsResponse {
  enabled: boolean;
  hasKey: boolean;
  provider: string;
  model: string;
}

export interface ExplanationResponse {
  ai: boolean;
  status: "success" | "fallback";
  explanation: {
    summary?: string;
    rootCauseRanking?: Array<{
      cause: string;
      likelihood: "high" | "medium" | "low";
      reasoning: string;
      supportingEvidenceIds?: string[];
    }>;
    confirmedFacts?: Array<{
      statement: string;
      evidenceIds: string[];
    }>;
    hypotheses?: Array<{
      statement: string;
      whatWouldConfirmIt: string;
    }>;
    checklist?: string[];
    suggestedExtraChecks?: string[];
    suggestedOperationIds?: string[];
  };
  removed?: string[];
  reasons?: string[];
  unverifiedSuggestions?: string[];
  cached?: boolean;
}
