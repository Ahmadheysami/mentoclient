# Parent & Child Panel — Feature Implementation

## 1. Objective

The base UI/UX for the **Parent Panel** and **Child/Teen Panel** has already been designed in previous phases.

This phase moves the project from UI/prototype work to **real feature implementation and API integration**.

The goal is to implement the Parent and Child/Teen panels according to the existing design system while connecting all required functionality to the real backend.

The implementation must preserve the existing project architecture and must not introduce unnecessary architectural changes.

---

# 2. Existing Project Context

The project is built with:

* Nuxt 4
* Vue 3
* TypeScript
* Tailwind CSS
* Nuxt UI
* Pinia
* Nuxt/Nitro Server API
* Existing backend under `Server/`

The existing panel architecture and UI design must be reused wherever possible.

The Parent Panel pages belong under:

```text
/panels/parent/**
```

The Child/Teen Panel pages belong under:

```text
/panels/child/**
```

The Parent and Child/Teen experiences are visually different and must not be treated as a single generic dashboard.

---

# 3. IMPORTANT — Required Investigation Before Implementation

Before writing or modifying implementation code, inspect the existing project.

Do not immediately start creating components or API calls.

First investigate:

```text
stores/
@/server/api/
@/src/modules/panels/**
Server/
```

Also inspect the existing **Big Panel** implementation because several features in this task should inherit its functionality and interaction patterns while receiving a panel-specific UI.

---

# 4. Swagger Is Mandatory

## VERY IMPORTANT

Before implementing any Parent Panel API integration, **study the Swagger documentation for the Parent Panel APIs**.

Use the existing local Swagger documentation:

```text
http://localhost:3001/.api/docs
```

Find and study the **Parent Panel / Panels** API section and identify the exact contracts for the endpoints required by this task.

Swagger must be treated as the primary API contract.

For every API used in this task, verify:

* HTTP method
* endpoint/path
* path parameters
* query parameters
* request body
* required fields
* optional fields
* response structure
* response data types
* success responses
* error responses
* validation rules
* authentication/authorization requirements
* pagination behavior, if applicable
* identifiers such as `userId`, `childId`, test IDs, etc.

### Do NOT guess API contracts.

If the Task description and Swagger appear inconsistent:

1. Check Swagger first.
2. Inspect the corresponding backend implementation.
3. Inspect existing frontend usage.
4. Use the actual backend contract.
5. Do not invent fields or response structures.

If Swagger is not sufficient to understand a response or behavior, inspect:

```text
Server/
@/src/modules/panels/**
```

and use the backend implementation to determine the correct structure.

---

# 5. API Architecture Rule

## IMPORTANT

All frontend API requests **must go through the Nuxt server**.

The client must NOT directly call the external/backend API.

The expected flow is:

```text
Vue Component
    ↓
Pinia Store / composable
    ↓
Nuxt Server API
    ↓
Backend API / Server logic
```

Before creating a new Nuxt server endpoint:

1. Inspect `@/server/api/`.
2. Look for an existing endpoint that already handles the required operation.
3. Reuse it when appropriate.
4. Only create a new endpoint when necessary.

Do not duplicate existing API logic.

---

# 6. State Management

Use **Pinia** for state management.

Before creating a new store:

* inspect existing stores
* identify existing panel-related state
* reuse existing state where appropriate
* follow the same naming and structure conventions
* avoid duplicated state
* keep API state management predictable

Do not introduce another state-management solution.

---

# 7. Big Panel Reuse

Several concepts already exist in the Big Panel.

The Parent and Child/Teen panels should reuse the **functionality and interaction patterns** of the Big Panel where applicable.

However:

> Do NOT simply copy the Big Panel UI.

The implementation should reuse:

* existing business logic
* API interaction patterns
* existing reusable components
* existing stores
* existing composables
* existing validation logic
* existing test/exam logic
* existing chatbot logic

while adapting the presentation to the target panel.

---

# 8. Chatbot

Implement the chatbot experience based on the existing Big Panel chatbot functionality.

The underlying functionality should follow the existing Big Panel implementation.

The visual design must be adapted to the target panel.

### Parent Panel

The Parent chatbot should have:

* professional appearance
* elegant visual hierarchy
* calm and trustworthy presentation
* clean and precise UI

### Child/Teen Panel

The Child/Teen chatbot should have:

* youthful visual language
* combination of child-friendly and teen-friendly elements
* attractive visual feedback
* engaging interactions
* animated elements where appropriate
* a design that prevents the interface from feeling boring or overly corporate

