---
title: "Employee Panel Design and Implementation"
description: "Implement the Employee Panel in Mentoya by reusing the existing Big Panel architecture, delivering functional Phase 1 features, and presenting locked Phase 2 features as polished interactive demos."
---

# Task: Employee Panel Design and Implementation

## 1. Task Overview

Implement the Employee Panel in Mentoya, following the existing Big Panel as the primary reference for architecture, UI patterns, reusable components, and user experience.

The Employee Panel should be built on top of the existing project structure. Do not redesign the Big Panel or create a new architecture from scratch.

Phase 1 includes three functional features:
- AI Assistant
- Active Tests
- Test Results

Phase 2 includes four features that must be presented as polished, visually rich, locked demos:
- رادار شکار
- استخدام
- مشاوره و کوچینگ
- آزمون گرفتن از دیگران

The purpose of the Phase 2 demos is to help employers understand the product's future capabilities and create a strong, professional first impression, even though these features are not operational yet.

**Important product rule:** The Employee Panel must remain visible and available for purchase to all users. Users do not need to own the Employee subscription to see the panel or its purchase option. However, they must purchase the `employee` plan before they can activate or enter the panel.

Do not hide the Employee Panel from users who have not purchased it. Instead, display its entry point and appropriate purchase CTA according to the existing subscription and purchase flow.

---

## 2. Phase 1: Inspect the Existing Project

Before making any code changes, inspect the current project and understand the existing implementation.

### 2.1. Inspect the Big Panel

Review the following areas:
- Existing panel structure, routes, layouts, and navigation.
- Shared components and reusable UI patterns.
- AI Assistant implementation and its API integration.
- Active Tests implementation and data retrieval.
- Test Results implementation and result presentation.
- Authentication and panel access middleware.
- Subscription validation and active-panel selection.
- User profile completion requirements.
- Loading, empty, error, and success states.
- Existing design tokens, typography, spacing, colors, shadows, and border-radius conventions.
- Responsive behavior and mobile navigation.

Reuse existing components and logic wherever appropriate. Avoid unnecessary duplication and avoid introducing new dependencies without a clear reason.

### 2.2. Inspect Subscription and Purchase Logic

Understand how subscription plans are defined, purchased, activated, and validated in the current application.

The Employee Panel must use the existing plan key:

`employee`

Determine how the project currently handles:
- Available plans and purchase CTAs.
- Subscription purchase and payment flows.
- Subscription ownership and validity.
- Panel activation and switching.
- Expired or missing subscriptions.
- Authentication and authorization.
- User profile completion.

Reuse the existing mechanisms instead of implementing a parallel subscription system.

### 2.3. Inspect Existing APIs and Documentation

Review the available API documentation, Swagger definitions, and existing integrations related to:
- AI Assistant
- Active Tests
- Test Results
- User profile information
- Subscription plans and purchase flows
- Panel activation and access

Do not assume that an endpoint exists without verifying it.

Use actual API contracts and existing project conventions. If an endpoint or required API contract is missing, document the gap rather than inventing an endpoint or presenting mock data as real functionality.

---

## 3. Employee Panel Visibility, Purchase, and Access Rules

This section defines a critical product requirement.

### 3.1. Panel Visibility

The Employee Panel must be discoverable by all users.

- Do not hide the Employee Panel entry point from users who have not purchased the plan.
- Do not restrict visibility of the Employee Panel purchase option.
- Users without the subscription must be able to discover the panel and understand its available features.
- Display an appropriate purchase CTA when the user does not own the required plan.
- Follow the existing subscription and purchase UI patterns used in the application.
- Do not automatically activate the Employee Panel for users who have not purchased it.

### 3.2. Purchase Requirement

Only users who have purchased the `employee` plan and satisfy the required profile completion conditions may activate and enter the Employee Panel.

The following rules must be enforced:
- A user without the `employee` subscription cannot activate the panel.
- A user without the `employee` subscription cannot access protected Employee Panel functionality.
- A user must explicitly complete the existing purchase flow before receiving access.
- Do not grant access simply because the user selects the Employee Panel or visits its route.
- Do not modify subscription ownership or activation state through client-side state manipulation.

