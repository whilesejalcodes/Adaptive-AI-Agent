import { getGeminiClient } from "./gemini";
import { MemoryPipelineError } from "./memory-types";

const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_TIMEOUT_MS = 20_000;

let expectedEmbedding: { model: string; dimension: number } | undefined;

export type GeneratedEmbedding = {
  model: string;
  vector: number[];
  dimension: number;
};

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function generateMemoryEmbedding(
  text: string,
  title: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<GeneratedEmbedding> {
  const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await getGeminiClient().models.embedContent({
      model,
      contents: text,
      config: {
        abortSignal: abortController.signal,
        taskType,
        ...(taskType === "RETRIEVAL_DOCUMENT" ? { title } : {}),
      },
    });
    const vector = response.embeddings?.[0]?.values;
    if (
      !Array.isArray(vector) ||
      vector.length === 0 ||
      vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new MemoryPipelineError("invalid-embedding");
    }

    if (
      expectedEmbedding?.model === model &&
      expectedEmbedding.dimension !== vector.length
    ) {
      throw new MemoryPipelineError("invalid-embedding");
    }
    expectedEmbedding = { model, dimension: vector.length };

    return { model, vector, dimension: vector.length };
  } catch (error) {
    if (error instanceof MemoryPipelineError) {
      throw error;
    }
    throw new MemoryPipelineError("embedding");
  } finally {
    clearTimeout(timeout);
  }
}