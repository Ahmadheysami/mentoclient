---

title: "Adult Panel Design"
description: "After purchasing a plan designed and implemented in Task-1, the user is directed to their corresponding panel based on the purchased plan. The user can then access the panel's features using the APIs already implemented in the backend. Each feature will be explained individually in the context below."
---

# Task 4 — Adult Panel Design

## 1. Project Structure

```text
app/
├── assets/
├── data/
├── layouts/
├── middleware/
├── pages/
├── plugins/
├── stores/              # Pinia stores
├── types/
├── utils/
├── app.config.ts
└── app.vue

docs/
├── design/              # UI design images
└── tasks/               # Project tasks

server/
├── api/                 # API endpoints
└── utils/

public/                  # Static files

.gitignore
.ignore                  # OpenCode ignore rules
AGENTS.md                # Project rules
Dockerfile
nuxt.config.ts
package.json
README.md
tailwind.config.ts
tsconfig.json
```

## 2. Project Summary

In Task-1, we implemented the plan system, including plan purchasing and activation. After purchasing a plan, a user can have an active plan that grants access to the corresponding panel.

The application has three Pro panels. In this task, we will fully implement the **Adult Panel**.

### Available Panels

* **Adult Panel** (`big`)
* **Teenager & Child Panel**, divided into two sections:

  * **Parent Panel:** Parents can access their panel directly.
  * **Teenager & Child Panel:** Parents grant access to their children through a dedicated link.

    * The child-facing panel has two different designs:

      * Children under 8 years old.
      * Children over 8 years old.
* **Employer Panel:** Designed specifically for employers.

> **Important — Panel-Specific UI Design**
>
> Each panel must have a distinct UI design that reflects its target audience and purpose:
>
> * Adult Panel: A design tailored to adults.
> * Parent, Teenager, and Child Panels: Designs appropriate for parents, teenagers, and children.
> * Employer Panel: A design tailored to employers.

> **Important — Panel Separation**
>
> All panels are completely independent of one another. Each panel must be implemented as a separate system with its own dedicated pages.

### Technical Requirements

* **Server-Side API Calls:** All API calls must go through the Nuxt server. This means calling the relevant Nuxt server endpoint first, which then invokes the API logic defined within the Nuxt.js server.
* **State Management:** Use Pinia for state management, following the existing store conventions.
* **Existing Codebase:** Examine the existing stores and `@/server/api` before implementation. Base your work on the existing architecture and implementation.

---

## 3. Development Workflow

The project is divided into multiple phases.

I will provide the features and requirements for each phase individually. Implement the project **one phase at a time**, following the provided specifications.

Do not proceed to subsequent phases until the current phase has been completed.

---

## 4. Panel UI/UX Design

Design each panel according to its specific purpose and target audience.

Use native mobile applications as design inspiration and leverage all relevant available skills.

Aim for the highest possible level of visual quality and user experience.

### Design Guidelines

* Create a professional panel interface with a clean, minimal navigation menu.
* Organize each feature into its own dedicated page and section.
* Design every feature according to its purpose and functionality.
* Keep the interface visually engaging and easy to use, preventing user fatigue.
* Prioritize a polished, native-app-like experience.

---

# Phase 1 — Adult Panel

## 5. Overview

The Adult Panel is designed for users aged 18 and above.

Build a visually appealing, user-friendly, and professional interface inspired by native mobile applications.

The overall experience should convey a premium product, making users feel that their investment in the application is worthwhile and that they are using a high-quality application.

## 6. Adult Panel Features

The Adult Panel includes the following features:

### 6.1 Astrology

Calculate and display astrological charts.

**Reference Task:** `@docs/tasks/Big-Panel/Task-1.md`

### 6.2 Goal Setting

Provide the goal-setting functionality.

**Reference Task:** `@docs/tasks/Big-Panel/Task-2.md`

### 6.3 AI Assistant

Provide an intelligent assistant.

**Reference Task:** `@docs/tasks/Big-Panel/Task-3.md`

---

## 7. Implementation Rules

Follow these rules throughout the implementation:

* **Mobile-First and Mobile-Friendly:** Build the interface using a mobile-first approach and ensure an excellent experience on mobile devices.
* **Plan-Based Access Control:**

  * Users must have an active plan to access a panel.
  * Redirect users exclusively to the panel corresponding to their purchased plan.
  * Prevent users from accessing other panels for which they do not have an active plan.
* **Plan Status Validation:**

  * Always check the user's remaining plan validity before allowing access to the corresponding panel.
* **Minimalist and Attractive UI:**

  * Give strong priority to a clean, minimal, modern, and visually appealing interface.
* **Color Palette:**

  * Use blue and purple as the primary colors.
  * Incorporate appropriate notification and status colors where needed.

---

## 8. Expected Output

Deliver a complete, professional Adult Panel with an attractive, polished, and engaging user interface.

Apply advanced UI/UX design techniques wherever appropriate to achieve the highest possible design quality for this project.

### Additional Note

If any API request or response body is unclear or requires further investigation, you may inspect the relevant backend implementation to understand the expected data structures and behavior.

Relevant code locations:

* `Server/`
* `@/src/modules/panels/**`

Use the existing backend code to clarify any uncertainties and ensure the frontend implementation is compatible with the existing API logic.
