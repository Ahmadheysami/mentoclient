<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * «رادار شکار» — the Talent Radar: a real, interactive radar chart of
 * fictional talent profiles, built on `apexcharts`.
 *
 * ## WHAT THIS PAGE IS, AND WHAT IT IS NOT
 *
 * This is a PREVIEW of a locked feature. Every number on the chart is
 * fictional and hard-coded in this file; no API call is made and no real
 * user data is rendered. The page exists to show the reader what the radar
 * will look like when it ships — a promise of capability, not a working
 * tool. The lock is communicated three ways, all consistent with the rest of
 * the employer panel:
 *
 *   1. A gold «به‌زودی» badge in the header (same token, same ring, same
 *      `font-yekan-bold font-normal` pairing as `ComingSoonCard.vue`).
 *   2. A `UButton` with `:disabled="true"` — visibly greyed, non-operational,
 *      but still a real `<button>` element in the DOM so a screen reader
 *      announces it as disabled rather than absent.
 *   3. A short paragraph stating plainly that the data is illustrative.
 *
 * ## THE CHART IS APEXCHARTS, NOT SVG
 *
 * The old inline demo (`Panel/EmployeeRadar.vue`) drew a decorative SVG
 * polygon with a CSS scan animation — a picture of a radar, not a radar. This
 * page uses a real `apexcharts` radar chart: six axes, a data polygon, hover
 * tooltips that show each score, and a profile selector that morphs the
 * polygon between three fictional candidates. The reader can interact with
 * it — hover or tap any axis to read its value — which is the whole point of
 * a radar chart.
 *
 * The apexcharts integration follows `Goal/RadarChart.vue` exactly. The
 * critical rules, restated here because each one fails silently if broken:
 *
 * - **`series` IS A PROP AND NOT PART OF `options`.** `vue3-apexcharts`
 *   declares `series: { type: Array, required: true }` and its `init()`
 *   overwrites `options.series` with a deep clone of `props.series`. Passing
 *   data inside `options` alone throws `JSON.parse(undefined)` and leaves an
 *   empty `<div>` with no error on screen.
 * - **The grid is `plotOptions.radar.polygons`, NOT `grid`.** `Radar` reads
 *   `strokeColors` / `connectorColors` off `plotOptions.radar.polygons` and
 *   never touches `config.grid`.
 * - **`xaxis.labels.style.colors` MUST BE AN ARRAY.** A bare string fails the
 *   `Array.isArray` test and every label falls back to a hardcoded grey.
 * - **`stroke.colors` CANNOT BE A CSS GRADIENT.** It is written to the SVG
 *   `stroke` attribute, which takes a `<paint>` — a gradient function is not
 *   one, so the browser drops it and the polygon edge paints nothing.
 *
 * ## THE SHADCN/UI-INSPIRED LIGHT THEME IS THE PAGE'S VISUAL IDENTITY
 *
 * This page is part of the employer panel's professional light theme: the card
 * is white with `rounded-xl shadow-sm border border-gray-200` like every
 * other employer card, and the polygon's stroke is the panel's INDIGO accent —
 * the same `#4f46e5` the CTA, the active selector tab and the icon chip use,
 * so the chart reads as part of one product rather than a coloured exception.
 * A radar is a field with a signal on it; the indigo polygon is that signal,
 * and it reads clearly against the white card surface.
 *
 * The tooltip stays LIGHT on purpose. Apexcharts' own dark tooltip would
 * dissolve into the card; a white tooltip with dark text is the one
 * element that must be readable at a glance, and it is.
 *
 * ## ANIMATIONS ARE ENABLED HERE, AND THAT IS A DELIBERATE EXCEPTION
 *
 * `Goal/RadarChart.vue` disables animations because its chart is static — a
 * 300ms draw on a screen the reader arrives at repeatedly would be motion
 * with no information. This chart is the opposite: it CHANGES when the reader
 * switches profiles, and the morph between two polygons is the most
 * informative motion the page has — it shows the reader that these are two
 * different people, not one person with a flicker. The animation is a single
 * 400ms transition on profile switch, not a loop.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "رادار شکار",
});

useSeoMeta({
  title: "رادار شکار",
});

