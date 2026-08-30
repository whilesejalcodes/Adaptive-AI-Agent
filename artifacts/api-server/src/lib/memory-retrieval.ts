import { firestore } from "./firebase-admin";
import { generateMemoryEmbedding } from "./embeddings";
import {
  MemoryPipelineError,
  MEMORY_TYPES,
  type MemoryType,
} from "./memory-types";
import { queryMemoryVectors, type RetrievedMemoryPoint } from "./qdrant";

const DEFAULT_TOP_K = 3;
const MAX_TOP_K = 5;
const DEFAULT_SCORE_THRESHOLD = 0.65;
const MAX_CONTEXT_LENGTH = 1_800;

export type RetrievedMemory = {
  id: string;
  text: string;
  type: MemoryType;
  score: number;
};

function boundedNumber(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function retrievalSettings() {
  return {
    topK: Math.round(boundedNumber(
      process.env.MEMORY_RETRIEVAL_TOP_K,
      DEFAULT_TOP_K,
      1,
      MAX_TOP_K,
    )),
    scoreThreshold: boundedNumber(
      process.env.MEMORY_RETRIEVAL_THRESHOLD,
      DEFAULT_SCORE_THRESHOLD,
      0,
      1,
    ),
  };
}

function isMemoryType(value: unknown): value is MemoryType {
  return typeof value === "string" &&
    (MEMORY_TYPES as readonly string[]).includes(value);
}

function validCandidate(
  candidate: RetrievedMemoryPoint,
  snapshot: FirebaseFirestore.DocumentSnapshot,
  userId: string,
): RetrievedMemory | null {
  const data = snapshot.data();
  if (
    !snapshot.exists ||
    !data ||
    data.userId !== userId ||
    data.id !== candidate.memoryId ||
    data.vectorStatus !== "indexed" ||
    data.text !== candidate.text ||
    data.type !== candidate.type ||
    !isMemoryType(data.type)
  ) {
    return null;
  }
  return {
    id: data.id,
    text: data.text,
    type: data.type,
    score: candidate.score,
  };
}

export async function retrieveRelevantMemories(
  userId: string,
  userText: string,
): Promise<RetrievedMemory[]> {
  const settings = retrievalSettings();
  const queryEmbedding = await generateMemoryEmbedding(
    userText,
    "conversation query",
    "RETRIEVAL_QUERY",
  );
  const candidates = await queryMemoryVectors({
    vector: queryEmbedding.vector,
    userId,
    limit: settings.topK,
    scoreThreshold: settings.scoreThreshold,
  });
  if (candidates.length === 0) return [];

  const snapshots = await firestore.getAll(
    ...candidates.map((candidate) =>
      firestore.collection("memories").doc(candidate.memoryId)
    ),
  );
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return candidates.flatMap((candidate) => {
    const snapshot = snapshotsById.get(candidate.memoryId);
    if (!snapshot) return [];
    const memory = validCandidate(candidate, snapshot, userId);
    return memory ? [memory] : [];
  });
}

export function formatMemoryContext(memories: RetrievedMemory[]): string | undefined {
  if (memories.length === 0) return undefined;
  const lines: string[] = [];
  let length = 0;
  for (const memory of memories) {
    const line = `- ${memory.text}`;
    if (length + line.length + 1 > MAX_CONTEXT_LENGTH) break;
    lines.push(line);
    length += line.length + 1;
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function isMemoryRetrievalError(
  error: unknown,
): error is MemoryPipelineError {
  return error instanceof MemoryPipelineError;
}