### 3.3. Server-Side Access Validation

Subscription validation must not rely solely on frontend visibility or route guards.

- Validate the authenticated user's subscription on the server for protected operations.
- Reuse the existing authorization and subscription middleware.
- Prevent direct API requests from bypassing subscription requirements.
- Ensure that modifying frontend state or manually entering a route cannot grant unauthorized access.
- Return appropriate responses for users without a valid subscription.
- Preserve the behavior of existing panels.

### 3.4. Purchase CTA Behavior

When a user without the required plan selects the Employee Panel:
- Keep the panel discoverable.
- Present the existing purchase flow or an appropriate purchase screen.
- Explain that purchasing the Employee plan is required to activate and enter the panel.
- Do not grant access until the purchase has been successfully verified.
- After successful purchase, follow the existing activation and navigation flow.

Do not create a new payment implementation if the project already provides a working purchase flow.

---

## 4. User Profile Requirements

Users must complete the following profile information before entering the Employee Panel:
- First name
- Last name
- The information required to determine the user's age

If the existing application uses date of birth to calculate age, reuse that source instead of introducing a redundant age field.

When required profile information is missing:
1. Prevent entry into the functional Employee Panel.
2. Redirect the user to the appropriate existing profile-completion flow.
3. Preserve the user's intended destination when compatible with the existing routing architecture.
4. Allow access after the required information has been completed and the Employee subscription has been verified.

The profile completion requirement must work consistently with existing authentication middleware and other panels.

Users without an Employee subscription must still be able to discover and purchase the plan, even if their profile is incomplete. Apply profile completion checks at the appropriate access or activation stage, not as a reason to hide the panel or its purchase option.

---

## 5. Phase 1: Functional Features

### 5.1. AI Assistant

Implement the AI Assistant by reusing the existing Big Panel implementation.

Requirements:
- Reuse existing components, API integrations, and business logic where possible.
- Preserve the current AI Assistant interaction patterns.
- Connect to verified APIs.
- Handle loading, success, empty, and error states.
- Preserve chat history when supported by the existing implementation.
- Follow the current application architecture and authorization rules.
- Ensure a polished mobile-first experience.
- Avoid duplicate APIs, services, or state management unless required by the existing architecture.

The AI Assistant must be fully functional. A static chat interface or mock responses are not acceptable substitutes for the existing working functionality.

### 5.2. Active Tests

Allow authorized Employee Panel users to view their available active tests.

Requirements:
- Use verified existing APIs.
- Display test titles, descriptions, statuses, and other fields supported by the actual API contract.
- Reuse existing test cards and related components when appropriate.
- Handle loading, empty, and error states.
- Respect subscription and user authorization rules.
- Do not present fabricated tests as real user data.

### 5.3. Test Results

Allow authorized users to view their own test results using existing APIs.

Requirements:
- Use verified API contracts.
- Display result information supported by the actual backend.
- Reuse existing result components and presentation patterns.
- Handle loading, empty, and error states.
- Prevent unauthorized access to other users' results.
- Do not fabricate results or mix demo data with real assessment data.

If the existing application distinguishes between completed tests and available results, preserve that distinction.

---

## 6. Phase 2: Locked Demo Features

The following features must be visually presented but must not be operational in this task:
- رادار شکار
- استخدام
- مشاوره و کوچینگ
- آزمون گرفتن از دیگران

The objective is to communicate the future value of the Employee Panel through polished, product-quality previews.

A simple card with a lock icon is not sufficient. Each feature should have its own visual identity, explanatory content, and meaningful preview.

However, all Phase 2 features must remain genuinely disabled. Their demo interactions must not execute real business operations or send requests to unimplemented APIs.

### 6.1. رادار شکار

This is the most important visual feature of the Employee Panel and must appear at the top of the main panel content.

#### Future Product Concept

In the future, employers will be able to discover people within Mentoya who may be psychologically compatible with their needs and criteria.

The feature is intended to communicate the concept of talent discovery and compatibility matching.

#### Visual Requirements

