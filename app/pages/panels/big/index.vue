<script setup lang="ts">
/**
 * The hub of the adult panel: who the reader is, the one number their own work
 * has produced, the panel's four destinations, what is being built next, and the
 * plan that governs all of it.
 *
 * ## THE PANEL HAS NO BOTTOM BAR, AND THIS PAGE IS WHY THAT IS NOT A BUG
 *
 * `app/layouts/panel.vue` documents it: no `AppBottomBar` here, because all four
 * of its items lead outside the paid panel and it would cover the bottom of the
 * viewport. What the reference mockup solves with a floating dark nav and a raised
 * centre FAB, this page therefore has to solve **as page content** — which is why
 * the navigation is the middle of the screen rather than a fixed strip at the
 * bottom of it. Nothing here is chrome, nothing is `position: fixed`, and nothing
 * is added to the layout.
 *
 * ## THE HIERARCHY, IN ONE SENTENCE
 *
 * Ink on a pale page, one hero figure, one prominent action, then the four
 * destinations, then the roadmap, then administration. That is the reference's
 * structure and it is the only part of the reference that was copied; everything
 * below the level of "what comes first" is the app's own components and the app's
 * own measured palette.
 *
 * ## WHAT THE REFERENCE CONTRIBUTED, AND WHAT IT COULD NOT
 *
 * | reference | here | why |
 * | --- | --- | --- |
 * | avatar, name, context, bell with a dot | `Panel/HomeIdentity.vue` | a panel's title bar is shared by every screen, so the welcome is this page's alone |
 * | the huge figure, dark ink on the page | `Panel/GoalSnapshotCard.vue` on `bg-x-sky-100` | the reader's own work, and the only number on the page |
 * | the white pill on its tinted card | the hero's own action | one primary action per screen, not five; the nav's role is played by the features grid in the middle of the page |
 * | «Watchlist» + a horizontal card rail | `Panel/FeatureCard.vue` × 4 in a 2-column grid | the panel's four real destinations — and a rail was the wrong container for four of them, see below |
 * | the tinted stat card: number, bar, legend | **dropped** | the six per-category averages are the goals hub's own subject; printing them here gave two sections competing over one number and one third of a screen |
 * | the search button | **dropped** | this app has no search to open |
 * | the profile-switcher chevron | **dropped** | see `Panel/HomeIdentity.vue`: there is no switcher, and `/me` is a form in settings |
 * | the coin symbols, the price and change columns | **dropped** | there are no prices here to quote |
 * | the floating bottom nav and its centre FAB | the hero's one white pill | see the row above |
 * | the small amber status dots | the «به‌زودی» badge | amber is a status in the reference, so it is one here too — never a surface |
 *
 * ### WHY THE FEATURES ARE A GRID AND NOT A RAIL
 *
 * They were a native snap scroller, and every part of that was plumbing: `snap-x
 * snap-mandatory`, `[overscroll-behavior-x:contain]`, a `-mx-2 … px-2` bleed and a
 * `me-auto` filler to hold the track at the inline-start in RTL. All of it is gone,
 * because the thing it existed for does not exist: **four** cards, and a rail is
 * the right answer to "there are more of these than fit" — at four, a rail hides
 * two of the panel's only four destinations behind a gesture, and on the way down
 * the page the reader cannot tell that anything is off-screen. A `grid-cols-2` shows
 * all four at once, costs no horizontal scroll at all, and removes four classes
 * that could each have been wrong.
 *
 * ## THE PALETTE IS MEASURED, NOT EYEBALLED
 *
 * Every surface on this page comes from the `--color-x-sky-*` / `--color-x-lime-*`
 * / `--color-x-mist-*` / `--color-x-gold-*` tokens added to `main.css`, which were
 * measured out of `docs/design/big-panel-reference.jpg` with a flatness test — 78%
 * sky blue, 15.7% lime, 1.9% amber, **0% violet**. The previous pass of this page
 * guessed lavender from memory and produced a dead near-grey column; that guess is
 * what the measurement exists to prevent, and nothing here may reintroduce it as a
 * surface. Text stays on the ink scale (`x-text-title` / `x-text-subtitle` /
 * `x-primary-content-700` for the one chevron that sits on a tinted card, which is a
 * step toward ink rather than a hue). `x-text-muted` appears nowhere on this page: it
 * measured 2.1–2.3:1 on both of the grounds here and lost every argument. The only
 * new text colour in the whole page is `gold-700` on the
 * `gold-200` badge, and the existing indigo survives here only as the colour of a
 * focus ring — a violet ring on a blue card is the one thing on screen that is not
 * one of its own surfaces.
 *
 * ## `definePageMeta` IS REPEATED ANYWAY
 *
 * It is repeated here even though `/panels/big.vue` already declares the `layout`
 * and Nuxt would inherit it. Inheritance works, and it is still the wrong default
 * for a gated surface: the seven panel pages under this route are written at
 * different times, possibly by different people, and a page that omits the key
 * would render the panel chrome with NO gate — reachable by direct URL, with the
 * layout and the header and no check. Putting all four keys in one block on every
 * page means the thing being remembered is the whole decision.
 *
 * `auth` before `panel-plan`: a plan check for a signed-out reader is a request
 * nobody can answer, and `panel-plan` is idempotent with `auth` precisely so the
 * order cannot be the thing that breaks.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "پنل بزرگسالان",
});

useSeoMeta({
  title: "پنل بزرگسالان",
});

/**
 * The panel's four destinations, in reading order.
 *
 * A literal list in the page rather than a fetched catalogue: the panel's contents
 * are what this app ships, not what the server returns this minute, so there is
 * nothing to load, nothing to fail, and no empty state to design. A route that does
 * not exist yet is a later unit's page, not a broken card — so every `to` below is
 * a file under `app/pages/panels/big/`.
 *
 * **No figure is carried on any of them.** The reference's watchlist cards print a
 * price and a change per row, and the obvious translation is a per-feature count —
 * goals made, tests taken, reports read. None of those numbers exist on this page:
 * the goal counts live in `GET /goal?category=…` buckets that only the goals hub
 * fetches (six requests, and a tile that says «۰ هدف» before its bucket has answered
 * would be a claim about the reader), and the astrology status would have to be read
 * by the destination page that owns it — and `status === "unknown"` may not be
 * rendered as "not started" in any case. So a card with no number is not an
 * unfinished card; it is the only honest shape.
 */
