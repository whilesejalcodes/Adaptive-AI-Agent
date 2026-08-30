---
name: Video artifact registration
description: Registration and workflow requirements for delegated video artifacts
---

Video artifacts must be created through the artifact registry before a delegated composition can be presented or previewed. A design worker can leave a valid-looking directory and manifest that is not registered, has no managed workflow, and cannot be resolved by presentation tools.

**Why:** The workspace presents artifacts by registry identity and managed workflow, not by filesystem discovery. Unregistered video source can build successfully while remaining invisible to preview and export tooling.

**How to apply:** Create the video artifact first, use its returned workflow name, then transfer or build the delegated composition inside that registered directory. Verify the artifact appears in the registry before presenting it.