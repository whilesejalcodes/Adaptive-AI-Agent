import { getGeminiClient } from "./gemini";
import {
  memoryExtractionSchema,
  MemoryPipelineError,
  type ExtractedMemory,
} from "./memory-types";

const EXTRACTION_TIMEOUT_MS = 20_000;
const MAX_INPUT_LENGTH = 4_000;
const MEMORY_EXTRACTION_INSTRUCTION =
  "Decide conservatively whether the user's message contains durable personal information " +
  "that would help in future conversations. Store only stable preferences, interests, goals, " +
  "personal facts, recurring context, or explicit instructions for assistant behavior. " +
  "Do not store temporary questions, one-off requests, generic facts, assistant-generated " +
  "claims, or conversational filler. Rewrite accepted items as concise standalone memories.";

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shouldStore", "memories"],
  properties: {
    shouldStore: { type: "boolean" },
    memories: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "type"],
        properties: {
          text: { type: "string", minLength: 3, maxLength: 500 },
          type: {
            type: "string",
            enum: ["preference", "interest", "goal", "fact", "instruction", "context"],
          },
        },
      },
    },
  },
};

export async function extractMemories(userText: string): Promise<ExtractedMemory[]> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), EXTRACTION_TIMEOUT_MS);

  try {
    const response = await getGeminiClient().models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest",
      contents: userText.slice(0, MAX_INPUT_LENGTH),
      config: {
        abortSignal: abortController.signal,
        maxOutputTokens: 768,
        responseMimeType: "application/json",
        responseJsonSchema: extractionJsonSchema,
        systemInstruction: MEMORY_EXTRACTION_INSTRUCTION,
        temperature: 0.1,
      },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new MemoryPipelineError("invalid-extraction");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new MemoryPipelineError("invalid-extraction");
    }

    const extraction = memoryExtractionSchema.safeParse(parsed);
    if (!extraction.success) {
      throw new MemoryPipelineError("invalid-extraction");
    }
    return extraction.data.shouldStore ? extraction.data.memories : [];
  } catch (error) {
    if (error instanceof MemoryPipelineError) {
      throw error;
    }
    throw new MemoryPipelineError("extraction");
  } finally {
    clearTimeout(timeout);
  }
}