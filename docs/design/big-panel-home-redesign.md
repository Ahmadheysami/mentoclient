# Big Panel Home — Redesign Specification

Status: approved design intent, to be implemented.
Scope: `app/pages/panels/big/index.vue`, the `app/components/Panel/*` components it owns,
and one **additive** token block in `app/assets/css/main.css`.

---

## 1. Scope facts (verified — do not re-litigate)

`grep 'PanelHomeIdentity|PanelGoalSnapshotCard|PanelFeatureCard|PanelComingSoonCard|PanelDomainScoreCard|AppUserPlanInfoCard'`
matches in **exactly one file**: `app/pages/panels/big/index.vue`.

- Every `Panel/*` component is private to this page and may be redesigned freely.
- `App/UserPlanInfoCard.vue` has no other caller, but it lives in `App/`, carries a documented
  public `showReader` contract, and is outside the redesign brief. **Do not modify it.**

Layout: `app/layouts/panel.vue` is `max-w-md` (448px) centred, `h-dvh`, one scroller, no bottom
bar, `bg-x-primary-content-100` = `#ecf0fb`, `dir="rtl"`. Design target is a **~416px column**.

`definePageMeta` (`layout: "panel"`, `middleware: ["auth","panel-plan"]`, `panel: "big"`,
`panelTitle: "پنل بزرگسالان"`) must stay byte-identical.

Baseline `npx vue-tsc --noEmit -p tsconfig.json` is **clean**; it must stay clean.

---

## 2. Palette — extracted from the reference image, not eyeballed

The first pass of this spec guessed lavender/purple from memory and produced a dead, near-grey
page. **That was wrong, and the reviewer rejected it.** The palette below was measured from
`docs/design/big-panel-reference.jpg` (2048×1536) with a 7×7-neighbourhood flatness test, so
these are true card fills rather than edge blends.

Measured hue distribution of non-neutral pixels:

| hue | share |
| --- | --- |
| **cyan / sky blue** | **78.0 %** |
| **lime / sage** | **15.7 %** |
| amber | 1.9 % |
| blue | 1.9 % |
| green, orange, red | 2.0 % |
| indigo | 0.2 % |
| **violet / purple** | **0.0 %** |

So the reference is **sky blue + lime on warm/cool neutrals, with amber as a status accent**.
There is no purple in it at all. Do not reintroduce purple as a surface.

### 2.1 Tokens to add

Append inside the existing `@theme { … }` block in `app/assets/css/main.css` (it currently
spans lines 6–82). **Additive only** — new `--color-x-*` names, no redefinition of any
existing token, so no other page changes visually.

```css
/* ---- Big Panel home palette, measured from docs/design/big-panel-reference.jpg ---- */
/* Hue mix of that image: 78% sky blue, 15.7% lime, 1.9% amber, 0% violet. The lavender
   this page used before was a memory-read of the reference and read as grey; these are
   the measured fills. */
--color-x-sky-100:  #d4edfc;
--color-x-sky-200:  #cbeafc;
--color-x-sky-300:  #b3def4;
--color-x-sky-400:  #acdaf6;
--color-x-sky-500:  #98d4f6;
--color-x-sky-600:  #78c8f7;
--color-x-sky-700:  #6dc6f8;

--color-x-lime-100: #eef2dc;
--color-x-lime-200: #dde5c0;
--color-x-lime-300: #cbd9b4;
--color-x-lime-500: #a9bd7e;

--color-x-mist-50:  #f7f7f6;
--color-x-mist-100: #f2f2f1;
--color-x-mist-200: #ecf1f3;
--color-x-mist-300: #e4eef3;

--color-x-gold-200: #fdf0b8;
--color-x-gold-500: #f5d847;
--color-x-gold-700: #8a6a0f;
```

### 2.2 How the tokens are used

- **Fill** — `sky-200` / `lime-200` card surfaces; `sky-600` bars and the primary action;
  `gold-500` the small status dot.
