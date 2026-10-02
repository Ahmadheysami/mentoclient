<script setup lang="ts">
import {
  GOAL_DOMAINS,
  goalDomainOf,
  type GoalChartPoint,
  type GoalDomain,
} from "~/types/goal";
import { faNumber } from "~/utils/fa";

/**
 * «پوشش دسته‌های هدف» — the hub's ONE hero figure, on the hub's ONE tinted
 * surface, with the hub's ONE prominent action underneath it.
 *
 * ## WHY THIS NUMBER, AND NOT THE AVERAGES
 *
 * `GET /goal/chart` is a `$avg` of `currentScore` per category and the backend
 * **never recomputes it** — so it cannot show movement and nothing here may be
 * called «پیشرفت». The six averages themselves belong to the goals hub, where the
 * reader opened a category on purpose and `Goal/RadarChart.vue` draws them on a
 * common axis; repeating one of them at 48px on a page that shows none of the other
 * six would be a number about ONE category standing in for the whole reader.
 *
 * What the figure below reads is **coverage**: how many of the six goal categories
 * hold at least one goal. That is a real, separate fact and it is safe to derive
 * because `createGoalSchema` validates `currentScore` as 1..10 — so a category
 * holding even one goal cannot average to zero, and the `$avg` is exactly `0` for a
 * category the reader has not touched. `score > 0` therefore means "there is a goal
 * here", which is the same argument `Goal/RadarChart.vue` makes before deciding
 * that six zeros are an empty state rather than a broken figure.
 *
 * ⚠️ **IT IS A COUNT OF CATEGORIES, NOT A COUNT OF GOALS.** Nothing here can say
 * how many goals exist, because the chart carries no such field; a reader with nine
 * goals in one category and a reader with one goal in each of six categories both
 * read «۶ از ۶». The unit beside the figure says «دستهٔ هدف» precisely so that
 * reading is never available.
 *
 * ## WHY THIS SURFACE IS THE MEASURED SKY TINT
 *
 * It was `bg-x-text-title` — a black block, the page's single dark surface — and
 * then a pale blue guess at the reference's lavender. Both were wrong in the same
 * way: they were read off a memory of `docs/design/big-panel-reference.jpg` rather
 * than off the image, and the guess produced a near-grey column. The reference's
 * hue distribution, measured with a 7×7-neighbourhood flatness test so the numbers
 * are card fills and not edge blends, is **78% sky blue, 15.7% lime, 1.9% amber and
 * 0% violet** — so the hero is `x-sky-100`, the reference's own hero fill.
 *
 * `ring-x-sky-200` rather than a shadow: `x-sky-100` on the `#ecf0fb` page is two
 * adjacent steps of one pale ramp, so without an edge the card and the page are the
 * same colour at two lightnesses, and the hairline is what the reference's own card
 * outline does. `rounded-3xl` is the app's, not the reference's.
 *
 * **Every colour on this card was re-measured against `#d4edfc`** rather than
 * carried over from the ink surface, because contrast is a property of the PAIR:
 * the figure `#262626` on `#d4edfc` is 12.5:1 and `#404040` is 8.6:1. `x-text-muted`
 * (`#a1a1a1`) is deliberately NOT used for them — on this pale ground it measures
 * 2.1:1 and fails AA at `text-[11px]`. It is in fact used NOWHERE on this page: both
 * headings that once reached for it were repainted once they were measured, so the
 * muted token survives in the palette without surviving on the screen.
 *
 * The bar's `sky-600` indicator is the one saturated value in the whole composition,
 * and it is the only place it belongs: a measurement has to be visible at a glance
 * or it is decoration, and 78% of the reference's pixels being sky means a sky bar
 * reads as part of the page rather than as an alarm on it.
 *
 * ## FIVE STATES, AND NONE OF THEM IS A ZEROED BAR
 *
 * - `loading` — asked, not answered. A skeleton with the loaded state's FOUR rows in
 *   the loaded order and the loaded box sizes, so the section below does not jump
 *   when the answer lands — see the arithmetic on the skeleton block below.
 * - `unavailable` — `chartUnavailable`, the endpoint's permanent refusal. NO
 *   number and NO bar: a bar at zero beside this message would claim the reader has
 *   no goals, which is not what happened. No retry either, for the reason
 *   `Goal/RadarChart.vue` gives — re-asking cannot succeed.
 * - `error` — one transport failure. The store's own Persian sentence, because
 *   `refusalMessage` is what distinguishes "try again later" from "check your
 *   connection", and re-typing either here would throw that away.
 * - `empty` — answered, and the answer is "no goals yet". A genuinely different
 *   answer from a broken figure, and a useful one: it is the state that invites the
 *   first goal.
 * - `ready` — answered with at least one covered category.
 *
 * The action renders in ALL FIVE of them. It points at a route, not at this figure,
 * so a figure that could not be loaded is not a reason to make the hub's way in
 * unreachable.
 *
 * ## NEVER ON THE FIRST PAINT
 *
 * `getChart()` runs in `onMounted`, so the server render and the client's first
 * paint agree that the answer has not arrived and neither blocks on it. It is
 * warm-cached (`getChart` returns early once `state.chart` is filled), so a
 * reader coming back from `/panels/big/goals` pays no second request.
 */
