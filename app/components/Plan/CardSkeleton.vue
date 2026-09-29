<script setup lang="ts">
/**
 * Placeholder cards shaped like the real plan cards — same radius, padding, row
 * heights, dip and hairline — so nothing shifts when the data lands. The middle
 * one wears the hero's ink surface and accent frame, because the hero is
 * positional: it is the centre of the list, whatever the API returns.
 * Decorative only — the parent owns `aria-busy`.
 */
const ROWS = 3;

/** The admin-authored features every card previews. */
const OPTION_ROWS = 4;

/** The hero is the middle item, so the middle skeleton stands in for it. */
const HERO_ROW = Math.floor((ROWS - 1) / 2) + 1;
</script>

<template>
  <div class="grid gap-5">
    <span class="sr-only">در حال دریافت پلن‌ها</span>

    <div
      v-for="row in ROWS"
      :key="`plan-skeleton-${row}`"
      class="plan-skeleton-card plan-notch-host relative rounded-4xl p-5"
      aria-hidden="true"
    >
      <!-- The hero's solid accent frame, behind its own surface -->
      <span
        v-if="row === HERO_ROW"
        class="absolute -top-1 -end-2 -bottom-2 -start-1 -rotate-1"
      >
        <span class="block size-full rounded-4xl bg-x-secondary-400/60" />
      </span>

      <!--
        The same two layers the real card uses: an outer hairline and the fill
        inset by its width, both carrying the dip mask. A mask on the element
        that owns the background alone would leave the hairline tracing the box
        instead of the arc.
      -->
      <span class="absolute inset-0">
        <span
          class="plan-surface block size-full"
          :class="row === HERO_ROW ? 'bg-white/15' : 'bg-x-primary-900/12'"
        />
        <span
          class="plan-surface plan-surface--fill absolute block"
          :class="
            row === HERO_ROW
              ? 'bg-linear-to-br from-x-primary-900 to-x-primary-800'
              : 'bg-white'
          "
        />
      </span>

      <div class="relative">
        <!--
          The discount badge, on its own line at the inline-start where the real
          card puts it. The row reserves the dip exactly as the real one does, so
          the two layouts cannot disagree: the dip is at the inline-END corner
          and this bar is pinned to the inline-START.

          The real card drops this row (and the savings line below) when a plan
          carries no discount, and a placeholder cannot know which case it is
          standing in for — so it depicts the discounted card and `min-h` pins both
          bands to the real row heights. A zero-discount plan therefore settles
          ~72px shorter when the data lands; that gap is the one a placeholder
          cannot close without the data it is standing in for.
        -->
        <div class="flex min-h-6 items-center gap-2 pe-[var(--notch-pad)]">
          <USkeleton
            class="h-6 w-24 shrink-0 rounded-full"
            :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
          />
        </div>

        <!--
          Eyebrow, now full width: the dip lives above it, beside the badge row,
          and never reaches the inline-start end of this line.
        -->
        <USkeleton
          class="mt-3 h-5 w-20 rounded-lg"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />

        <USkeleton
          class="mt-1 h-8 w-2/3 rounded-lg"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />

        <!-- Price: the figure, its unit, and the two accent lines beside it -->
        <div class="mt-3 flex flex-wrap items-end gap-2.5">
          <USkeleton
            class="h-10 w-32 rounded-xl"
            :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
          />
          <USkeleton
            class="h-8 w-24 rounded-lg"
            :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
          />
        </div>

        <!-- The savings line, conditional in the real card like the badge above -->
        <USkeleton
          class="mt-2 min-h-6 w-28 rounded-lg"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />

        <!--
          Description, then the dashed rule the real card divides on. Three rows,
          because the real body is `line-clamp-3` at `leading-7` — 84px, not the
          60px two rows would stand for.
        -->
        <USkeleton
          class="mt-3 h-7 w-full rounded-lg"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />
        <USkeleton
          class="mt-1 h-7 w-11/12 rounded-lg"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />
        <USkeleton
          class="mt-1 h-7 w-11/12 rounded-lg"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />
        <div
          class="mt-4 border-t border-dashed"
          :class="row === HERO_ROW ? 'border-white/20' : 'border-x-primary-100'"
        />

        <!-- Feature rows -->
        <div class="mt-4 grid gap-3.5">
          <div
            v-for="option in OPTION_ROWS"
            :key="`option-${option}`"
            class="flex items-center gap-2.5"
          >
            <USkeleton
              class="size-5 shrink-0 rounded-full"
              :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
            />
            <USkeleton
              class="h-6 rounded-lg"
              :class="[
                row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50',
                option > 3 ? 'w-2/5' : 'w-4/5',
              ]"
            />
          </div>
        </div>

        <USkeleton
          class="mt-3 h-5 w-24 rounded-lg"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />

        <!-- CTA affordance -->
        <USkeleton
          class="mt-5 h-12 w-full rounded-full"
          :class="row === HERO_ROW ? 'bg-x-primary-800' : 'bg-x-primary-50'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * `USkeleton` pulses on its own. It is a loading state rather than decoration,
 * but a pulsing block is still motion, so reduced-motion stops it here.
 * `:deep` is needed because the animated element is inside the component.
 */
@media (prefers-reduced-motion: reduce) {
  .plan-skeleton-card :deep(.animate-pulse) {
    animation: none;
  }
}
</style>
