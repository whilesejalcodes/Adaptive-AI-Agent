# Adaptive AI Agent architecture

This document describes the implementation in the repository. 

## 1. Frontend architecture

The web artifact is a React/Vite single-page application rooted at `/`.
Wouter owns the routes:

- `/` — public introduction
- `/login` and `/signup` — Firebase email/password authentication
- `/chat` — protected conversation workspace
- `/memories` — protected memory dashboard

`AuthProvider` owns the Firebase browser session and creates a user document
when a new account is registered. `ProtectedRoute` prevents workspace access
without a current user. TanStack Query consumes the generated OpenAPI client,
while the custom fetch layer attaches the current Firebase ID token to
authenticated API calls. The interface has a desktop side rail, a responsive
mobile top bar/drawer, and a mobile bottom navigation.

## 2. API architecture

The API is an Express 5 service mounted under `/api`. The route modules are:

- `health` — `/healthz`
- `conversations` — conversation listing, title updates, history, and chat
- `memories` — owner-scoped memory CRUD and re-indexing
- `feedback` — owner-scoped response ratings and feedback listing

The OpenAPI document in `lib/api-spec/openapi.yaml` is the contract source of
truth. Orval generates the client hooks and Zod schemas used by the frontend
and server.

## 3. Authentication flow

1. The browser signs up or signs in through Firebase Authentication.
2. The browser persists the session when local persistence is available.
3. The API client obtains the current Firebase ID token before each request.
4. `requireAuth` verifies the bearer token with Firebase Admin and checks
   revocation status.
5. Routes use the verified token UID as the only ownership identity.

Firebase Admin credentials never enter the frontend bundle. The browser-safe
Firebase web settings are supplied only through `VITE_FIREBASE_*` build
variables.

## 4. Conversation persistence

A chat request first verifies that the conversation belongs to the caller,
loads bounded history, and adds the new user message only to the in-memory
generation context. The server runs the agent and generates the response
before writing messages. After successful generation, one Firestore batch writes:

- the user message
- the assistant message
- the conversation `updatedAt` value

This prevents a failed generation from leaving an orphaned persisted user
message. Conversation and message reads are owner-filtered and bounded. When
an ordered Firestore query is unavailable because its composite index is not
deployed, the API falls back to application sorting and a bounded response.

## 5. Gemini generation

Gemini calls are made only by the API. The normal response path uses the
configured `GEMINI_MODEL` or the low-cost default. Calls have an abort timeout,
bounded history, bounded output, and stable error categories. The client
receives an application-level error rather than a provider error object.

## 6. Memory creation pipeline

Memory creation has two entry points:

1. After a successful chat, Gemini extraction conservatively decides whether
   the user message contains durable personal information.
2. The memory dashboard or the `memory_manage` tool explicitly creates or
   updates a memory.

Accepted memory text is validated against the allowed memory types. The
Firestore document is first written as `pending`. The API then requests a
Gemini embedding, ensures the Qdrant collection and `userId` payload index,
and upserts the vector. On success, Firestore changes to `indexed` with model
and dimension metadata. On failure, the document remains visible as `failed`
with a safe failure category, and any vector written before a Firestore update
failure is removed.

Post-response extraction is isolated from the chat response: an extraction or
indexing failure is logged safely and does not invalidate an already persisted
conversation response.

## 7. Memory retrieval pipeline

Ordinary chat does not automatically incur a memory search. A recall-shaped
request triggers one topic-focused query embedding. The Qdrant search:

- filters by the verified Firebase UID
- limits the number of returned points
- requests payload without vectors

Each candidate is validated against the corresponding Firestore document,
including UID, text, type, indexed status, and memory ID. Only bounded,
relevant notes are passed to Gemini as contextual data. Retrieval failures are
isolated so a normal chat can continue without memory context.

## 8. Agent and tool calling

The server-side orchestrator gives Gemini a centralized typed tool registry:

- `memory_search` — search the authenticated user’s memories
- `memory_manage` — create or update a memory after an explicit user request

The orchestrator allows at most three iterations and three total tool calls.
Tool calls are validated with Zod, and same-turn calls execute sequentially so
memory operations do not race. The model never receives a user ID to manage
ownership. Tool outputs are returned as data, not instructions.

For a memory-recall request, the first search is performed before generation
and reused by the forced first-turn search tool call. This avoids duplicate
retrieval work while preserving the tool-calling flow.

## 9. Feedback and adaptation

Feedback is intentionally separate from long-term memory. A rating is keyed
by authenticated user and assistant message. The feedback transaction updates
the rating and a user-level adaptation document containing:

- `negativeStreak`
- `preferConcise`
- `updatedAt`

Three consecutive negative ratings enable the concise-response adaptation.
Positive feedback resets the streak. Adaptation is server-owned context and
is never treated as user memory.

## 10. Security boundaries

- Firebase Admin verifies the caller and revocation status.
- Server routes derive ownership from the verified UID.
- Conversation, message, memory, and feedback resources are checked before
  access or mutation.
- Request bodies, IDs, titles, memory types, ratings, and tool arguments are
  schema-validated and size-bounded.
- CORS is same-origin by default, with an explicit allowlist option.
- Authorization headers are redacted from structured logs.
- Raw provider and server errors are converted to safe categories.
- User text, extracted memory candidates, retrieved memories, and tool results
  are treated as untrusted model-visible data and explicitly delimited.

## 11. Error and failure isolation

Gemini generation has bounded timeouts and provider classification. A failed
generation is returned as a stable API error before conversation persistence.
Memory retrieval can fail without preventing a response. Post-response memory
extraction and indexing can fail without undoing the successful conversation.
Qdrant/Firestore consistency is handled by marking failed metadata and cleaning
up vectors when the metadata status update cannot complete.

An artificial external-provider outage was **Not verified yet** because the
verification run did not alter live service configuration.

## 12. Rate limiting

Authenticated write-heavy endpoints use a UID-keyed in-memory limiter:

- assistant generation: 12 requests per minute, two concurrent requests
- memory writes: 30 requests per minute, four concurrent requests
- feedback writes: 60 requests per minute, six concurrent requests

The limiter returns `429` with `Retry-After` when either threshold is reached.
It is deliberately dependency-free and process-local. That keeps the current
architecture small, but a future multi-instance deployment would require a
shared limiter.

## 13. Firestore and Qdrant data flow

Firestore is the canonical application data store. It stores user-visible
metadata, ownership, timestamps, source references, and memory index status.
Qdrant stores only the searchable vector and a payload containing the memory
identity, verified UID, type, text, source references, and creation time.

The API writes Firestore metadata and Qdrant vectors as a controlled pipeline.
Search begins in Qdrant for similarity, then Firestore validates the candidate
before any note reaches Gemini. This keeps vector search fast while preserving
Firestore as the source of truth and owner boundary.
