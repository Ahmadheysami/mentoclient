# AGENTS.md

## Project

**Mentoya** is a mobile-first Persian RTL application built with:
This is essentially a psychology-focused project featuring the capabilities and interface style of a "super-app."

It is a mobile-only web app.
The design and color palette must align with psychological principles; the palette has already been selected.
The project comprises three distinct panels:
- A panel for children, adolescents, and adults (this actually consists of two sub-panels: one for the parent and one for the child/adolescent, with distinct designs tailored to the respective age groups).
- An adult panel.
- An employer/administrator panel.

The visual design of each panel—including the color palette—must be appropriate for its specific function and target audience.
The project includes a wide range of features, which will be implemented task by task.

* Vue 3 + Composition API
* Nuxt 4
* TypeScript
* Nuxt UI
* Tailwind CSS
* VueUse
* Pinia
* Nuxt/Nitro Server API
* Socket.IO / realtime features

Main features:

* Authentication / OTP
* AI / MentorBot
* Psychological tests
* Cafe realtime chat
* Notifications
* User profile
* Wallet / coins

The application is primarily designed for **mobile + RTL Persian UI**.

---

## Project Structure

```text
app/
├── components/     # UI and feature components
├── layouts/        # Nuxt layouts
├── middleware/     # Route middleware
├── pages/          # File-based routes
├── plugins/        # Nuxt plugins
├── stores/         # Pinia stores
├── types/          # Shared TypeScript types
├── assets/         # CSS/assets
├── app.config.ts
└── app.vue

server/
├── api/            # Nitro API routes
└── utils/          # Server utilities

public/
├── fonts/
├── images/
└── sounds/
```

Feature components live under:

```text
components/App/
components/Auth/
components/Bot/
components/Cafe/
components/Features/
components/Home/
components/Notification/
components/Popup/
components/Socket/
components/Test/
components/Ui/
components/Util/
components/Wallet/
```

Keep feature-specific code inside its existing domain.

---

# Core Rules

## 1. Existing Architecture First

Before changing code:

1. Inspect the relevant existing files.
2. Search for reusable components, composables, stores and utilities.
3. Follow existing patterns.
4. Make the smallest correct change.

Do not restructure the project unless explicitly requested.

Do not rewrite unrelated code.

Do not introduce new abstractions without a real need.

---

## 2. Vue

Use Vue 3 Composition API with `<script setup lang="ts">`.

Prefer:

```ts
ref()
computed()
reactive()
watch()
```

Use `watch` only for real side effects.

Avoid duplicated derived state.

Use typed props and emits.

Do not use Options API for new code.

Avoid `any`.

---

## 3. Nuxt

Follow Nuxt conventions.

Use:

```text
app/pages/       → routes
app/layouts/     → layouts
app/middleware/  → middleware
app/plugins/     → plugins
server/api/      → API
```

Use Nuxt file-based routing.

Do not create custom routing when Nuxt routing is sufficient.

### SSR

Assume code can execute on the server.

Do not directly access:

```ts
window
document
localStorage
navigator
```

during SSR.

Use:

```ts
import.meta.client
```

or Nuxt/VueUse SSR-safe utilities when necessary.

Client-only plugins must use:

```text
*.client.ts
```

---

## 4. Data Fetching

Use `useFetch` when SSR/reactive fetching is appropriate.

Use `$fetch` for imperative operations such as:

* form submission
* mutations
* button actions

Do not blindly replace one with the other.

---

## 5. Pinia

Use existing domain stores:

```text
auth
bot
cafe
notification
test
user
wallet
```

Use Pinia for shared/domain state.

Keep local UI state inside components.

Do not create generic stores such as:

```text
global.ts
common.ts
misc.ts
```

without a strong reason.

---

## 6. Nuxt UI

Nuxt UI is the primary UI component library.

Before creating a custom UI component, check whether Nuxt UI already provides it.

Prefer:

```vue
<UButton />
<UInput />
<UModal />
<UAlert />
<USkeleton />
<UAvatar />
<UTabs />
<UCard />
```

Customize Nuxt UI through its supported props, slots and Tailwind classes.

Do not recreate existing Nuxt UI components.

---

