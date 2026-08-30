---
name: Artifact package installation
description: Monorepo dependency installation behavior for artifact-scoped frontend packages
---

When adding a dependency to an artifact package in this pnpm workspace, target
the artifact package explicitly instead of allowing an install helper to run
`pnpm add` at the workspace root.

**Why:** The generic package installation helper invokes the command from the
workspace root, where pnpm rejects implicit root dependency additions. An
artifact-scoped install keeps frontend dependencies out of the root and other
services.

**How to apply:** Use the existing artifact package filter for dependency
changes, then verify both that package manifest and the workspace lockfile
changed as expected.