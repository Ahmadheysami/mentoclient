---
name: project-context
description: Gather just enough context to work on a task correctly, making the decisions that keep inspection targeted and cheap — prioritizing project configuration, the relevant module, shared components, related composables/hooks, related types, the related API layer, and tests, in that order, without ever scanning the entire repository unless explicitly required. Prefers listing directories, searching exact symbols, and reading only relevant files, and avoids generated files, lockfiles, build output, unrelated modules, and large docs. Use at the start of a task to understand the codebase before editing. For implementing the task use frontend-implementation; for wiring to an API use api-integration.
---
# Project Context

Before working on a task, inspect only the files required to understand the task.

## Priority

1. Project configuration
2. Relevant module
3. Shared components
4. Related composables/hooks
5. Related types
6. Related API layer
7. Tests

Do not scan the entire repository unless explicitly required.

## Context Rules

Prefer targeted inspection:

- list directories first
- search exact symbols
- read only relevant files
- inspect dependencies only when necessary

Avoid reading:

- generated files
- lockfiles
- build output
- unrelated modules
- large documentation files

## Goal

Minimize context while preserving enough information for correct implementation.