## 7. Tailwind CSS

Tailwind is the primary styling system.

Prefer utility classes over custom CSS.

Use custom CSS only when Tailwind/Nuxt UI is not appropriate.

Avoid excessive arbitrary values such as:

```text
w-[137px]
text-[17px]
mt-[13px]
```

Use existing design tokens where possible.

---

## 8. RTL + Mobile First

The application is **Persian RTL and mobile-first**.

Design mobile first:

```text
mobile → sm → md → lg → xl
```

Prefer logical Tailwind utilities:

```text
ms-*
me-*
ps-*
pe-*
start-*
end-*
```

over unnecessary directional utilities.

Always consider:

* RTL
* touch targets
* small screens
* keyboard/focus behavior
* responsive layout

Do not introduce desktop-first UI.

---

## 9. VueUse

Before writing custom browser/reactivity utilities, check VueUse.

Useful examples:

```text
useLocalStorage
useDebounce
useDebounceFn
useThrottleFn
useEventListener
useMediaQuery
useBreakpoints
useClipboard
useIntersectionObserver
useOnline
useMounted
```

Use VueUse when it genuinely simplifies the implementation.

Do not add unnecessary abstractions.

---

## 10. Components

Naming:

```text
PascalCase.vue
```

Feature components:

```text
components/Cafe/
components/Test/
components/Wallet/
```

Reusable primitives:

```text
components/Ui/
```

Application-wide components:

```text
components/App/
```

Pages should compose components, not contain large amounts of business logic.

Extract reusable logic into composables/stores.

---

## 11. TypeScript

TypeScript is required for new code.

Prefer explicit types.

Avoid:

```ts
any
```

Use:

```ts
unknown
```

when a value is genuinely unknown and narrow it safely.

Shared API/domain types belong in:

```text
app/types/
```

Do not duplicate the same type across components.

---

## 12. API

Server endpoints live under:

```text
server/api/
```

Follow existing naming conventions.

Use HTTP method suffixes:

```text
.get.ts
.post.ts
.put.ts
.patch.ts
.delete.ts
```

Do not invent API endpoints or response structures when they are not present in the repository.

The server is the source of truth for sensitive/business operations such as wallet transactions.

---

## 13. Realtime

Realtime code exists around:

```text
app/plugins/
app/components/Socket/
app/stores/
```

Avoid:

* duplicate socket connections
* duplicate event listeners
* memory leaks
* unnecessary polling

Clean up listeners when required.

Follow existing socket/event architecture.

---

## 14. UI States

Async UI should consider:

```text
loading
success
empty
error
```

Use existing UI components such as `USkeleton` where appropriate.

Never assume API requests always succeed.

---

## 15. Security

Never expose:

* API keys
* secrets
* private tokens
* authentication cookies
* server-only environment variables

Never log:

* OTPs
* access tokens
* cookies
* sensitive user data

Do not move server secrets into client-side code.

---

## 16. Dependencies

Before installing a package, check:

1. Vue
2. Nuxt
3. Nuxt UI
4. VueUse
5. Existing project utilities

Only add dependencies when the existing stack cannot reasonably solve the problem.

---

## 17. Scope Control

For every task:

```text
Understand
→ Search existing code
→ Plan
→ Implement
→ Verify
```

Modify only what is necessary.

Do not:

* refactor unrelated code
* rename existing APIs
* migrate architecture
* replace libraries
* restructure directories

unless explicitly requested.

---

## 18. Verification

Before finishing, verify relevant:

* TypeScript
* Nuxt/Vue errors
* SSR behavior
* RTL behavior
* mobile layout
* loading/error states
* realtime behavior

Never claim a test/build passed unless it was actually run.

---

## 19. When Unsure

Do not guess:

* API contracts
* socket events
* store fields
* authentication behavior
* business rules
* design tokens

Inspect the repository first.

If the required information cannot be determined from the codebase, ask for clarification.

---

## Priority

When rules conflict:

```text
1. User requirement
2. Existing project architecture
3. Security
4. Correctness
5. SSR compatibility
6. Mobile/RTL UX
7. Performance
8. Maintainability
```

**Goal: make the smallest correct change that fits the existing Mentoya architecture.**