/**
 * The six talent categories the radar measures, in declaration order.
 *
 * The order is the order the axes are drawn in — apexcharts places the first
 * label at the top and proceeds clockwise — so it is also the order the
 * profile scores are listed in. The two lists can never disagree because
 * both are this one array.
 *
 * `as const` so the labels are a readonly tuple: the chart's `labels` option
 * and the `xaxis` colour array are both derived from it, and a readonly
 * source is what makes "the polygon that is drawn" and "the numbers a screen
 * reader is given" the same six strings by construction.
 */
const TALENT_DOMAINS = [
  "روانشناسی سازمانی",
  "مدیریت استرس",
  "هوش هیجانی",
  "ارتباطات",
  "رهبری",
  "خلاقیت",
] as const;

/**
 * One fictional talent profile.
 *
 * `scores` is six numbers, one per `TALENT_DOMAINS` entry, each 1..10.
 * The values are invented and illustrative — they describe no real person.
 */
interface TalentProfile {
  /** The profile's id, used as the selector's value and the key. */
  id: string;
  /** The profile's display name — «پروفایل الف» and so on. */
  label: string;
  /** Six scores in `TALENT_DOMAINS` order, each 1..10. Fictional. */
  scores: number[];
}

/**
 * The three fictional profiles the reader can switch between.
 *
 * Three profiles with clearly different shapes — الف is strong on people
 * skills, ب on management, ج on creativity — so the morph between them is
 * visible at a glance and the selector feels like it is comparing real
 * candidates.
 *
 * ⚠️ ALL DATA IS FICTIONAL. These profiles do not exist.
 */
const FIRST_PROFILE: TalentProfile = { id: "a", label: "پروفایل الف", scores: [8, 6, 7, 9, 5, 7] };

const PROFILES: TalentProfile[] = [
  FIRST_PROFILE,
  { id: "b", label: "پروفایل ب", scores: [5, 8, 6, 7, 9, 8] },
  { id: "c", label: "پروفایل ج", scores: [7, 5, 9, 6, 8, 6] },
];

/**
 * The currently selected profile's id.
 *
 * A plain `ref`, not a store: this is page-local UI state that dies with the
 * navigation and has no meaning on any other screen.
 */
const activeProfileId = ref<string>(FIRST_PROFILE.id);

/**
 * The profile object behind `activeProfileId`.
 *
 * `?? FIRST_PROFILE` rather than a non-null assertion: with
 * `noUncheckedIndexedAccess` the find is `TalentProfile | undefined`, and a
 * total function that cannot return `undefined` is the honest version of the
 * same idea. The `??` branch is unreachable in practice — `activeProfileId`
 * is only ever set to a value from `PROFILES` — but it is the difference
 * between a crash and a fallback on a future edit.
 */
const activeProfile = computed<TalentProfile>(
  () => PROFILES.find((p) => p.id === activeProfileId.value) ?? FIRST_PROFILE,
);

/**
 * The chart's series — one series per the active profile.
 *
 * A computed so the chart re-renders when the selector changes, and bound as
 * the `:series` PROP (never inside `options`) for the reason the file header
 * gives: `vue3-apexcharts` overwrites `options.series` with a clone of
 * `props.series`, so data passed through `options` alone throws and renders
 * nothing.
 */
const series = computed(() => [
  {
    name: activeProfile.value.label,
    data: activeProfile.value.scores,
  },
]);

/**
 * The six axis labels, as a mutable `string[]` for apexcharts.
 *
 * `[...TALENT_DOMAINS]` rather than `TALENT_DOMAINS` directly: the `as const`
 * tuple is `readonly`, and apexcharts' `labels` option is typed `string[]`.
 * Spreading copies the six strings into a fresh mutable array, which is also
 * what the `xaxis` colour array below is derived from.
 */
const labels = computed<string[]>(() => [...TALENT_DOMAINS]);

/**
 * The five colours this figure is made of, each one a token from
 * `app/assets/css/main.css`'s `@theme` written out as the literal string
 * apexcharts needs. They are constants rather than inline literals because
 * each is used by two options (the polygon's edge and its fill are read in
 * different places, the ring colour is read for both the rings and the
 * spokes), and because a named constant is what makes the pairing checkable.
 *
 * ⚠️ **THESE ARE THE EMPLOYER PANEL'S SHADCN/UI-INSPIRED PALETTE — indigo
 * accent, slate surfaces.** Each constant below names the
 * `x-employer-*` token it stands for.
 */

