# Adaptive AI Agent interview notes

These answers describe the current implementation and its deliberate
tradeoffs.

## Why Firebase?

Firebase provides browser-friendly email/password authentication and a
well-supported ID-token model. The browser can authenticate without receiving
server credentials, while Firebase Admin gives the API a trusted way to verify
identity and revocation status.

## Why Firestore?

Firestore is the canonical store for user-owned conversations, messages,
memories, feedback, and adaptation state. Its document model fits these
bounded records, and the server can keep all writes behind Firebase Admin.

## Why Qdrant?

Qdrant is specialized for vector similarity search. It handles the searchable
memory index while Firestore remains the source of truth for ownership and
visible metadata. The Qdrant payload includes a Firebase UID filter so search
is user-scoped before results are validated again in Firestore.

## Why embeddings?

Keyword matching is too narrow for memories expressed with different wording.
Embeddings let a recall-shaped question find semantically related saved
information. The current system uses Gemini embeddings and caps both result
count and context length.

## Why Gemini?

Gemini supplies both conversational generation and structured capabilities
needed by this project: JSON-constrained memory extraction, embeddings, and
native function calling. Calls stay on the server so the API key and provider
details never enter the browser.

## Why server-side AI calls?

Server-side calls protect the Gemini credential, centralize timeouts and error
classification, and ensure the API can enforce ownership before model-visible
context is assembled. It also keeps tool execution under application control.

## What makes this an agent?

The server runs a bounded orchestration loop around Gemini function calling.
Gemini can select from a typed registry, the server validates and executes the
approved memory tools, and tool results are returned to Gemini for the next
turn. The loop has a maximum of three iterations and three tool calls.

## How does memory work?

After successful chat, a conservative Gemini extraction step can identify
durable preferences, interests, goals, facts, context, or explicit assistant
instructions. Accepted memories are written to Firestore and indexed in
Qdrant. Users can also explicitly create or update memories through the
dashboard or memory tool.

## How is memory different from conversation history?

Conversation history is the bounded chronological record of messages in a
conversation. Long-term memory is a separate, user-visible collection of
durable information selected for reuse across conversations. Feedback is
separate from both and is used only for application-level response
adaptation.

## How is ownership enforced?

The API verifies the Firebase ID token and derives the owner from its UID.
Request bodies, URL IDs, memory text, and model tool arguments cannot choose
the owner. Resource reads and writes check that stored ownership matches the
verified UID before continuing.

## How is prompt injection handled?

User text passed to memory extraction is explicitly delimited as untrusted
data. Retrieved notes and tool outputs are labeled as contextual data rather
than instructions. Gemini receives bounded context, and system instructions
state that memory content cannot override system policy. Tool arguments are
schema-validated, and memory changes require explicit user wording.

## How does rate limiting work?

The server keeps a small UID-keyed in-memory bucket. Assistant generation,
memory writes, and feedback writes have separate request and concurrency
budgets. Exceeding either budget returns `429` with `Retry-After`. This is
simple and cost-conscious, but it is process-local rather than a
multi-instance distributed limiter.

## What happens when Gemini fails?

The API maps timeout, authentication, rate-limit, provider, configuration, and
empty-response failures to stable application errors. The failed request does
not persist an orphaned user message. Logs contain safe categories rather than
raw provider error objects.

## What happens when Qdrant fails?

A direct memory write leaves metadata marked as failed and returns a controlled
service error. A post-chat indexing failure is isolated after the successful
conversation response. If Qdrant writes a vector but the Firestore status
update fails, the API attempts to delete that vector to avoid an inconsistent
orphan.

An artificial live provider-outage test is **Not verified yet**; the
verification run intentionally did not alter external service configuration.

## How does feedback adaptation work?

Each authenticated user has a separate adaptation document. Feedback is keyed
by user and assistant message, and a transaction updates both the rating and
negative streak. Three consecutive negative ratings enable a concise-response
preference; positive feedback resets the streak. This is application context,
not model retraining.

## What tradeoffs were made?

- Firestore is kept as the canonical store; Qdrant is only the search index.
- Memory recall is explicit/heuristic rather than running on every chat, which
  controls embedding cost.
- The agent has a small tool and iteration budget for predictable behavior.
- Conversation writes happen after generation so failed AI calls do not leave
  partial user-visible history.
- The rate limiter is dependency-free and process-local; it is appropriate for
  the current small architecture but would need a shared service at larger
  scale.
- Missing Firestore indexes have bounded application fallbacks so development
  does not fail solely because an index has not yet been deployed.