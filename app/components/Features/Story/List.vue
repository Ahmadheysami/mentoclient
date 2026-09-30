<script setup lang="ts">
import { Swiper, SwiperSlide } from "swiper/vue";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import type { FreeModeOptions } from "swiper/types";
import type { StoryGroup } from "~/types/story";

/**
 * The horizontal rail of story rings.
 *
 * `slidesPerView: 'auto'` + fixed-width cards is what makes a long Persian
 * author name TRUNCATE instead of squeezing the ring, and a two-word name not
 * stretch the rail.
 *
 * `momentum: false` and NO `sticky`, so the rail scrolls freely and stops
 * exactly where the finger lifts. `sticky` is Swiper 14's snapping switch:
 * with it set, the free-mode `onTouchEnd` calls `swiper.slideToClosest()`,
 * which is precisely the one-card-at-a-time stepping a free rail must not
 * have. Swiper 14 REMOVED the Swiper 11 `snap: { grid: 'round' }` and
 * `overscroll` options, so do not reach for those instead — they are a type
 * error and, at runtime, a silently ignored object. `momentum: false` is what
 * stops it flinging past the release point: free, but controlled.
 *
 * `watchOverflow: false` is REQUIRED, not a style preference. Swiper defaults
 * it to `true`, and once the content fits the container it LOCKS the rail —
 * `onTouchStart` returns before a touch ever registers, so the rail is dead.
 * A stories rail is a small fixed set of rings that very often does fit: the
 * rings plus gaps are 350px, and any screen 374px or wider has that to spare
 * once the rail's own `px-3` is subtracted. The larger cards narrow that
 * margin but do not close it, so THIS prop — not the sizing — is what makes
 * the rail scrollable on a 390px phone. The viewer passes the same thing;
 * see `Viewer.vue`.
 *
 * No `A11y` module here (unlike the viewer): it attaches an `aria-live` region
 * that announces on every slide change while the reader is merely browsing a
 * free-scrolling rail. The rail's cards are real `<button>`s inside a labelled
 * `<section>`, which is accessible without list semantics.
 */
const props = defineProps<{
  groups: StoryGroup[];
  /**
   * groupId → the MOST RECENT item index visited, owned by the entry component.
   * A back-swipe lowers it; that is intended, and it is what makes the rail
   * resume where the reader stopped rather than where they got to. Only the
   * boolean "was this reel opened" is read here.
   */
  seen: Map<string, number>;
}>();

const emit = defineEmits<{ select: [groupIndex: number] }>();

/**
 * Hoisted rather than inline: an inline object literal is a NEW object on every
 * render, and Swiper's `getChangedParams` would then see a changed `freeMode`
 * param on every update.
 */
const listModules = [FreeMode];

/**
 * `sticky` is deliberately absent. See the docblock above — enabling it is what
 * made the rail step one card at a time.
 */
const listFreeMode: FreeModeOptions = {
  enabled: true,
  momentum: false,
};

/**
 * A group with no items is never rendered, so it can never be opened.
 *
 * The ORIGINAL index is carried through the filter on purpose: the entry
 * component's `openGroup` resolves a group index against the unfiltered list
 * (and against the flattened frames), so a filtered re-index would silently
 * open the wrong reel the moment a zero-item group sat in the middle.
 */
const visibleGroups = computed(() =>
  props.groups
    .map((group, groupIndex) => ({ group, groupIndex }))
    .filter((entry) => entry.group.items.length > 0)
    .map((entry, railIndex) => ({ ...entry, railIndex })),
);
</script>

<template>
  <!--
    Deliberately NOT `role="list"`: Swiper owns the slide `<div>`s and gives them
    no role, so a `role="list"` would have unroled children. Stated here so
    nobody "fixes" it.

    `swiper.css` sets `.swiper { overflow: hidden }` and is left alone — which is
    why no card uses `hover:scale`. Overriding it with a Tailwind
    `overflow-visible` would be a source-order gamble against the library's own
    stylesheet; `active:scale-95` sidesteps the problem entirely.
  -->
  <Swiper
    :modules="listModules"
    class="story-rail"
    :slides-per-view="4.5"
    :space-between="10"
    wrapper-class="!px-3"
    :free-mode="listFreeMode"
    :watch-overflow="false"
  >
    <SwiperSlide v-for="entry in visibleGroups" :key="entry.group.id">
      <FeaturesStoryCard
        :group="entry.group"
        :index="entry.railIndex"
        :seen="seen.has(entry.group.id)"
        @select="emit('select', entry.groupIndex)"
      />
    </SwiperSlide>
  </Swiper>
</template>

<style scoped>
/**
 * The same house curve the viewer uses, through Swiper's documented custom
 * property. `swiper.css` reads it with a default of `initial` (i.e. `ease`).
 */
.story-rail {
  --swiper-wrapper-transition-timing-function: var(--ease-out);
}
</style>