/** `x-employer-accent` — the polygon's edge: the indigo signal the whole employer panel is keyed to. */
const STROKE = "#4f46e5";

/** `x-employer-accent` — the polygon's body, at 18% over the white card. */
const FILL = "#4f46e5";

/** `x-employer-border` — the six rings and spokes, one step off the card so the grid recedes behind the polygon. */
const RING = "#e2e8f0";

/** `x-employer-text-secondary` — the six axis names. */
const AXIS_LABEL = "#64748b";

/** `x-employer-text-muted` — the 0…10 scale along the vertical spoke. */
const SCALE_LABEL = "#94a3b8";

/**
 * Apex options are a plain object, and `vue3-apexcharts` ships no types, so
 * nothing here is checked against an option schema. Every field below is one
 * the radar actually reads, in the place it reads it from — see the header
 * for the three that were not, and for how each was measured.
 */
const options = computed(() => ({
  chart: {
    type: "radar",
    fontFamily: "inherit",
    toolbar: { show: false },
    // ENABLED, unlike `Goal/RadarChart.vue` — see the header for why. The
    // morph between profiles is the most informative motion this page has.
    animations: { enabled: true, speed: 400 },
    // ⚠️ APEXCHARTS' OWN ACCESSIBILITY LAYER IS TURNED DOWN, ON PURPOSE.
    // With `accessibility.keyboard.{enabled,navigation.enabled}` on — both
    // default `true` — the library labels its `<svg>` `role="application"`,
    // which puts a screen reader into application mode over a figure that has
    // no interactive parts at all: the reader then has to ARROW around six
    // static polygons to reach the numbers that are already in the table
    // below this chart. Turning keyboard navigation off drops the role to
    // plain `img`, so the figure is announced once as an image and the table
    // beneath it is read linearly. `announcements` goes with it for the same
    // reason — the library's live region narrates draw progress this chart
    // does not need announced.
    //
    // This is a REPLACEMENT, not a removal: every number the figure shows is
    // in the `sr-only` table in the template, which is the accessible
    // representation, and it is a table because six name/value pairs ARE
    // tabular data.
    accessibility: {
      enabled: true,
      // REPLACES the library's own `aria-label`, and `description` is the key
      // it reads for exactly that. Its default is generated from the SERIES
      // NAME and count — «radar chart with 1 data series: پروفایل الف» —
      // which names nothing a reader can use. This says what the figure is
      // AND what it is not, because the one number it draws is a fictional
      // score and the page must not let a reader mistake it for a real
      // assessment.
      description:
        "نمودار راداری شش دستهٔ استعداد برای یک پروفایل فرضی؛ اعداد نمایشی و واقعی نیستند.",
      announcements: { enabled: false },
      keyboard: { enabled: false, navigation: { enabled: false } },
    },
  },
  labels: labels.value,
  yaxis: {
    min: 0,
    max: 10,
    tickAmount: 5,
    // Read as `yaxisConfig.labels.style.colors` in `drawYAxisTexts`, where a
    // bare string IS honoured (unlike the x axis below) — so this one is a
    // plain value.
    labels: { style: { colors: SCALE_LABEL, fontSize: "10px" } },
  },
  // Six spoken scores is noise on a phone; the number lives in the tooltip on
  // hover and in the `sr-only` table below.
  dataLabels: { enabled: false },
  stroke: {
    width: 2,
    // ⚠️ A CSS COLOUR, never a `linearGradient(…)`. This is written to the
    // SVG `stroke` attribute of the figure's path, and SVG `stroke` takes a
    // `<paint>` — a gradient function is not one, so the browser drops it
    // and the polygon edge paints nothing at all.
    colors: [STROKE],
  },
  fill: {
    // `solid` on purpose: a gradient fill at 18% opacity over a white card
    // turns muddy, and now that the edge is visible again the polygon reads
    // from its stroke rather than from its fill.
    type: "solid",
    colors: [FILL],
    opacity: 0.18,
  },
  markers: { size: 4, strokeWidth: 0, colors: [FILL] },
  legend: { show: false },
  tooltip: {
    // Numbers are Persian everywhere else on this app; apex draws its own.
    // The formatter is the same one `Goal/RadarChart.vue` uses.
    y: { formatter: (value: number) => `${faNumber(value)} از ۱۰` },
  },
  // ⚠️ THE RADAR'S GRID LIVES HERE, NOT UNDER `grid`. `Radar.drawPolygons()`
  // reads `this.polygons.strokeColors` and `.connectorColors` off
  // `plotOptions.radar.polygons` for the six rings and the six spokes, and
  // never reads `config.grid` — so a `grid.strokeColors` would be inert and
  // the rings would stay at apexcharts' own default `#e8e8e8`.
  plotOptions: {
    radar: {
      polygons: { strokeColors: RING, connectorColors: RING },
    },
  },
  xaxis: {
    labels: {
      // ⚠️ AN ARRAY, ONE ENTRY PER AXIS. `Radar.drawXAxisTexts()` resolves
      // the colour as `Array.isArray(style.colors) && style.colors[i] ? … :
      // "#a8a8a8"`, so a bare string fails the test and every label falls
      // back to a hardcoded grey. Six axes, six entries — that is the whole
      // contract.
      style: {
        colors: TALENT_DOMAINS.map(() => AXIS_LABEL),
        fontSize: "11px",
        fontFamily: "inherit",
      },
    },
  },
}));

