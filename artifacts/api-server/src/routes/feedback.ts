import { Router, type IRouter } from "express";
import {
  ListConversationFeedbackParams,
  ListConversationFeedbackResponse,
  SubmitMessageFeedbackBody,
  SubmitMessageFeedbackParams,
  SubmitMessageFeedbackResponse,
} from "@workspace/api-zod";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase-admin";
import {
  listConversationFeedback,
  submitFeedback,
} from "../lib/feedback";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const conversations = firestore.collection("conversations");
const messages = firestore.collection("messages");

function serializeFeedback(record: {
  id: string;
  conversationId: string;
  messageId: string;
  rating: "up" | "down";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}) {
  return {
    id: record.id,
    conversationId: record.conversationId,
    messageId: record.messageId,
    rating: record.rating,
    createdAt: record.createdAt.toDate().toISOString(),
    updatedAt: record.updatedAt.toDate().toISOString(),
  };
}

router.use(requireAuth);

router.get("/conversations/:conversationId/feedback", async (req, res) => {
  const userId = req.user?.uid;
  const parsedParams = ListConversationFeedbackParams.safeParse(req.params);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (!parsedParams.success) {
    res.status(400).json({ error: "Conversation ID is required." });
    return;
  }

  try {
    const conversation = await conversations.doc(parsedParams.data.conversationId).get();
    if (!conversation.exists || conversation.data()?.userId !== userId) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const data = (await listConversationFeedback(userId, parsedParams.data.conversationId))
      .map(serializeFeedback);
    res.json(ListConversationFeedbackResponse.parse(data));
  } catch (error) {
    req.log.error({ error }, "Failed to list conversation feedback");
    res.status(500).json({ error: "Unable to load feedback." });
  }
});

router.post(
  "/conversations/:conversationId/messages/:messageId/feedback",
  async (req, res) => {
    const userId = req.user?.uid;
    const parsedParams = SubmitMessageFeedbackParams.safeParse(req.params);
    const parsedBody = SubmitMessageFeedbackBody.safeParse(req.body);
    if (!userId) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "A valid feedback rating is required." });
      return;
    }

    try {
      const conversation = await conversations.doc(parsedParams.data.conversationId).get();
      if (!conversation.exists || conversation.data()?.userId !== userId) {
        res.status(404).json({ error: "Conversation not found." });
        return;
      }

      const message = await messages.doc(parsedParams.data.messageId).get();
      const messageData = message.data();
      if (
        !message.exists ||
        messageData?.conversationId !== parsedParams.data.conversationId ||
        messageData?.userId !== userId ||
        messageData?.role !== "model"
      ) {
        res.status(404).json({ error: "Assistant message not found." });
        return;
      }

      const record = await submitFeedback({
        userId,
        conversationId: parsedParams.data.conversationId,
        messageId: parsedParams.data.messageId,
        rating: parsedBody.data.rating,
      });
      res.status(201).json(SubmitMessageFeedbackResponse.parse(serializeFeedback(record)));
    } catch (error) {
      req.log.error({ error }, "Failed to save message feedback");
      res.status(500).json({ error: "Unable to save feedback." });
    }
  },
);

export default router;