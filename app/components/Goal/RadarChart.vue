<script setup lang="ts">
import {
  GOAL_DOMAINS,
  GOAL_DOMAINS_META,
  goalDomainOf,
  type GoalChartPoint,
  type GoalDomain,
} from "~/types/goal";
import { faNumber } from "~/utils/fa";

/**
 * The radar of the reader's six goal categories.
 *
 * **NOT SSR-SAFE, AND NOT IMPORTED.** `apexcharts` reads the DOM while it
 * measures, and `plugins/chart.ts` registers `vue3-apexcharts` globally — so the
 * `<apexchart>` below needs no import and no `defineAsyncComponent`. The price is
 * that this file must be wrapped in `<ClientOnly>` by its parent, with a
 * `USkeleton` as the fallback; this component does not wrap itself, because a
 * `<ClientOnly>` it owned would render a skeleton over its own loading state and
 * report "ready" from inside a tree that is not mounted yet.
 *
 * ⚠️ **`series` IS A PROP AND NOT PART OF `options`.** `vue3-apexcharts@1.11.1`
 * declares `series: { type: Array, required: true }`, and its `init()` builds
 * `newOptions = { chart, series: JSON.parse(JSON.stringify(props.series)) }`
 * and then `extend(props.options, newOptions)` — `newOptions` is the SOURCE, so
 * it OVERWRITES whatever `options.series` held. Passing the data inside `options`
 * alone therefore does not merely look wrong: `props.series` is `undefined`,
 * `JSON.stringify(undefined)` is `undefined`, and `JSON.parse(undefined)` throws
 * `SyntaxError: "undefined" is not valid JSON`. `init()` is `async` and is called
 * from `onMounted` with no `.catch()`, so the throw becomes an unhandled promise
 * rejection, `new ApexCharts(...)` is never reached, `render()` never runs, and the
 * `<div class="vue-apexcharts">` stays empty — with no error anywhere on screen.
 * `:series` is therefore bound from the computed below and `series` is kept OUT
 * of `options`. Do not merge them back.
 *
 * The peer range is `apexcharts >=5.10.0` and the installed `apexcharts` is
 * v6.6.1, but nothing in the v6 surface this chart touches has broken: the
 * wrapper only ever calls `new ApexCharts(el, config).render()`, the radar IS
 * registered in the v6 bundle (`ApexCharts.use({ radar: Radar, … })`), and
 * `chart.height: "100%"` is still resolved by `setSVGDimensions()` as
 * `getDimensions(el.parentNode)[1] * n / 100`, i.e. off the `h-72` box below.
 *
 * ⚠️ **WHERE EACH OPTION MUST LIVE — this is why the figure looked empty.**
 * The radar is drawn by `class Radar` in `apexcharts.esm.js`, and it reads a
 * *different* set of keys from the one a line chart does. Three options were in
 * the wrong place, and each failed silently — the polygon was drawn, with the
 * data in it, and it read as «no data» because it had no edge and grey axes:
 *
 * 1. **`stroke.colors` CANNOT BE A CSS GRADIENT.** It is written straight to the
 *    `stroke` presentation attribute of the figure's `<path>`, and SVG `stroke`
 *    takes a `<paint>` — `none`, a colour, or `url(#id)`. `linear-gradient(…)` is
 *    not a paint, so the browser discards it and the path paints **nothing**.
 *    Measured, with the exact config below: `getAttribute("stroke")` is
 *    `"linear-gradient(to left, #2b7fff, #7c86ff)"` and `getComputedStyle(path)
 *    .stroke` is `"none"`. An 18%-opacity fill with no outline is a smudge, which
 *    is what «shows no data» looks like.
 *
 *    A real gradient IS reachable — apexcharts injects its own `<defs>`, but the
 *    `url(#id)` reference resolves against the DOCUMENT, so a `<linearGradient>`
 *    placed anywhere in the page paints the stroke. It was tried and rejected: it
 *    requires a hand-written `<defs>` injected as a side effect of a Vue
 *    component, which is a large amount of machinery for one path and a figure
 *    that breaks silently if the id is ever duplicated. The panel's own pairing is
 *    used instead — `x-primary-500` edge over an `x-secondary-500` body — which is
 *    the same two hues the gradient was reaching for.
 * 2. **THE GRID IS `plotOptions.radar.polygons`, NOT `grid`.** `Radar.drawPolygons()`
 *    reads `this.polygons.strokeColors` / `.connectorColors` off
 *    `config.plotOptions.radar.polygons`; it never touches `config.grid`. So
 *    `grid.strokeColors: "#dbe3ed"` was read by nothing and the rings stayed at
 *    apexcharts' own default `#e8e8e8` — measured `rgb(232, 232, 232)` with the
 *    old config and `rgb(219, 227, 237)` with the one below. `grid.strokeDashArray`
 *    is likewise unread (Radar reads `config.stroke.dashArray`, which is the
 *    FIGURE's dash, not the rings'), so the dashes were never drawn either —
 *    measured `(unset)` on every ring. They are gone here deliberately: solid
 *    `x-primary-content-300` rings read as a frame, and six dashed rings on a
 *    288px figure turn it into a grid of noise the polygon has to fight.
 * 3. **`xaxis.labels.style.colors` MUST BE AN ARRAY.** The radar's
 *    `drawXAxisTexts()` resolves the label colour as
 *    `Array.isArray(style.colors) && style.colors[i] ? style.colors[i] :
 *    "#a8a8a8"` — a bare string fails the `Array.isArray` test and every label
 *    falls back to a hardcoded grey. Measured `rgb(168, 168, 168)` with the old
 *    string, `rgb(91, 114, 140)` with the array below.
 *
 * Every option below is therefore placed where `class Radar` actually looks for
 * it, and each was verified by measuring the PAINTED result in a real browser
 * rather than by reading the attribute back.
 *
 * ⚠️ **WHAT THESE NUMBERS ARE NOT.** `GET /goal/chart` returns, per domain, the
 * mean of `input.currentScore` — the self-rating the reader wrote **once, at
 * creation**. The backend never recomputes it, so this is NOT progress over
 * time and nothing on this chart can show movement. The caption below says
 * «نقطهٔ شروع» for exactly that reason: a chart that looks like progress and
 * cannot be is the one way this screen could mislead someone.
 *
 * The six categories are read from `GOAL_DOMAINS` in declaration order — the same
 * order `appConfig.panels.modules.goal.list` gives the server, so the axes can
 * never disagree with the enum the API validated `category` against — and a point
 * is matched to its axis by `goalDomainOf` (in `~/types/goal`) rather than by a
 * literal slug.
 */
