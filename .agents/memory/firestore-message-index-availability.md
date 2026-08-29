---
name: Firestore message index availability
description: Development availability of the composite index needed for newest-first conversation history.
---

Treat the conversation/timestamp composite index as declared but not guaranteed to be deployed in the development Firebase project.

**Why:** The ordered conversation-history query required the composite index, and the server credential was not permitted to create that index.

**How to apply:** Keep runtime queries compatible with available indexes unless deployment is explicitly arranged. If newest-first history becomes required, deploy the declared index through an authorized Firebase workflow before relying on it.