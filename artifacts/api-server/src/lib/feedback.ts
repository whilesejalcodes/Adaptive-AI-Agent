import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./firebase-admin";

export type FeedbackRating = "up" | "down";

export type FeedbackRecord = {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  rating: FeedbackRating;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ResponseAdaptation = {
  preferConcise: boolean;
};

type AdaptationDocument = ResponseAdaptation & {
  userId: string;
  negativeStreak: number;
  updatedAt: Timestamp;
};

const feedback = firestore.collection("feedback");
const adaptations = firestore.collection("adaptations");

function feedbackDocumentId(userId: string, messageId: string): string {
  return `${encodeURIComponent(userId)}__${encodeURIComponent(messageId)}`;
}

function feedbackFromData(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): FeedbackRecord | null {
  if (
    !data ||
    typeof data.userId !== "string" ||
    typeof data.conversationId !== "string" ||
    typeof data.messageId !== "string" ||
    (data.rating !== "up" && data.rating !== "down") ||
    !(data.createdAt instanceof Timestamp) ||
    !(data.updatedAt instanceof Timestamp)
  ) {
    return null;
  }

  return {
    id,
    userId: data.userId,
    conversationId: data.conversationId,
    messageId: data.messageId,
    rating: data.rating,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listConversationFeedback(
  userId: string,
  conversationId: string,
): Promise<FeedbackRecord[]> {
  const snapshot = await feedback.where("conversationId", "==", conversationId).get();
  return snapshot.docs
    .map((document) => feedbackFromData(document.id, document.data()))
    .filter((record): record is FeedbackRecord => record?.userId === userId);
}

export async function submitFeedback(input: {
  userId: string;
  conversationId: string;
  messageId: string;
  rating: FeedbackRating;
}): Promise<FeedbackRecord> {
  const feedbackReference = feedback.doc(feedbackDocumentId(input.userId, input.messageId));
  const adaptationReference = adaptations.doc(input.userId);

  return firestore.runTransaction(async (transaction) => {
    const existingFeedbackSnapshot = await transaction.get(feedbackReference);
    const adaptationSnapshot = await transaction.get(adaptationReference);
    const existingFeedback = feedbackFromData(
      existingFeedbackSnapshot.id,
      existingFeedbackSnapshot.data(),
    );
    const adaptationData = adaptationSnapshot.data();
    const currentStreak = typeof adaptationData?.negativeStreak === "number" &&
        Number.isInteger(adaptationData.negativeStreak)
      ? Math.max(0, Math.min(3, adaptationData.negativeStreak))
      : 0;
    const now = Timestamp.now();
    const nextStreak = input.rating === "up"
      ? 0
      : existingFeedback?.rating === "down"
        ? Math.max(1, currentStreak)
        : Math.min(3, currentStreak + 1);
    const record: FeedbackRecord = {
      id: feedbackReference.id,
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      rating: input.rating,
      createdAt: existingFeedback?.createdAt ?? now,
      updatedAt: now,
    };
    const adaptation: AdaptationDocument = {
      userId: input.userId,
      negativeStreak: nextStreak,
      preferConcise: nextStreak >= 3,
      updatedAt: now,
    };

    transaction.set(feedbackReference, record);
    transaction.set(adaptationReference, adaptation);
    return record;
  });
}

export async function getResponseAdaptation(
  userId: string,
): Promise<ResponseAdaptation | undefined> {
  const snapshot = await adaptations.doc(userId).get();
  const data = snapshot.data();
  if (
    !data ||
    typeof data.negativeStreak !== "number" ||
    !Number.isInteger(data.negativeStreak) ||
    typeof data.preferConcise !== "boolean"
  ) {
    return undefined;
  }

  return {
    preferConcise: data.preferConcise && data.negativeStreak >= 3,
  };
}