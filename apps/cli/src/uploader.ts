import { redactText } from "@stackdoctor/core";
import { type Report } from "@stackdoctor/schemas";
import { validateServerUrl } from "./config-store.js";

/**
 * Formats a clear terminal preview of what will be uploaded.
 */
export function formatReportPreview(report: Report): string {
  const lines: string[] = [];
  lines.push("======================================================");
  lines.push("                StackDoctor Report Preview             ");
  lines.push("======================================================");
  lines.push(`Project Name     : ${report.projectName}`);
  lines.push(`Operating System : ${report.operatingSystem}`);
  lines.push(`Tool Version     : ${report.toolVersion}`);
  lines.push(`Status           : ${report.status}`);
  lines.push(`Total Checks     : ${report.summary.totalChecks}`);
  lines.push(`Total Findings   : ${report.summary.totalFindings}`);

  if (report.findings.length > 0) {
    lines.push("Findings to be uploaded:");
    for (const f of report.findings) {
      lines.push(`  - [${f.severity.toUpperCase()}] ${f.title} (${f.ruleId})`);
    }
  } else {
    lines.push("Findings: None (Healthy environment)");
  }
  lines.push("======================================================");
  return lines.join("\n");
}

/**
 * Deeply redacts all strings in a report object before sending over the wire.
 */
function deeplyRedactObject<T>(input: T): T {
  if (typeof input === "string") {
    return redactText(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => deeplyRedactObject(item)) as unknown as T;
  }
  if (input !== null && typeof input === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      copy[key] = deeplyRedactObject(value);
    }
    return copy as T;
  }
  return input;
}

export interface UploadOptions {
  serverUrl: string;
  token: string;
  projectId?: string;
  fetchImpl?: typeof fetch;
}

export interface UploadResult {
  runId: string;
  status: number;
}

/**
 * Uploads a diagnostic report to the StackDoctor API over HTTPS (or HTTP for localhost).
 * Enforces token redaction and descriptive error messages.
 */
export async function uploadReport(
  report: Report,
  options: UploadOptions
): Promise<UploadResult> {
  const validatedUrl = validateServerUrl(options.serverUrl);
  const normalizedServer = validatedUrl.origin;

  // Redact all strings again locally prior to network transmission
  const sanitized = deeplyRedactObject(report);

  let targetUrl = `${normalizedServer}/api/v1/diagnostic-runs`;
  if (options.projectId) {
    targetUrl += `?projectId=${encodeURIComponent(options.projectId)}`;
  }

  const fetchFn = options.fetchImpl || globalThis.fetch;
  if (!fetchFn) {
    throw new Error("No fetch implementation available in current runtime.");
  }

  let response: Response;
  try {
    response = await fetchFn(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.token}`
      },
      body: JSON.stringify(sanitized)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Sanitize any accidental token echo from network errors
    const safeMsg = redactText(message);
    throw new Error(`Network failure uploading report to ${normalizedServer}: ${safeMsg}`);
  }

  if (response.status === 201) {
    const json = (await response.json()) as { diagnosticRun: { id: string } };
    return {
      runId: json.diagnosticRun.id,
      status: 201
    };
  }

  if (response.status === 401) {
    throw new Error(
      `Authentication failed (HTTP 401): Your API token is invalid, revoked, or expired.`
    );
  }

  if (response.status === 422) {
    throw new Error(
      `Report rejected (HTTP 422): Server detected unredacted credentials or canary secrets in the report.`
    );
  }

  let errorDetails = "";
  try {
    const errJson = (await response.json()) as { error?: { message?: string } };
    if (errJson?.error?.message) {
      errorDetails = `: ${errJson.error.message}`;
    }
  } catch {
    // Ignore JSON parse failure on non-200 responses
  }

  throw new Error(`Failed to upload report (HTTP ${response.status})${errorDetails}`);
}
