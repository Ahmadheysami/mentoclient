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