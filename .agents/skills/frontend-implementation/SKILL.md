---
name: frontend-implementation
description: Implement a requested frontend feature end to end, making the decisions that keep the change correct, localized, and consistent with the existing codebase — inspecting related files, components, state management, utilities, the API layer, and types before editing, then reusing existing patterns, preserving type safety, and covering the relevant states (loading, success, empty, error, disabled). Finishes by running checks, reviewing changed files, and removing debug logs, TODOs, temporary code, and unused imports. Use when asked to build, add, or change a frontend feature or component. For wiring to an API use api-integration; for reviewing the result use code-review.
---

# Frontend Implementation

Implement only the requested functionality.

## Before Editing

Inspect:

- related files
- existing components
- state management
- utilities
- API layer
- types

## Rules

- reuse existing patterns
- keep changes localized
- preserve type safety
- avoid unrelated refactoring
- avoid unnecessary dependencies

## States

Implement when relevant:

- loading
- success
- empty
- error
- disabled

## Finish

Run relevant checks.

Review changed files.

Remove:

- debug logs
- TODOs
- temporary code
- unused imports