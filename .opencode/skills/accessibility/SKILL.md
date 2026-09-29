---
name: accessibility
description: Ensure a user-facing interface is accessible, making the decisions that determine whether every user can actually use it — semantic HTML, keyboard navigation, focus states, labels, buttons, form errors, contrast, screen reader meaning, and disabled states. Fixes the implementation. Use when building or reviewing UI, adding interactive elements, wiring up forms, or checking that a component works for keyboard and screen reader users. For a full codebase audit use audit-accessibility; for design-level guidance use review-accessibility.
---

# Accessibility

All user-facing interfaces should be accessible.

## Check

- semantic HTML
- keyboard navigation
- focus states
- labels
- buttons
- form errors
- contrast
- screen reader meaning
- disabled states

## Interactive Elements

Do not use clickable divs when a semantic button or link is appropriate.

## Forms

Every input should have:

- accessible label
- validation feedback
- clear error state

## Focus

Never remove focus indication without providing an accessible alternative.