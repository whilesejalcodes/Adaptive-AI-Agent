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
} from "@workspace/api-zod";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase-admin";
import {
  generateGeminiReply,
  GEMINI_HISTORY_LIMIT,
  GeminiGenerationError,
  type GeminiConversationMessage,
} from "../lib/gemini";
import { createMemoriesForInteraction } from "../lib/memory-storage";
import {
  formatMemoryContext,
  retrieveRelevantMemories,
  isMemoryRetrievalError,
} from "../lib/memory-retrieval";
import { MemoryPipelineError } from "../lib/memory-types";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const conversations = firestore.collection("conversations");
const messages = firestore.collection("messages");

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
    const snapshot = await conversations.where("userId", "==", userId).get();
    const data = snapshot.docs
      .map((document) => conversationFromSnapshot(document))
      .sort((left, right) => right.updatedAt.toMillis() - left.updatedAt.toMillis())
      .map(serializeConversation);
    res.json(ListConversationsResponse.parse(data));
  } catch (error) {
    req.log.error({ error }, "Failed to list conversations");
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
    const document: ConversationDocument = {
      id: reference.id,
      userId,
      title: parsed.data.title.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await reference.set(document);
    res.status(201).json(
      CreateConversationResponse.parse(serializeConversation(document)),
    );
  } catch {
    req.log.error("Failed to create conversation");
    res.status(500).json({ error: "Unable to create conversation." });
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

    const snapshot = await messages
      .where("conversationId", "==", parsedParams.data.conversationId)
      .get();
    const data = snapshot.docs
      .map((document) => messageFromSnapshot(document))
      .sort((left, right) => left.timestamp.toMillis() - right.timestamp.toMillis())
      .map(serializeMessage);
    res.json(ListConversationMessagesResponse.parse(data));
  } catch {
    req.log.error("Failed to list conversation messages");
    res.status(500).json({ error: "Unable to load messages." });
  }
});

router.post("/conversations/:conversationId/messages", async (req, res) => {
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

    await userMessageReference.set(userMessage);

    const historySnapshot = await messages
      .where("conversationId", "==", parsedParams.data.conversationId)
      .limit(GEMINI_HISTORY_LIMIT)
      .get();
    const historyDocuments = historySnapshot.docs
      .map((document) => messageFromSnapshot(document))
      .filter((message) => message.id !== userMessage.id);
    historyDocuments.push(userMessage);
    const history: GeminiConversationMessage[] = historyDocuments
      .sort((left, right) => left.timestamp.toMillis() - right.timestamp.toMillis())
      .slice(-GEMINI_HISTORY_LIMIT)
      .map(({ role, text }) => ({ role, text }));
    let memoryContext: string | undefined;
    try {
      memoryContext = formatMemoryContext(
        await retrieveRelevantMemories(userId, text),
      );
    } catch (error) {
      req.log.warn(
        { kind: isMemoryRetrievalError(error) ? error.kind : "unknown" },
        "Memory retrieval failed; continuing without memory context",
      );
    }
    const assistantText = await generateGeminiReply(history, memoryContext);
    const assistantMessage: MessageDocument = {
      id: assistantMessageReference.id,
      conversationId: parsedParams.data.conversationId,
      userId,
      role: "model",
      text: assistantText,
      timestamp: Timestamp.now(),
    };

    const batch = firestore.batch();
    batch.set(assistantMessageReference, assistantMessage);
    batch.update(conversation.ref, { updatedAt: assistantMessage.timestamp });
    await batch.commit();

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

    const data = {
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage),
    };
    res.status(201).json(SendConversationMessageResponse.parse(data));
  } catch (error) {
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

    req.log.error("Failed to store conversation messages");
    res.status(500).json({ error: "Unable to save the message." });
  }
});

export default router;