Create a distinctive and attractive رادار شکار section containing:
- An animated radar chart or radar-style visualization.
- Fictional avatars positioned around or within the radar.
- Concentric radar rings.
- Subtle scanning lines and moving scan effects.
- Small glowing points and carefully controlled visual highlights.
- Smooth, continuous scanning animation.
- A clear lock indicator or "به‌زودی" label.
- A short explanation of the feature's future purpose.
- A disabled or non-operational CTA.

The radar should feel active and visually engaging while remaining clearly identified as a locked preview.

#### Layout

Position رادار شکار at the beginning of the main Employee Panel page.

It should have higher visual prominence than the other Phase 2 features. The chart must remain readable on small mobile screens and should not become cluttered or excessively small.

#### Demo Data and Privacy

Use only fictional avatars and clearly illustrative data.

Do not use actual user profiles, real psychological assessment results, or real compatibility calculations in the demo.

Do not imply that real users have already been identified or analyzed.

#### Functional Restrictions

- Do not execute actual user discovery.
- Do not implement real psychological compatibility matching.
- Do not send recruitment requests or contact users.
- Do not query real user profiles for the demo.
- Do not perform any operation that changes real user data.

### 6.2. استخدام

This feature will eventually support a complete recruitment workflow.

For this task, implement a polished visual preview containing:
- The title استخدام.
- A concise explanation of the future recruitment functionality.
- Visual elements related to recruitment and team building.
- A fictional preview of recruitment stages.
- Illustrative cards representing job opportunities, candidates, and selection stages.
- A clear lock indicator or "به‌زودی" label.
- A disabled CTA.

The preview should communicate the future product concept without implementing an incomplete recruitment system.

Do not create real job postings, manage actual candidates, or execute recruitment operations.

### 6.3. مشاوره و کوچینگ

This feature will eventually allow employers to select a suitable consultant or coach.

For this task, implement a locked demo containing:
- The title مشاوره و کوچینگ.
- A concise description of the future service.
- Illustrative consultant profile cards.
- Fictional avatars and sample specialty labels.
- A preview of a future consultant directory.
- A clear lock indicator or "به‌زودی" label.
- A disabled CTA.

All displayed profiles must be clearly illustrative. Do not connect the demo to real consultant booking, payments, scheduling, or consultation workflows.

### 6.4. آزمون گرفتن از دیگران

In the future, employers will be able to purchase an assessment, generate an invitation link, send it to another person, and view the completed assessment result in their panel.

For this task, implement a polished visual preview containing:
- The title آزمون گرفتن از دیگران.
- A concise explanation of the future workflow.
- An illustrative assessment card.
- A visual preview of the invitation-link concept.
- Fictional invitation status indicators, such as sent, awaiting completion, and completed.
- An illustrative preview of the future result-viewing experience.
- A clear lock indicator or "به‌زودی" label.
- A disabled CTA.

#### Functional Restrictions

- Do not purchase an assessment.
- Do not generate a real invitation link.
- Do not send invitations or notifications.
- Do not create real assessment sessions for other users.
- Do not generate or retrieve other users' assessment results through this demo.
- Do not execute any payment-related operation.

All content must be clearly illustrative and must not be presented as actual user activity.

---

## 7. Phase 2 Demo Interaction Rules

All Phase 2 features must be visually appealing but non-operational.

- Disabled CTAs must not execute business operations.
- Demo interactions must not call real APIs.
- Do not navigate to incomplete routes or error pages.
- Do not modify user data, subscription state, or assessment records.
- Do not use mock data in ways that could be mistaken for real user information.
- If additional explanation is useful, a tooltip or informational modal may be used.
- Informational interactions must not imply that the underlying feature is available.

Use a consistent visual language for locked states across all four features.

The lock state should be clear without making the interface look broken, inaccessible, or unfinished.

---

## 8. UI/UX and Native App Design Requirements

### 8.1. Overall Design Direction

The Employee Panel must feel like a polished native mobile application rather than a conventional administrative dashboard.

The design should be:
- Mobile-first.
- Minimal and professional.
- Modern and visually engaging.
- Carefully spaced and well structured.
- Consistent with Mentoya's existing visual identity.
- Smooth in navigation and interaction.
- Based on reusable components and existing design tokens.