const props = defineProps<{
  /** Where the card's one action leads: the panel's goals hub. */
  to: string;
}>();

const goalStore = useGoal();

onMounted(async () => {
  // NOT awaited by anything the reader is looking at: this is the panel's front
  // door and the goal figure is one card of it. `getChart` never rejects — every
  // outcome lands in `state.chart`, `state.error.chart` or `state.chartUnavailable`.
  await goalStore.getChart();
});

/**
 * The score of one category, or `0` for a category this payload does not carry.
 *
 * `goalDomainOf` reads the domain back OUT of the server's `_id` rather than
 * comparing a hand-written slug, which is the whole reason it exists: a copied
 * string fails silently, and a silent failure here is a category wrongly counted
 * as empty — a reader told «۵ از ۶» who actually has six.
 */
function scoreOf(domain: GoalDomain, points: GoalChartPoint[]): number {
  const point = points.find((item) => goalDomainOf(item._id) === domain);

  return point ? Number(point.score) || 0 : 0;
}

/** How many of the six categories hold at least one goal. 0..6, never null. */
const covered = computed<number>(() => {
  const chart = goalStore.state.chart;

  if (chart === null) return 0;

  return GOAL_DOMAINS.filter((domain) => scoreOf(domain, chart) > 0).length;
});

/**
 * Which of the four things this card can honestly be showing, in one place.
 *
 * The order matters: `loading` is tested against `chart === null` rather than
 * alone, so a WARM store (the reader arrived here from the goals hub) renders the
 * figure on the first paint instead of flashing a skeleton over an answer that is
 * already in memory.
 */
type SnapshotView = "loading" | "unavailable" | "error" | "empty" | "ready";

const view = computed<SnapshotView>(() => {
  if (goalStore.state.chart === null) {
    if (goalStore.state.loading.chart) return "loading";

    return goalStore.state.chartUnavailable ? "unavailable" : "error";
  }

  return covered.value === 0 ? "empty" : "ready";
});

/**
 * The one sentence the two "no figure" states share.
 *
 * A refusal and a failed request are different conditions, but on THIS card they
 * answer the same question the reader is asking — "is there a number here?" — and
 * the answer is no either way. They are worded identically on purpose; the
 * difference is one a screen reader does not need and the goals hub, where the
 * figure is the whole point, already handles separately.
 *
 * Deliberately says nothing about WHY. The panel home is behind the entitlement
 * gate, so "you have no plan" would be false here, and the store cannot say more
 * than "it did not come".
 */
const NO_FIGURE = "نقطهٔ شروع شما در حال حاضر در دسترس نیست.";

