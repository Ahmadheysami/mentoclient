---
name: testing
description: Write and run frontend tests using the existing test infrastructure, covering the cases that actually catch regressions — happy path, edge cases, loading, empty, errors, unauthorized, invalid input, and regression. Refuses to introduce a new testing framework unless required, and never claims a test passed unless it was actually executed. Use when asked to add tests for a component or feature, verify a change, or reproduce a bug in a test. For implementing features use frontend-implementation; for reviewing changes use code-review.
---
# Frontend Testing

Use the existing test infrastructure.

Test:

- happy path
- edge cases
- loading
- empty
- errors
- unauthorized
- invalid input
- regression

Do not introduce a new testing framework unless required.

Never claim a test passed unless it was actually executed.