Use `rounded-4xl` for major cards and containers where appropriate and consistent with the current design system.

Pay particular attention to spacing, typography, alignment, component density, and visual hierarchy.

### 8.2. Professional Employer-Oriented Visual Language

The design must communicate trust, professionalism, organization, and intelligence.

Avoid:
- Excessively playful or childish visual elements.
- Harsh or inconsistent color combinations.
- Excessive shadows and decorative effects.
- Unnecessary animations.
- Repetitive cards with little informational value.
- Overly dense layouts.

The interface should remain engaging without losing its professional identity.

### 8.3. Existing Design System

Inspect the current project before defining new colors, fonts, tokens, or component styles.

Reuse existing:
- Design tokens.
- Typography.
- Color palette.
- Icons.
- Shared components.
- Spacing conventions.
- Border-radius conventions.
- Animation utilities.

Do not introduce a separate design system for the Employee Panel without a clear technical reason.

### 8.4. Persian RTL Support

The interface must preserve correct Persian typography and RTL layout behavior.

Verify:
- Text alignment.
- Icon positioning.
- Direction-sensitive spacing.
- Card layouts.
- Navigation behavior.
- Radar visualization labels and controls.
- Responsive behavior across screen sizes.

Avoid unnecessary layout changes that could affect existing panels.

### 8.5. Responsive Behavior

Prioritize mobile screens while maintaining appropriate responsive behavior on larger screens.

Verify:
- No unintended horizontal overflow.
- Readable radar visualization.
- Proper CTA placement.
- Appropriate card sizes and spacing.
- Consistent rounded corners.
- Correct RTL layout.
- No overlap between animations and content.

### 8.6. Animation and Performance

Animations must be smooth, subtle, and purposeful.

- Keep the radar scanning animation lightweight.
- Avoid unnecessary concurrent animations.
- Respect `prefers-reduced-motion` where practical.
- Prevent continuous animations from degrading performance.
- Keep the page stable during API requests and rendering.
- Reuse existing animation libraries or utilities where appropriate.

---

## 9. Skills and Visual Assets

Before implementation, inspect all available skills relevant to:
- Native mobile UI/UX design.
- Vue and Nuxt development.
- Component architecture.
- Accessibility.
- Animation and performance optimization.

Use all relevant skills that are available in the execution environment. Do not assume unavailable tools or skills exist.

### Visual Asset Reference

Preferred source for visual assets:

https://www.vecteezy.com

Before downloading new assets:
1. Inspect existing assets in the project.
2. Search for appropriate illustrations for talent discovery, recruitment, consulting, and assessments.
3. Verify the asset's licensing and permitted use.
4. Prefer high-quality assets that fit the professional and minimal visual direction.
5. Avoid watermarked assets or assets with unclear licensing.

### Important Asset Download Rule

If you find a suitable image but cannot download it or obtain a usable direct URL, stop the work related to that specific asset and provide me with the actual asset page URL so I can download it manually.

Do not invent URLs or replace a failed asset with a fabricated link.

If other parts of the task can be implemented independently, clearly report the blocked asset and wait for my confirmation before proceeding with those remaining parts. Do not silently substitute a different asset.

---

## 10. Out of Scope

The following functionality is not part of this implementation:
- Real talent discovery through رادار شکار.
- Real psychological compatibility algorithms.
- Actual recruitment workflows.
- Purchasing assessments for other people.
- Generating real assessment invitation links.
- Sending assessment invitations.
- Retrieving other users' assessment results through the new demo.
- Real consultant selection, booking, or payment workflows.

Only polished, locked visual previews are required for these Phase 2 features.

These restrictions do not apply to existing Phase 1 features. The AI Assistant, Active Tests, and Test Results must remain functional according to their verified existing API integrations.

The Employee Panel must remain visible to all users, regardless of subscription ownership. Only activation and protected access require the `employee` subscription.

---

## 11. Acceptance Criteria

### 11.1. Visibility and Purchase

