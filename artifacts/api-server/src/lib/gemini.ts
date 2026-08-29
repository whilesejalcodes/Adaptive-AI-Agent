import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-flash-lite-latest";
export const GEMINI_HISTORY_LIMIT = 30;
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_INSTRUCTION =
  "You are Adaptive, a helpful and conversational thinking partner. " +
  "Answer the user's question clearly, be practical when appropriate, and " +
  "do not claim access to information that is not present in the conversation.";

export type GeminiConversationMessage = {
  role: "user" | "model";
  text: string;
};

export type GeminiFailureKind =
  | "configuration"
  | "authentication"
  | "rate-limit"
  | "timeout"
  | "provider"
  | "empty-response";

export class GeminiGenerationError extends Error {
  readonly kind: GeminiFailureKind;

  constructor(kind: GeminiFailureKind) {
    super("Gemini generation failed.");
    this.name = "GeminiGenerationError";
    this.kind = kind;
  }
}

function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function getContents(messages: GeminiConversationMessage[]) {
  const boundedMessages = messages.slice(-GEMINI_HISTORY_LIMIT);
  const firstUserIndex = boundedMessages.findIndex((message) => message.role === "user");
  const usableMessages = firstUserIndex === -1
    ? []
    : boundedMessages.slice(firstUserIndex);

  return usableMessages.reduce<Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }>>((contents, message) => {
    const previous = contents.at(-1);
    if (previous?.role === message.role) {
      previous.parts.push({ text: message.text });
    } else {
      contents.push({
        role: message.role,
        parts: [{ text: message.text }],
      });
    }
    return contents;
  }, []);
}

function classifyProviderError(error: unknown): GeminiFailureKind {
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }

  const candidate = error as { status?: number; code?: number; message?: string };
  const status = candidate.status ?? candidate.code;
  const message = candidate.message?.toLowerCase() ?? "";

  if (status === 401 || status === 403 || message.includes("api key")) {
    return "authentication";
  }
  if (status === 429 || message.includes("rate limit") || message.includes("resource exhausted")) {
    return "rate-limit";
  }
  return "provider";
}

export async function generateGeminiReply(
  messages: GeminiConversationMessage[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiGenerationError("configuration");
  }

  const contents = getContents(messages);
  if (contents.length === 0) {
    throw new GeminiGenerationError("provider");
  }

  const ai = new GoogleGenAI({ apiKey });
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents,
      config: {
        abortSignal: abortController.signal,
        maxOutputTokens: 8192,
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new GeminiGenerationError("empty-response");
    }
    return text;
  } catch (error) {
    if (error instanceof GeminiGenerationError) {
      throw error;
    }
    throw new GeminiGenerationError(classifyProviderError(error));
  } finally {
    clearTimeout(timeout);
  }
}