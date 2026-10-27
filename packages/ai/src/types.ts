/**
 * Core types and interfaces for StackDoctor AI module.
 */

export interface AiRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface AiResponse {
  text: string;
}

export interface AiProvider {
  id: string;
  complete(request: AiRequest): Promise<AiResponse>;
}

export interface AiDisabledResult {
  status: "ai_disabled";
  message: string;
}

export interface AiSuccessResult<T> {
  status: "success";
  data: T;
  raw: string;
}

export interface AiErrorResult {
  status: "error";
  error: string;
}

export type AiResult<T> = AiDisabledResult | AiSuccessResult<T> | AiErrorResult;

export interface AiInputEvidenceItem {
  id: string;
  kind: string;
  observed: string;
}

export interface AiInputFinding {
  ruleId: string;
  title: string;
  severity: string;
  confidence: string;
  category: string;
  evidence: AiInputEvidenceItem[];
  possibleCauses: string[];
}

export interface AiInputEnvironment {
  osFamily: string;
  runtimeVersions: string[];
}

export interface AiInput {
  findings: AiInputFinding[];
  environment: AiInputEnvironment;
  isTruncated?: boolean;
}
