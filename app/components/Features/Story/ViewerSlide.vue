<script setup lang="ts">
import type { StoryFrame } from "~/types/story";

/**
 * One frame of the reel: the media, the RTL tap zones, the hold surface and the
 * CTA scrim.
 *
 * Z-order is the contract with `Viewer.vue`: media 0, tap/hold layer 10, CTA
 * 20, header 40. A press that lands on a button therefore never reaches the
 * hold handler, so no `closest('[data-interactive]')` test is needed anywhere.
 */
const props = defineProps<{
  frame: StoryFrame;
  /** Index of this frame in the flattened list. */
  index: number;
  activeIndex: number;
}>();

const emit = defineEmits<{ prev: []; next: []; hold: [held: boolean] }>();

/**
 * Media mount window AND interactivity window: only the current frame and its
 * two neighbours mount an `<img>` and are left interactive, so at most THREE
 * images exist in the DOM whatever the reel length and at most three frames sit
 * in the tab order / the accessibility tree. This is the single biggest
 * performance decision in the feature; the rest of the reel shows the branded
 * placeholder instead of a broken image.
 *
 * It is ALSO what the frame root's `:inert` keys off. Swiper 14 does not set
 * `aria-hidden` on inactive slides (the string `swiper-slide-invisible` is gone
 * from its JS; the CSS rule is legacy) and its `A11y` module only adds
 * `role="group"` + `aria-label`, so without `inert` a 40-frame reel puts ~40
 * external-link CTAs and 2 × 40 tap-zone buttons in front of the header's own
 * pause/stop/close controls.
 *
 * `loading="lazy"` + `decoding="async"` + explicit width/height on top of it
 * keep the swap cheap and the box stable. No `sizes`/`modifiers` here: each one
 * is an IPX transform and they multiply.
 */
const eager = computed(() => Math.abs(props.index - props.activeIndex) <= 1);
</script>

<template>
  <!--
    `inert` on the FRAME ROOT, not on the CTA: one attribute takes the whole
    subtree out of focus, out of the a11y tree and out of hit-testing at once.
    Swiper's own drag handling is bound to the carousel WRAPPER, which is an
    ANCESTOR of this root, so a non-eager frame cannot swallow a swipe.

    `|| undefined` is belt-and-braces: `inert` is one of Vue's boolean
    attributes, so a plain `false` would still render as a bare `inert` on the
    SSR attribute path. Vue's client patcher sets it as the DOM property
    (`HTMLElement.inert`), which reflects either way.
  -->
  <div class="absolute inset-0" :inert="!eager || undefined">
    <!-- Media. The CTA scrim, the tap zones and the header all sit above it. -->
    <div class="story-media absolute inset-0 z-0 overflow-hidden">
      <NuxtImg
        v-if="eager && frame.item.media.kind === 'image'"
        :src="frame.item.media.src"
        :alt="frame.item.media.alt"
        :width="frame.item.media.width"
        :height="frame.item.media.height"
        loading="lazy"
        decoding="async"
        class="h-full w-full object-cover"
      />
      <!-- Anything unmounted, or a `video` kind this phase does not play yet. -->
      <div v-else class="story-placeholder h-full w-full" aria-hidden="true" />
    </div>

    <!--
      Tap + hold surface, `z-10`.

      Hold-to-pause needs no target of its own: the 24 % dead centre between the
      two tap zones is the hold area, exactly as on Instagram. The press only
      becomes a pause after 120 ms, which is what stops a quick tap-to-advance
      from also pausing; release resumes from the SAME elapsed time, never zero.

      `pointerleave` is required — without it, dragging a finger off the screen
      leaves the story frozen forever.
    -->
    <div
      class="absolute inset-0 z-10"
      @pointerdown="emit('hold', true)"
      @pointerup="emit('hold', false)"
      @pointercancel="emit('hold', false)"
      @pointerleave="emit('hold', false)"
    >
      <!--
        `start-0` / `end-0` make the sides self-documenting: in RTL start =
        right = PREVIOUS and end = left = NEXT, which is what `slidePrev` /
        `slideNext` mean once Swiper's `rtlTranslate` is on.

        The two zones meet in the middle and `w-[38%]` is the only place that
        number lives, so the dead zone between them cannot drift out of sync.

        `tabindex="-1"`: 3 frames × 2 zones would add 6 tab stops to a screen
        Swiper's `A11y` module already labels. Keyboard users get the arrow keys
        (Swiper's RTL-aware `Keyboard` module) and the three header buttons.
        Outside the mount window the whole frame root is `inert` anyway.
      -->
      <button
        type="button"
        tabindex="-1"
        class="absolute inset-y-0 start-0 w-[38%]"
        aria-label="استوری قبلی"
        @click.stop="emit('prev')"
      />
      <button
        type="button"
        tabindex="-1"
        class="absolute inset-y-0 end-0 w-[38%]"
        aria-label="استوری بعدی"
        @click.stop="emit('next')"
      />
    </div>

    <!--
      CTA scrim, `z-20`. A GRADIENT, not a blur — blur is banned in this
      feature. Gated on the frame CARRYING a link, so a linkless frame has no
      scrim at all; a frame whose link `safeStoryHref` later refuses keeps an
      empty one, which is the known cost of not letting this component know
      about the URL gate.
    -->
    <div
      v-if="frame.item.link"
      class="absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-black/92 via-black/55 to-transparent px-4 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <FeaturesStoryViewerCta :link="frame.item.link" />
    </div>
  </div>
</template>

<style scoped>
.story-media {
  /* A hold-to-pause press on iOS must not raise the system callout. */
  -webkit-touch-callout: none;
  background: #000;
}

.story-placeholder {
  /* The palette arrives as custom properties on the viewer root, so a fast
     swipe shows the brand gradient rather than a hole. */
  background-image: linear-gradient(
    160deg,
    var(--story-placeholder-from),
    var(--story-placeholder-to)
  );
}
</style>

<!--
  Deliberately NOT `scoped`, and this is the one place in the feature that needs
  an unscoped block.

  A4 — the incoming frame's settle, keyed off Swiper's OWN class, so it costs
  zero JS. The wrapper already slides; this only makes the image read as
  "arriving" instead of popping.

  It cannot be scoped: the state we need to react to (`.swiper-slide-active`)
  lives on an ANCESTOR that Swiper owns, and a scoped selector can only ever
  match downward from a scope id that this component owns. `:global(X) Y` in a
  scoped block silently DROPS the `Y` compound (verified against
  `@vue/compiler-sfc` 3.5.40), and `:deep(.swiper-slide-active) .story-media`
  compiles to `[data-v-x] .swiper-slide-active .story-media`, whose required
  `[data-v-x]` ancestor does not exist — this component's root is a DESCENDANT
  of the slide, not an ancestor of it.

  So the rule is global and the class names below are the guard: `story-media`
  and `story-settle` exist only in this feature.
-->
<style>
.swiper-slide-active .story-media {
  animation: story-settle 260ms var(--ease-out) both;
}

@keyframes story-settle {
  from {
    opacity: 0.92;
    transform: scale(1.015);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .swiper-slide-active .story-media {
    animation: none;
  }
}
</style>
