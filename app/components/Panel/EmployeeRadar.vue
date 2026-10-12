<script setup lang="ts">
/**
 * «رادار شکار» — the Talent Radar, the flagship locked demo of Phase 2.
 *
 * ## WHY THIS IS A LOCKED DEMO AND NOT A DASHBOARD
 *
 * Everything on this card is FICTIONAL and ILLUSTRATIVE. The radar chart,
 * the glowing dots, the perimeter avatars, the pipeline stages, the
 * consultant profiles and the assessment statuses are all invented data
 * hard-coded in this file. No API call is made. No real user data is
 * rendered. The card exists to show the reader what the feature WILL look
 * like when it ships — a promise of capability, not a working tool.
 *
 * The lock is communicated three ways, all consistent with the Phase 1
 * «به‌زودی» badge pattern:
 *
 *   1. A gold `UBadge` in the header row (same token, same ring, same
 *      `font-yekan-bold font-normal` pairing as `ComingSoonCard.vue`).
 *   2. A `UButton` with `:disabled="true"` — visibly greyed, non-operational,
 *      but still a real `<button>` element in the DOM (so a screen reader
 *      announces it as disabled rather than absent).
 *   3. `aria-hidden="true"` on the entire radar visualization, because it
 *      is decorative: the card's text already says everything the chart
 *      would "say", and an animated SVG with no accessible name would be
 *      noise to a screen reader.
 *
 * ## THE RADAR IS AN SVG, NOT A CANVAS OR A CHART LIBRARY
 *
 * The chart is a simple polygon radar: concentric rings (4 circles) drawn
 * with `<circle>`, axis spokes with `<line>`, and a glowing data polygon
 * with `<polygon>`. No charting library is added because the shape is
 * trivial, the data is static, and the whole point is the SCAN ANIMATION
 * — a CSS-rotating gradient wedge layered on top via a sibling `<div>`.
 * A chart library would fight that animation; an SVG embraces it.
 *
 * The scan wedge is a conic-gradient `<div>` clipped to a circle, rotated
 * by the `radar-scan` keyframe defined in `main.css`. It sits in a
 * separate layer ABOVE the SVG rings but BELOW the perimeter avatars, so
 * the beam sweeps "under" the talent dots and reads as depth.
 *
 * ## AVATARS ARE INITIALS, NOT PHOTOS
 *
 * Every fictional person on this card is represented by a coloured circle
 * with their initials in Persian. No `<img>`, no external URL, no real face.
 * The pastel background colours cycle through the palette's sky, lime and
 * mist tints so each avatar is visually distinct without introducing a new
 * hue family.
 *
 * ## RESPONSIVE SIZING
 *
 * The radar SVG uses a `viewBox` of `0 0 280 280` and is sized by
 * `w-full max-w-[280px] mx-auto`, so it scales fluidly from a 320px phone
 * up to the panel's 448px cap without distortion. The perimeter avatars are
 * positioned with percentage-based `top`/`left` values relative to the
 * radar container, not absolute pixels, so they track the SVG as it scales.
 *
 * ## PREFERRED-REDUCED-MOTION
 *
 * All three animations (`radar-scan`, `radar-pulse`, `radar-avatar-float`)
 * are disabled by the `prefers-reduced-motion` media query and the
 * `html[data-motion="reduced"]` attribute, both defined in `main.css`.
 * The card is fully static under reduced motion — the radar chart, dots
 * and avatars all render in their resting state.
 */

/**
 * One fictional talent detected by the radar.
 *
 * `angle` is the compass position around the radar perimeter in degrees
 * (0 = top, 90 = right, 180 = bottom, 270 = left). `distance` is how far
 * from centre the avatar sits, as a percentage of the radar radius — 100
 * means on the outermost ring, 50 means halfway out. `initials` are one or
 * two Persian characters. `color` indexes into the pastel palette below.
 */
interface FictionalTalent {
  name: string;
  initials: string;
  angle: number;
  distance: number;
  color: number;
}

/**
 * The fictional talents positioned around the radar perimeter.
 *
 * Five avatars at varied angles and distances, so the perimeter feels
 * populated but not crowded. Angles are spread across all four quadrants
 * to avoid a lopsided composition. Distances vary between 62% and 100% of
 * the radius so some avatars sit on the outer ring and others hover closer
 * in — which reads as "depth" on a 2D radar.
 *
 * ⚠️ ALL DATA IS FICTIONAL. These names, initials and positions are
 * illustrative only. No real person is represented.
 */
