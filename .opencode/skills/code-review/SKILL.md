---
name: code-review
description: Review a set of requested code changes and decide whether they are ready to merge, working through priorities in order — correctness, security, architecture, maintainability, error handling, type safety, performance, and accessibility. Focuses strictly on the changed code and directly affected areas, and does not turn the review into unrelated refactoring. Returns a verdict of CODE_REVIEW: PASS or CODE_REVIEW: CHANGES_REQUIRED. Use when asked to review a diff, pull request, or set of changes before merging. For reviewing motion specifically use review-animations; for a full codebase audit use improve-codebase.
---

# Code Review

Review the requested changes.

Priorities:

1. correctness
2. security
3. architecture
4. maintainability
5. error handling
6. type safety
7. performance
8. accessibility

Focus on changed code and directly affected areas.

Do not turn the review into unrelated refactoring.

Return:

CODE_REVIEW: PASS

or:

CODE_REVIEW: CHANGES_REQUIRED