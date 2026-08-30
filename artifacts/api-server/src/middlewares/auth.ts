import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../lib/firebase-admin";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  const token = match?.[1].trim();
  if (!token || token.length > 8_192) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    req.user = await firebaseAuth.verifyIdToken(token, true);
    next();
  } catch {
    req.log.warn("Rejected invalid Firebase ID token");
    res.status(401).json({ error: "Authentication required." });
  }
}