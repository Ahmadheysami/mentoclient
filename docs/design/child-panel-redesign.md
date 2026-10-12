# Child/Teen Panel — Redesign Specification

Status: **in progress**. Date: 2026-10-07.

Scope: `app/pages/panels/child/**`, `app/components/Child/**`, `app/layouts/child.vue`,
`app/components/Child/Nav.vue`, additive tokens in `app/assets/css/main.css`.
Business logic, stores, APIs, middleware, routes are PRESERVED. Variant (`neu-kid`/`neu-teen`)
stays derived from `stageOfAge(profile.age)`; SSR rules unchanged (profile via
middleware, `readAt` snapshot, no `Date.now()` at render).

## 1. Navigation (new)

Bottom nav goes from 6 tabs to 4:

| Tab | Route | Icon |
|---|---|---|
| خانه | /panels/child | solar:home-2-bold |
| مسیر من | /panels/child/goals | solar:routing-3-linear (kid) / solar:flag-2-linear (teen) |
| فعالیت‌ها | /panels/child/tests | solar:widget-5-bold |
| من | /panels/child/profile | solar:user-rounded-bold |

- **چت‌بات** leaves the nav: becomes a prominent hero CTA on Home («با من حرف بزن») + a
  floating action button on the child pages (not on `/assistant` or `/enter`), still
  reachable at `/panels/child/assistant`.
- **نتایج** leaves the nav: becomes a section/preview on Home + a row inside Profile.
- **آزمون** keeps its page; label changes to «فعالیت‌ها» conceptually but route unchanged.

## 2. Home composition (new order)

1. **Greeting header** — avatar + name + variant-appropriate greeting (existing `ChildHero` data, simplified).
2. **Hero / current state** — remaining attempts bar + completed count (existing hero math preserved), richer illustration.
3. **Primary action** — the most relevant next action: continue first available test → else open first active goal → else open assistant. One dominant CTA only.
4. **Chatbot CTA strip** — «با من حرف بزن» card (kid playful / teen minimal).
5. **Today's progress** — two compact stats (tests done, goals in progress).
6. **My journey** — current goals preview (first 2, real data from goalAward), «همه» link.
7. **Upcoming activity** — available exams preview (first 3, existing `ChildExamCard`).
8. **Achievements** — completed tests count + recent result (real from `useTest`), empty-state aware.
9. **Discovery strip** — horizontal scroll of suggestion chips/links to settings personalization.

Sections with zero data collapse into a single designed empty state, never fake cards.

## 3. Feature grouping

| Feature | New location |
|---|---|
| Home | /panels/child |
| Goals (journey) | /panels/child/goals + /goals/[id] (kept, redesigned) |
| Exams | /panels/child/tests + /tests/[assetId] (kept, redesigned) |
| Results | Home preview + /results (route kept, reachable from Profile) |
| Assistant | hero CTA + FAB + /assistant (kept) |
| Profile | /profile (redesigned: identity + settings + results + sign out) |
| Settings | /settings (redesigned personalization) |

## 4. Child vs Teen

One component system; personality via variant class. Kid: sun/berry/mint, rounded-3xl,
larger type, playful icons, more illustration. Teen: violet/teal, rounded-xl, tighter,
editorial, abstract illustration, subtler motion. Motion: kid gentle bounce on press;
teen opacity/translate only. Both: same layout structure, same spacing scale.

## 5. Motion

GSAP (just installed) used ONLY for: hero entrance stagger, goal progress bar fill,
step completion pulse, exam completion celebration (kid: soft scale pop; teen: fade+rise).
All guarded by `prefers-reduced-motion` and `html[data-motion="reduced"]` (existing tokens).
No looping GSAP timelines. CSS keyframes remain for ambient float.

## 6. States

Loading: variant-appropriate skeletons (existing `USkeleton`, h matched to new layout).
Empty: `UiStateMessage` with variant icon + explanation + CTA where useful.
Error: `UAlert` soft error + retry (existing pattern preserved).

## 7. Preserved

- All routes, middleware, stores, API contracts, cookie behavior.
- `ChildExamCard`, `ChildExamIntro`, `ChildEnterCode`, `ChildParentScopedNote` public props.
- `useChildPanel`, `useGoalAward`, `useChildBot`, `useTest`, `useSettings` APIs.
- `data-child-theme` / `data-child-ui-size` html attrs; theme swatches still apply.
- Exam hand-off `/test/active/exam?examId=…&scope=child`.

## 8. Implementation order

1. main.css: additive tokens (celebration, hero gradients, journey path) + GSAP-safe classes.
2. Nav.vue: 4 tabs.
3. New shared components: `Child/SectionHeader.vue`, `Child/StatChip.vue`, `Child/JourneyPath.vue`, `Child/AssistantFab.vue`, `Child/ResultCard.vue`, `Child/GoalPreview.vue`.
4. index.vue (Home) rebuild.
5. goals.vue + goals/[id].vue journey presentation.
6. tests.vue, tests/[assetId].vue presentation.
7. results.vue, profile.vue, settings.vue.
8. assistant.vue polish.
9. GSAP pass.
10. RTL/responsive verify + typecheck + build.