const props = withDefaults(
  defineProps<{
    points: GoalChartPoint[] | null;
    loading?: boolean;
  }>(),
  { loading: false },
);

/**
 * `0` for a domain the API has no goal in, which is a REAL answer: upstream
 * back-fills every one of the six with `score: 0` so the polygon is complete.
 */
function scoreOf(domain: GoalDomain): number {
  if (props.points === null) return 0;

  const point = props.points.find((item) => goalDomainOf(item._id) === domain);

  return point ? Math.max(0, Math.min(10, Number(point.score) || 0)) : 0;
}

/**
 * The six scores, in `GOAL_DOMAINS` order, clamped to 1..10.
 *
 * Kept as its own computed because `series` below is the only shape that needs it
 * and the empty test and the screen-reader table need it too — deriving all three
 * from one list is what makes «the polygon that is drawn», «the state that says
 * this reader has no goals» and «the numbers a screen reader is given» the same
 * six numbers by construction rather than by coincidence.
 */
const scores = computed<number[]>(() =>
  GOAL_DOMAINS.map((domain) => scoreOf(domain)),
);

/**
 * Six axes, always — including the zeros, because a hole would be a lie.
 *
 * Rebuilt only when `points` changes, so the wrapper's deep watcher on this prop
 * fires once per real answer and not once per render.
 */
const series = computed(() => [
  {
    name: "نقطهٔ شروع",
    data: scores.value,
  },
]);

const labels = computed(() =>
  GOAL_DOMAINS.map((domain) => GOAL_DOMAINS_META[domain].label),
);

