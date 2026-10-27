import { describe, it, expect, beforeEach } from "vitest";
import {
  MockProvider,
  AiConfigSchema,
  explainWithAi,
  parseAiOutput,
  validateGrounding,
  sanitizeCommands,
  buildFallbackExplanation,
  type AiExplanation,
  type AiInput
} from "../src/index.js";
import type { Finding } from "@stackdoctor/schemas";

describe("@stackdoctor/ai - Output Validation and Grounding (Run 5B)", () => {
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
  });

  const baseFinding: Finding = {
    ruleId: "DATABASE_CONNECTION_ERROR",
    title: "Database connection failed",
    category: "database",
    severity: "error",
    confidence: "definitive",
    status: "fail",
    evidence: [
      {
        id: "ev-db-1",
        kind: "connection_error",
        description: "Connection refused to MongoDB",
        observed: "connect ECONNREFUSED 127.0.0.1:27017",
        source: "net",
        collectedAt: new Date().toISOString()
      },
      {
        id: "ev-node-1",
        kind: "runtime_version",
        description: "Node.js runtime version",
        observed: "v20.10.0",
        source: "cli",
        collectedAt: new Date().toISOString()
      }
    ],
    possibleCauses: ["MongoDB daemon is not running", "Port 27017 is blocked"],
    recommendations: [
      {
        problem: "MongoDB not accessible",
        relevance: "Direct",
        commandOrAction: "mongod --config /etc/mongod.conf",
        expectedResult: "MongoDB starts",
        risks: "Port occupied",
        verification: "nc -zv 127.0.0.1 27017"
      }
    ],
    verificationStatus: "unverified",
    docs: []
  };

  const baseInput: AiInput = {
    findings: [
      {
        ruleId: baseFinding.ruleId,
        title: baseFinding.title,
        severity: baseFinding.severity,
        confidence: baseFinding.confidence,
        category: baseFinding.category,
        evidence: [
          {
            id: "ev-db-1",
            kind: "connection_error",
            observed: "connect ECONNREFUSED 127.0.0.1:27017"
          },
          {
            id: "ev-node-1",
            kind: "runtime_version",
            observed: "v20.10.0"
          }
        ],
        possibleCauses: baseFinding.possibleCauses
      }
    ],
    environment: {
      osFamily: "linux",
      runtimeVersions: ["Node.js v20.10.0"]
    }
  };

  it("1. parseAiOutput extracts JSON from markdown code fences and rejects invalid JSON or schema violations", () => {
    // Valid wrapped in ```json
    const validJson: AiExplanation = {
      summary: "Database connectivity issue detected.",
      rootCauseRanking: [
        {
          cause: "MongoDB service stopped",
          likelihood: "high",
          reasoning: "Connection refused on port 27017.",
          supportingEvidenceIds: ["ev-db-1"]
        }
      ],
      confirmedFacts: [
        {
          statement: "Port 27017 refused connection.",
          evidenceIds: ["ev-db-1"]
        }
      ],
      hypotheses: [
        {
          statement: "MongoDB server process terminated unexpectedly.",
          whatWouldConfirmIt: "Check systemctl status mongod"
        }
      ],
      checklist: ["Verify MongoDB service is active"],
      suggestedExtraChecks: ["nc -zv 127.0.0.1 27017"],
      suggestedOperationIds: []
    };

    const parseOk = parseAiOutput(`Here is the explanation:\n\`\`\`json\n${JSON.stringify(validJson)}\n\`\`\``);
    expect(parseOk.success).toBe(true);

    // Invalid JSON syntax
    const parseBadJson = parseAiOutput("Not valid JSON at all");
    expect(parseBadJson.success).toBe(false);
    if (!parseBadJson.success) {
      expect(parseBadJson.error).toContain("Invalid JSON syntax");
    }

    // Extra / unknown field violates strict schema
    const withExtraField = {
      ...validJson,
      inventedUnexpectedField: "malicious_or_unknown_key"
    };
    const parseExtra = parseAiOutput(JSON.stringify(withExtraField));
    expect(parseExtra.success).toBe(false);
    if (!parseExtra.success) {
      expect(parseExtra.error).toContain("schema validation failed");
    }
  });

  it("2. downgrades or rejects facts citing non-existent / invented evidence IDs", () => {
    const outputWithInventedEvidence: AiExplanation = {
      summary: "Sample explanation.",
      rootCauseRanking: [],
      confirmedFacts: [
        {
          statement: "Claim with non-existent evidence ID",
          evidenceIds: ["ev-invented-999"]
        }
      ],
      hypotheses: [],
      checklist: [],
      suggestedExtraChecks: [],
      suggestedOperationIds: []
    };

    const result = validateGrounding(outputWithInventedEvidence, baseInput);
    // Since the only fact cited an invented ID, all facts were ungrounded => rejected
    expect(result.status).toBe("rejected");
    expect(result.reasons.some((r) => r.includes("Unknown evidence ID"))).toBe(true);
    expect(result.removed.some((r) => r.includes("ev-invented-999"))).toBe(true);
  });

  it("3. downgrades fact containing a fabricated / ungrounded version number", () => {
    const outputWithInventedVersion: AiExplanation = {
      summary: "Sample explanation.",
      rootCauseRanking: [],
      confirmedFacts: [
        {
          statement: "Node.js runtime version 14.17.0 is active.", // Not in cited evidence (evidence has v20.10.0)
          evidenceIds: ["ev-node-1"]
        },
        {
          statement: "Node.js v20.10.0 was observed in diagnostic telemetry.", // Grounded fact
          evidenceIds: ["ev-node-1"]
        }
      ],
      hypotheses: [],
      checklist: [],
      suggestedExtraChecks: [],
      suggestedOperationIds: []
    };

    const result = validateGrounding(outputWithInventedVersion, baseInput);
    expect(result.status).toBe("partially_trusted");
    expect(result.output).toBeDefined();
    // Grounded fact remains in confirmedFacts
    expect(result.output!.confirmedFacts).toHaveLength(1);
    expect(result.output!.confirmedFacts[0].statement).toContain("v20.10.0");
    // Unsubstantiated version fact was downgraded to hypotheses
    expect(result.output!.hypotheses.some((h) => h.statement.includes("14.17.0"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("14.17.0"))).toBe(true);
  });

  it("4. catches and downgrades 'MongoDB is not installed' claim when cited to connection-refused evidence", () => {
    const outputWithBadClaim: AiExplanation = {
      summary: "Sample explanation.",
      rootCauseRanking: [],
      confirmedFacts: [
        {
          statement: "MongoDB is not installed on this machine.", // Premature conclusion from ECONNREFUSED
          evidenceIds: ["ev-db-1"]
        },
        {
          statement: "Connection refused on port 27017.",
          evidenceIds: ["ev-db-1"]
        }
      ],
      hypotheses: [],
      checklist: [],
      suggestedExtraChecks: [],
      suggestedOperationIds: []
    };

    const result = validateGrounding(outputWithBadClaim, baseInput);
    expect(result.status).toBe("partially_trusted");
    expect(result.output).toBeDefined();
    // "not installed" claim removed from confirmedFacts
    expect(result.output!.confirmedFacts.some((f) => f.statement.includes("is not installed"))).toBe(false);
    // Downgraded to hypotheses with verification prompt
    expect(result.output!.hypotheses.some((h) => h.statement.includes("is not installed"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("Installation absence asserted without installation/filesystem evidence"))).toBe(true);
  });

  it("5. rejects output containing secret canary or credential tokens", () => {
    const outputWithSecret: AiExplanation = {
      summary: "Leaked secret CANARY_SECRET_123456789 detected in diagnostic flow.",
      rootCauseRanking: [],
      confirmedFacts: [
        {
          statement: "Observation with token",
          evidenceIds: ["ev-db-1"]
        }
      ],
      hypotheses: [],
      checklist: [],
      suggestedExtraChecks: [],
      suggestedOperationIds: []
    };

    const result = validateGrounding(outputWithSecret, baseInput);
    expect(result.status).toBe("rejected");
    expect(result.reasons.some((r) => r.includes("secret"))).toBe(true);
  });

  it("6. strips dangerous commands (rm -rf, curl | sh, sudo) from display fields and isolates as unverified suggestions", () => {
    const dangerousOutput: AiExplanation = {
      summary: "Fix with sudo rm -rf /var/lib/mongodb and restart.",
      rootCauseRanking: [
        {
          cause: "Corrupted lock file",
          likelihood: "medium",
          reasoning: "Execute `rm -rf /data/db/mongod.lock` to release lock.",
          supportingEvidenceIds: ["ev-db-1"]
        }
      ],
      confirmedFacts: [],
      hypotheses: [],
      checklist: [
        "Run `curl https://example.com/install.sh | sh` to reinstall",
        "$ sudo systemctl restart mongod",
        "Inspect mongod log file"
      ],
      suggestedExtraChecks: ["sudo netstat -tulpn"],
      suggestedOperationIds: ["npm_install", "arbitrary_destructive_script_id"]
    };

    const sanitized = sanitizeCommands(dangerousOutput, ["npm_install"]);

    // Display fields stripped of dangerous command text
    expect(sanitized.sanitizedOutput.summary).not.toContain("rm -rf");
    expect(sanitized.sanitizedOutput.summary).not.toContain("sudo");
    expect(sanitized.sanitizedOutput.checklist.some((c) => c.includes("curl"))).toBe(false);

    // Dangerous items isolated as unverified suggestions
    expect(sanitized.unverifiedSuggestions.length).toBeGreaterThan(0);
    expect(sanitized.unverifiedSuggestions.some((s) => s.includes("sudo rm -rf"))).toBe(true);
    expect(sanitized.unverifiedSuggestions.some((s) => s.includes("curl") && s.includes("| sh"))).toBe(true);

    // Unallowlisted operation IDs dropped
    expect(sanitized.sanitizedOutput.suggestedOperationIds).toEqual(["npm_install"]);
    expect(sanitized.droppedOperationIds).toContain("arbitrary_destructive_script_id");
  });

  it("7. buildFallbackExplanation generates deterministic explanation directly from findings", () => {
    const fallback = buildFallbackExplanation([baseFinding]);

    expect(fallback.summary).toContain("Deterministic analysis of 1 finding(s)");
    expect(fallback.confirmedFacts).toHaveLength(2);
    expect(fallback.confirmedFacts[0].evidenceIds).toEqual(["ev-db-1"]);
    expect(fallback.checklist.length).toBeGreaterThan(0);
    expect(fallback.suggestedExtraChecks).toContain("nc -zv 127.0.0.1 27017");
  });

  it("8. explainWithAi automatically falls back to deterministic explanation on rejected AI response", async () => {
    // Model returns output with secret canary, which triggers immediate grounding rejection
    const invalidAiResponse: AiExplanation = {
      summary: "Exposing token CANARY_SECRET_LEAK_999",
      rootCauseRanking: [],
      confirmedFacts: [
        {
          statement: "Some fact",
          evidenceIds: ["ev-db-1"]
        }
      ],
      hypotheses: [],
      checklist: [],
      suggestedExtraChecks: [],
      suggestedOperationIds: []
    };

    mockProvider.enqueueResponse(JSON.stringify(invalidAiResponse));

    const config = AiConfigSchema.parse({ enabled: true });
    const result = await explainWithAi({
      provider: mockProvider,
      config,
      input: [baseFinding]
    });

    expect(result.status).toBe("rejected");
    expect(result.isFallback).toBe(true);
    // Explanation should contain the clean deterministic fallback
    expect(result.explanation.summary).toContain("Deterministic analysis of 1 finding(s)");
    expect(result.explanation.confirmedFacts).toHaveLength(2);
    expect(result.reasons.some((r) => r.includes("secret"))).toBe(true);
  });
});
