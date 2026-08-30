import { Router, type IRouter } from "express";
import {
  CreateConversationBody,
  CreateConversationResponse,
  ListConversationMessagesParams,
  ListConversationMessagesResponse,
  ListConversationsResponse,
  SendConversationMessageBody,
  SendConversationMessageParams,
  SendConversationMessageResponse,
  UpdateConversationBody,
  UpdateConversationParams,
  UpdateConversationResponse,
} from "@workspace/api-zod";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase-admin";
import {
  GEMINI_HISTORY_LIMIT,
  GeminiGenerationError,
  type GeminiConversationMessage,
} from "../lib/gemini";
import { AgentOrchestrationError, runAdaptiveAgent } from "../lib/agent";
import { createMemoriesForInteraction } from "../lib/memory-storage";
import {
  buildMemoryRecallQuery,
  formatMemoryContext,
  isMemoryRecallRequest,
  MEMORY_RECALL_SCORE_THRESHOLD,
  retrieveRelevantMemories,
  isMemoryRetrievalError,
  type RetrievedMemory,
} from "../lib/memory-retrieval";
import { MemoryPipelineError } from "../lib/memory-types";
import { getResponseAdaptation } from "../lib/feedback";
import { requireAuth } from "../middlewares/auth";
import { createUserRateLimiter } from "../middlewares/rate-limit";

const router: IRouter = Router();
const conversations = firestore.collection("conversations");
const messages = firestore.collection("messages");
const MAX_CONVERSATIONS = 200;
const MAX_CONVERSATION_MESSAGES = 200;
const messageRateLimiter = createUserRateLimiter({
  windowMs: 60_000,
  maxRequests: 12,
  maxConcurrent: 2,
  message: "Too many assistant requests. Please wait a moment and try again.",
});

type ConversationDocument = {
  id: string;
  userId: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type MessageDocument = {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "model";
  text: string;
  timestamp: Timestamp;
};

function isoTimestamp(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  throw new Error("Firestore document is missing a valid timestamp.");
}

function conversationFromSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot,
): ConversationDocument {
  const data = snapshot.data();
  if (
    !data ||
    typeof data.userId !== "string" ||
    typeof data.title !== "string" ||
    !(data.createdAt instanceof Timestamp) ||
    !(data.updatedAt instanceof Timestamp)
  ) {
    throw new Error("Conversation document is invalid.");
  }

  return {
    id: snapshot.id,
    userId: data.userId,
    title: data.title,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function messageFromSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot,
): MessageDocument {
  const data = snapshot.data();
  if (
    !data ||
    typeof data.conversationId !== "string" ||
    typeof data.userId !== "string" ||
    (data.role !== "user" && data.role !== "model") ||
    typeof data.text !== "string" ||
    !(data.timestamp instanceof Timestamp)
  ) {
    throw new Error("Message document is invalid.");
  }

  return {
    id: snapshot.id,
    conversationId: data.conversationId,
    userId: data.userId,
    role: data.role,
    text: data.text,
    timestamp: data.timestamp,
  };
}

function serializeConversation(document: ConversationDocument) {
  return {
    id: document.id,
    userId: document.userId,
    title: document.title,
    createdAt: isoTimestamp(document.createdAt),
    updatedAt: isoTimestamp(document.updatedAt),
  };
}

function serializeMessage(document: MessageDocument) {
  return {
    id: document.id,
    conversationId: document.conversationId,
    userId: document.userId,
    role: document.role,
    text: document.text,
    timestamp: isoTimestamp(document.timestamp),
  };
}

function safeErrorKind(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function isMissingIndexError(error: unknown): boolean {
  return error instanceof Error && /requires an index|create composite index/i.test(error.message);
}

let orderedMessageQueryAvailable: boolean | undefined;
let orderedConversationQueryAvailable: boolean | undefined;

async function getOwnedConversationMessages(
  conversationId: string,
  userId: string,
  limit: number,
): Promise<MessageDocument[]> {
  if (orderedMessageQueryAvailable !== false) {
    try {
      const snapshot = await messages
        .where("conversationId", "==", conversationId)
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();
      orderedMessageQueryAvailable = true;
      return snapshot.docs
        .map((document) => {
          try {
            return messageFromSnapshot(document);
          } catch {
            return null;
          }
        })
        .filter((message): message is MessageDocument =>
          message !== null && message.userId === userId)
        .sort((left, right) => left.timestamp.toMillis() - right.timestamp.toMillis());
    } catch (error) {
      if (!isMissingIndexError(error)) throw error;
      orderedMessageQueryAvailable = false;
    }
  }

  const snapshot = await messages
    .where("conversationId", "==", conversationId)
    .get();
  return snapshot.docs
    .map((document) => {
      try {
        return messageFromSnapshot(document);
      } catch {
        return null;
      }
    })
    .filter((message): message is MessageDocument =>
      message !== null && message.userId === userId)
    .sort((left, right) => left.timestamp.toMillis() - right.timestamp.toMillis())
    .slice(-limit);
}

async function getOwnedConversations(userId: string): Promise<ConversationDocument[]> {
  if (orderedConversationQueryAvailable !== false) {
    try {
      const snapshot = await conversations
        .where("userId", "==", userId)
        .orderBy("updatedAt", "desc")
        .limit(MAX_CONVERSATIONS)
        .get();
      orderedConversationQueryAvailable = true;
      return snapshot.docs
        .map((document) => conversationFromSnapshot(document))
        .sort((left, right) => right.updatedAt.toMillis() - left.updatedAt.toMillis());
    } catch (error) {
      if (!isMissingIndexError(error)) throw error;
      orderedConversationQueryAvailable = false;
    }
  }

  const snapshot = await conversations.where("userId", "==", userId).get();
  return snapshot.docs
    .map((document) => conversationFromSnapshot(document))
    .sort((left, right) => right.updatedAt.toMillis() - left.updatedAt.toMillis())
    .slice(0, MAX_CONVERSATIONS);
}

async function findOwnedConversation(
  conversationId: string,
  userId: string,
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  const snapshot = await conversations.doc(conversationId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data();
  return data?.userId === userId ? snapshot : null;
}

router.use(requireAuth);

router.get("/conversations", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const data = (await getOwnedConversations(userId))
      .map(serializeConversation);
    res.json(ListConversationsResponse.parse(data));
  } catch (error) {
    req.log.error({ kind: safeErrorKind(error) }, "Failed to list conversations");
    res.status(500).json({ error: "Unable to load conversations." });
  }
});

router.post("/conversations", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Conversation title is required." });
    return;
  }

  try {
    const now = Timestamp.now();
    const reference = conversations.doc();
    const title = parsed.data.title.trim();
    if (!title) {
      res.status(400).json({ error: "Conversation title is required." });
      return;
    }

    const document: ConversationDocument = {
      id: reference.id,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    };

    await reference.set(document);
    res.status(201).json(
      CreateConversationResponse.parse(serializeConversation(document)),
    );
  } catch {
    req.log.error({ kind: "unknown" }, "Failed to create conversation");
    res.status(500).json({ error: "Unable to create conversation." });
  }
});