/**
 * The profile selector's three buttons, derived from `PROFILES`.
 *
 * A computed rather than a second literal list so the selector and the chart
 * can never offer different sets of profiles: both read the same array.
 */
const profileOptions = computed(() =>
  PROFILES.map((profile) => ({
    id: profile.id,
    label: profile.label,
    active: profile.id === activeProfileId.value,
  })),
);
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      THE WHOLE PAGE IS ONE CARD. The radar is the page's visual identity
      and the card's clean white surface is what makes the indigo polygon read
      as a signal, so the card wraps everything — header, selector, chart,
      explanation and CTA — in one surface rather than floating a chart card
      on the page.

      `rounded-xl bg-white p-4 shadow-sm border border-gray-200` is the
      shadcn/ui-inspired standard card surface for the employer panel —
      so this page reads as part of the Pro Console set rather than a
      coloured exception.
    -->
    <section
      aria-labelledby="employer-radar-heading"
      class="rounded-xl bg-white p-4 shadow-sm border border-gray-200"
    >
      <!-- ===== Header: icon chip + title + «به‌زودی» badge ===== -->
      <div class="flex items-start gap-3">
        <!--
          The chip is the employer accent at 15% with the indigo glyph — the
          shadcn/ui icon chip treatment the reference gives primary icons,
          and the same indigo the polygon, the active tab and the CTA
          below are painted in.
        -->
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
          aria-hidden="true"
        >
          <UIcon name="solar:radar-2-linear" size="18" />
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-2">
            <h2
              id="employer-radar-heading"
              class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-gray-900"
            >
              رادار شکار
            </h2>

            <!--
              The gold «به‌زودی» badge — identical pattern to ComingSoonCard.vue:
              `color="warning"` for the semantic, gold-200 fill, gold-700 text,
              gold-500/40 ring. `font-yekan-bold font-normal` pairing is required
              because `font-yekan-bold` is a single face at 400 and the theme's
              `font-medium` would synthesize a bold on top of it.
            -->
            <UBadge
              color="warning"
              class="shrink-0"
              :ui="{
                base: 'gap-1.5 rounded-full bg-x-gold-200 px-2.5 py-0.5 text-[11px] leading-5 font-yekan-bold font-normal text-x-gold-700 ring-1 ring-x-gold-500/40',
              }"
            >
              <span
                class="size-1.5 shrink-0 rounded-full bg-x-gold-700"
                aria-hidden="true"
              />
              به‌زودی
            </UBadge>
          </div>

          <p class="mt-1 text-xs leading-5 text-gray-500">
            شناسایی خودکار افراد توانمند در هر زمینهٔ شغلی؛ نمایش نقاط قوت و
            استعدادها روی یک نمودار تعاملی.
          </p>
        </div>
      </div>

      <!-- ===== Profile selector ===== -->
      <!--
        Three buttons in a row, one per fictional profile. A plain `<button>`
        rather than `UButton` because the light ground needs colours the theme
        does not have a variant for — the active button is the indigo accent
        pill and the inactive ones are light chips with a hairline — and
        fighting the theme with `:ui` overrides would be more code than the
        three Tailwind classes below. The active pill's white-on-indigo ink is
        the same pairing the page's CTA uses, so the selected state and the
        primary action read as one system.

        `role="tablist"` / `role="tab"` / `aria-selected` so a screen reader
        announces the three as a tab strip and says which is current. The
        chart below is the tab panel; it is not wired to `aria-controls`
        because apexcharts renders its own DOM and the association would be
        decorative.
      -->
      <div
        class="mt-4 flex gap-2"
        role="tablist"
        aria-label="انتخاب پروفایل"
      >
        <button
          v-for="option in profileOptions"
          :key="option.id"
          type="button"
          role="tab"
          :aria-selected="option.active"
          class="flex-1 rounded-lg px-3 py-2 text-xs font-yekan-bold transition-colors"
          :class="
            option.active
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-50 text-gray-600 border border-gray-200'
          "
          @click="activeProfileId = option.id"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- ===== The radar chart ===== -->
      <!--
        `<ClientOnly>` with a skeleton fallback, for the reason
        `Goal/RadarChart.vue` gives: `apexcharts` reads the DOM while it
        measures, so the `<apexchart>` below must not render on the server.
        The fallback is a `USkeleton` of the same `h-72` box so the page does
        not jump when the chart mounts.

        The skeleton is `bg-gray-50` — one step off the white
        card — so it reads as a placeholder on the same ground the chart will
        occupy, the same convention the shadcn/ui skeleton uses one step
        off its own card.
      -->
      <ClientOnly>
        <div class="mt-4 h-72 w-full">
          <apexchart
            type="radar"
            height="100%"
            :series="series"
            :options="options"
          />

          <!--
            The accessible representation of the figure: a visually-hidden
            table of the six scores for the ACTIVE profile. A figure whose
            data is reachable only by hovering is unreadable without a mouse,
            and these six numbers are the entire point of the screen. The
            table is rebuilt whenever the profile changes because `scores` is
            the active profile's own array.
          -->
          <table class="sr-only">
            <caption>
              امتیاز پروفایل {{ activeProfile.label }} در شش دستهٔ استعداد، از ۱۰
            </caption>
            <thead>
              <tr>
                <th scope="col">دسته</th>
                <th scope="col">امتیاز</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(label, index) in labels" :key="label">
                <th scope="row">{{ label }}</th>
                <td>{{ faNumber(activeProfile.scores[index] ?? 0) }} از ۱۰</td>
              </tr>
            </tbody>
          </table>
        </div>

        <template #fallback>
          <div class="h-72 w-full" aria-busy="true">
            <USkeleton
              class="size-full rounded-lg bg-gray-50"
            />
            <span class="sr-only">در حال دریافت نمودار</span>
          </div>
        </template>
      </ClientOnly>

      <!-- ===== Explanation ===== -->
      <!--
        One short paragraph saying what the reader is looking at and — more
        important — what it is NOT. The chart is interactive and the profiles
        are plausible, so without this line a reader could reasonably take the
        scores for a real assessment. The sentence says they are illustrative
        in the same weight of type as everything else on the page.
      -->
      <p class="mt-3 text-xs leading-5 text-gray-500">
        این نمودار پیش‌نمایشی از قابلیت رادار شکار است. پروفایل‌ها و امتیازها
        کاملاً فرضی و برای نمایش شکل ابزار در نظر گرفته شده‌اند.
      </p>

      <!-- ===== CTA — disabled, clearly locked ===== -->
      <!--
        The locked CTA is the employer accent with white-on-indigo ink — the
        panel's primary-action pairing, so even disabled it reads as "this is
        the button that will exist". The `:ui` override is the same technique
        `Test/ActiveCard.vue` uses for its own button: the theme's solid
        variant would paint it the app's brand blue, which is not this
        panel's primary colour.
      -->
      <UButton
        block
        color="x-primary"
        size="lg"
        class="mt-4"
        disabled
        :ui="{ base: 'bg-indigo-600! text-white! hover:bg-indigo-700!' }"
      >
        شروع اسکن رادار
      </UButton>
    </section>
  </div>
</template>
