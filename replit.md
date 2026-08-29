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

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React, Vite, Tailwind CSS, Wouter, Firebase Authentication
- API: Express 5, Firebase Admin
- Canonical Phase 2 data store: Cloud Firestore
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
- Firestore root collections are `users`, `conversations`, and `messages`; ownership comes from the verified UID.
- API contracts are defined in OpenAPI and generated into shared client/server packages.
- The web application is rooted at `/` so the primary preview is immediately visible.

## Product

- Phase 1 established the conversation workspace and memory dashboard surfaces.
- Phase 2 adds Firebase email/password authentication plus user-owned Firestore conversations and messages.
- The Phase 2 assistant response is intentionally deterministic: `Phase 2 Firebase Echo: [User Text]`.
- Later phases will add Gemini responses, Qdrant retrieval, persistent memory, tools, and application-level feedback adaptation.

## User preferences

- Keep the implementation incremental and stop after each approved development phase.

## Gotchas

- Run API code generation after every OpenAPI contract change before importing generated hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
