---
name: security-review
description: Perform a focused frontend security audit and decide whether the code is safe to ship, working through XSS, unsafe HTML, authentication, authorization assumptions, token handling, storage, cookies, redirects, sensitive data, API responses, and user input. Rates each finding by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO) without inflating it, and reports the location, problem, impact, evidence, and remediation for every issue. Ends with a gate verdict of SECURITY_GATE: PASS or SECURITY_GATE: BLOCKED. Use when asked to audit a change or feature for security, or before merging security-sensitive code. For general code review use code-review; for wiring to an API use api-integration.
---

# Security Review

Perform a focused frontend security audit.

Check:

- XSS
- unsafe HTML
- authentication
- authorization assumptions
- token handling
- storage
- cookies
- redirects
- sensitive data
- API responses
- user input

## Severity

CRITICAL
HIGH
MEDIUM
LOW
INFO

Do not inflate severity.

For each finding provide:

Location
Problem
Impact
Evidence
Remediation

Finish with:

SECURITY_GATE: PASS

or:

SECURITY_GATE: BLOCKED