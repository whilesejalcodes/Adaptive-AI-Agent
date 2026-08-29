---
name: Direct Gemini model availability
description: How to choose a default model for direct Google Gemini API access in this project.
---

Use a low-cost model identifier that has been verified through the live Google Gemini API for the project, while preserving an environment override.

**Why:** A stable-looking Flash Lite identifier appeared in the model catalog but returned 404 for generation, while the catalog’s maintained Flash Lite alias generated successfully.

**How to apply:** When changing the default, list models and run a minimal server-only generation with the project’s direct Google API access. Do not rely on naming conventions or provider-agnostic model lists.