Do not make the Child/Teen UI childish to the point of looking inappropriate for teenagers.

---

# 9. Tests / Exams

The test system should inherit its functionality from the existing Big Panel implementation.

However, the Parent and Child/Teen presentation must be different.

---

## 9.1 Parent — Active Tests

Create an **Active Tests** section for the Parent Panel.

The section should have a professional Parent-oriented design.

The Parent should be able to:

### Assign a Test to a Child

The Parent can select one of their children and assign an available/purchased test to that child.

Expected flow:

```text
Active/Purchased Tests
        ↓
Assign Test
        ↓
Load Children
        ↓
Select Child
        ↓
Use child userId
        ↓
Assign Test
```

The UI must clearly show:

* available test
* selected child
* assignment action
* loading state
* success state
* error state

### Show Test

The Parent must also have an action to view the test.

---

# 10. Child / Teen — Exams

The Child/Teen panel should use the title:

```text
امتحانات
```

The section should display the exams/tests assigned to the child.

Each assigned exam should provide an action:

```text
شروع امتحان
```

The exam experience should reuse the existing exam implementation.

An exam page has already been designed in a previous phase.

Before modifying or recreating the exam page:

* inspect the existing exam page
* inspect its components
* inspect its state management
* inspect its logic
* reuse the existing implementation where possible

The Child/Teen exam UI should preserve the existing child-friendly visual direction, including:

* child-friendly icons
* suitable vector illustrations
* engaging visual elements
* appropriate animations

Do not unnecessarily redesign an already completed exam experience.

---

# 11. Parent Panel — Child Management

Implement the following real Parent Panel functionality.

---

## 11.1 Create Child

The Parent must be able to create a child.

API:

```text
/.api/panels/parent/child/create
```

Before implementation, verify the exact HTTP method and request/response contract in Swagger.

The UI must respect the active Parent plan.

If the current plan contains a `membersCount` limitation:

```text
current children count < membersCount
```

must be satisfied before allowing another child to be created.

The frontend must use the actual plan/member information available from the existing application/backend.

Do not hardcode the limit.

---

## 11.2 List Children

API:

```text
/.api/panels/parent/child/list
```

Use the exact contract defined by Swagger/backend.

The child list should be presented using the existing Parent Panel design language.

Include appropriate:

* loading state
* empty state
* error state
* refresh/update behavior
* child selection behavior where required

---

## 11.3 Children Statistics

API:

```text
/.api/panels/parent/child/stats
```

This endpoint represents the statistics for the Parent's children collectively.

Do not confuse this with the individual-child statistics endpoint.

Use Swagger/backend to determine the exact response structure.

---

## 11.4 Individual Child Information

API:

```text
/.api/panels/parent/child/{childId}
```

The `{childId}` must be handled according to the actual backend contract.

The resulting page/section should display the child information using a clean and structured Parent-oriented UI.

---

## 11.5 Individual Child Statistics

API:

```text
/.api/panels/parent/child/{childId}/stats
```

Also verify the following backend route mentioned by the task:

```text
/.api/panels/parent/{childId}/stats
```

These routes must NOT be assumed to be interchangeable.

Determine from Swagger and backend implementation:

* which endpoint is currently valid
* whether both exist
* what each endpoint returns
* whether one is legacy or belongs to another purpose

Use the actual backend contract.

---

## 11.6 Child Activities

API:

```text
/.api/panels/parent/child/{childId}/activities
```

Implement the child activity view using the actual response returned by the backend.

The UI should present activities in a clear and understandable timeline/list structure where appropriate.

Do not invent activity fields that do not exist in the API response.

---

# 12. Child Access Code Management

The Parent must be able to manage access for a child.

---

## 12.1 Create Access Code

API:

```text
/.api/panels/parent/child/{childId}/access-code
```

The Parent should be able to create an access code and receive the unique code required for the child to access their account.

The UI should clearly communicate:

* whether an access code exists
* generated code
* creation/loading state
* success state
* failure state
* available management actions

Follow the exact backend behavior from Swagger.

---

## 12.2 Delete Access

API:

```text
/.api/panels/parent/child/access-code
```

Verify the exact HTTP method, request body and semantics through Swagger/backend.

Do not infer these from the URL alone.

---

## 12.3 Revoke Access Code

API:

```text
/.api/panels/parent/child/{childId}/access-code/revoke
```