const destinations: {
  to: string;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    to: "/panels/big/astrology",
    icon: "solar:magic-stick-3-linear",
    title: "چارت تولد",
    description: "اثر انگشت منحصر بفرد کیهانی (آسترولوژی)",
  },
  {
    to: "/panels/big/goals",
    icon: "solar:target-linear",
    title: "هدف‌گذاری",
    description: "تعیین هدف و پیگیری قدم‌به‌قدم آن.",
  },
  {
    to: "/panels/big/tests",
    icon: "solar:clipboard-list-linear",
    title: "آزمون های من",
    description: "آزمون‌های فعال و نتیجه‌های ثبت‌شدهٔ شما.",
  },
  {
    to: "/panels/big/assistant",
    icon: "solar:user-speak-rounded-linear",
    title: "دستیار هوش مصنوعی",
    description: "گفت‌وگو با دستیار هوش مصنوعی این پنل.",
  },
];

/**
 * What this panel will have and does not have yet — the roadmap.
 *
 * **`name` IS PASSED THROUGH VERBATIM, AND THAT IS A CONTRACT ABOUT THE CARD, NOT
 * ABOUT TODAY'S DATA.** `Panel/ComingSoonCard` wraps it in a `<bdi>` and prints it
 * as given, because the moment a name here IS a Latin product name, translating or
 * rewording it would be a mis-spelling rather than localisation. **All five values
 * below are Persian and are owned by this page** — today they are feature names, not
 * brand names, and this comment must not be read as a list of them: a previous draft
 * of it enumerated five Latin brand names that appear nowhere in the repo, which is a
 * trap for whoever next "corrects" the data to match the prose. The `<bdi>` is what
 * keeps today's values free of that decision. The `description` beside each one is
 * likewise the sentence this app owns and is free to write.
 *
 * There is no `to` on any of these, deliberately: `Panel/ComingSoonCard` has no
 * link to point at, so nothing here can be mistaken for a destination — not by a
 * finger, not by a keyboard, and not by the router. All five are also ABSENT from
 * `destinations` above, which is what makes the roadmap true: a row here is
 * something the reader cannot open today.
 */
