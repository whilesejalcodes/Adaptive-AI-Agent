import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./firebase-admin";
import { generateMemoryEmbedding } from "./embeddings";
import { extractMemories } from "./memory-extraction";
import {
  MemoryPipelineError,
  memoryInputSchema,
  memoryUpdateSchema,
  type MemoryInput,
  type MemoryDocument,
  type MemoryFailureKind,
  type MemoryUpdate,
  MEMORY_TYPES,
  type MemoryType,
} from "./memory-types";
import {
  deleteMemoryVector,
  ensureMemoryCollection,
  getMemoryPointId,
  upsertMemoryVector,
} from "./qdrant";

const memories = firestore.collection("memories");

function stableHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function failureKind(error: unknown): MemoryFailureKind {
  return error instanceof MemoryPipelineError ? error.kind : "qdrant";
}

function isMemoryType(value: unknown): value is MemoryType {
  return typeof value === "string" &&
    (MEMORY_TYPES as readonly string[]).includes(value);
}

function memoryFromSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot,
): MemoryDocument | null {
  const data = snapshot.data();
  if (
    !snapshot.exists ||
    !data ||
    typeof data.id !== "string" ||
    typeof data.userId !== "string" ||
    typeof data.text !== "string" ||
    !isMemoryType(data.type) ||
    !(data.createdAt instanceof Timestamp) ||
    !(data.updatedAt instanceof Timestamp) ||
    typeof data.sourceConversationId !== "string" ||
    typeof data.sourceMessageId !== "string" ||
    !["pending", "indexed", "failed"].includes(data.vectorStatus)
  ) {
    return null;
  }
  return {
    id: data.id,
    userId: data.userId,
    text: data.text,
    type: data.type,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    sourceConversationId: data.sourceConversationId,
    sourceMessageId: data.sourceMessageId,
    vectorStatus: data.vectorStatus,
    ...(typeof data.embeddingModel === "string"
      ? { embeddingModel: data.embeddingModel }
      : {}),
    ...(typeof data.embeddingDimension === "number"
      ? { embeddingDimension: data.embeddingDimension }
      : {}),
    ...(typeof data.indexingError === "string"
      ? { indexingError: data.indexingError as MemoryFailureKind }
      : {}),
  };
}

export async function listOwnedMemories(userId: string): Promise<MemoryDocument[]> {
  const snapshot = await memories.where("userId", "==", userId).get();
  return snapshot.docs
    .map(memoryFromSnapshot)
    .filter((memory): memory is MemoryDocument => memory !== null)
    .sort((left, right) => right.updatedAt.toMillis() - left.updatedAt.toMillis());
}

export async function getOwnedMemory(
  userId: string,
  memoryId: string,
): Promise<MemoryDocument | null> {
  const memory = memoryFromSnapshot(await memories.doc(memoryId).get());
  return memory?.userId === userId ? memory : null;
}

function manualMemoryId(userId: string, input: MemoryInput): string {
  return stableHash([userId, input.type, input.text]).slice(0, 40);
}

async function writeIndexedMemory(
  reference: FirebaseFirestore.DocumentReference,
  document: MemoryDocument,
): Promise<MemoryDocument> {
  try {
    const embedding = await generateMemoryEmbedding(document.text, document.type);
    await ensureMemoryCollection(embedding.dimension);
    await upsertMemoryVector({
      pointId: getMemoryPointId(document.id),
      vector: embedding.vector,
      payload: {
        memoryId: document.id,
        userId: document.userId,
        type: document.type,
        text: document.text,
        sourceConversationId: document.sourceConversationId,
        sourceMessageId: document.sourceMessageId,
        createdAt: document.createdAt.toDate().toISOString(),
      },
    });
    const updatedAt = Timestamp.now();
    await reference.update({
      vectorStatus: "indexed",
      embeddingModel: embedding.model,
      embeddingDimension: embedding.dimension,
      indexingError: null,
      updatedAt,
    });
    return { ...document, vectorStatus: "indexed", embeddingModel: embedding.model, embeddingDimension: embedding.dimension, updatedAt };
  } catch (error) {
    try {
      await reference.update({
        vectorStatus: "failed",
        indexingError: failureKind(error),
        updatedAt: Timestamp.now(),
      });
    } catch {
      throw new MemoryPipelineError("firestore");
    }
    throw error instanceof MemoryPipelineError ? error : new MemoryPipelineError("qdrant");
  }
}

async function writePendingMemory(
  reference: FirebaseFirestore.DocumentReference,
  document: MemoryDocument,
): Promise<void> {
  try {
    await reference.set(document, { merge: true });
  } catch {
    throw new MemoryPipelineError("firestore");
  }
}

export async function createOwnedMemory(
  userId: string,
  input: MemoryInput,
): Promise<MemoryDocument> {
  const parsed = memoryInputSchema.parse(input);
  const now = Timestamp.now();
  const id = manualMemoryId(userId, parsed);
  const reference = memories.doc(id);
  const existing = memoryFromSnapshot(await reference.get());
  if (existing?.vectorStatus === "indexed") return existing;
  const document: MemoryDocument = {
    id,
    userId,
    text: parsed.text,
    type: parsed.type,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sourceConversationId: existing?.sourceConversationId ?? "manual",
    sourceMessageId: existing?.sourceMessageId ?? "manual",
    vectorStatus: "pending",
  };
  await writePendingMemory(reference, document);
  return writeIndexedMemory(reference, document);
}

export async function updateOwnedMemory(
  userId: string,
  memoryId: string,
  input: MemoryUpdate,
): Promise<MemoryDocument | null> {
  const current = await getOwnedMemory(userId, memoryId);
  if (!current) return null;
  const parsed = memoryUpdateSchema.parse(input);
  const document: MemoryDocument = {
    ...current,
    ...(parsed.text !== undefined ? { text: parsed.text } : {}),
    ...(parsed.type !== undefined ? { type: parsed.type } : {}),
    updatedAt: Timestamp.now(),
    vectorStatus: "pending",
  };
  if (document.text === current.text && document.type === current.type && current.vectorStatus === "indexed") {
    return current;
  }
  await writePendingMemory(referenceFor(memoryId), document);
  return writeIndexedMemory(referenceFor(memoryId), document);
}

function referenceFor(memoryId: string): FirebaseFirestore.DocumentReference {
  return memories.doc(memoryId);
}

export async function deleteOwnedMemory(
  userId: string,
  memoryId: string,
): Promise<boolean> {
  const current = await getOwnedMemory(userId, memoryId);
  if (!current) return false;
  await deleteMemoryVector(current.id);
  try {
    await referenceFor(memoryId).delete();
  } catch {
    throw new MemoryPipelineError("firestore");
  }
  return true;
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
        pointId: getMemoryPointId(memoryId),
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