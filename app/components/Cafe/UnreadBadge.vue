<script setup lang="ts">
/**
 * The unread counter that sits under the time on a conversation row.
 *
 * **The badge is a fact, not a colour.** It carries a number and a Persian
 * `aria-label`, so «۳ پیام خوانده‌نشده» reaches a screen reader instead of an
 * anonymous dot. It is `role`-less on purpose: the count is content, not a live
 * region — a screen reader should hear it when the row is read, not interrupt
 * whatever it is saying.
 *
 * The near-black surface is `x-text-title`, the same token the mic button and
 * the outgoing bubble use, so the whole conversation screen has one ink for
 * «the reader's own world» instead of a second accent invented here.
 *
 * ## ⚠️ THE `h-5` / `leading-none` PAIR IS CORRECT — DO NOT "CENTRE" IT
 *
 * A 20px badge under a 12px time is the first thing an alignment audit
 * suspects, and it was measured rather than eyeballed. The arithmetic, from the
 * metrics in the shipped `public/fonts/yekan/regular.woff2` (ascent **1.00em**,
 * descent **−0.55em**, `lineGap` 0, `USE_TYPO_METRICS` set, so the glyph
 * content box is **1.55em**):
 *
 * - Nuxt UI's `UBadge` base is `font-medium inline-flex items-center`, and
 *   merging our `ui.base` through `tailwind-merge` leaves `py-1` **and** `h-5`
 *   both standing (`h` and `py` are unrelated groups). With preflight's
 *   `box-sizing: border-box` that is a 20px box with 4px padding, i.e. a 12px
 *   content box, and `items-center` centres a `leading-none` 12px line box in
 *   it — line-box top **4px** down.
 * - Half-leading = (12 − 1.55×12)/2 = **−3.3px**, so the baseline sits at
 *   4 − 3.3 + 12 = **12.7px** from the badge's top.
 * - Persian digits `۱`–`۹` occupy yMin 0 … yMax **637/1000 em** — they sit
 *   entirely *above* the baseline — so the ink is centred **3.82px** above it,
 *   at **8.88px** from the badge's top.
 * - `CafeMessageTimestamp variant="row"` renders `text-xs leading-5`: a 20px
 *   line box, half-leading (20 − 18.6)/2 = **+0.7px**, baseline **12.7px**,
 *   digit centre **8.88px**.
 *
 * **Same size, same baseline, same optical centre.** The badge's digits and the
 * clock above it are one typographic object.
 *
 * The badge's own *geometric* centre is at 10px, so the digits sit 1.12px above
 * it. That is not an error: it is 0.0935em, the font's own digit-in-line-box
 * offset, produced by an ascent that reserves a full 1em for marks Persian
 * digits never reach. Removing it would need a sub-pixel arbitrary value and
 * would move the digits *down*, away from the clock they are supposed to match.
 * If a badge ever looks wrong, change this only after re-deriving the numbers
 * above — the pair is aligned today.
 *
 * (`۰` is the one digit that breaks the rule: yMin 91 … yMax 477, only 0.386em
 * tall against 0.637em for the rest. It never reaches this badge, because a
 * count of zero hides it — but a `faNumber` zero in a *pill* elsewhere is drawn
 * visibly smaller than its neighbours, which is the font, not a layout fault.)
 */
const props = withDefaults(
  defineProps<{
    /** Messages the reader has not opened. Anything at or below zero hides. */
    count: number;
    /** The figure above which counting stops and the badge reads «۹۹+». */
    max?: number;
  }>(),
  { max: 99 },
);

/**
 * Zero hides. A badge that renders «۰ پیام خوانده‌نشده» is worse than no badge:
 * it spends the most contrasted ink on the screen to say nothing is new.
 */
const visible = computed(() => Number.isFinite(props.count) && props.count > 0);

const figure = computed(() =>
  props.count > props.max ? `${faNumber(props.max)}+` : faNumber(props.count),
);

/** Persian, because a bare «۳» is not a sentence to a screen reader. */
const accessibleLabel = computed(
  () => `${faNumber(props.count)} پیام خوانده‌نشده`,
);
</script>

<template>
  <UBadge
    v-if="visible"
    :aria-label="accessibleLabel"
    class="shrink-0"
    :ui="{
      base:
        'h-5 min-w-5 rounded-full bg-x-text-title px-1.5 text-xs leading-none text-white tabular-nums',
    }"
  >
    {{ figure }}
  </UBadge>
</template>