Implement access-code revocation according to the actual backend contract.

The UI should make destructive/revocation actions clear and prevent accidental actions through appropriate confirmation UX.

---

# 13. Child Accessibility / Time Restrictions

Parents can configure when a child is allowed to access the system.

API:

```text
/.api/panels/parent/modules/accessibility
```

The current task describes the request body as:

```json
{
  "access": [
    {
      "from": "08:00",
      "to": "20:00"
    }
  ],
  "child": "string",
  "disable": false
}
```

However, **do not assume this is the final contract**.

Verify the exact request body and response structure in Swagger and backend implementation before implementation.

The Parent must be able to configure:

* child
* enabled/disabled state
* allowed time ranges
* multiple access intervals within a 24-hour day

Example conceptual behavior:

```text
08:00 → 12:00
14:00 → 18:00
20:00 → 22:00
```

The UI should make multiple time ranges easy to understand and manage.

Do not impose a single time range if the backend supports multiple ranges.

---

# 14. Test Allocation

Parents can assign tests that are available/purchased by the Parent to a child.

API:

```text
/.api/panels/parent/{childId as userId}/test-allocation/{id}
```

The implementation must:

1. Load the available/purchased tests using the existing system.
2. Allow the Parent to select a child.
3. Use the child's correct `userId`.
4. Assign the selected test through the appropriate API.
5. Handle loading, success and error states.
6. Refresh relevant state after successful allocation when required.

Verify the exact endpoint method and parameters in Swagger.

---

# 15. Child / Teen Panel

The Child/Teen Panel must provide a genuinely engaging experience.

The goal is not merely to change colors.

The design should feel like a real product designed specifically for children/teenagers.

Use the existing information and functionality available from the backend and current application.

Use GSAP where animation improves the experience.

Possible areas for tasteful animation include:

* page entrance
* cards
* statistics
* progress
* interactive elements
* feedback states
* transitions between sections

Animations must remain:

* smooth
* purposeful
* performant
* non-disruptive
* appropriate for mobile devices

Do not add animation everywhere simply for visual effect.

---

# 16. Design & UI/UX Requirements

This is a major requirement of this task.

The final implementation must be **clean, precise, polished and production-quality**.

Do not treat UI implementation as simply placing API data into existing HTML.

The final UI must maintain visual consistency with the current Parent/Child design system.

### General principles

* clean layout
* precise spacing
* consistent typography
* strong visual hierarchy
* consistent border radius
* consistent shadows/elevation
* clear interaction states
* appropriate use of color
* responsive behavior
* mobile-first implementation
* RTL support
* accessible interactions
* polished empty/loading/error states

Use existing Nuxt UI components and project design tokens where appropriate.

Do not introduce another UI library.

---

# 17. Audience-Specific Design

## Parent

The Parent Panel should communicate:

* trust
* professionalism
* clarity
* control
* safety
* simplicity

Avoid excessive decorative elements.

The UI should feel premium and organized.

---

## Child / Teen

The Child/Teen Panel should communicate:

* energy
* curiosity
* engagement
* friendliness
* progress
* motivation

Use:

* illustrations
* suitable icons
* visual feedback
* tasteful motion
* friendly cards
* progress-oriented elements

But avoid making the interface look like a generic children's game.

The design should work for both younger children and teenagers.

---

# 18. Responsive & RTL Requirements

The application is primarily mobile-oriented.

All newly implemented pages and components must be:

* mobile-first
* responsive
* RTL-compatible
* usable on small screens
* compatible with the existing Persian UI

Do not rely on fixed desktop dimensions.

Do not break existing RTL layouts.

Use logical CSS/layout patterns where appropriate.

---

# 19. Loading / Empty / Error / Success States

Every API-driven feature must have proper UI states.

At minimum consider:

```text
Loading
Success
Empty
Error
Disabled
Pending
```

Do not leave blank screens while API requests are loading.

Do not show generic broken UI when an API returns an error.

Use the existing notification/toast/error-handling conventions in the project.

---

# 20. Internationalization

All user-facing text must follow the project's existing i18n/localization structure.

Do not hardcode user-facing messages in components when the project already has translation files.

Use the existing translation conventions.

---

# 21. Existing Architecture First

Before creating anything new, answer these questions through code inspection:

* Is there already a Parent store?
* Is there already a Child store?
* Is there already a test store?
* Is there already a chatbot store?
* Is there already a child-card component?
* Is there already a test-card component?
* Is there already an exam component?
* Is there already a reusable modal/drawer?
* Is there already a notification/error mechanism?
* Is there already an API wrapper for these endpoints?
* Is there already a reusable statistics component?
* Is there already an access/time restriction component?

Reuse existing implementations whenever appropriate.

Avoid duplicate components and duplicate business logic.

---

# 22. Backend Investigation Rule

If any API behavior is unclear, inspect the backend.

Relevant locations:

```text
Server/
@/src/modules/panels/**
```

Use the backend to determine:

* expected payloads
* response structures
* validation
* authorization
* business rules
* identifier semantics
* error conditions
* plan limitations
* child/access-code behavior
* test allocation behavior

Do not implement frontend assumptions when the backend can provide the actual answer.

---

# 23. Implementation Strategy

Follow this order:

### Phase 1 — Inspect

Study:

```text
existing Parent/Child pages
existing Big Panel
stores/
@/server/api/
@/src/modules/panels/**
Server/
Swagger
```

Understand the current architecture before making changes.

### Phase 2 — API Contract

For every required API:

```text
Swagger
   ↓
Existing Nuxt API
   ↓
Backend implementation
   ↓
Actual request/response contract
```

Resolve any discrepancies before implementation.

### Phase 3 — State

Implement or extend Pinia stores according to existing conventions.

### Phase 4 — Nuxt Server API

Add or modify Nuxt server endpoints only where necessary.

All frontend API calls must go through these endpoints.

### Phase 5 — Parent Features

Implement:

* children management
* child information
* child statistics
* child activities
* child access code
* access-code revoke/delete
* child accessibility/time restrictions
* active tests
* test allocation
* chatbot

### Phase 6 — Child/Teen Features

Implement:

* child/teen dashboard
* assigned exams
* exam entry
* chatbot
* relevant child statistics/progress
* appropriate interactive/animated experience

### Phase 7 — UI Refinement

Review every page for:

* spacing
* hierarchy
* typography
* consistency
* responsiveness
* RTL
* loading states
* empty states
* errors
* animations
* visual polish

### Phase 8 — Verification

After implementation:

* inspect TypeScript errors
* inspect Nuxt errors
* inspect API request/response handling
* inspect incorrect endpoint usage
* inspect broken imports
* inspect unused code
* inspect duplicated logic
* verify responsive behavior
* verify Parent/Child route separation
* verify all requested features are actually connected to real APIs

---

# 24. Important Restrictions

Do NOT:

* invent API endpoints
* invent request/response fields
* bypass the Nuxt server
* call backend APIs directly from Vue components
* create duplicate stores unnecessarily
* create duplicate components unnecessarily
* introduce another UI library
* rewrite unrelated parts of the application
* redesign already completed features without reason
* copy the Big Panel UI directly
* hardcode plan limits
* assume undocumented backend behavior
* leave API-driven UI without loading/error/empty states
* sacrifice functionality for visual effects
* add excessive animations

---

# 25. Definition of Done

This task is complete only when:

* Parent Panel functionality is connected to the real backend.
* Child/Teen Panel functionality is connected to the real backend.
* Required Parent APIs have been verified through Swagger.
* Ambiguous APIs have been verified through backend implementation.
* All frontend API calls go through Nuxt Server API.
* Pinia is used consistently with the existing architecture.
* Existing stores/components/composables are reused where appropriate.
* Parent and Child routes remain separated.
* Parent UI is professional, clean and precise.
* Child/Teen UI is engaging, appropriate and polished.
* Existing exam functionality is reused where appropriate.
* GSAP is used only where it improves the user experience.
* Loading, empty, error and success states are implemented.
* RTL and mobile-first behavior are preserved.
* No unnecessary dependencies or architectural changes are introduced.
* No unrelated features are modified.
* The final implementation matches the existing design system while providing the newly requested functionality.
* TypeScript/Nuxt/runtime issues introduced by the implementation are resolved.

---

# Final Instruction

**Do not start implementation based only on this document.**

First inspect the existing codebase, existing Parent/Child UI, Big Panel implementation, Pinia stores, `@/server/api/`, backend modules and especially the **Parent Panel APIs in Swagger**.

The implementation must be based on the **actual existing architecture and backend contracts**.

The final result should not look like a quick API integration.

It must feel like a carefully designed, production-ready part of the existing Mentoya application:

> **Correct API integration + correct architecture + clean implementation + precise UI/UX + audience-specific design.**