const upcoming: {
  icon: string;
  name: string;
  description: string;
}[] = [
  {
    icon: "solar:magnifer-linear",
    name: "تحلیل حساب من",
    description: "تحلیل تخصصی حساب کاربری با هوش مصنوعی",
  },
  {
    icon: "solar:users-group-rounded-linear",
    name: "مشاورین من",
    description: "مشاوره تخصصی انسانی و هوش مصنوعی",
  },
  {
    icon: "solar:users-group-two-rounded-linear",
    name: "تطبیق حساب کاربری",
    description: "همسان سازی حساب کاربری با شخص مورد نظر",
  },
  {
    icon: "solar:notebook-linear",
    name: "آزمون های هوشمند",
    description: "آزمون‌های هوشمند و تطبیقی",
  },
  {
    icon: "solar:gamepad-linear",
    name: "سرگرمی ها",
    description: "سرگرمی های مناسب با الگوی رفتاری شما",
  },
];

/**
 * The two surfaces the features grid cycles through, in order.
 *
 * **A CHECKERBOARD, AND THE CYCLE LIVES HERE.** The guarantee is about this list,
 * not about the card: four identical cards read as a table rather than as a set of
 * destinations, and the same tint twice in a row reads as a mistake rather than as a
 * choice. `Panel/FeatureCard.vue` knows its own `tone` and nothing about its
 * position, so a card that counted for itself would repaint whenever this list was
 * reordered — the guarantee has to live beside the list or it does not exist.
 *
 * The two hues are the reference's own measured pair (78% sky, 15.7% lime) and they
 * alternate, so the four cards carry the page's colour weight instead of one hue
 * doing all the work.
 *
 * ⚠️ **THE PARITY IS NOT `index % 2` — THAT PAINTS COLUMNS, NOT A CHECKERBOARD.**
 * In a two-column grid `index % 2` gives `sky|lime / sky|lime`: two monochrome
 * columns and a visible vertical seam down the page, which is the one thing a
 * checkerboard exists to avoid. A checkerboard has to flip on BOTH axes, so the row
 * has to be folded into the parity as well — see `toneOf` below. The parity is still
 * computed rather than written down as a four-entry cycle: with an even length the
 * two rules are the same rule, and a computed one cannot drift out of step with the
 * number of cards.
 *
 * `mist` is a member of the card's tone union but is deliberately NOT in this
 * cycle, and ⚠️ **NOTHING ON THIS PAGE PAINTS IT ANY MORE.** It used to be cited as
 * evidence: the roadmap's chips were `bg-x-mist-100` and this comment called them
 * context-not-destination. Those chips are `bg-x-sky-100` now, because `mist-100`
 * measures 1.12:1 on a white card — no edge at all — so the argument it was enlisted
 * in no longer holds, and the plan card's tiles were white with a hairline rather
 * than mist to begin with. Context on this page is carried by being WHITE with a
 * `sky-300` outline, not by a neutral fill; the four cards above are the only four
 * things a reader is invited to tap, and they are the only four that carry a fill of
 * their own. `mist` stays in the union so a future caller that does want a neutral
 * surface for context gets a real one instead of an undefined class, which is what
 * `Panel/FeatureCard.vue` says about it.
 */
const FEATURE_TONES = ["sky", "lime"] as const;

