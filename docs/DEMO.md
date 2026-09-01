# Adaptive AI Agent demo

This is a 3–5 minute walkthrough of the strongest existing product and
engineering decisions. Use a disposable demo account and remove its memories
afterward.

## 1. Sign up and sign in

Create an account from `/signup`, then sign out and sign back in from `/login`.
Point out that the browser owns only the Firebase session; the API verifies the
ID token before accessing the workspace.

## 2. Start a conversation

Suggested prompt:

> I am preparing for an SDE interview and want a concise study plan for
> distributed systems.

Show that the response comes from Gemini and that the conversation appears in
the workspace history.

## 3. Create an explicit memory

Suggested prompt:

> Remember that I prefer concise explanations with one concrete example.

The agent can use the approved memory tool for an explicit request. Open the
Memory dashboard and show that the saved item is visible and editable. If
preferred for a more deterministic demo, create the same kind of memory from
the dashboard.

## 4. Demonstrate semantic memory retrieval

Suggested prompt:

> Do you remember how I prefer technical explanations to be structured?

The recall-shaped request performs a bounded, UID-filtered semantic search
through Qdrant, validates the result against Firestore, and supplies the
relevant note to Gemini.

## 5. Show an agent capability

Suggested prompt:

> What saved preferences should you use when answering my next question?

Explain that `memory_search` is a server-side Gemini tool with validated
arguments, a small call budget, and ownership derived from the authenticated
Firebase UID. It is not a generic code-execution tool.

## 6. Edit and inspect memory

Edit the saved preference in the Memory dashboard. Show the index status and
the delete action. Explain that Firestore owns the visible record and Qdrant
holds its searchable vector.

## 7. Give feedback and show adaptation

Send a few assistant-message ratings from the response controls. Explain that
feedback is stored separately from memory. The server tracks a bounded
negative streak and can enable concise-response adaptation after repeated
negative ratings; positive feedback resets that streak.

## 8. Show persistence

Refresh the page or sign out and back in. Reopen the conversation and show its
messages. This demonstrates Firebase authentication plus Firestore
conversation persistence rather than browser-only state.

## 9. Briefly explain security

Use these points instead of attempting to expose internal credentials:

- Every protected request carries a Firebase ID token.
- Firebase Admin verifies the token and revocation status.
- The server derives ownership from the verified UID.
- A different user receives `404` for another user’s conversation, message,
  memory, or feedback resource.
- Request validation, CORS restrictions, safe errors, rate limits, and
  untrusted-context boundaries are enforced server-side.

## Demo close

End with the design tradeoff: Adaptive learns through explicit, application-
level memory and feedback records, not model retraining. This makes the
behavior inspectable, reversible, and suitable for a small production system.
