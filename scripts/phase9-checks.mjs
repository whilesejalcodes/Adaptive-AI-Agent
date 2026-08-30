import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceRoot = new URL("../", import.meta.url);
const readWorkspaceFile = (relativePath) =>
  readFile(new URL(relativePath, workspaceRoot), "utf8");

const appSource = await readWorkspaceFile("artifacts/api-server/src/app.ts");
const limiterSource = await readFile(
  new URL("../artifacts/api-server/src/middlewares/rate-limit.ts", import.meta.url),
  "utf8",
);
const conversationSource = await readFile(
  new URL("../artifacts/api-server/src/routes/conversations.ts", import.meta.url),
  "utf8",
);
const authSource = await readFile(
  new URL("../artifacts/api-server/src/middlewares/auth.ts", import.meta.url),
  "utf8",
);

assert.match(appSource, /express\.json\(\{\s*limit:\s*"64kb"/);
assert.match(appSource, /express\.urlencoded\(\{\s*extended:\s*true,\s*limit:\s*"16kb"/);
assert.match(appSource, /entity\.parse\.failed/);
assert.match(appSource, /entity\.too\.large/);
assert.match(appSource, /allowedOrigins\.has\(origin\)/);
assert.match(limiterSource, /req\.user\?\.uid/);
assert.match(conversationSource, /maxConcurrent:\s*2/);
assert.match(conversationSource, /MAX_CONVERSATION_MESSAGES\s*=\s*200/);
assert.match(conversationSource, /message\.userId\s*===\s*userId/);
assert.match(authSource, /verifyIdToken\(token,\s*true\)/);

const baseUrl = process.env.PHASE9_BASE_URL?.replace(/\/+$/, "");
if (baseUrl) {
  const unauthenticated = await fetch(`${baseUrl}/api/conversations`);
  assert.equal(unauthenticated.status, 401);

  const malformed = await fetch(`${baseUrl}/api/conversations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get("content-type")?.split(";")[0], "application/json");
  assert.deepEqual(Object.keys(await malformed.json()), ["error"]);

  const oversized = await fetch(`${baseUrl}/api/conversations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "x".repeat(70_000) }),
  });
  assert.equal(oversized.status, 413);

  const crossOrigin = await fetch(`${baseUrl}/api/healthz`, {
    headers: { origin: "https://phase9-untrusted.example" },
  });
  assert.equal(crossOrigin.headers.get("access-control-allow-origin"), null);
}

console.log(
  baseUrl
    ? "Phase 9 checks passed: source wiring and live API boundaries."
    : "Phase 9 checks passed: source wiring. Set PHASE9_BASE_URL for live API boundaries.",
);