const talents: FictionalTalent[] = [
  { name: "سارا محمدی", initials: "س", angle: 20, distance: 100, color: 0 },
  { name: "علی رضایی", initials: "ع", angle: 85, distance: 78, color: 1 },
  { name: "نگار کریمی", initials: "ن", angle: 150, distance: 92, color: 2 },
  { name: "امیر حسینی", initials: "ا", angle: 220, distance: 68, color: 0 },
  { name: "مریم احمدی", initials: "م", angle: 300, distance: 85, color: 1 },
];

/**
 * The pastel background classes for the avatar circles.
 *
 * Three tints cycling so no two adjacent avatars share a colour. The
 * tints are the palette's sky-100, lime-100 and mist-100 — all light
 * enough that a white initial letter inside reads clearly without
 * needing a custom text colour. The cycle is `color % PALETTE.length`,
 * so adding a fourth colour here automatically applies it.
 */
const AVATAR_TINTS = [
  "bg-x-sky-100 text-x-sky-700",
  "bg-x-lime-100 text-x-text-title",
  "bg-x-mist-200 text-x-text-subtitle",
];

/**
 * One glowing dot on the radar face.
 *
 * `x` and `y` are coordinates in the SVG's 280×280 viewBox space.
 * `delay` staggers the `radar-pulse` animation so the dots do not blink
 * in unison. `size` is the dot's radius in viewBox units.
 */
interface RadarDot {
  x: number;
  y: number;
  delay: number;
  size: number;
}

/**
 * The fictional signal dots scattered across the radar face.
 *
 * Six dots at varied positions and sizes, representing "detected talent
 * signals". Their coordinates are spread across all four quadrants and
 * all four ring bands so the radar face feels alive. Each dot's `delay`
 * is a multiple of 200ms, which staggers their pulse cycles enough that
 * they never all brighten at the same moment.
 *
 * ⚠️ ALL DATA IS FICTIONAL. These dots have no real-world meaning.
 */
const dots: RadarDot[] = [
  { x: 140, y: 60, delay: 0, size: 5 },
  { x: 95, y: 105, delay: 200, size: 4 },
  { x: 190, y: 90, delay: 400, size: 6 },
  { x: 70, y: 155, delay: 100, size: 4.5 },
  { x: 210, y: 160, delay: 300, size: 5 },
  { x: 140, y: 220, delay: 500, size: 5.5 },
];

/**
 * The radar chart's centre point in viewBox coordinates.
 *
 * The viewBox is 280×280, so the centre is (140, 140). This constant is
 * used to compute avatar positions around the perimeter.
 */
const CENTER = 140;

/**
 * The radar's outer radius in viewBox units.
 *
 * 120 units out of the 280-unit viewBox, leaving a 20-unit margin on all
 * sides for the perimeter avatars to sit in.
 */
const RADIUS = 120;

/**
 * Convert a talent's polar position (angle + distance) to Cartesian
 * coordinates in the SVG viewBox space.
 *
 * `angle` is in degrees, 0 = top, increasing clockwise. `distance` is a
 * percentage of the outer radius. The result is an `{ x, y }` pair that
 * can be used directly in `top`/`left` percentage positioning on the
 * perimeter avatar wrapper.
 *
 * The `top`/`left` values are percentages of the radar CONTAINER (the
 * parent `<div>`), not the viewBox, so they scale correctly with the
 * responsive SVG. The container is a square (`aspect-square`), so the
 * percentage space matches the viewBox space 1:1.
 */
function polarToPercent(
  angleDeg: number,
  distancePercent: number,
): { top: string; left: string } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const r = (distancePercent / 100) * RADIUS;
  const x = CENTER + r * Math.cos(rad);
  const y = CENTER + r * Math.sin(rad);
  return {
    top: `${(y / 280) * 100}%`,
    left: `${(x / 280) * 100}%`,
  };
}

/**
 * The polygon points for the radar's data shape.
 *
 * A hexagon connecting six fictional "capability scores" at varied
 * distances from centre. The shape is irregular on purpose — a perfect
 * hexagon would look like a default chart, while an irregular polygon
 * looks like real (fictional) data. Coordinates are in the 280×280
 * viewBox space.
 */
const DATA_POLYGON =
  "140,45 195,85 215,140 180,200 110,220 60,160";
</script>

