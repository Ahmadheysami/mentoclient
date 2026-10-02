<script setup lang="ts">
/**
 * One available destination of the panel hub, as one cell of the features grid.
 *
 * ## WHY THERE IS NO WIDTH HERE ANY MORE
 *
 * This card was `w-48 shrink-0 snap-start`, and that width was load-bearing: on a
 * snap rail `scroll-snap-align: start` only means something when every slide is the
 * same size, and the peeking sliver of the next card only exists because a card is
 * narrower than its container. Four cards in a `grid-cols-2` need none of that — the
 * grid gives every card the same width, all four of them, with no second scroller on
 * a page that already has one — so the width classes are gone with the rail. What
 * stays is `h-full`, because grid stretch stops at the `<li>` and a card in the
 * shorter half of a row would otherwise end above its neighbour.
 *
 * ## THE TINT IS PASSED IN, AND IT IS NOT DERIVED HERE
 *
 * The cycle of surfaces belongs to the page's list, because the guarantee is about
 * that list: four identical cards read as a table rather than as four destinations,
 * and the same tint twice in a row reads as a mistake. This component knows its own
 * `tone` and nothing about its position, so a card that counted for itself would
 * repaint whenever the list was reordered. See `FEATURE_TONES` in
 * `pages/panels/big/index.vue` for the checkerboard rule itself.
 *
 * ⚠️ **THE THREE SURFACES ARE THE MEASURED ONES**, taken from
 * `docs/design/big-panel-reference.jpg` rather than from a memory of it — 78% sky
 * blue, 15.7% lime, and a warm neutral for the rows that are context rather than
 * destinations. Each surface carries its own ring one step darker than itself, so
 * the separation from the `#ecf0fb` page is drawn by the card's own colour and not
 * by a border hue borrowed from somewhere else on the page.
 *
 * ## THE CHIP IS WHITE ON EVERY SURFACE, AND THAT IS NOW SIMPLE
 *
 * It used to be part of the tone, because one of the four tones WAS white and a
 * white chip on a white card vanishes into its own card. There is no white surface
 * in this union any more, so the chip is `bg-white` unconditionally with the glyph
 * in the ink token — 15.1:1 on white, and the same chip on all four cards, which is
 * one fewer thing to vary. It is `size-10`, not `size-11`, because at ~199px per
 * grid column every pixel the top row takes is a pixel the card has not; the whole
 * card is a tap target far above 44px, so the chip is a glyph and not a control — it
 * stays `aria-hidden` and never grows a size of its own.
 *
 * ## THE CHIP AND THE CHEVRON SHARE THE TOP ROW, AND THE TITLE GETS A LINE OF ITS OWN
 *
 * The chip used to ride beside the title. In a 2-column grid that does not fit: a
 * column is ~199px wide, and ~171px of that is inside the padding, so a 40px chip
 * and an 18px chevron on the title's line leave under 100px for «دستیار هوش
 * مصنوعی» — which would truncate a destination's NAME, the one word on the card that
 * must not be clipped. Putting the chevron at the inline end of the chip row instead
 * gives the title the full 171px, and it is the reference's own card anatomy: a
 * control at the inline end of the top row, the text under it.
 *
 * The chevron is `x-primary-content-700`, NOT `x-text-muted`. `x-text-muted`
 * measures 2.06:1 on `sky-200` and 1.97:1 on `lime-200`, and even though the glyph
 * is `aria-hidden` it is the only "this opens something" cue on the card, so it is
 * held to the 3:1 that WCAG asks of a non-text control rather than excused as
 * decoration. `x-primary-content-700` gives 3.95:1 and 3.79:1 — and it is a step
 * toward the ink rather than a hue, which keeps the direction from competing with
 * the destination's own colour, which is already the card it sits on.
 *
 * ## PRESS FEEDBACK ONLY, AND WHY THERE IS NO `hover`
 *
 * `active:scale-[0.98]` is the whole interaction. A hover state on a touch screen
 * is the oldest "this is a website" tell there is: the card would light up under a
 * finger that is only passing over it on the way to something else — and a finger
 * travelling down a two-column grid crosses every card in it on the way to the
 * second one. The `motion-reduce:` pair cancels both the transition and the scale for
 * a reader who has asked for no motion, and the whole app's
 * `html[data-motion="reduced"]` rule flattens whatever is left.
 *
 * ## FOCUS, NOT JUST TAP
 *
 * The card IS the link, so it is in the tab order for free and the visible
 * `focus-visible` ring is the only affordance a keyboard user gets — a card that
 * only responds to `:active` is unusable without a pointer. The ring is the indigo
 * one, because a focus ring drawn in the same blue as the surface it is drawn over
 * is the one thing on screen that cannot say where you are.
 *
 * The title is a block in a COLUMN flex container, so `align-items: stretch` gives
 * it the card's width and its own `truncate` bites directly — no `min-w-0` is needed
 * here, because the `min-width: auto` trap only applies to a flex item on the main
 * axis, which is what the title used to be when the chip shared its line.
 *
 * ## NOTHING INSIDE THE CARD IS A SECOND TARGET
 *
 * The whole tile is the tap target and it is far above 44px, so there is no inner
 * control that would compete for the same touch, and nothing inside it is focusable.
 */