router.patch("/conversations/:conversationId", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const parsedParams = UpdateConversationParams.safeParse({
    conversationId: req.params.conversationId,
  });
  const parsedBody = UpdateConversationBody.safeParse(req.body);
  const title = parsedBody.success ? parsedBody.data.title.trim() : "";
  if (!parsedParams.success || !parsedBody.success || !title) {
    res.status(400).json({ error: "Conversation title is required." });
    return;
  }

  try {
    const conversation = await findOwnedConversation(
      parsedParams.data.conversationId,
      userId,
    );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const updatedAt = Timestamp.now();
    await conversation.ref.update({ title, updatedAt });
    res.json(
      UpdateConversationResponse.parse(
        serializeConversation({
          ...conversationFromSnapshot(conversation),
          title,
          updatedAt,
        }),
      ),
    );
  } catch (error) {
    req.log.error({ kind: safeErrorKind(error) }, "Failed to update conversation");
    res.status(500).json({ error: "Unable to update conversation." });
  }
});

router.get("/conversations/:conversationId/messages", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const parsedParams = ListConversationMessagesParams.safeParse({
    conversationId: req.params.conversationId,
  });
  if (!parsedParams.success) {
    res.status(400).json({ error: "Conversation ID is required." });
    return;
  }

  try {
    const conversation = await findOwnedConversation(
      parsedParams.data.conversationId,
      userId,
    );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const data = (await getOwnedConversationMessages(
      parsedParams.data.conversationId,
      userId,
      MAX_CONVERSATION_MESSAGES,
    )).map(serializeMessage);
    res.json(ListConversationMessagesResponse.parse(data));
  } catch (error) {
    req.log.error({ kind: safeErrorKind(error) }, "Failed to list conversation messages");
    res.status(500).json({ error: "Unable to load messages." });
  }
});

