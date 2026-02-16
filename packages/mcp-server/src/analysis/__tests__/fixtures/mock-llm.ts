// Mock LlmProvider for testing.
// Routes responses based on system prompt content.

import type { LlmProvider, LlmMessage, LlmOptions } from "../../types.js";
import { IDENTITY_RESPONSE, ACTIVATION_RESPONSE, lensResponse, CLUSTER_RESPONSE, MERGE_RESPONSE, ICP_RESPONSE, ACTIVATION_MAP_RESPONSE, MEASUREMENT_SPEC_RESPONSE, VALIDATION_REVIEW_RESPONSE } from "./responses.js";

/** Canned responses keyed by a substring in the system prompt or user message */
const FIXTURE_RESPONSES: Array<{ match: string; response: string }> = [
  { match: "Capability Mapping lens", response: lensResponse("capability_mapping", "enabling_features") },
  { match: "Effort Elimination lens", response: lensResponse("effort_elimination", "effort_eliminated") },
  { match: "Time Compression lens", response: lensResponse("time_compression", "time_compression") },
  { match: "Artifact Creation lens", response: lensResponse("artifact_creation", "artifact_type") },
  { match: "Information Asymmetry lens", response: lensResponse("info_asymmetry", "information_gained") },
  { match: "Decision Enablement lens", response: lensResponse("decision_enablement", "decision_enabled") },
  { match: "State Transitions lens", response: lensResponse("state_transitions", "state_transition") },
  { match: "Extract the core identity", response: IDENTITY_RESPONSE },
  { match: "activation progression", response: ACTIVATION_RESPONSE },
  { match: "grouping value moment candidates", response: CLUSTER_RESPONSE },
  { match: "merging value moment candidates", response: MERGE_RESPONSE },
  { match: "Ideal Customer Profiles", response: ICP_RESPONSE },
  { match: "activation map", response: ACTIVATION_MAP_RESPONSE },
  { match: "measurement specification", response: MEASUREMENT_SPEC_RESPONSE },
  { match: "Review flagged", response: VALIDATION_REVIEW_RESPONSE },
];

export interface MockLlm extends LlmProvider {
  callCount: number;
  calls: Array<{ messages: LlmMessage[]; options?: LlmOptions }>;
}

export function createMockLlm(): MockLlm {
  const calls: Array<{ messages: LlmMessage[]; options?: LlmOptions }> = [];

  const provider: MockLlm = {
    callCount: 0,
    calls,
    async complete(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
      provider.callCount++;
      calls.push({ messages, options });

      const systemPrompt = messages.find((m) => m.role === "system")?.content ?? "";
      const userPrompt = messages.find((m) => m.role === "user")?.content ?? "";
      const allContent = systemPrompt + " " + userPrompt;

      for (const fixture of FIXTURE_RESPONSES) {
        if (allContent.includes(fixture.match)) return fixture.response;
      }

      return "[]"; // fallback
    },
  };

  return provider;
}

/**
 * Create a mock LLM that throws on specific prompts.
 */
export function createFailingMockLlm(failOn: string): MockLlm {
  const base = createMockLlm();
  const originalComplete = base.complete.bind(base);

  base.complete = async (messages: LlmMessage[], options?: LlmOptions): Promise<string> => {
    const systemPrompt = messages.find((m) => m.role === "system")?.content ?? "";
    if (systemPrompt.includes(failOn)) {
      throw new Error(`Mock LLM failure: ${failOn}`);
    }
    return originalComplete(messages, options);
  };

  return base;
}