/** What the failed-request state says, preferring the store's own wording. */
const failureNote = computed<string>(
  () => goalStore.state.error.chart ?? NO_FIGURE,
);

/** `۳ از ۶` — the figure itself, in Persian digits. */
const figure = computed<string>(
  () => `${faNumber(covered.value)} از ${faNumber(GOAL_DOMAINS.length)}`,
);

/**
 * The sentence under a filled bar.
 *
 * The full six and the partial six are different achievements and get different
 * words: the partial one names the gap, because a gap is the actionable part.
 */
const coverageNote = computed<string>(() => {
  const rest = GOAL_DOMAINS.length - covered.value;

  if (rest === 0) return "هر شش دسته را هدف گذاشته‌اید.";

  return `${faNumber(rest)} دستهٔ دیگر هنوز هدفی ندارد.`;
});

/**
 * The `aria-label` on the `progressbar` itself.
 *
 * `UProgress` defaults this to a Latin-digit percentage ("50%"), which a Persian
 * screen reader would read out as a bare number with no unit and no direction.
 * Saying the fraction in Persian words carries the same information and reads
 * correctly.
 *
 * The parameter is nullable because reka types it that way — it is `modelValue`
 * verbatim — and the card never renders the bar while that value is `null`, so the
 * guard is unreachable at runtime and exists only to satisfy the signature.
 */
function progressLabel(
  value: number | null | undefined,
  max: number,
): string | undefined {
  if (value === null || value === undefined) return undefined;

  return `${faNumber(value)} از ${faNumber(max)} دستهٔ هدف`;
}
</script>