/**
 * The five colours this figure is made of, each one a token from
 * `app/assets/css/main.css`'s `@theme` written out as the literal string apexcharts
 * needs. They are constants rather than inline literals because each is used by two
 * options (the polygon's edge and its fill are read in different places, the ring
 * colour is read for both the rings and the spokes), and because a named constant
 * is what makes the pairing checkable: the figure is `x-primary` for its edge and
 * `x-secondary` for its body, which is the panel's own pairing.
 */

/** `x-primary-500` — the polygon's edge, and the only reason it reads as a shape. */
const STROKE = "#2b7fff";

/** `x-secondary-500` — the polygon's body, at 18% over a white card. */
const FILL = "#7c86ff";

/** `x-primary-content-300` — the six rings and the six spokes behind the polygon. */
const RING = "#dbe3ed";

/** `x-text-muted` — the six axis names. */
const AXIS_LABEL = "#5b728c";

/** `x-primary-content-500` — the 0…10 scale along the vertical spoke. */
const SCALE_LABEL = "#9aadc4";

/**
 * Apex options are a plain object, and `vue3-apexcharts` ships no types, so
 * nothing here is checked against an option schema. Every field below is one the
 * radar actually reads, in the place it reads it from — see the header for the
 * three that were not, and for how each was measured.
 */
const options = computed(() => ({
  chart: {
    type: "radar",
    fontFamily: "inherit",
    toolbar: { show: false },
    // Apex animates by default; a 300ms draw on a screen the reader arrives at
    // repeatedly would be the only motion here that carries no information.
    animations: { enabled: false },
    // ⚠️ APEXCHARTS' OWN ACCESSIBILITY LAYER IS TURNED DOWN, ON PURPOSE.
    // With `accessibility.keyboard.{enabled,navigation.enabled}` on — both
    // default `true` — the library labels its `<svg>` `role="application"`,
    // which puts a screen reader into application mode over a figure that has no
    // interactive parts at all: the reader then has to ARROW around six static
    // polygons to reach the numbers that are already in the table below this
    // chart. Turning keyboard navigation off drops the role to plain `img`, so the
    // figure is announced once as an image and the table beneath it is read
    // linearly. `announcements` goes with it for the same reason — the library's
    // live region narrates draw progress this chart does not animate.
    //
    // This is a REPLACEMENT, not a removal: every number the figure shows is in the
    // `sr-only` table in the template, which is the accessible representation, and
    // it is a table because six name/value pairs ARE tabular data.
    accessibility: {
      enabled: true,
      // REPLACES the library's own `aria-label`, and `description` is the key it
      // reads for exactly that: `getAccessibleChartLabel()` returns
      // `accessibility.description` when it is set, before it looks at the title or
      // the series at all. Its default is generated from the SERIES NAME and count —
      // «radar chart with 1 data series: نقطهٔ شروع» — which names nothing a reader
      // can use. This says what the figure is AND what it is not, because the one
      // number it draws is the score the reader wrote at creation and the backend
      // never recomputes it. Verified in a browser: the `<svg>` carries
      // `role="img"` and this exact string as its `aria-label`.
      description:
        "نمودار نقطهٔ شروع شما در شش دستهٔ هدف؛ امتیاز هر دسته همان عددی است که هنگام ثبت هدف نوشته‌اید و بعداً بازمحاسبه نمی‌شود.",
      announcements: { enabled: false },
      keyboard: { enabled: false, navigation: { enabled: false } },
    },
  },
  labels: labels.value,
  yaxis: {
    min: 0,
    max: 10,
    tickAmount: 5,
    // Read as `yaxisConfig.labels.style.colors` in `drawYAxisTexts`, where a bare
    // string IS honoured (unlike the x axis below) — so this one is a plain value.
    labels: { style: { colors: SCALE_LABEL, fontSize: "10px" } },
  },
  // Six spoken scores is noise on a phone; the number lives on each category
  // tile in the hub instead.
  dataLabels: { enabled: false },
  stroke: {
    width: 2,
    // ⚠️ A CSS COLOUR, never a `linear-gradient(…)`. This is written to the SVG
    // `stroke` attribute of the figure's path, and SVG `stroke` takes a `<paint>`
    // — a gradient function is not one, so the browser drops it and the polygon
    // edge paints nothing at all. Verified: with the gradient string the
    // attribute is `"linear-gradient(…)"` and the computed `stroke` is `"none"`.
    colors: [STROKE],
  },
  fill: {
    // `solid` on purpose: a gradient fill at 18% opacity over a white card turns
    // muddy, and now that the edge is visible again the polygon reads from its
    // stroke rather than from its fill.
    type: "solid",
    colors: [FILL],
    opacity: 0.18,
  },
  markers: { size: 4, strokeWidth: 0, colors: [FILL] },
  legend: { show: false },
  tooltip: {
    // Numbers are Persian everywhere else on this app; apex draws its own.
    y: { formatter: (value: number) => `${faNumber(value)} از ۱۰` },
  },
  // ⚠️ THE RADAR'S GRID LIVES HERE, NOT UNDER `grid`. `Radar.drawPolygons()`
  // reads `this.polygons.strokeColors` and `.connectorColors` off
  // `plotOptions.radar.polygons` for the six rings and the six spokes, and never
  // reads `config.grid` — so the old `grid.strokeColors` was inert and the rings
  // stayed at apexcharts' own `#e8e8e8`.
  plotOptions: {
    radar: {
      polygons: { strokeColors: RING, connectorColors: RING },
    },
  },
  xaxis: {
    labels: {
      // ⚠️ AN ARRAY, ONE ENTRY PER AXIS. `Radar.drawXAxisTexts()` resolves the
      // colour as `Array.isArray(style.colors) && style.colors[i] ? … :
      // "#a8a8a8"`, so a bare string fails the test and every label falls back to
      // a hardcoded grey. Six axes, six entries — that is the whole contract.
      style: {
        colors: GOAL_DOMAINS.map(() => AXIS_LABEL),
        fontSize: "11px",
        fontFamily: "inherit",
      },
    },
  },
}));

