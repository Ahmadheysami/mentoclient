<script setup lang="ts">
import { Swiper, SwiperSlide } from "swiper/vue";
import { A11y, Keyboard } from "swiper/modules";
import "swiper/css";
import "swiper/css/a11y";
import { useDocumentVisibility, useEventListener, useTimeoutFn } from "@vueuse/core";
import {
  STORY_VIEWER_COLORS,
  flattenStoryGroups,
  storyItemDuration,
} from "~/types/story";
import type { StoryGroup } from "~/types/story";
import type { Swiper as SwiperClass, A11yOptions, KeyboardOptions } from "swiper/types";

/**
 * The fullscreen story viewer: `UModal` + ONE flat Swiper + navigation + the
 * pause reasons + the Android hardware-back entry.
 *
 * Why a single flat Swiper over `flattenStoryGroups(groups)` rather than one
 * Swiper per story: Swiper binds its pointer handlers to the wrapper and claims
 * any drag that starts on a descendant, so two horizontal carousels nested in an
 * RTL stack is the worst case — the inner one starves the outer and the outer
 * can only be dragged from a region the inner does not cover. Flattened, the
 * tap zones live *inside* the slides, so the same `pointerdown` both starts a
 * drag and (on a clean `click`) fires the tap, and Swiper's own
 * `preventClicks` + `preventClicksPropagation` arbitrate the two with zero
 * custom code. It also means "next item", "next story" and "next story's first
 * item" are all just `slideNext()`, and the progress bar and the header read
 * from ONE cursor.
 *
 * Why `UModal` and not a hand-rolled `Teleport`: a fullscreen overlay is exactly
 * a modal dialog, and Reka hands over `role="dialog"`, `aria-labelledby` /
 * `aria-describedby`, a trapped focus scope with focus restored on unmount,
 * Escape / outside dismissal, `aria-hidden` on the rest of the document, the
 * body scroll lock, and the portal — all for free. `aria-modal` is deliberately
 * NOT forced: Reka omits it in favour of `useHideOthers`, and Nuxt UI 4.9.0
 * offers no clean injection path (`UModal` does not forward `$attrs`, and its
 * `content` prop is spread with `v-bind` from a getter-ref that Vue's
 * `guardReactiveProps` + `normalizeProps` do not unwrap). `useHideOthers`
 * already does the job.
 *
 * The parent mounts this with `v-if`, NOT via the modal's `open`: Reka's
 * `Presence` only renders `DialogContent` while `open` is true, so a
 * permanently-mounted `UModal` would hand Swiper a `null` element and it would
 * never initialise. Mounting fresh per open is also what guarantees a clean
 * `swiper.destroy()`, a clean `tryOnScopeDispose(pause)` on the rAF, and a
 * clean `popstate` removal — and it keeps the whole viewer (Swiper, rAF,
 * `popstate`) out of the SSR payload, so hydration has nothing to mismatch.
 */
const props = defineProps<{
  groups: StoryGroup[];
  /** Flat index to open at — the rail resumes where the reader stopped. */
  startSlide: number;
}>();

const emit = defineEmits<{
  close: [];
  finished: [];
  progress: [groupId: string, itemIndex: number];
}>();

/* ------------------------------------------------------------------ modules -- */

const viewerModules = [A11y, Keyboard];

/**
 * Hoisted rather than inlined in the template: an inline object literal is a
 * NEW object on every render, and Swiper's `getChangedParams` would then see a
 * changed `a11y` / `keyboard` param on every update.
 */
const viewerA11y: A11yOptions = {
  enabled: true,
  slideRole: "group",
  slideLabelMessage: "{{index}} از {{slidesLength}}",
  prevSlideMessage: "استوری قبلی",
  nextSlideMessage: "استوری بعدی",
  firstSlideMessage: "ابتدای استوری",
  lastSlideMessage: "انتهای استوری",
  containerMessage: "استوری‌ها",
  containerRoleDescriptionMessage: "اسلاید",
  /**
   * Off ON PURPOSE. Swiper's `A11y` module sets `aria-live="polite"` on the
   * wrapper when its OWN autoplay is off — and this viewer drives timing with a
   * hand-rolled rAF (`ViewerProgress`), not Swiper autoplay. So at the default
   * `true` every auto-advance, ~5 s apart, queues a full announcement of the
   * outgoing and incoming slide, forever. The progress bar's `aria-valuetext`
   * and the modal description already say where the reader is.
   */
  wrapperLiveRegion: false,
};

