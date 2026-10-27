export interface ResilientRequestOptions {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  maxRetries?: number;
  responseSizeCapBytes?: number;
  signal?: AbortSignal;
}

/**
 * Validates protocol: only https is permitted, unless host is localhost or 127.0.0.1.
 */
export function validateEndpointUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid provider endpoint URL: ${urlString}`);
  }

  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";

  if (parsed.protocol === "http:" && !isLocalhost) {
    throw new Error(
      `Insecure HTTP connection disallowed for remote host '${parsed.hostname}'. HTTPS is required.`
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported protocol '${parsed.protocol}'. Expected HTTPS or HTTP for localhost.`);
  }

  return parsed;
}

/**
 * Resilient HTTP client for AI provider requests with HTTPS enforcement,
 * timeout aborts, response size capping, and limited 429/5xx retries.
 */
export async function resilientPost(
  options: ResilientRequestOptions
): Promise<{ text: string; status: number }> {
  const {
    url,
    headers,
    body,
    timeoutMs,
    maxRetries = 2,
    responseSizeCapBytes = 250_000,
    signal
  } = options;

  validateEndpointUrl(url);

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const abortHandler = () => {
      controller.abort();
    };

    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method || "POST",
        headers,
        body,
        signal: controller.signal
      });

      if (timeoutId) clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortHandler);

      // Check status
      if (response.status === 429 || (response.status >= 500 && response.status <= 504)) {
        if (attempt < maxRetries) {
          attempt++;
          // Exponential backoff: 300ms, 600ms...
          const delay = 300 * Math.pow(2, attempt - 1);
          await new Promise((res) => setTimeout(res, delay));
          continue;
        } else {
          throw new Error(`Provider returned error status ${response.status} (attempted ${attempt + 1} times)`);
        }
      }

      if (!response.ok) {
        throw new Error(`Provider request failed with HTTP ${response.status}`);
      }

      // Check content-length header if provided
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > responseSizeCapBytes) {
        throw new Error(
          `Response payload size (${contentLength} bytes) exceeded size cap of ${responseSizeCapBytes} bytes`
        );
      }

      const text = await response.text();
      if (Buffer.byteLength(text, "utf-8") > responseSizeCapBytes) {
        throw new Error(
          `Response payload exceeded maximum allowed size cap of ${responseSizeCapBytes} bytes`
        );
      }

      return { text, status: response.status };
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortHandler);

      const isAbort =
        (err instanceof Error && err.name === "AbortError") ||
        controller.signal.aborted;

      if (isAbort) {
        throw new Error(`AI request timed out after ${timeoutMs}ms`);
      }

      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        attempt++;
        const delay = 300 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      break;
    }
  }

  throw lastError || new Error("AI request failed");
}
