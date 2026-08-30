---
name: Firestore message index availability
description: Development availability of the composite index needed for newest-first conversation history.
---

Treat the conversation/timestamp composite index as declared but not guaranteed to be deployed in the development Firebase project.

**Why:** The ordered conversation-history query required the composite index, and the server credential was not permitted to create that index.

**How to apply:** Attempt bounded newest-first reads, detect missing-index errors, then fall back to owner-filtered reads sorted and capped in application code. Do not make index deployment a runtime prerequisite.