<template>
  <section
    class="reveal rounded-3xl bg-x-sky-100 p-4 ring-1 ring-x-sky-200"
    :aria-busy="view === 'loading'"
  >
    <h2 class="sr-only">پوشش دسته‌های هدف</h2>

    <!--
      The eyebrow: WHAT the number is about, before the number is read. It names the
      SUBJECT; the UNIT the figure is measured in is the separate «دستهٔ هدف» line
      under the figure, and keeping the two apart is what stops a reader taking
      «۶ از ۶» for a score. `text-[11px] leading-5` is the house metadata step, and
      `x-text-subtitle` rather than `x-text-muted` because the muted token measures
      2.1:1 on this ground — see the header.
    -->
    <p class="text-[11px] leading-5 text-x-text-subtitle">
      دسته‌هایی که در آن‌ها هدف ثبت کرده‌اید
    </p>

    <!-- LOADING: FOUR ROWS, IN THE LOADED ORDER, AT THE LOADED BOX SIZES — figure,
         unit, bar, note. The heights are not eyeballed; they are the loaded block's,
         so the two states occupy the same 130px and nothing below moves when the
         answer lands:

           wrapper  `mt-1.5`                            6   ← was `mt-3`, which
           figure   `h-12`                             48       over-shot the figure's
           unit     `mt-1.5 h-5`                    6+20=26     own `mt-1.5` by 6px
           bar      `mt-3 h-1`                      12+ 4=16
           note     `mt-2.5 h-6`                   10+24=34
                                                  -----
                                                    130  = loaded, exactly

         `size="sm"` puts the real bar at `h-1`, so the bar slot is `h-1` here too, and
         `h-5`/`h-6` are `leading-5`/`leading-6` turned into boxes. An earlier version
         was three rows with a taller bar: 102px against 130px, a 28px jump that
         pushed the action pill and the three sections under it down the screen.

         The skeleton fill is `x-sky-200` — one step off the card's own ground, which
         is the only relationship a placeholder fill has to satisfy — and the bar slot
         is `bg-white` for the same reason the loaded track is: on a pale tint the
         white track is the one value that separates from the card. `aria-hidden`
         because the wrapper already carries `aria-busy` and the `sr-only` heading
         above names what is loading. -->
    <div v-if="view === 'loading'" class="mt-1.5" aria-hidden="true">
      <USkeleton class="h-12 w-36 rounded-xl bg-x-sky-200" />
      <USkeleton class="mt-1.5 h-5 w-14 rounded-lg bg-x-sky-200" />
      <USkeleton class="mt-3 h-1 w-full rounded-full bg-white" />
      <USkeleton class="mt-2.5 h-6 w-40 rounded-lg bg-x-sky-200" />
    </div>

    <!-- UNAVAILABLE / ERROR: one sentence and NOTHING else. No bar, no figure. A
         zeroed bar beside either message would say "you have no goals", which is
         the one thing neither state knows. -->
    <p
      v-else-if="view === 'unavailable' || view === 'error'"
      class="mt-3 text-sm leading-7 text-x-text-subtitle"
    >
      {{ view === "unavailable" ? NO_FIGURE : failureNote }}
    </p>

    <!--
      EMPTY and READY share one figure and one bar, because they are the two states
      where the figure is TRUE — «۰ از ۶» is a fact about the reader, not a failure.
      What differs is the sentence under it: the empty state says what to do, the
      filled one says what is left.
    -->
    <template v-else>
      <!--
        `text-5xl` is the reference's hero scale, and it is the ONLY 48px type on
        this page — which is what makes it a hero rather than a heading. `leading-none`
        keeps the Persian descenders off the bar below, `tabular-nums` means the
        figure does not change width when the answer lands, and the ink token is
        what the reference puts on a light page.
      -->
      <p
        class="mt-1.5 font-yekan-extra text-5xl leading-none text-x-text-title tabular-nums"
      >
        {{ figure }}
      </p>

      <p class="mt-1.5 text-[11px] leading-5 text-x-text-subtitle">دستهٔ هدف</p>

      <!--
        `x-sky-600` on a WHITE track. The white track is the one thing this pale card
        could not take for free: `x-sky-200` on `x-sky-100` is two adjacent steps of
        the same ramp and the track disappears. The indicator is named in `:ui` rather
        than left to `color`, because `color` can only be a name registered in
        `app.config.ts` — which is out of this redesign's scope — and the theme's
        value would be the old blue; `x-primary` is therefore the honest name for the
        role and `bg-x-sky-600` is what actually paints it.
      -->
      <UProgress
        :model-value="covered"
        :max="GOAL_DOMAINS.length"
        size="sm"
        color="x-primary"
        :get-value-label="progressLabel"
        class="mt-3"
        :ui="{
          base: 'bg-white',
          indicator: 'bg-x-sky-600 motion-reduce:transition-none',
        }"
      />

      <p class="mt-2.5 text-xs leading-6 text-x-text-subtitle">
        {{ coverageNote }}
      </p>
    </template>

    <!--
      THE ONE PROMOTENT ACTION ON THIS PAGE.

      The reference puts a white pill on its tinted card and a raised FAB in its
      bottom bar; this app may have one primary action, not five, so the FAB's role
      is played by this pill and nowhere else. It is a `<NuxtLink>` and not a
      `disabled` button in any state above, because a route is reachable whether or
      not the figure beside it could be read.

      `min-h-11` is 44px. `shadow-xs` is the only lift on the whole card, which is
      what makes the pill the thing the thumb is meant to find — against the
      `sky-100` ground a white pill is the brightest thing by a wide margin, and
      because nothing else on the card is raised it does not have to compete with a
      second cue. `font-yekan-bold` rather than `font-bold`, because the weight alone
      would fake-bold a family that ships its own bold face. The focus ring is the
      indigo one this page uses everywhere, for the reason `Panel/FeatureCard.vue`
      gives: a ring in the same blue as the ground it is drawn over is the one thing
      on screen that cannot say where you are.
    -->
    <NuxtLink
      :to="props.to"
      class="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 font-yekan-bold text-xs text-x-text-title shadow-xs transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-secondary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span>دیدن هدف‌ها</span>
      <UIcon name="solar:alt-arrow-left-linear" size="16" aria-hidden="true" />
    </NuxtLink>
  </section>
</template>