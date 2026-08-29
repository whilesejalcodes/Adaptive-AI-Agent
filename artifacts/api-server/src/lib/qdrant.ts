import { QdrantClient } from "@qdrant/js-client-rest";
import { MemoryPipelineError, type MemoryType } from "./memory-types";

const COLLECTION_NAME = "user_memories";
const QDRANT_TIMEOUT_MS = 8_000;

let qdrantClient: QdrantClient | undefined;

function getQdrantClient(): QdrantClient {
  const url = process.env.QDRANT_URL?.trim();
  const apiKey = process.env.QDRANT_API_KEY?.trim();
  if (!url || !apiKey) {
    throw new MemoryPipelineError("configuration");
  }
  qdrantClient ??= new QdrantClient({
    url,
    apiKey,
    checkCompatibility: true,
    timeout: QDRANT_TIMEOUT_MS,
  });
  return qdrantClient;
}

function collectionVectorConfig(info: Awaited<ReturnType<QdrantClient["getCollection"]>>) {
  return info.config.params.vectors;
}

function getHttpStatus(error: unknown): number | undefined {
  const directStatus = (error as { status?: unknown })?.status;
  if (typeof directStatus === "number") {
    return directStatus;
  }
  if (error instanceof Error) {
    const match = /^Unexpected Response:\s+(\d{3})\b/.exec(error.message);
    return match ? Number(match[1]) : undefined;
  }
  return undefined;
}

export async function ensureMemoryCollection(dimension: number): Promise<void> {
  const client = getQdrantClient();

  try {
    const info = await client.getCollection(COLLECTION_NAME);
    const vectors = collectionVectorConfig(info);
    if (
      !vectors ||
      !("size" in vectors) ||
      vectors.size !== dimension ||
      vectors.distance !== "Cosine"
    ) {
      throw new MemoryPipelineError("incompatible-collection");
    }
    return;
  } catch (error) {
    if (error instanceof MemoryPipelineError) {
      throw error;
    }

    if (getHttpStatus(error) !== 404) {
      throw new MemoryPipelineError("qdrant");
    }
  }

  try {
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: dimension,
        distance: "Cosine",
      },
    });
  } catch (error) {
    if (getHttpStatus(error) === 409) {
      await ensureMemoryCollection(dimension);
      return;
    }
    throw new MemoryPipelineError("qdrant");
  }
}

export type MemoryVectorPayload = {
  memoryId: string;
  userId: string;
  type: MemoryType;
  text: string;
  sourceConversationId: string;
  sourceMessageId: string;
  createdAt: string;
};

export async function upsertMemoryVector(input: {
  pointId: string;
  vector: number[];
  payload: MemoryVectorPayload;
}): Promise<void> {
  try {
    await getQdrantClient().upsert(COLLECTION_NAME, {
      wait: true,
      points: [{
        id: input.pointId,
        vector: input.vector,
        payload: input.payload,
      }],
    });
  } catch {
    throw new MemoryPipelineError("qdrant");
  }
}