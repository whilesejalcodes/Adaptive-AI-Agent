import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

export const MEMORY_TYPES = [
  "preference",
  "interest",
  "goal",
  "fact",
  "instruction",
  "context",
] as const;

export const extractedMemorySchema = z.object({
  text: z.string().trim().min(3).max(500),
  type: z.enum(MEMORY_TYPES),
});

export const memoryExtractionSchema = z.object({
  shouldStore: z.boolean(),
  memories: z.array(extractedMemorySchema).max(3),
}).superRefine((value, context) => {
  if (!value.shouldStore && value.memories.length > 0) {
    context.addIssue({
      code: "custom",
      message: "Rejected extraction must not include memories.",
      path: ["memories"],
    });
  }
  if (value.shouldStore && value.memories.length === 0) {
    context.addIssue({
      code: "custom",
      message: "Accepted extraction must include at least one memory.",
      path: ["memories"],
    });
  }
});

export type ExtractedMemory = z.infer<typeof extractedMemorySchema>;
export type MemoryType = ExtractedMemory["type"];
export type MemoryIndexStatus = "pending" | "indexed" | "failed";

export type MemoryDocument = {
  id: string;
  userId: string;
  text: string;
  type: MemoryType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sourceConversationId: string;
  sourceMessageId: string;
  vectorStatus: MemoryIndexStatus;
  embeddingModel?: string;
  embeddingDimension?: number;
  indexingError?: MemoryFailureKind;
};

export const memoryUpdateSchema = z.object({
  text: z.string().trim().min(3).max(500).optional(),
  type: z.enum(MEMORY_TYPES).optional(),
}).refine((value) => value.text !== undefined || value.type !== undefined, {
  message: "At least one memory field is required.",
});

export const memoryInputSchema = z.object({
  text: z.string().trim().min(3).max(500),
  type: z.enum(MEMORY_TYPES),
});

export type MemoryUpdate = z.infer<typeof memoryUpdateSchema>;
export type MemoryInput = z.infer<typeof memoryInputSchema>;

export type MemoryFailureKind =
  | "configuration"
  | "extraction"
  | "invalid-extraction"
  | "embedding"
  | "invalid-embedding"
  | "qdrant"
  | "incompatible-collection"
  | "firestore";

export class MemoryPipelineError extends Error {
  readonly kind: MemoryFailureKind;

  constructor(kind: MemoryFailureKind) {
    super("Memory processing failed.");
    this.name = "MemoryPipelineError";
    this.kind = kind;
  }
}