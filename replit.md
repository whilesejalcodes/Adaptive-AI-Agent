# Adaptive AI Agent

A personal AI workspace that uses persistent memory and feedback to make future conversations more relevant.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/adaptive-ai-agent run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required environment variables will be added as external services are introduced.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React, Vite, Tailwind CSS, Wouter
- API: Express 5
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

- The initial product shell is built before external AI and authentication integrations.
- API contracts are defined in OpenAPI and generated into shared client/server packages.
- The web application is rooted at `/` so the primary preview is immediately visible.

## Product

- Phase 1 establishes the conversation workspace and memory dashboard surfaces.
- Later phases will add Firebase Authentication, Firestore persistence, Gemini responses, Qdrant retrieval, and application-level feedback adaptation.

## User preferences

- Keep the implementation incremental and stop after each approved development phase.

## Gotchas

- Run API code generation after every OpenAPI contract change before importing generated hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
