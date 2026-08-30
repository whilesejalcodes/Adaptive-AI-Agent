---
name: API runtime validation
description: A workspace-specific constraint for running disposable TypeScript checks against the API server.
---

Direct Node TypeScript execution does not resolve this API package's extensionless local imports reliably. Use the API package's esbuild path for disposable runtime checks so validation matches the production bundle.

**Why:** The server build bundles extensionless TypeScript imports successfully, while Node's built-in type stripping alone stops before executing the same source.

**How to apply:** Keep temporary checks outside the product source and bundle them from the API package before execution; remove them after the check.