import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { MemoryPipelineError, type MemoryType } from "./memory-types";

const COLLECTION_NAME = "user_memories";
const QDRANT_TIMEOUT_MS = 8_000;

let qdrantClient: QdrantClient | undefined;

function stableHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function getQdrantConfig(): { url: string; apiKey: string } {
  const url = process.env.QDRANT_URL?.trim();
  const apiKey = process.env.QDRANT_API_KEY?.trim();
  if (!url || !apiKey) {
    throw new MemoryPipelineError("configuration");
  }
  return { url, apiKey };
}

function getQdrantClient(): QdrantClient {
  const { url, apiKey } = getQdrantConfig();
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

async function ensureUserIdPayloadIndex(client: QdrantClient): Promise<void> {
  try {
    await client.createPayloadIndex(COLLECTION_NAME, {
      wait: true,
      field_name: "userId",
      field_schema: "keyword",
    });
  } catch (error) {
    if (getHttpStatus(error) !== 409) {
      throw new MemoryPipelineError("qdrant");
    }
  }
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
    await ensureUserIdPayloadIndex(client);
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
    await ensureUserIdPayloadIndex(client);
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

export function getMemoryPointId(memoryId: string): string {
  const hash = stableHash(["qdrant", memoryId]);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

export async function deleteMemoryVector(memoryId: string): Promise<void> {
  try {
    await getQdrantClient().delete(COLLECTION_NAME, {
      wait: true,
      points: [getMemoryPointId(memoryId)],
    });
  } catch {
    throw new MemoryPipelineError("qdrant");
  }
}

export type RetrievedMemoryPoint = {
  memoryId: string;
  userId: string;
  text: string;
  type: MemoryType;
  score: number;
};

export async function queryMemoryVectors(input: {
  vector: number[];
  userId: string;
  limit: number;
  scoreThreshold: number;
}): Promise<RetrievedMemoryPoint[]> {
  const { url, apiKey } = getQdrantConfig();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), QDRANT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${url.replace(/\/+$/, "")}/collections/${COLLECTION_NAME}/points/search`,
      {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          vector: input.vector,
          filter: {
            must: [{
              key: "userId",
              match: { value: input.userId },
            }],
          },
          limit: input.limit,
          score_threshold: input.scoreThreshold,
          with_payload: true,
          with_vector: false,
        }),
        signal: abortController.signal,
      },
    );
    if (!response.ok) {
      throw new MemoryPipelineError("qdrant");
    }
    const body = await response.json() as {
      result?: Array<{
        score?: unknown;
        payload?: Record<string, unknown> | null;
      }>;
    };
    if (!Array.isArray(body.result)) {
      throw new MemoryPipelineError("qdrant");
    }

    return body.result.flatMap((point) => {
      const payload = point.payload;
      if (
        typeof payload?.memoryId !== "string" ||
        typeof payload.userId !== "string" ||
        typeof payload.text !== "string" ||
        typeof payload.type !== "string" ||
        typeof point.score !== "number"
      ) {
        return [];
      }
      return [{
        memoryId: payload.memoryId,
        userId: payload.userId,
        text: payload.text,
        type: payload.type as MemoryType,
        score: point.score,
      }];
    });
  } catch {
    throw new MemoryPipelineError("qdrant");
  } finally {
    clearTimeout(timeout);
  }
}