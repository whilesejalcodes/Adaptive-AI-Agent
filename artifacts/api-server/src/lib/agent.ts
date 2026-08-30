import {
  generateGeminiToolTurn,
  getGeminiContents,
  type GeminiConversationMessage,
} from "./gemini";
import { getAgentToolDeclarations, executeAgentToolCall, type AgentToolContext } from "./agent-tools";
import type { RetrievedMemory } from "./memory-retrieval";

const MAX_TOOL_ITERATIONS = 3;
const MAX_TOOL_CALLS = 3;

export class AgentOrchestrationError extends Error {
  readonly kind: "tool-limit" | "invalid-tool-call";

  constructor(kind: "tool-limit" | "invalid-tool-call" = "tool-limit") {
    super(kind === "tool-limit"
      ? "The assistant reached its tool-use limit."
      : "The assistant returned an invalid tool call.");
    this.name = "AgentOrchestrationError";
    this.kind = kind;
  }
}

export type AdaptiveAgentInput = {
  userId: string;
  userText: string;
  history: GeminiConversationMessage[];
  memoryContext?: string;
  initialMemories?: RetrievedMemory[];
  initialMemoryQuery?: string;
  initialMemoryRetrievalFailed?: boolean;
  memoryRecallRequest?: boolean;
};

export type AdaptiveAgentResult = {
  text: string;
  memoryManaged: boolean;
};

export async function runAdaptiveAgent(input: AdaptiveAgentInput): Promise<AdaptiveAgentResult> {
  let contents = getGeminiContents(input.history);
  let toolCallsUsed = 0;
  let memoryManaged = false;
  const toolContext: AgentToolContext = {
    userId: input.userId,
    userText: input.userText,
    initialMemories: input.initialMemories,
    initialMemoryQuery: input.initialMemoryQuery,
    initialMemoryRetrievalFailed: input.initialMemoryRetrievalFailed,
    memoryRecallRequest: input.memoryRecallRequest,
  };

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const turn = await generateGeminiToolTurn(
      contents,
      input.memoryContext,
      getAgentToolDeclarations(),
      input.memoryRecallRequest && iteration === 0,
    );
    if (turn.functionCalls.length === 0) {
      if (!turn.text) {
        throw new Error("The assistant returned an empty response.");
      }
      return { text: turn.text, memoryManaged };
    }

    if (toolCallsUsed + turn.functionCalls.length > MAX_TOOL_CALLS) {
      throw new AgentOrchestrationError();
    }
    toolCallsUsed += turn.functionCalls.length;
    const functionResponses = await Promise.all(
      turn.functionCalls.map(async (functionCall) => {
        if (!functionCall.name) {
          throw new AgentOrchestrationError("invalid-tool-call");
        }
        const response = await executeAgentToolCall(
          functionCall.name,
          functionCall.args,
          toolContext,
        );
        if (functionCall.name === "memory_manage" && "output" in response) {
          memoryManaged = true;
        }
        return {
          functionResponse: {
            id: functionCall.id,
            name: functionCall.name,
            response,
          },
        };
      }),
    );
    contents = [
      ...contents,
      turn.modelContent,
      {
        role: "user",
        parts: functionResponses,
      },
    ];
  }

  throw new AgentOrchestrationError();
}