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
  createdAt: string;
  updatedAt: string;
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
    }
  },
  rules: {
    async list(): Promise<{ total: number; rules: Array<{ id: string; title: string; severity: string; description: string }> }> {
      return apiFetch("/api/v1/rules");
    }
  }
};