/**
 * Every domain at zero.
 *
 * `createGoalSchema` validates `currentScore` as 1..10, so a category that holds
 * at least one goal CANNOT average to zero — its `$avg` is at least 1. Six
 * zeroed axes therefore mean exactly one thing: **this reader has no goal in
 * this panel yet.** That is an answer, not a failure, and it is a different
 * answer from a broken figure, so it is rendered as its own state below.
 *
 * Tested over `scores` — the six numbers that will actually be drawn — and not
 * over `props.points`. The two agree whenever the payload is well formed, but the
 * figure is what the reader judges, so «the figure is flat» is the condition that
 * belongs here. A payload whose `_id`s matched no domain would also be flat, and
 * that is a real answer too rather than a figure to draw.
 */
const isEmpty = computed<boolean>(() => scores.value.every((score) => score === 0));

/**
 * Which of the four things the `h-72` box holds, in one place.
 *
 * - `loading` — asked, not answered. A skeleton rather than a zeroed polygon,
 *   because six axes at zero for one frame reads as a score of zero.
 * - `empty`  — answered, and the answer is "no goals yet" (see `isEmpty`).
 * - `chart`  — answered with something to draw.
 * - `none`   — answered, and the answer carried no figure at all (`state.chart`
 *   stayed `null` on a `success: true`, see the store's `getChart`). The PARENT
 *   owns the two REFUSALS — the permanent one with no plan and the transport one
 *   — and it renders RadarChart only when neither is set, so this state has to be
 *   its own: an unhandled branch drew nothing, and a card with a heading over an
 *   empty box says nothing about why. A zeroed polygon here would claim the
 *   reader scored nothing in six categories, which is not what the answer means,
 *   so this says what the answer was. No retry: the request SUCCEEDED, so there
 *   is no failure to repeat — the parent's own `error.chart` state is where a
 *   failed request gets its button.
 */
const view = computed<"loading" | "empty" | "chart" | "none">(() => {
  if (props.loading && props.points === null) return "loading";
  if (props.points === null) return "none";

  return isEmpty.value ? "empty" : "chart";
});
</script>

