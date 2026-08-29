import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateMemoryBody,
  CreateMemoryResponse,
  DeleteMemoryParams,
  GetMemoryParams,
  GetMemoryResponse,
  ListMemoriesResponse,
  UpdateMemoryBody,
  UpdateMemoryParams,
  UpdateMemoryResponse,
} from "@workspace/api-zod";
import {
  createOwnedMemory,
  deleteOwnedMemory,
  getOwnedMemory,
  listOwnedMemories,
  updateOwnedMemory,
} from "../lib/memory-storage";
import { MemoryPipelineError, type MemoryDocument } from "../lib/memory-types";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeMemory(memory: MemoryDocument) {
  return {
    id: memory.id,
    text: memory.text,
    type: memory.type,
    createdAt: memory.createdAt.toDate().toISOString(),
    updatedAt: memory.updatedAt.toDate().toISOString(),
    sourceConversationId: memory.sourceConversationId,
    sourceMessageId: memory.sourceMessageId,
    vectorStatus: memory.vectorStatus,
  };
}

function sendMemoryServiceError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  req.log.error(
    { kind: error instanceof MemoryPipelineError ? error.kind : "unknown" },
    "Memory operation failed",
  );
  res.status(error instanceof MemoryPipelineError ? 503 : 500).json({
    error: error instanceof MemoryPipelineError
      ? "Memory storage is temporarily unavailable. Please try again."
      : "The memory operation could not be completed.",
  });
}

router.use(requireAuth);

router.get("/memories", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  try {
    const response = (await listOwnedMemories(userId)).map(serializeMemory);
    res.json(ListMemoriesResponse.parse(response));
  } catch (error) {
    sendMemoryServiceError(req, res, error);
  }
});

router.post("/memories", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Memory text and type are required." });
    return;
  }
  try {
    const memory = await createOwnedMemory(userId, parsed.data);
    res.status(201).json(CreateMemoryResponse.parse(serializeMemory(memory)));
  } catch (error) {
    sendMemoryServiceError(req, res, error);
  }
});

router.get("/memories/:memoryId", async (req, res) => {
  const userId = req.user?.uid;
  const params = GetMemoryParams.safeParse(req.params);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (!params.success) {
    res.status(404).json({ error: "Memory not found." });
    return;
  }
  try {
    const memory = await getOwnedMemory(userId, params.data.memoryId);
    if (!memory) {
      res.status(404).json({ error: "Memory not found." });
      return;
    }
    res.json(GetMemoryResponse.parse(serializeMemory(memory)));
  } catch (error) {
    sendMemoryServiceError(req, res, error);
  }
});

router.patch("/memories/:memoryId", async (req, res) => {
  const userId = req.user?.uid;
  const params = UpdateMemoryParams.safeParse(req.params);
  const body = UpdateMemoryBody.safeParse(req.body);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (!params.success) {
    res.status(404).json({ error: "Memory not found." });
    return;
  }
  if (!body.success || (body.data.text === undefined && body.data.type === undefined)) {
    res.status(400).json({ error: "Provide memory text or type to update." });
    return;
  }
  try {
    const memory = await updateOwnedMemory(userId, params.data.memoryId, body.data);
    if (!memory) {
      res.status(404).json({ error: "Memory not found." });
      return;
    }
    res.json(UpdateMemoryResponse.parse(serializeMemory(memory)));
  } catch (error) {
    sendMemoryServiceError(req, res, error);
  }
});

router.delete("/memories/:memoryId", async (req, res) => {
  const userId = req.user?.uid;
  const params = DeleteMemoryParams.safeParse(req.params);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (!params.success) {
    res.status(404).json({ error: "Memory not found." });
    return;
  }
  try {
    const deleted = await deleteOwnedMemory(userId, params.data.memoryId);
    if (!deleted) {
      res.status(404).json({ error: "Memory not found." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    sendMemoryServiceError(req, res, error);
  }
});

export default router;