- [ ] The Employee Panel is discoverable by all users.
- [ ] Users without an Employee subscription can see the panel entry point and purchase CTA.
- [ ] The panel is not hidden merely because the user has not purchased the plan.
- [ ] Users without the `employee` plan cannot activate or enter the protected panel.
- [ ] Selecting the panel without a subscription leads to the appropriate existing purchase flow.
- [ ] Successful purchase is verified before access is granted.
- [ ] Client-side state manipulation cannot bypass subscription validation.

### 11.2. Profile Requirements

- [ ] First name is required.
- [ ] Last name is required.
- [ ] Age or the information required to calculate age is available.
- [ ] Users with incomplete profiles cannot enter the functional panel.
- [ ] Users can still discover and purchase the Employee plan before completing their profile.
- [ ] Profile completion and subscription checks do not create redirect loops.

### 11.3. Functional Features

- [ ] The AI Assistant uses verified existing APIs and works correctly.
- [ ] Active Tests are retrieved from real APIs.
- [ ] Test Results are retrieved from real APIs.
- [ ] Loading, empty, and error states are implemented.
- [ ] Unauthorized access to other users' data is prevented.
- [ ] No fabricated data is presented as real functionality.

### 11.4. Locked Demo Features

- [ ] رادار شکار appears at the top of the main Employee Panel page.
- [ ] The radar has a polished visual design and controlled scanning animation.
- [ ] All four Phase 2 features are clearly introduced.
- [ ] Each feature communicates its future value.
- [ ] All Phase 2 features are visibly locked.
- [ ] Demo CTAs do not trigger real business operations or API calls.
- [ ] Fictional profiles and assessment data are not presented as real user information.
- [ ] No payment, invitation, recruitment, or consultation operations are executed by the demos.

### 11.5. UI/UX and Quality

- [ ] The design follows the existing Big Panel and Mentoya design system.
- [ ] Persian RTL behavior is correct.
- [ ] Spacing, typography, icons, and rounded corners are consistent.
- [ ] The interface works across mobile and larger screen sizes.
- [ ] Animations do not significantly degrade performance.
- [ ] Existing panels continue to work correctly.
- [ ] No broken navigation, incomplete routes, or misleading interactive controls remain.

---

## 12. Recommended Implementation Workflow

Follow this order:

1. Inspect the existing project structure and Big Panel implementation.
2. Identify reusable components and shared business logic.
3. Review the existing API contracts and subscription purchase flow.
4. Verify Employee Panel visibility, purchase, activation, and access rules.
5. Implement the Employee Panel structure using the current architecture.
6. Integrate the AI Assistant, Active Tests, and Test Results.
7. Implement the four locked Phase 2 demos, prioritizing رادار شکار.
8. Refine spacing, animations, loading states, empty states, and responsive behavior.
9. Test subscription validation, profile completion, API integrations, locked feature behavior, and regressions.
10. Provide a clear implementation report.

If a requirement conflicts with the existing architecture or depends on a missing API contract, document the issue before making broad architectural changes.

---

## 13. Final Report Requirements

After implementation, provide a report covering:
- Created or modified pages and components.
- Existing components reused.
- APIs inspected and integrated.
- Employee subscription visibility and purchase behavior.
- Server-side access enforcement.
- Profile completion validation.
- Functional Phase 1 features.
- Locked Phase 2 demos.
- Tests executed and their actual results.
- Known issues, missing APIs, or remaining work.

Do not report tests as successful if they were not executed. Do not describe a visual-only demo as a functional feature.

---

## 14. Final Objective

Deliver a professional Employee Panel for Mentoya that:
- Remains visible and purchasable to every user.
- Requires a verified `employee` subscription for activation and protected access.
- Reuses the existing Big Panel architecture and design system.
- Provides fully functional Phase 1 features.
- Introduces the four Phase 2 features through polished, locked demos.
- Gives special visual attention to رادار شکار.
- Maintains a refined, native-like, responsive, Persian RTL experience.
- Preserves the integrity of existing panels and subscription flows.

Prioritize correct access control, architectural consistency, real functionality, polished visual design, and reliable testing over unnecessary abstractions or a complete rewrite.
