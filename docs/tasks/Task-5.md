---

title: "Parent, Child & Teenager Panel — Creative UI/UX Design"
description: "Create a highly creative, premium, age-appropriate UI/UX design concept for the Parent, Child, and Teenager panels. This task is strictly limited to visual design and frontend prototyping, without implementing real functionality or backend integration."
---

# Task — Parent, Child & Teenager Panel Design

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
├── design/              # UI design references
└── tasks/               # Project tasks

server/
├── api/
└── utils/

public/
AGENTS.md
nuxt.config.ts
package.json
tailwind.config.ts
tsconfig.json
```

Before starting, inspect the existing project structure, design references, global styles, layouts, reusable components, and current panel implementations.

Follow the existing architecture and conventions. Do not introduce unnecessary dependencies or restructure unrelated parts of the application.

---

## 2. Project Overview

Mentoya is a premium AI-powered psychology, personal development, and mentoring application.

This task focuses on creating a completely new visual design concept for the **Parent, Child, and Teenager experience**.

The system consists of two main experiences:

* **Parent Panel:** A dedicated dashboard for parents (mothers and fathers) who own the primary account and manage their children's access and activities.
* **Child & Teenager Panel:** A separate, age-adaptive experience accessed by children through a dedicated access link provided by their parents.

Although these experiences belong to the same ecosystem, they must have distinct visual identities, interaction patterns, and design languages appropriate for their audiences.

### 2.1. Panel Separation, Routing & Access Architecture

The Parent and Child experiences must be implemented as two completely separate frontend sections with independent routes, layouts, and visual identities.

### Route Structure

**Parent Panel**

* Base route: `/panels/parent/**`
* The Parent Panel belongs to the primary account holder (mother or father).
* All parent-facing pages and layouts must remain within the `/panels/parent/` route hierarchy.
* The Parent Panel uses the parent's existing authenticated account and plan-based access system.

**Child Panel**

* Base route: `/panels/child/**`
* The Child Panel is a completely independent experience designed for children and teenagers.
* All child-facing pages and layouts must remain within the `/panels/child/` route hierarchy.
* The visual design must adapt to the child's age group:

  * Ages 7–14: Playful, imaginative, colorful, and child-friendly.
  * Ages 14–18: Contemporary, expressive, mature, and teenager-friendly.

### Parent-to-Child Access Model

The Child Panel uses a unique access mechanism that differs fundamentally from conventional authentication and plan-based access.

**Important: Children do not have independent authentication accounts.**

The access flow works as follows:

1. The parent has access to the Parent Panel through their own primary account.
2. The parent provides or generates a dedicated access link for the child.
3. The child opens the provided link and enters the Child Panel directly.
4. The child can access their designated experience without a login screen, registration process, or plan-purchasing flow.

The access link represents the entry mechanism for the child's experience. It is separate from the parent's authentication system.

### Strict Architectural Boundaries

* The Parent Panel and Child Panel must have separate route hierarchies and dedicated layouts.
* Do not merge the parent and child experiences into a single dashboard or shared navigation system.
* Do not create a conventional authentication flow for children.
* Do not implement login, registration, OTP verification, or independent account management for the Child Panel.
* Do not apply the adult or parent plan-purchasing and `auth-plan` mechanisms to the Child Panel.
* Do not redirect children to the Parent Panel or an authentication screen when entering through their dedicated access link.
* Keep the child-facing experience independent of the parent's authenticated interface.
* Do not assume that the child has an email address, phone number, password, or independent account.

The access link is part of the existing product concept. For this design-only phase, represent the link-sharing and direct-entry experience visually using mock data and local demonstrations where appropriate.

Do not implement real access-link generation, token validation, backend authorization, or security mechanisms in this phase.

### Design Implications

**Parent Panel**

* Design a dedicated area for managing and presenting child access.
* Explore an elegant, intuitive access-link sharing interface.
* Visually distinguish access-link creation, copying, and sharing states using prototype interactions.
* Make the relationship between the parent's account and the child's independent interface clear.

**Child Panel**

* Design the entry experience to feel immediate, welcoming, and frictionless.
* Do not display login, registration, plan selection, or account authentication screens.
* The child should feel that opening their dedicated link takes them directly into their own personalized environment.
* Ensure that the experience remains visually independent from the Parent Panel, even though both belong to the same product ecosystem.

**Scope Reminder:** These routing and access requirements define the intended product architecture. This task remains strictly limited to visual design and frontend prototyping. Do not implement real authentication, authorization, access-link infrastructure, or backend functionality.

---

## 3. Age-Based Design Strategy

The child-facing experience must adapt its visual identity according to the user's age.

### A. Children — Ages 7–14

Create a delightful, imaginative, playful, and colorful interface that makes children feel comfortable, curious, motivated, and excited to explore.

Design inspiration:

* Modern educational and interactive children's applications.
* Playful illustrations, expressive characters, and imaginative environments.
* Colorful interfaces with sophisticated color combinations rather than overwhelming rainbow palettes.
* Friendly shapes, organic forms, expressive cards, and visually rewarding interactions.
* Subtle gamification-inspired visual elements that encourage exploration and personal growth.

The result should feel magical, welcoming, and engaging without looking cheap, overly childish, or visually chaotic.

### B. Teenagers — Ages 14–18

Create a sophisticated, energetic, expressive, and contemporary experience that reflects teenage identity and independence.

Design inspiration:

* Premium lifestyle and wellness applications.
* Modern social and creative platforms.
* Contemporary editorial layouts, expressive typography, bold compositions, and carefully selected gradients.
* Stylish color combinations, subtle motion concepts, and immersive visual elements.
* A balance between youthful energy, emotional well-being, and a mature sense of personal identity.

Avoid childish illustrations, excessive cartoon elements, or designs that resemble elementary-school educational applications.

The interface should feel modern, personal, inspiring, and genuinely appealing to teenagers.

### Age Boundary

For the overlapping age of 14, design both variants and ensure the final concept can consistently select the appropriate experience based on the user's assigned age group.

Do not simply apply different color themes to the same layout. Develop appropriately distinct compositions, component styles, typography, illustrations, and interaction concepts for each age group.

---

## 4. Parent Panel — Design Direction

The Parent Panel is the central management and guidance experience for parents.

Its visual identity should communicate:

* Trust and emotional safety.
* Professionalism and reliability.
* Clarity and simplicity.
* Warmth, empathy, and family well-being.
* Premium quality and modern technology.

Create a sophisticated interface that feels like a premium family wellness and parenting application.

Explore creative approaches such as:

* An elegant personalized welcome area.
* A beautifully composed family overview.
* Visually engaging child profile cards.
* Thoughtful representations of children's progress and activities.
* A calm and refined navigation experience.
* Beautifully designed empty states, notifications, and contextual information.
* Subtle visual connections between the parent and child experiences.
* A well-designed child access management area.
* A polished visual concept for generating, copying, and sharing child access links.

The Parent Panel must have its own coherent design language. It should not look like a scaled-up version of the children's interface.

Prioritize a visually balanced, reassuring, and polished experience without sacrificing creativity.

### Parent Panel Navigation Concept

Explore a clean and intuitive navigation system suitable for a premium mobile application.

Potential sections to represent visually:

* Overview.
* Children and profiles.
* Activities and progress.
* Access management.
* Settings.

These are visual exploration suggestions, not requirements to implement real functionality.

Use an appropriate navigation pattern based on the final design direction. Do not force every section into a conventional sidebar or bottom navigation if another approach provides a better user experience.

---

## 5. Child & Teenager Panel — Design Direction

The child-facing experience should feel like a personalized environment rather than a conventional administrative dashboard.

Explore creative visual concepts that make the user feel that the application belongs to them.

Depending on the age group, consider:

* Personalized greetings and identity-focused welcome screens.
* Expressive visual representations of personal development.
* Engaging activity and discovery cards.
* Creative navigation patterns.
* Delightful visual feedback and subtle motion concepts.
* Distinctive illustrations, decorative elements, and visual storytelling.
* Personalized profile and achievement representations.
* Inviting empty states and visually interesting activity previews.

Use creativity to establish a memorable experience while keeping the interface intuitive and accessible.

Do not force all features into conventional dashboard cards. Explore different layouts and visual hierarchies wherever they improve the experience.

### Child Panel Navigation Concept

Explore age-appropriate navigation patterns rather than reusing the Parent Panel's navigation.

For younger children, consider:

* Large, recognizable navigation elements.
* Friendly icons and clear visual destinations.
* Simple navigation that minimizes cognitive load.
* Playful but consistent visual feedback.

For teenagers, consider:

* Sleek and compact navigation.
* Modern navigation patterns inspired by premium lifestyle applications.
* Strong visual hierarchy and personalized content presentation.
* A more independent and mature browsing experience.

These are design directions, not fixed component requirements.

---

## 6. Creative Direction & Visual Exploration

**Creativity and design quality are the highest priorities of this task.**

Do not settle for a generic dashboard, a basic collection of cards, or a conventional SaaS layout.

Think like a senior product designer working on a premium, internationally competitive mobile application.

Explore original visual concepts, sophisticated compositions, unexpected but practical layouts, and memorable interface details.

### Design Principles

* **Distinctive visual identity:** Each experience must have a recognizable and intentional visual language.
* **Emotional design:** Use visual storytelling and carefully selected design elements to create the right emotional response for each audience.
* **Premium aesthetics:** Pay attention to spacing, proportions, typography, depth, contrast, color harmony, and visual rhythm.
* **Modern interaction design:** Introduce thoughtful interaction patterns, delightful hover and press states, and subtle motion concepts where appropriate.
* **Visual hierarchy:** Make important information immediately recognizable without creating visual clutter.
* **Consistency:** Maintain coherent design systems within each experience while allowing the three experiences to remain visually distinct.
* **Accessibility:** Maintain readable typography, sufficient contrast, touch-friendly controls, and age-appropriate usability.
* **Originality:** Avoid blindly reproducing popular dashboard templates or copying reference designs.

### Color Direction

Explore appropriate color systems for each experience rather than imposing one shared palette.

Potential directions include:

**Parent**

* Refined blues.
* Soft purples.
* Warm neutrals.
* Calming accent colors.

**Children (7–14)**

* Vibrant yet harmonious colors.
* Playful gradients.
* Expressive accents.
* Friendly visual contrast.

**Teenagers (14–18)**

* Contemporary combinations of energetic accents.
* Sophisticated neutrals.
* Expressive gradients.
* Confident typography.

These are creative starting points, not strict limitations.

You are encouraged to explore more original combinations if they result in a stronger visual identity.

---

## 7. Design References & Skill Utilization

Before designing, identify and invoke all relevant available design skills.

Prioritize skills related to:

* Advanced UI/UX design.
* Creative art direction and visual exploration.
* Mobile-first interface design.
* Design systems and component styling.
* Age-appropriate user experience.
* Modern frontend prototyping.
* Micro-interactions and motion design.
* Accessibility and usability.

Inspect the available skills and their instructions before selecting the most relevant ones.

Reuse existing project skills and avoid installing or introducing unnecessary tools.

Study the visual references available in `docs/design/` and inspect existing project screens to understand the current product identity.

Use these references as inspiration and context, not as templates to reproduce.

If existing designs are outdated or unsuitable for the target audience, prioritize the new creative direction while preserving compatibility with the overall Mentoya ecosystem.

Do not claim to have used a skill unless it was actually available and invoked.

---

## 8. Technical Requirements

The project uses the following technologies and conventions:

* **Nuxt:** Follow the existing Nuxt application architecture and routing conventions.
* **Vue 3:** Use the existing component and Composition API conventions.
* **TypeScript:** Maintain type safety and existing project standards.
* **Tailwind CSS:** Use the existing styling system and design tokens.
* **Nuxt UI:** Reuse existing components where appropriate, but customize their appearance to achieve the desired visual quality.
* **Pinia:** Respect existing store conventions if any visual prototype state is required.

### Frontend Implementation Guidelines

* Follow the existing project structure.
* Reuse existing layouts, utilities, and components whenever appropriate.
* Create reusable visual components when they provide genuine design value.
* Maintain clean, readable, and maintainable code.
* Ensure all proposed screens are responsive, with mobile-first design as the primary priority.
* Use realistic sample data when necessary to demonstrate the design.
* Keep visual prototypes self-contained and independent of backend functionality.
* Preserve the route separation between `/panels/parent/**` and `/panels/child/**`.
* Use separate layouts for the Parent and Child experiences.
* Ensure the child experience can visually demonstrate the age-specific variants without requiring real authentication or backend data.

Do not introduce unnecessary architectural complexity or duplicate existing shared components without a clear reason.

---

## 9. Strict Scope — Visual Design Only

**This task is exclusively for creative UI/UX design and frontend prototyping.**

The goal is to explore and establish the visual direction of the Parent, Child, and Teenager experiences before implementing their actual functionality.

### Allowed

* Creating new visual layouts and page compositions.
* Building frontend screens and reusable visual components.
* Creating mock interfaces with realistic sample data.
* Implementing local-only interactions that demonstrate the proposed user experience.
* Creating static or simulated navigation between prototype screens.
* Designing age-specific visual variations.
* Exploring visual states such as empty, active, selected, and completed states.
* Adding decorative animations and micro-interactions when they improve the prototype.
* Creating visual design tokens and component styles where appropriate.
* Creating a simulated parent-to-child access-link interface.
* Demonstrating the child panel's direct-entry experience using mock data.
* Creating separate route-based visual prototypes under the required route hierarchies.

### Not Allowed

* Implementing backend functionality.
* Integrating real APIs or making actual API requests.
* Implementing authentication or authorization logic.
* Developing actual parent-child account relationships.
* Implementing real plan management or access-control mechanisms.
* Building actual psychology assessments, AI features, or other functional product modules.
* Modifying existing backend services or business logic.
* Implementing real access-link generation, token validation, or security mechanisms.
* Implementing child login, registration, OTP verification, or an independent authentication system.
* Applying the parent's authentication or `auth-plan` middleware to the child panel.
* Reworking unrelated application features.
* Advancing into subsequent implementation phases.

All data and interactions should remain local and demonstrative.

Do not confuse a visually complete prototype with a production-ready functional system.

---

## 10. Expected Deliverables

Create a visually impressive frontend prototype that demonstrates the proposed design direction for all three experiences.

The prototype should include:

### A. Parent Panel

* A complete, polished main dashboard concept.
* A clear navigation system.
* Visually compelling family and child overview sections.
* Representative management and activity components.
* A dedicated child access management concept.
* A visually polished access-link sharing interface.
* Thoughtful empty and populated states where useful.

### B. Children's Panel — Ages 7–14

* A distinctive, playful, imaginative main screen.
* Age-appropriate navigation and component styling.
* Engaging visual representations of activities and personal development.
* A cohesive visual identity that feels delightful and memorable.
* A welcoming direct-entry visual experience without authentication screens.

### C. Teenager Panel — Ages 14–18

* A modern, expressive, and sophisticated main screen.
* A visual identity that reflects teenage independence and personality.
* Contemporary navigation and content layouts.
* An engaging but mature design experience.
* A welcoming direct-entry visual experience without authentication screens.

### D. Design Consistency

* The Parent Panel and Child Panel must be visually independent.
* The two child age variants must be meaningfully different.
* The overall product should still feel like a unified Mentoya ecosystem.
* The prototype must be sufficiently developed to evaluate the three experiences side by side.

Prioritize the main screens and representative components over implementing every possible application page.

---

## 11. Final Instructions

Before writing code:

1. Inspect the current project structure and relevant existing implementations.
2. Discover and read the available design-related skills.
3. Review existing design references and identify reusable components and styling conventions.
4. Establish a creative visual direction for each of the three experiences.
5. Identify the appropriate route and layout boundaries for the Parent and Child Panels.
6. Begin the frontend prototype only after understanding the project's existing conventions.

Work independently as a senior UI/UX designer and frontend design engineer.

Make deliberate creative decisions instead of repeatedly asking for approval on ordinary design details.

**Do not produce a generic or minimal first draft.** Aim for a highly polished, distinctive, visually rich, and professionally art-directed result.

Do not implement real product functionality merely to make the prototype appear complete.

The final output should make it possible to evaluate the three design directions side by side and decide which visual concepts should be carried forward into the actual product implementation.

**Remember: This phase is about creating an exceptional visual concept, not implementing the complete product.**

----
Refrence Design Image: https://cdn.dribbble.com/userupload/48186856/file/6d015328c2885afae86bc83aae473306.png?resize=2048x1536&vertical=center

**Create the photos and icons you need for children and teenagers yourself.**