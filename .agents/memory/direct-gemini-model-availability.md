---
name: Direct Gemini model availability
description: How to choose generation and embedding defaults for direct Google Gemini API access in this project.
---

Use model identifiers that have been verified through the live Google Gemini API for the project, while preserving environment overrides. The verified stable embedding model is `gemini-embedding-001`, whose default output is 3,072 dimensions.

**Why:** A stable-looking Flash Lite identifier appeared in the model catalog but returned 404 for generation, while the catalog’s maintained Flash Lite alias generated successfully. Embedding collection dimensions must come from a real embedding result, not model-name assumptions.

**How to apply:** When changing a default, list models and run a minimal server-only generation or embedding with the project’s direct Google API access. Verify the returned embedding dimension before creating or reusing a vector collection. Do not rely on naming conventions or provider-agnostic model lists.