<template>
  <section
    aria-labelledby="employee-radar-heading"
    class="rounded-4xl bg-white p-4 ring-1 ring-x-sky-300"
  >
    <!-- ===== Header: icon chip + title + «به‌زودی» badge ===== -->
    <div class="flex items-start gap-3">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-2xl bg-x-sky-100 text-x-text-title"
        aria-hidden="true"
      >
        <UIcon name="solar:radar-2-linear" size="20" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <h3
            id="employee-radar-heading"
            class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-x-text-title"
          >
            رادار شکار
          </h3>

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

        <p class="mt-1.5 text-xs leading-6 text-x-text-subtitle">
          شناسایی خودکار افراد توانمند در هر زمینهٔ شغلی؛ نمایش نقاط قوت و
          استعدادها روی یک نمودار تعاملی.
        </p>
      </div>
    </div>

    <!-- ===== Radar visualization ===== -->
    <div
      class="relative mx-auto mt-4 aspect-square w-full max-w-[280px]"
      aria-hidden="true"
    >
      <!--
        The SVG radar chart: concentric rings, axis spokes, and a data polygon.
        `viewBox="0 0 280 280"` with `w-full h-full` makes it scale fluidly.
        All shapes use `vector-effect="non-scaling-stroke"` is NOT needed here
        because the strokes are part of the illustration and should scale
        with the chart.
      -->
      <svg
        viewBox="0 0 280 280"
        class="absolute inset-0 h-full w-full"
        fill="none"
      >
        <!-- Concentric rings — 4 circles at 25%, 50%, 75% and 100% of radius -->
        <circle
          v-for="ring in [30, 60, 90, 120]"
          :key="ring"
          :cx="CENTER"
          :cy="CENTER"
          :r="ring"
          class="stroke-x-sky-200"
          stroke-width="1"
        />

        <!-- Axis spokes — 4 lines through centre at 45° intervals -->
        <line
          v-for="angle in [0, 45, 90, 135, 180, 225, 270, 315]"
          :key="angle"
          :x1="CENTER"
          :y1="CENTER"
          :x2="CENTER + 120 * Math.cos(((angle - 90) * Math.PI) / 180)"
          :y2="CENTER + 120 * Math.sin(((angle - 90) * Math.PI) / 180)"
          class="stroke-x-sky-200"
          stroke-width="0.5"
          stroke-opacity="0.5"
        />

        <!-- Data polygon — the fictional capability shape -->
        <polygon
          :points="DATA_POLYGON"
          class="fill-x-sky-100 stroke-x-sky-300"
          stroke-width="1.5"
          fill-opacity="0.4"
        />

        <!-- Glowing signal dots -->
        <circle
          v-for="(dot, i) in dots"
          :key="i"
          :cx="dot.x"
          :cy="dot.y"
          :r="dot.size"
          class="fill-x-sky-500"
        />
      </svg>

      <!--
        The rotating scan wedge — a conic-gradient div clipped to a circle,
        rotated by the `radar-scan` CSS animation. It sits ABOVE the SVG
        (z-index implied by source order) but BELOW the perimeter avatars.
        `origin-center` makes the rotation pivot on the radar's centre.
      -->
      <div
        class="radar-scan pointer-events-none absolute inset-0 rounded-full"
        style="
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(111, 198, 248, 0.15) 30deg,
            transparent 60deg
          );
        "
      />

      <!--
        Perimeter avatars — fictional talent circles positioned by
        `polarToPercent`. Each avatar is a `size-10` circle with a pastel
        tint and a white initial. The `radar-avatar-float` animation gives
        them a subtle independent bob. `--avatar-float-delay` staggers the
        float cycle per avatar.
      -->
      <span
        v-for="(talent, i) in talents"
        :key="talent.name"
        class="radar-avatar-float absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-yekan-bold text-sm ring-2 ring-white"
        :class="AVATAR_TINTS[talent.color % AVATAR_TINTS.length]"
        :style="{
          top: polarToPercent(talent.angle, talent.distance).top,
          left: polarToPercent(talent.angle, talent.distance).left,
          '--avatar-float-delay': i * 800,
        }"
      >
        {{ talent.initials }}
      </span>
    </div>

    <!-- ===== CTA — disabled, clearly locked ===== -->
    <UButton
      block
      color="x-primary"
      size="lg"
      class="mt-4"
      disabled
    >
      مشاهدهٔ رادار شکار
    </UButton>
  </section>
</template>
