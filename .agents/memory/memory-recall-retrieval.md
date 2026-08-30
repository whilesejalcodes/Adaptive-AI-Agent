---
name: Memory recall retrieval
description: Reliable retrieval behavior for explicit saved-memory questions without adding duplicate search pipelines.
---

Explicit memory-recall requests should use a topic-focused query, retrieve through the existing owner-scoped vector service once, and reuse that result if the first Gemini turn is forced to call memory_search.

**Why:** Meta-language such as “do you remember” can dilute semantic similarity, while optional tool selection can skip retrieval. Searching every ordinary message adds latency and unnecessary embedding work.

**How to apply:** Keep recall detection narrow, use a bounded recall threshold/query transformation, force only the first recall turn to call memory_search, and return to automatic tool selection for subsequent turns and normal chat.