---
name: Explicit memory tool writes
description: Prevent duplicate records when explicit tool-driven memory management and automatic extraction share a chat flow.
---

When an explicit memory-management tool successfully creates or updates a memory, do not also run the automatic post-response extraction pass for that interaction.

**Why:** The tool and extractor can phrase the same fact differently, producing separate deterministic IDs. Editing one record then leaves stale conflicting context available to retrieval.

**How to apply:** Keep automatic extraction for normal chat messages and for explicit requests where the memory tool did not complete successfully. Skip it only after a confirmed successful tool mutation.