const viewerKeyboard: KeyboardOptions = { enabled: true, onlyInViewport: true };

/* -------------------------------------------------------------------- state -- */

const frames = computed(() => flattenStoryGroups(props.groups));

const swiper = shallowRef<SwiperClass | null>(null);
/** Clamped so a stale `startSlide` can never leave the cursor off the list. */
const startIndex = computed(() =>
  Math.min(Math.max(props.startSlide, 0), Math.max(frames.value.length - 1, 0)),
);
// Seeded from `startIndex` rather than 0, so the progress bar's first frame
// identity is the frame the reader is actually opening, before `onSwiperReady`
// has had a chance to correct it.
const activeIndex = ref(startIndex.value);
const manualPaused = ref(false);
const isTransitioning = ref(false);
const visibility = useDocumentVisibility();

/**
 * ONE boolean for the child. Every reason to stop lives here, so
 * `ViewerProgress` never has to know why it is stopped.
 *
 * The visibility term is the tab-backgrounding guard: rAF stops when hidden, so
 * the first frame back would otherwise carry seconds of `delta` and the story
 * would fast-forward. (The engine clamps its step too, but losing time quietly
 * is the better of the two behaviours.)
 */
const isPaused = computed(
  () =>
    manualPaused.value ||
    isTransitioning.value ||
    visibility.value !== "visible",
);

const currentFrame = computed(() => frames.value[activeIndex.value] ?? null);
const currentGroup = computed(() => currentFrame.value?.group ?? null);
const totalSegments = computed(() => currentGroup.value?.items.length ?? 0);
const frameDuration = computed(() =>
  currentFrame.value ? storyItemDuration(currentFrame.value.item) : 0,
);

const a11yTitle = computed(() =>
  currentGroup.value ? `استوری ${currentGroup.value.author.title}` : "استوری",
);
const a11yDescription = computed(() =>
  currentGroup.value
    ? `${currentGroup.value.title} — بخش ${activeIndex.value + 1} از ${frames.value.length}`
    : "نمایش استوری",
);

/**
 * The four colours the viewer root cannot express as a stock Tailwind utility:
 * the two CTA-gradient stops (`--story-accent-*`, read by `LinkColorized`'s
 * `.story-cta` fallbacks) and the two placeholder-gradient stops
 * (`--story-placeholder-*`, read by `ViewerSlide`'s `.story-placeholder`).
 *
 * Everything else in the dark viewer stays a utility on purpose: both scrims are
 * `bg-linear-to-* from-black/…`, the header text is `text-white` /
 * `text-white/70`, and the progress fills are `bg-white`. `STORY_VIEWER_COLORS`
 * documents the tokens those exact values came from.
 */
const viewerVars = {
  "--story-accent-from": STORY_VIEWER_COLORS.accentFrom,
  "--story-accent-to": STORY_VIEWER_COLORS.accentTo,
  "--story-placeholder-from": STORY_VIEWER_COLORS.placeholderFrom,
  "--story-placeholder-to": STORY_VIEWER_COLORS.placeholderTo,
} as const;

/**
 * The `UModal` theme overrides, read from `@nuxt/ui@4.9.0`
 * `dist/shared/ui.*.mjs` L4105-4161.
 *
 * `overlay` — the theme is `fixed inset-0` + `bg-elevated/75` and is kept
 * rendered ON PURPOSE: Reka's `DialogOverlayImpl` owns `useBodyScrollLock(true)`,
 * so `:overlay="false"` would silently drop the body scroll lock. `bg-black!`
 * makes it deterministic and invisible under the opaque panel. The theme has no
 * blur today, so `backdrop-blur-none!` is a no-op today — it is here because it
 * is the verified-working symmetric counterpart of this repo's own
 * `overlay: 'backdrop-blur-md'`, and it survives a theme bump. It is the ONLY
 * blur string anywhere in this feature.
 *
 * `content` — the theme is `bg-default divide-y divide-default flex flex-col
 * focus:outline-none`. `bg-black!` is the dark canvas; `divide-y-0` kills the
 * hairline `divide-y` would draw between the `#content` children;
 * `rounded-none` / `ring-0` / `shadow-none` remove dialog chrome.
 * `@variant dark (false)` in `main.css` disables every `dark:` utility
 * app-wide, so the viewer is built from explicit classes and one scoped block —
 * never `dark:`.
 *
 * Hoisted for the same reason as `viewerA11y`: an inline literal in the
 * template is a new object every render.
 */
