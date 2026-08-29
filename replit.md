# Adaptive AI Agent

A personal AI workspace that uses persistent memory and feedback to make future conversations more relevant.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server on the workflow-provided `PORT`
- `pnpm --filter @workspace/adaptive-ai-agent run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Firebase web configuration uses the `VITE_FIREBASE_*` environment variables.
- Firebase Admin uses `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
- Server-side Gemini generation uses `GEMINI_API_KEY`; `GEMINI_MODEL` optionally overrides the supported low-cost default.
- Server-side memory indexing uses `QDRANT_URL` and `QDRANT_API_KEY`; `GEMINI_EMBEDDING_MODEL` optionally overrides the embedding model.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React, Vite, Tailwind CSS, Wouter, Firebase Authentication
- API: Express 5, Firebase Admin, official Google Gemini SDK, official Qdrant client
- Canonical application data store: Cloud Firestore
- API contracts: OpenAPI, Orval-generated TypeScript and Zod clients
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/adaptive-ai-agent/` — React/Vite web application
- `artifacts/api-server/` — shared Express API service
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/api-client-react/` — generated React Query client hooks
- `lib/api-zod/` — generated server-side Zod schemas
- `artifacts/adaptive-ai-agent/src/index.css` — application theme and design tokens

## Architecture decisions

- Firebase Authentication runs in the browser; verified Firebase ID tokens protect API routes.
- Firebase Admin credentials and Firestore writes for conversations/messages remain server-side.
- Gemini API calls and credentials remain server-side; the browser receives only the generated response or a safe application error.
- Memory extraction runs only after a successful new chat interaction; Firestore is the memory metadata source of truth and Qdrant stores vectors with Firebase UID ownership payloads.
- Chat retrieval creates one query embedding, filters Qdrant by the verified UID, validates indexed results against Firestore, and passes only bounded relevant notes to Gemini as untrusted context.
- Authenticated memory APIs support owner-scoped create, list, read, update/re-index, and delete operations; vector deletion completes before metadata deletion.
- Firestore root collections are `users`, `conversations`, and `messages`; ownership comes from the verified UID.
- API contracts are defined in OpenAPI and generated into shared client/server packages.
- The web application is rooted at `/` so the primary preview is immediately visible.

## Product

- Phase 1 established the conversation workspace and memory dashboard surfaces.
- Phase 2 adds Firebase email/password authentication plus user-owned Firestore conversations and messages.
- Phase 3 replaces the deterministic Echo with context-aware Gemini responses generated and persisted by the API server.
- Phase 4 adds conservative structured memory extraction, Google embeddings, Firestore memory metadata, and Qdrant vector storage.
- Phase 5 adds bounded Qdrant retrieval, failure isolation, duplicate-safe storage, owner-scoped memory management, and the live memory dashboard.
- Later phases will add tools and application-level feedback adaptation.

## User preferences

- Keep the implementation incremental and stop after each approved development phase.

## Gotchas

- Run API code generation after every OpenAPI contract change before importing generated hooks.
- Gemini retrieval-query embeddings must omit the document-only `title` field.
- Qdrant UID filtering requires a `keyword` payload index on `userId`; ensure collection setup creates it for both new and existing collections.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