- **Never as text** — `sky-*` above 400 and `lime-*` above 300 are too light for text.
  Text stays on the existing ink scale: `x-text-title` `#262626` (≈ the reference's `#181818`
  dark card), `x-text-subtitle` `#404040`, `x-text-muted` `#a1a1a1`. The only new text
  colour is `gold-700` on a `gold-200` badge.
- No gradients, no saturated fills, `shadow-xs` only, hairline `ring-1` for separation.
  `rounded-3xl` cards, `rounded-2xl` chips, `rounded-full` pills.

### 2.3 Note on the project's "blue and purple" rule

`docs/tasks/Task-4.md` §7 asks for blue and purple as primaries. The measured reference is
blue-dominant with **zero** purple, and `AGENTS.md` ranks user requirement above architecture.
So: blue is the primary (78% of the reference is sky blue, so this is satisfied), lime is the
second surface family, and the existing indigo/violet token survives only for focus rings —
it is not a surface. Do not widen the palette beyond §2.1.

---

## 3. Composition

Four blocks. The goal-domain statistics section from the first draft is **cut** (§4).

### A. Identity — `Panel/HomeIdentity.vue`
Avatar, name, age, one bell button, on the page background. Avatar in a `sky-100` ring, name
`font-yekan-bold text-base`, age `text-xs text-x-text-subtitle`, bell a 44px white circle.
Keep: no chevron, name not a link, `aria-label` carries the unread count in Persian digits,
dot is `aria-hidden`, the `notification.get({ public: "1" })` read and its empty `catch`.

### B. Hero snapshot — `Panel/GoalSnapshotCard.vue`
Replace the black `bg-x-text-title` block with a **measured tint**: `rounded-3xl bg-x-sky-100`,
no shadow, no gradient. Inside, in order: the eyebrow sentence (what the number is), the
figure `font-yekan-extra text-5xl leading-none text-x-text-title tabular-nums`, the unit line
«دستهٔ هدف», the coverage bar (`sky-600` indicator on an `x-white` track), the note sentence,
then **one** primary action — the reference's white pill on a tinted card: `bg-white`, ink
label, `rounded-full`, `min-h-11`, `shadow-xs`, pointing at `/panels/big/goals`. One prominent
action on the page, not five.