router.post("/conversations/:conversationId/messages", messageRateLimiter, async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const parsedParams = SendConversationMessageParams.safeParse({
    conversationId: req.params.conversationId,
  });
  const parsedBody = SendConversationMessageBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Message text is required." });
    return;
  }

  const text = parsedBody.data.text.trim();
  if (!text) {
    res.status(400).json({ error: "Message text is required." });
    return;
  }

  try {
    const conversation = await findOwnedConversation(
      parsedParams.data.conversationId,
      userId,
    );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const now = Timestamp.now();
    const userMessageReference = messages.doc();
    const assistantMessageReference = messages.doc();
    const userMessage: MessageDocument = {
      id: userMessageReference.id,
      conversationId: parsedParams.data.conversationId,
      userId,
      role: "user",
      text,
      timestamp: now,
    };

    const historyDocuments = await getOwnedConversationMessages(
      parsedParams.data.conversationId,
      userId,
      GEMINI_HISTORY_LIMIT,
    );
    historyDocuments.push(userMessage);
    const history: GeminiConversationMessage[] = historyDocuments
      .sort((left, right) => left.timestamp.toMillis() - right.timestamp.toMillis())
      .slice(-GEMINI_HISTORY_LIMIT)
      .map(({ role, text }) => ({ role, text }));
    const memoryRecallRequest = isMemoryRecallRequest(text);
    const initialMemoryQuery = memoryRecallRequest
      ? buildMemoryRecallQuery(text)
      : undefined;
    let memoryContext: string | undefined;
    let initialMemories: RetrievedMemory[] | undefined;
    let initialMemoryRetrievalFailed = false;
    if (memoryRecallRequest) {
      try {
        initialMemories = await retrieveRelevantMemories(userId, initialMemoryQuery!, {
          scoreThreshold: MEMORY_RECALL_SCORE_THRESHOLD,
        });
        memoryContext = formatMemoryContext(initialMemories);
      } catch (error) {
        initialMemoryRetrievalFailed = true;
        req.log.warn(
          { kind: isMemoryRetrievalError(error) ? error.kind : "unknown" },
          "Memory retrieval failed; continuing without memory context",
        );
      }
    }
    let adaptation: { preferConcise: boolean } | undefined;
    try {
      adaptation = await getResponseAdaptation(userId);
    } catch (error) {
      req.log.warn(
        { kind: safeErrorKind(error) },
        "Response adaptation unavailable; continuing with default style",
      );
    }
    const agentResult = await runAdaptiveAgent({
      userId,
      userText: text,
      history,
      memoryContext,
      initialMemories,
      initialMemoryQuery,
      initialMemoryRetrievalFailed,
      memoryRecallRequest,
      adaptation,
    });
    const assistantText = agentResult.text;
    const assistantMessage: MessageDocument = {
      id: assistantMessageReference.id,
      conversationId: parsedParams.data.conversationId,
      userId,
      role: "model",
      text: assistantText,
      timestamp: Timestamp.now(),
    };

    const batch = firestore.batch();
    batch.set(userMessageReference, userMessage);
    batch.set(assistantMessageReference, assistantMessage);
    batch.update(conversation.ref, { updatedAt: assistantMessage.timestamp });
    await batch.commit();

    if (!agentResult.memoryManaged) {
      try {
        const memoryResult = await createMemoriesForInteraction({
          userId,
          conversationId: parsedParams.data.conversationId,
          userMessageId: userMessage.id,
          userText: userMessage.text,
        });
        if (memoryResult.failed > 0) {
          req.log.warn(
            {
              extracted: memoryResult.extracted,
              indexed: memoryResult.indexed,
              failed: memoryResult.failed,
            },
            "Some extracted memories could not be indexed",
          );
        }
      } catch (error) {
        req.log.warn(
          { kind: error instanceof MemoryPipelineError ? error.kind : "unknown" },
          "Memory processing failed after successful chat response",
        );
      }
    }

    const data = {
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage),
    };
    res.status(201).json(SendConversationMessageResponse.parse(data));
  } catch (error) {
    if (error instanceof AgentOrchestrationError) {
      req.log.warn({ kind: error.kind }, "Agent orchestration stopped safely");
      res.status(503).json({
        error: error.kind === "tool-limit"
          ? "The assistant could not complete that request within its tool-use limit. Please try again."
          : "The assistant could not complete that tool request. Please try again.",
      });
      return;
    }
    if (error instanceof GeminiGenerationError) {
      req.log.warn({ kind: error.kind }, "Gemini generation failed");
      const status = error.kind === "timeout"
        ? 504
        : error.kind === "configuration" || error.kind === "rate-limit"
          ? 503
          : 502;
      const message = error.kind === "configuration"
        ? "The AI service is not configured."
        : error.kind === "authentication"
          ? "The AI service could not authenticate."
          : error.kind === "rate-limit" || error.kind === "timeout"
            ? "The AI service is temporarily unavailable. Please try again."
            : error.kind === "empty-response"
              ? "The AI service returned an empty response. Please try again."
              : "The AI service could not generate a response. Please try again.";
      res.status(status).json({ error: message });
      return;
    }

    req.log.error({ kind: safeErrorKind(error) }, "Failed to store conversation messages");
    res.status(500).json({ error: "Unable to save the message." });
  }
});

export default router;