const viewerUi = {
  overlay: "bg-black! backdrop-blur-none!",
  content: "bg-black! divide-y-0 rounded-none ring-0 shadow-none",
};

/* ---------------------------------------------------------------- navigation -- */

function reportProgress() {
  const frame = currentFrame.value;
  if (frame) emit("progress", frame.group.id, frame.itemIndex);
}

function next() {
  if (activeIndex.value < frames.value.length - 1) {
    swiper.value?.slideNext(260);
  } else {
    emit("finished");
  }
}

function prev() {
  // At frame 0 this is a deliberate no-op: a back-swipe must never close the
  // viewer, so a mis-swipe cannot lose the reader's place.
  if (activeIndex.value > 0) swiper.value?.slidePrev(260);
}

function onSwiperReady(instance: SwiperClass) {
  swiper.value = instance;
  activeIndex.value = instance.activeIndex;
  reportProgress();
}

/**
 * Swiper's `emit()` unshifts the instance as the first argument before fanning
 * out to `onAny`, so the Vue wrapper really does receive the instance here —
 * `slideChange` itself carries no payload.
 */
function onSlideChange(instance: SwiperClass) {
  activeIndex.value = instance.activeIndex;
  reportProgress();
}

function onTransitionStart() {
  isTransitioning.value = true;
}

function onTransitionEnd() {
  isTransitioning.value = false;
}

/* ------------------------------------------------------------ hold to pause -- */

/**
 * 120 ms is the whole trick: a quick tap-to-advance ends its press before the
 * timer fires, so tapping never also pauses.
 */
const hold = useTimeoutFn(
  () => {
    manualPaused.value = true;
  },
  120,
  { immediate: false },
);

function onHold(held: boolean) {
  if (held) {
    hold.start();
    return;
  }

  hold.stop();
  // Resume from the SAME `elapsed` — never from zero.
  manualPaused.value = false;
}

/* ------------------------------------------------------- android back button -- */

/**
 * The viewer is not a route, so the hardware back button would leave the page.
 * One history entry is pushed on mount, and `popped` makes sure it comes off
 * EXACTLY once, on every exit path:
 *
 *   • Escape / outside click / the header ✕ → `close()` pops it;
 *   • `finished` (the reel running to its end) never goes through `close()` —
 *     the parent unmounts the viewer directly — so `onBeforeUnmount` pops it;
 *   • Android hardware back → the BROWSER pops it, the `popstate` handler
 *     latches `popped` and only emits `close`, so nothing pops a second time.
 *
 * One flag rather than a `poppedByBack` plus a `popped`: they can never
 * disagree, and two booleans guarding one `history.back()` is a bug waiting to
 * be written. This is the only place the feature touches `history`; it goes
 * away the moment the app grows a global back-button composable.
 */
let popped = false;
/** Defence in depth: no path may emit `close` twice. */
let closing = false;

onMounted(() => {
  window.history.pushState({ storyViewer: true }, "");
});

useEventListener("popstate", () => {
  // The traversal above already removed our entry — latching here is what stops
  // `onBeforeUnmount` from walking the reader one step further back.
  popped = true;
  emit("close");
});

/** Idempotent by construction, so every caller is safe and none can loop. */
function popEntry() {
  if (popped) return;

  popped = true;
  window.history.back();
}

onBeforeUnmount(popEntry);

function onUpdateOpen(open: boolean) {
  // `open` is a controlled `true` here, so Reka's own Escape / outside-click
  // dismissal cannot close anything by itself — it only asks. Routing the ask
  // through the same `close()` is what makes the Escape key the spec promises
  // (§5.1) actually work.
  if (!open) close();
}

function close() {
  if (closing) return;
  closing = true;

  emit("close");
  popEntry();
}
</script>