<template>
  <div>
    <!-- LOADING: the same height as the figure it stands in for, so the hub does
         not jump when the polygon arrives. `aria-busy` is how a screen reader is
         told it is still coming. -->
    <div v-if="view === 'loading'" class="h-72 w-full" aria-busy="true">
      <USkeleton class="size-full rounded-3xl bg-x-primary-50" />
      <span class="sr-only">در حال دریافت نمودار</span>
    </div>

    <!--
      EMPTY. The polygon at six zeros collapses onto the centre of its own grid,
      which looks exactly like a figure that failed to draw — so nothing is drawn
      and the box says what is true instead. The six category names are listed
      because they ARE the six axes, and naming them here is what turns "nothing
      is drawn" into "these six are what will be measured".
    -->
    <div
      v-else-if="view === 'empty'"
      class="flex h-72 flex-col items-center justify-center gap-3 px-2 text-center"
    >
      <span
        class="grid size-14 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
        aria-hidden="true"
      >
        <UIcon name="solar:chart-2-linear" size="28" />
      </span>

      <p class="text-sm font-yekan-bold text-x-text-title">
        هنوز هدفی ثبت نکرده‌اید
      </p>

      <p class="max-w-64 text-xs leading-6 text-x-text-subtitle">
        نمودار از امتیازی ساخته می‌شود که هنگام ثبت هر هدف به همان دسته می‌دهید.
        با ثبت اولین هدف، این شش دسته سنجیده می‌شوند.
      </p>

      <ul class="flex flex-wrap justify-center gap-1.5">
        <li v-for="domain in GOAL_DOMAINS" :key="domain">
          <UBadge
            variant="soft"
            color="neutral"
            size="sm"
            :icon="GOAL_DOMAINS_META[domain].icon"
            :label="GOAL_DOMAINS_META[domain].label"
            :ui="{ base: 'rounded-full text-[11px] font-normal' }"
          />
        </li>
      </ul>
    </div>

    <!--
      CHART. The six scores are in the tooltip, but a tooltip needs a pointer — so
      they are also in a visually-hidden table, which is the only route to them for
      a keyboard or screen-reader user. A figure whose data is reachable only by
      hovering is unreadable without a mouse, and these six numbers are the entire
      point of the screen.

      The wrapper carries no `role="img"`: the figure below is the image, apexcharts
      gives its own `<svg>` an `aria-label` from `chart.accessibility`, and putting
      `img` on a div that CONTAINS that svg and this table would collapse the table
      out of the accessibility tree — the opposite of what it is here for.
    -->
    <div v-else-if="view === 'chart'" class="h-72 w-full">
      <apexchart
        type="radar"
        height="100%"
        :series="series"
        :options="options"
      />

      <table class="sr-only">
        <caption>نقطهٔ شروع شما در شش دستهٔ هدف، از ۱۰</caption>
        <thead>
          <tr>
            <th scope="col">دسته</th>
            <th scope="col">امتیاز</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(label, index) in labels" :key="label">
            <th scope="row">{{ label }}</th>
            <td>{{ faNumber(scores[index] ?? 0) }} از ۱۰</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!--
      ANSWERED WITH NO FIGURE. `h-72`, the same box as every other branch, so the
      six tiles below do not jump. The parent's two refusal states cannot cover
      this one — they are keyed on `chartUnavailable` and `error.chart`, and this
      is neither — and saying so is the whole content of the state.
    -->
    <div
      v-else
      class="flex h-72 flex-col items-center justify-center gap-2.5 px-2 text-center"
    >
      <span
        class="grid size-14 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
        aria-hidden="true"
      >
        <UIcon name="solar:chart-2-linear" size="28" />
      </span>

      <p class="text-sm font-yekan-bold text-x-text-title">
        نموداری برای نمایش وجود ندارد
      </p>

      <p class="max-w-64 text-xs leading-6 text-x-text-subtitle">
        پاسخ سرور شامل نموداری نبود؛ اگر همین‌جا باقی ماند، صفحه را دوباره بارگذاری
        کنید.
      </p>
    </div>

    <!--
      One sentence under the figure, and only under a figure that exists: the
      empty state above already explains itself and the refused states belong to
      the parent, so a caption under either would say it a second time.
    -->
    <p
      v-if="view === 'chart'"
      class="mt-2 px-1 text-center text-xs leading-6 text-x-text-subtitle"
    >
      این نمودار نقطهٔ شروع شماست: امتیازی که هنگام ثبت هدف به هر دسته دادید.
    </p>
  </div>
</template>
