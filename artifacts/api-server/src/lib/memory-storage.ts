import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./firebase-admin";
import { generateMemoryEmbedding } from "./embeddings";
import { extractMemories } from "./memory-extraction";
import {
  MemoryPipelineError,
  type MemoryDocument,
  type MemoryFailureKind,
} from "./memory-types";
import { ensureMemoryCollection, upsertMemoryVector } from "./qdrant";

const memories = firestore.collection("memories");

function stableHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function qdrantUuid(memoryId: string): string {
  const hash = stableHash(["qdrant", memoryId]);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

function failureKind(error: unknown): MemoryFailureKind {
  return error instanceof MemoryPipelineError ? error.kind : "qdrant";
}

export type MemoryProcessingResult = {
  extracted: number;
  indexed: number;
  failed: number;
};

export async function createMemoriesForInteraction(input: {
  userId: string;
  conversationId: string;
  userMessageId: string;
  userText: string;
}): Promise<MemoryProcessingResult> {
  const extracted = await extractMemories(input.userText);
  const result: MemoryProcessingResult = {
    extracted: extracted.length,
    indexed: 0,
    failed: 0,
  };

  for (const memory of extracted) {
    const memoryId = stableHash([
      input.userId,
      memory.type,
      memory.text,
    ]).slice(0, 40);
    const reference = memories.doc(memoryId);
    const existing = await reference.get();
    if (existing.data()?.vectorStatus === "indexed") {
      result.indexed += 1;
      continue;
    }

    const now = Timestamp.now();
    const document: MemoryDocument = {
      id: memoryId,
      userId: input.userId,
      text: memory.text,
      type: memory.type,
      createdAt: existing.data()?.createdAt instanceof Timestamp
        ? existing.data()?.createdAt
        : now,
      updatedAt: now,
      sourceConversationId: input.conversationId,
      sourceMessageId: input.userMessageId,
      vectorStatus: "pending",
    };

    try {
      await reference.set(document, { merge: true });
    } catch {
      throw new MemoryPipelineError("firestore");
    }

    try {
      const embedding = await generateMemoryEmbedding(memory.text, memory.type);
      await ensureMemoryCollection(embedding.dimension);
      await upsertMemoryVector({
        pointId: qdrantUuid(memoryId),
        vector: embedding.vector,
        payload: {
          memoryId,
          userId: input.userId,
          type: memory.type,
          text: memory.text,
          sourceConversationId: input.conversationId,
          sourceMessageId: input.userMessageId,
          createdAt: document.createdAt.toDate().toISOString(),
        },
      });
      await reference.update({
        vectorStatus: "indexed",
        embeddingModel: embedding.model,
        embeddingDimension: embedding.dimension,
        indexingError: null,
        updatedAt: Timestamp.now(),
      });
      result.indexed += 1;
    } catch (error) {
      result.failed += 1;
      try {
        await reference.update({
          vectorStatus: "failed",
          indexingError: failureKind(error),
          updatedAt: Timestamp.now(),
        });
      } catch {
        throw new MemoryPipelineError("firestore");
      }
    }
  }

  return result;
}