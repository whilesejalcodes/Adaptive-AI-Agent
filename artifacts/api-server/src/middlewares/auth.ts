import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../lib/firebase-admin";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    req.user = await firebaseAuth.verifyIdToken(match[1]);
    next();
  } catch {
    req.log.warn("Rejected invalid Firebase ID token");
    res.status(401).json({ error: "Authentication required." });
  }
}