import type { AiProvider, AiRequest, AiResponse } from "./types.js";

/**
 * Deterministic MockProvider for testing AI workflows without network requests.
 * Records all requests and allows scripting returned responses.
 */
export class MockProvider implements AiProvider {
  public readonly id = "mock";
  private defaultResponse: string;
  private queuedResponses: string[] = [];
  private receivedRequests: AiRequest[] = [];

  constructor(defaultResponse = '{"summary": "Mock explanation"}') {
    this.defaultResponse = defaultResponse;
  }

  public setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  public enqueueResponse(response: string): void {
    this.queuedResponses.push(response);
  }

  public getReceivedRequests(): readonly AiRequest[] {
    return [...this.receivedRequests];
  }

  public getLastRequest(): AiRequest | undefined {
    return this.receivedRequests[this.receivedRequests.length - 1];
  }

  public clear(): void {
    this.receivedRequests = [];
    this.queuedResponses = [];
  }

  public async complete(request: AiRequest): Promise<AiResponse> {
    if (request.signal?.aborted) {
      throw new Error("Request aborted");
    }

    this.receivedRequests.push({ ...request });

    const text = this.queuedResponses.shift() ?? this.defaultResponse;
    return { text };
  }
}