<template>
  <UModal
    open
    fullscreen
    :transition="false"
    :title="a11yTitle"
    :description="a11yDescription"
    :ui="viewerUi"
    @update:open="onUpdateOpen"
  >
    <template #content>
      <!--
        A1 — replaces `UModal`'s untunable `scale-in` (which `:transition="false"`
        turns off). A subtle scale rather than a slide, so the viewer reads as
        "a layer opened" rather than "a page pushed".
        A2 — there is NO exit animation: Reka's `Presence` unmounts the instant
        `open` goes false, and Instagram closes instantly too. Accepted.
      -->
      <section
        class="story-root absolute inset-0 overflow-hidden bg-black"
        :style="viewerVars"
      >
        <Swiper
          class="story-swiper"
          :modules="viewerModules"
          direction="horizontal"
          :slides-per-view="1"
          :space-between="0"
          :speed="260"
          :initial-slide="startIndex"
          :threshold="14"
          :resistance-ratio="0.7"
          :watch-overflow="false"
          :a11y="viewerA11y"
          :keyboard="viewerKeyboard"
          @swiper="onSwiperReady"
          @slide-change="onSlideChange"
          @slide-change-transition-start="onTransitionStart"
          @slide-change-transition-end="onTransitionEnd"
        >
          <SwiperSlide v-for="(frame, i) in frames" :key="frame.key">
            <FeaturesStoryViewerSlide
              :frame="frame"
              :index="i"
              :active-index="activeIndex"
              @prev="prev"
              @next="next"
              @hold="onHold"
            />
          </SwiperSlide>
        </Swiper>

        <!--
          ONE chrome column, not two absolutely-positioned layers: the header's
          top padding is then simply the bar's height, and the scrim gradient
          covers both in a single paint. A GRADIENT, not a blur.
        -->
        <div
          class="absolute inset-x-0 top-0 z-40 flex flex-col bg-linear-to-b from-black/88 via-black/45 to-transparent pt-[calc(0.5rem+env(safe-area-inset-top))] pb-8"
        >
          <FeaturesStoryViewerProgress
            v-if="currentFrame"
            :item-key="currentFrame.key"
            :total="totalSegments"
            :active-index="currentFrame.itemIndex"
            :duration-ms="frameDuration"
            :paused="isPaused"
            @expire="next"
          />

          <FeaturesStoryViewerHeader
            v-if="currentGroup && currentFrame"
            :author="currentGroup.author"
            :item="currentFrame.item"
            :manual-paused="manualPaused"
            @toggle="manualPaused = !manualPaused"
            @next="next"
            @close="close"
          />
        </div>
      </section>
    </template>
  </UModal>
</template>

<style scoped>
/**
 * The one Swiper rule we own, and it is not a Tailwind class.
 *
 * `position` / `inset` / `z-index` are declared HERE rather than as
 * `absolute inset-0 z-0` utilities because of a source-order hazard the spec
 * flags elsewhere: `swiper.css` is emitted into the page's CSS chunk, which the
 * build injects AFTER the Tailwind entry chunk, and `.swiper` ships
 * `position: relative; z-index: 1`. Equal specificity, later source order — so
 * the utilities would be silently dead, the Swiper would size to its content
 * (zero, because `.swiper-slide { height: 100% }` resolves against an auto
 * height), and the viewer would render empty. A scoped rule carries a
 * `[data-v-*]` attribute, so it wins on specificity alone and cannot lose this
 * race on a future chunk re-order.
 *
 * `--swiper-wrapper-transition-timing-function` is the library's own documented
 * hook (`swiper.css` reads it with a default of `initial`, i.e. `ease`). It puts
 * the house curve on the one motion that carries meaning (A3) without touching
 * the library.
 *
 * There is deliberately NO `rtl` / `direction` override here: `dir="rtl"` is
 * hard-coded in `nuxt.config.ts → app.head.htmlAttrs`, `direction: rtl`
 * inherits, and Swiper reads it with `getComputedStyle`, setting `swiper.rtl`
 * and `rtlTranslate` itself. There is no `rtl` param to pass, and the existing
 * `Carousel.vue` never passed one. Likewise `.swiper-horizontal { touch-action:
 * pan-y }` is left alone — it is what keeps vertical drags as the browser's and
 * hands horizontal ones to Swiper.
 */
.story-swiper {
  position: absolute;
  inset: 0;
  z-index: 0;
  --swiper-wrapper-transition-timing-function: var(--ease-out);
}

.story-root {
  animation: story-in 240ms var(--ease-out) both;
}

@keyframes story-in {
  from {
    opacity: 0;
    transform: scale(1.04);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .story-root {
    animation: none;
  }
}
</style>