type FeatureTone = (typeof FEATURE_TONES)[number];

/**
 * The tint for the card at `index` — the page's one real invariant.
 *
 * `(index + Math.floor(index / 2)) % length` is the flip on BOTH axes. In a
 * two-column grid, `Math.floor(index / 2)` is the row, so adding it to the index and
 * then taking the parity is exactly "alternate along each row, and alternate again
 * between rows":
 *
 *     index   0     1     2     3     4     5
 *     row     0     0     1     1     2     2
 *     parity  0     1     1     0     0     1     → sky lime lime sky sky lime
 *
 * So the four cards read `sky|lime / lime|sky` — a checkerboard, with like tints
 * sitting on the DIAGONAL. ⚠️ **Plain `index % 2` is wrong here** and was the bug
 * this function carried from the spec through the first implementation: it yields
 * `sky|lime / sky|lime`, i.e. two monochrome columns.
 *
 * The clearest way to tell the two rules apart is indices 1 and 2. They are
 * consecutive in the array, but in the grid index 1 is (row 0, col 1) and index 2 is
 * (row 1, col 0) — they sit on the DIAGONAL, not on a shared row. So they must be the
 * SAME colour, and this parity gives them that: `toneOf(1) === toneOf(2) === "lime"`.
 * `index % 2` cannot express it, because it has no idea a row boundary passed between
 * them — it yields `"sky"` at index 2, the opposite. ⚠️ The rule is therefore about
 * neighbours IN LAYOUT, not about consecutive indices — read it the array way and it
 * looks wrong.
 * Any future grid whose column count is not 2 has to re-derive the parity.
 *
 * `?? "sky"` rather than a non-null assertion: with `noUncheckedIndexedAccess` the
 * modulo is `FeatureTone | undefined`, and a total function that cannot return
 * `undefined` is the honest version of the same idea — the fallback is a real member
 * of the union, so no caller can receive a value the prop does not accept.
 *
 * ⚠️ **DO NOT REPLACE THIS WITH A `tone` FIELD ON EACH ENTRY.** A hand-written
 * `tone` per card has twice now been written into this file by something other than
 * the author who wrote this function, and reverted twice: it compiles, it renders,
 * and it is indistinguishable in review at a glance — while making the one guarantee
 * this page has something a later edit breaks silently. `FeatureTone` accepts either
 * value at any index, so adding a fifth destination, or reordering the list, puts two
 * of the same tint side by side and TypeScript has nothing to say about it. Note that
 * `.nuxt/tsconfig.app.json` sets `strict` but NOT `noUnusedLocals`, so deleting this
 * function while keeping its callers' replacement also passes `vue-tsc` — the typecheck
 * cannot be the thing that catches the regression. The tints are computed rather than
 * written down so that "the same tint twice in a row" is UNREPRESENTABLE, not merely
 * absent.
 *
 * ⚠️ **AND NOTE THAT A HAND-WRITTEN SEQUENCE IS NOT EVEN TRUSTWORTHY AS AN EXAMPLE.**
 * The version that was in this file most recently read `sky, lime, lime, sky`, which
 * happens to be the correct checkerboard — and it still violated the rule that the
 * mechanism exists to enforce, purely by being hand-maintained.
 */