type FeatureTone = "sky" | "lime" | "mist";

const props = defineProps<{
  /** The route this card opens. Every entry here is a route that exists. */
  to: string;
  /** An Iconify name from the LOCALLY bundled `solar` collection. */
  icon: string;
  title: string;
  description: string;
  /** This card's surface, cycled by the caller so two neighbours never share one. */
  tone: FeatureTone;
}>();

/**
 * The measured fill and its own hairline, per surface.
 *
 * The ring is always one step darker than the fill it belongs to, which is why the
 * ring travels with the surface instead of being a single page-wide border colour:
 * on `sky-200` a `lime-300` hairline would read as a mistake.
 *
 * `mist` is not in the page's cycle — it is the surface for a card that is CONTEXT
 * rather than a destination — and it is kept in the map so a caller passing it gets
 * a real surface instead of an undefined class.
 */
const TONES: Record<FeatureTone, string> = {
  sky: "bg-x-sky-200 ring-x-sky-300",
  lime: "bg-x-lime-200 ring-x-lime-300",
  mist: "bg-x-mist-200 ring-x-mist-300",
};

/** This card's surface, chosen by the caller rather than counted here. */
const tone = computed<string>(() => TONES[props.tone]);
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex h-full flex-col rounded-3xl p-3.5 ring-1 transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-secondary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
    :class="tone"
  >
    <!--
      Chip at the inline start, chevron at the inline end, on one `justify-between`
      row: the chip is the card's identity and the chevron is its direction, and
      neither belongs on the title's line the title needs for itself. See the header
      for the measurement that forced the split.

      Every wrapper here is a `<span>` rather than a `<div>` because an `<a>` may only
      hold phrasing content; a flex row is still a flex row when its element is a
      `<span>`, so the served HTML stays valid.
    -->
    <span class="flex items-center justify-between">
      <span
        class="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-x-text-title"
        aria-hidden="true"
      >
        <UIcon :name="icon" size="20" />
      </span>

      <UIcon
        name="solar:alt-arrow-left-linear"
        size="18"
        class="shrink-0 text-x-primary-content-700"
        aria-hidden="true"
      />
    </span>

    <!--
      `truncate`, and not `line-clamp-2`: a destination has ONE name and a clipped
      name is a misspelling of it — the roadmap's rows are where wrapping is the right
      answer, because those are product names read as a list.
    -->
    <span class="mt-2.5 block truncate font-yekan-bold text-sm text-x-text-title">
      {{ title }}
    </span>

    <!--
      `mt-auto` on the LAST line, not a fixed margin on both: the grid stretches every
      card in a row to the height of its tallest sibling, and without this the one
      whose description is a single line would end higher than the one that takes two,
      so the two cards would appear to have different amounts of content. `pt-1.5` is
      the floor for the gap in the short card — `mt-auto` alone can compute to 0.
    -->
    <span class="mt-auto block pt-1.5 line-clamp-2 text-xs leading-6 text-x-text-subtitle">
      {{ description }}
    </span>
  </NuxtLink>
</template>