All five states keep their current semantics — `loading` (skeleton of the same shape),
`unavailable`, `error`, `empty`, `ready`. A state with no figure shows no bar, never a
zeroed bar. Keep the `onMounted` fetch, the warm-cache early return, and the Persian
`aria-label` on the progressbar (never `UProgress`'s Latin percentage default).

### C. «امکانات در دسترس» — `Panel/FeatureCard.vue`, now a 2-column grid
**The rail is cut.** It becomes `grid grid-cols-2 gap-3`, four cards, two rows. This removes
the snap scroller, its `[overscroll-behavior-x:contain]`, the `-mx-…/px-…` bleed and the
`me-auto` filler — delete them, do not leave them behind.

Tint is a **checkerboard** so the grid reads as one set rather than a table, and the two
hues carry the page's colour weight:

| # | feature | surface |
| --- | --- | --- |
| 0 | طالعه بیاتی | `bg-x-sky-200` |
| 1 | دستیار هوشمند | `bg-x-lime-200` |
| 2 | من و پارتنر | `bg-x-sky-200` |
| 3 | آزمون های هوشمند | `bg-x-lime-200` |

Card: white icon chip 40px, title `font-yekan-bold text-sm`, description `text-xs leading-6
line-clamp-2`, chevron inline-end (`solar:alt-arrow-left-linear`) in `x-text-muted`. Press
feedback only — `active:scale-[0.98]` + `transition-transform` + the `motion-reduce:` pair, and
a `focus-visible` ring. **No `hover:`.**

Keep `FEATURE_TONES` / `toneOf()` in the page, not the card, for the reason its comment gives —
but the tone type becomes the two measured surfaces plus `mist` for the plan/roadmap context,
not the four dead lavenders. Rewrite that comment to describe the checkerboard rule.

### D. Roadmap — `Panel/ComingSoonCard.vue`
Five stacked cards become **one grouped card** holding five compact rows: icon chip, brand
name in a `<bdi>` (brand names are never translated), description, and a `bg-x-gold-200`
`text-x-gold-700` «به‌زودی» badge with a `gold-500` dot — the reference's amber used as a
genuine status. Drop the dashed outline; keep the load-bearing rule the component exists to
enforce: **no link, no button, no `role`, no `tabindex`, no `hover:`, no `active:`.** Nothing
here may look pressable, because nothing here is. Keep `line-clamp-2` and the `<bdi>`.

Its `<h2>` stays `x-text-muted` — the only muted heading on the page.

### E. Plan — `App/UserPlanInfoCard.vue`, untouched
Keep `panel="big" :show-reader="false"`, wrapped in a `<section aria-labelledby="panel-big-plan">`
pointing at its own visible heading. Do not add a second heading above it.

---

## 4. Cut: the goal-domain statistics section

The first draft added a six-tile «نقطهٔ شروع در دسته‌های هدف» grid on top of the existing dead
code (`domainScores`, `domainsView`, `domainsNote`, `DOMAIN_SCORE_TONE`, `DOMAIN_BAR_TONE` in the
page, and `Panel/DomainScoreCard.vue`). The reviewer removed it as unnecessary.

So:

- **Do not** add the section.
- **Delete** `domainScores`, `domainsView`, `domainsNote`, `DOMAIN_SCORE_TONE` and
  `DOMAIN_BAR_TONE` from `app/pages/panels/big/index.vue`, and prune the imports they alone
  needed (`GOAL_DOMAINS`, `GoalDomain`, `goalDomainOf`, `DomainScoreCard`).
- **Delete** `app/components/Panel/DomainScoreCard.vue` — it has zero usages after this and was
  only ever used by the removed section.

Do not delete `Goal/RadarChart.vue` or `Goal/CategoryCard.vue`; the goals hub and radar chart
use them.

---

## 5. Typography

House fonts only (`font-yekan-light|regular|bold|extra`), one scale:

| role | classes |
| --- | --- |
| hero figure | `font-yekan-extra text-5xl leading-none` `tabular-nums` |
| section heading | `font-yekan-bold text-sm` |
| card title | `font-yekan-bold text-sm` |
| body / description | `text-xs leading-6` |
| metadata / eyebrow | `text-[11px] leading-5` |

`tabular-nums` on every figure that changes width when its answer lands.

---

## 6. Non-negotiable house rules

- RTL-first: logical utilities only — `ms-* me-* ps-* pe-* start-* end-*`. No `ml/mr/pl/pr`.
- Never `window`/`document`/`localStorage` at setup top level.
- No `any`. Explicit prop and computed types.
- `loading` / `empty` / `error` for every async section; skeletons match the loaded shape.
- No new dependencies. `UProgress`, `USkeleton`, `UBadge`, `UIcon`, `UAvatar` suffice.
- `active:scale` + `motion-reduce:` pair on every pressable; `focus-visible` ring on every link.
- Mobile-first; the column is capped at 448px by the layout.
- Comments in this repo explain *why*. Replace stale design rationale with the new rationale
  rather than deleting comments silently.

## 7. Definition of done

1. `npx vue-tsc --noEmit -p tsconfig.json` → no output.
2. Changes confined to: `app/pages/panels/big/index.vue`, `app/components/Panel/*.vue`,
   `main.css` (additive `@theme` hunk only). Deleted: `Panel/DomainScoreCard.vue`.
3. `App/UserPlanInfoCard.vue`, `app/layouts/panel.vue`, `App/PanelHeader.vue` and every other
   page byte-identical.
4. All five hero states present in the markup; `loading` / `empty` / `error` intact.
5. No rail remnants in the features section.
6. At least three distinct hues visible in the markup: `sky-*`, `lime-*`, `gold-*`.