function toneOf(index: number): FeatureTone {
  const parity = (index + Math.floor(index / 2)) % FEATURE_TONES.length;
  return FEATURE_TONES[parity] ?? "sky";
}
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      1. THE REFERENCE'S TOP BAR, rebuilt in the page. `App/PanelHeader.vue` is not
      touched and stays the page's `<h1>`; this row carries no heading of its own for
      exactly that reason, and `<AppPanelHeader>` above it is the document's banner.
    -->
    <PanelHomeIdentity />

    <!--
      2. THE HERO. The one figure about the reader's own work, on the page's one
      tinted surface, with the page's one prominent action under it. It fetches on
      mount and therefore never delays the paint of anything above it.

      `mt-5` rather than the section rhythm's `mt-8` because the identity row above
      is not a section — it is the page saying who is standing here — and a hero
      20px below a name belongs to the name, while one 32px below it belongs to
      itself.
    -->
    <PanelGoalSnapshotCard class="mt-5" to="/panels/big/goals" />

    <!--
      3. THE FEATURES — the reference's watchlist, and the replacement this panel's
      missing bottom bar is made of.

      A `<ul>` of four links in a `grid-cols-2`: two rows, nothing hidden behind a
      gesture, and no second scroller on a page whose layout already has one. The
      `-mx-2 … px-2` bleed, the `snap-x` track and the `me-auto` filler that used to
      hold the rail at its inline start in RTL are all gone with the rail — a grid
      has no inline start to correct.

      NO «همه» BESIDE THIS HEADING: the full list of what this panel offers IS this
      page, so there is nothing for a "see all" to open. That is the same reason
      `Panel/ComingSoonCard` refuses to be a link — an affordance with nothing behind
      it is worse than no affordance.

      The heading is `x-text-title`, and so is the roadmap's below: one heading style
      for every section on the page. `x-text-muted` is the only token that was ever
      available for "quieter", and it measures 2.27:1 on the `#ecf0fb` page — which is
      why neither heading reaches for it. Subordination is carried by the surfaces
      instead, which is where a reader actually reads it.
    -->
    <section aria-labelledby="panel-big-destinations" class="mt-8">
      <h2
        id="panel-big-destinations"
        class="text-sm font-yekan-bold text-x-text-title"
      >
        امکانات در دسترس
      </h2>

      <ul class="mt-3 grid grid-cols-2 gap-3">
        <li
          v-for="(destination, index) in destinations"
          :key="destination.to"
          class="reveal-stagger"
          :style="{ animationDelay: `${Math.min(index, 3) * 50}ms` }"
        >
          <PanelFeatureCard
            :to="destination.to"
            :icon="destination.icon"
            :title="destination.title"
            :description="destination.description"
            :tone="toneOf(index)"
          />
        </li>
      </ul>
    </section>

    <!--
      4. THE ROADMAP. Introduced by one plain sentence rather than an apology — the
      reference's own `data-driven insights` eyebrow is the model, one line, no
      heading weight, saying what the list below is for. A reader is told what is
      coming, in the same weight of type as everything else, and each row carries its
      own «به‌زودی» badge.

      ONE GROUPED CARD, FIVE ROWS. Five cards with five outlines were five boxes
      fighting the four feature cards above for attention, on the least actionable
      thing on the page. One `rounded-3xl bg-white` container with `divide-y` hairline
      rows says "this is one list" instead, and `Panel/ComingSoonCard` becomes a row
      inside it.

      ⚠️ It IS SUBORDINATE, BUT NOT THROUGH THE HEADING. This heading was
      `x-text-muted`, on the reasoning that it is the one section a reader may skip.
      That token measures 2.27:1 on the `#ecf0fb` page ground, so the intent was
      bought with a failing contrast ratio — which is not a design device, it is a
      legibility bug wearing a design device's clothes. It is `x-text-title` now, the
      same as every other section, and the section still reads as the optional one
      because it sits last, behind a white grouped card that is quieter than the
      tinted hero and the tinted grid above it, and behind a sentence that says
      plainly that nothing here can be opened yet. Hierarchy belongs to the surfaces
      and the order, not to the type colour.

      Nothing inside it looks pressable, because nothing inside it can: see that
      component's header for the rules it exists to hold.

      It sits ABOVE the plan card, not below it: the plan says what the reader has
      bought, which is administration, and the road below it is the only part of this
      page that is still being written. Putting the un-actionable list above the
      administrative one lets the page end on something that is settled.
    -->
    <section aria-labelledby="panel-big-upcoming" class="mt-8">
      <h2
        id="panel-big-upcoming"
        class="text-sm font-yekan-bold text-x-text-title"
      >
        به‌زودی
      </h2>

      <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
        این قابلیت‌ها در حال ساخت‌اند و به‌زودی در همین پنل در دسترس قرار می‌گیرند.
      </p>

      <!--
        `py-1` on the list rather than `first:pt-0 last:pb-0` on the rows: the
        dividers belong to the LIST, so they must not be inside the padding that
        creates them, and one constant on one element is easier to keep true than
        two variants spread over five rows.

        `divide-y` draws a border on every child but the first and is logical, so it
        needs no `start`/`end` correction in this RTL column.

        The hairline steps the measured neutral UP rather than staying on it, because
        `#ecf1f3` on white is 1.14:1 — the same "no edge at all" that made the badge
        need its own ring. The two roles take different strengths deliberately: a rule
        between rows only has to separate one row from the next, so it takes `sky-200`
        (1.26:1), while the outline has to read as a container, so it takes `sky-300`
        (1.43:1).

        ⚠️ **THE PLAN CARD BELOW OUTLINES IN `sky-300` AS WELL, AND THAT IS THE
        POINT.** It used to draw its own `ring-x-primary-100` (1.41:1), so the two
        white cards on this screen carried different hairlines — a seam a reader sees
        as a change of card and cannot account for. It now rings in `sky-300` like
        this container does, which is not a coincidence of tokens: the step is chosen
        by the ROLE, and both of these are containers rather than rules. A rule
        between two rows only has to separate one row from the next, so it takes
        `sky-200` as above; an outline has to read as a container, so it takes
        `sky-300` — on this card and on every tile of the plan card below, which is
        why they can now be changed together and must be. See each component's header
        for the same rule read by size: those tiles keep `shadow-xs` and this card
        does not, because a container its own size is already lifted by its ring.
      -->
      <ul
        class="mt-3 divide-y divide-x-sky-200 rounded-3xl bg-white px-3.5 py-1 ring-1 ring-x-sky-300"
      >
        <li
          v-for="(feature, index) in upcoming"
          :key="feature.name"
          class="reveal-stagger"
          :style="{ animationDelay: `${Math.min(index, 5) * 50}ms` }"
        >
          <PanelComingSoonCard
            :icon="feature.icon"
            :name="feature.name"
            :description="feature.description"
          />
        </li>
      </ul>
    </section>

    <!--
      5. THE PLAN, last — with the reader's two facts withheld (`show-reader="false"`),
      because `Panel/HomeIdentity.vue` printed the name and the age a few hundred
      pixels above and two cards saying «علی رضایی» on one screen is duplication
      rather than emphasis. What is left is the two facts this page cannot say
      anywhere else: which plan governs this panel, and when it runs out.

      ⚠️ **A NAMED LANDMARK, AND NO HEADING OF OUR OWN.**
      The card exposes no `id` for `aria-labelledby` to point at: its headings are an
      `<h2>` and an `<h3>` and nothing on it carries an identifier, so this wrapper
      cannot borrow the card's own heading however the card happens to be painted.
      (It has since been edited — chips, rings, skeleton fills — and the identifiers
      are still absent on purpose: they belong to a documented public contract and not
      to a palette, and adding one would reach into that contract to save a wrapper.)
      The card already prints its OWN `sr-only` `<h2>` — «اطلاعات پنل» — beside its
      visible `<h3>` when `show-reader="false"`. An earlier version of this wrapper added a
      third heading with those same words to reach the card, which put «اطلاعات پنل»
      into the heading list twice: invisible twice, but a heading navigation list does
      not care whether a heading is visible. So the wrapper names itself with
      `aria-label` instead — a landmark announced once, and the card's headings left
      to the card. A VISIBLE «اطلاعات پنل» above it would be worse still, putting the
      word twice on one screen.
    -->
    <section aria-label="اطلاعات پنل" class="mt-8">
      <AppUserPlanInfoCard panel="big" :show-reader="false" />
    </section>
  </div>
</template>
