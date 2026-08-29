---
name: Qdrant filter indexes
description: Required setup for ownership-filtered memory retrieval on the project's Qdrant cluster.
---

Create a `keyword` payload index for every Qdrant field used as a required ownership filter, including `userId`, and ensure it exists when opening either a new or existing collection.

**Why:** This cluster rejects filtered vector searches when the filter field lacks a compatible payload index; unfiltered searches are not an acceptable ownership boundary.

**How to apply:** Collection compatibility setup must include payload-index setup before any UID-filtered retrieval. Treat index creation failure as a retrieval/storage provider failure and keep the chat failure-isolation path active.