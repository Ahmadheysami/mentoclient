<script setup lang="ts">
import { useRafFn } from "@vueuse/core";
import { STORY_VIEWER_COLORS } from "~/types/story";

/**
 * The segmented progress bar AND the whole timing engine.
 *
 * Location matters: this component owns the *mechanism* (`elapsed`), knows
 * nothing about Swiper, and reports "this frame is over" with one `expire`
 * event. The parent owns the *reasons* to stop (`paused`, already OR'd) and
 * navigation. ~40 lines with a single consumer is more idiomatic Vue here than
 * a controller object passed down, and it avoids inventing a store for what is
 * ephemeral session state that must never survive a reload.
 */
const props = defineProps<{
  /** `${groupId}:${itemId}` — the frame identity the engine resets on. */
  itemKey: string;
  total: number;
  activeIndex: number;
  durationMs: number;
  /** One boolean; every reason is already OR'd in by the parent. */
  paused: boolean;
}>();

const emit = defineEmits<{ expire: [] }>();

/**
 * One fill element per segment, indexed by the segment's 0-BASED position.
 *
 * Index-keyed on purpose, and this is load-bearing. A single "current fill" ref
 * bound to a `v-else-if` branch CANNOT work here: those two branches compile to
 * KEYED block vnodes (`key: 0` / `key: 1`), so every `activeIndex` change is an
 * unmount + mount rather than an in-place patch. Vue calls a function ref with
 * `null` on unmount and does not restore the old value, and the `v-for` is
 * patched in ascending index order — so on a BACKWARD move (`1 → 0`) the
 * incoming element is captured first and the outgoing one nulls it LAST. The
 * segment then sat at `scaleX(0)` for the rest of the frame on every back-swipe.
 *
 * One always-mounted fill per segment removes the question entirely: the refs
 * never move, only `data-active` / `data-done` do.
 *
 * Invariant: at most ONE element in the whole bar carries an inline `transform`
 * at any time — the one `paint()` wrote to last. `painted` below is what keeps
 * it that way.
 *
 * Non-reactive on purpose: only `paint()` reads it, ~60×/s. Slots past `total`
 * are never read (`activeIndex` is always `< total`), and an unmounted segment
 * nulls its own slot through this same ref, so a shrinking `total` is harmless.
 */
const fills: (HTMLElement | null)[] = [];

/** Real milliseconds, accumulated — never frames. */
let elapsed = 0;
/** Latched, so a slow frame or a long task cannot fire `expire` twice. */
let fired = false;
/**
 * The segment `paint()` last wrote to — and, by the invariant above, the ONLY
 * element in the bar that can hold an inline `transform`. It exists so that one
 * can be dropped again: an inline `style` out-competes
 * `.story-seg-fill[data-done]`, so a segment that was active at `scaleX(0.37)`
 * would otherwise freeze at 37 % for the rest of the reel.
 *
 * NOT reset on an `itemKey` change — that would skip the cleanup of the very
 * segment that is about to become `data-done`.
 */
let painted = -1;

function setFill(i: number, el: HTMLElement | null) {
  fills[i - 1] = el;
}

/**
 * The outgoing segment is handed back to `[data-done]` BEFORE the new one is
 * painted, in the same synchronous call, so there is never a frame where the
 * bar shows the old fill on a segment that claims to be complete.
 */
function paint() {
  const next = props.activeIndex;

  if (painted !== next) {
    fills[painted]?.style.removeProperty("transform");
    painted = next;
  }

  const el = fills[next];
  if (!el || props.durationMs <= 0) return;

  const ratio = Math.min(1, elapsed / props.durationMs);

  el.style.transform = `scaleX(${ratio.toFixed(4)})`;
}

function tick({ delta }: { delta: number }) {
  // Clamp the step: after a long GC, a backgrounded tab or a janky slide the
  // first frame back can carry seconds. Without this the story fast-forwards
  // through itself. The cost of clamping is that a stalled frame loses time
  // rather than making it up — which is the behaviour we want, and the reason
  // the parent also auto-pauses on `document.visibilitychange`.
  elapsed += Math.min(delta, 100);

  if (elapsed >= props.durationMs) {
    elapsed = props.durationMs;

    if (!fired) {
      fired = true;
      emit("expire");
    }
  }

  paint();
}

// No `fpsLimit`: the fill is a transform on a promoted layer and 60 fps is the
// whole point of the bar. A CSS `animation` is not an option — it cannot be
// read back, so the visual bar and the "advance now" decision would be two
// clocks that drift. `useRafFn` cancels the frame id in `pause()` and registers
// `tryOnScopeDispose(pause)`, so unmount cannot leak the loop.
const { pause, resume } = useRafFn(tick, { immediate: false });

// Reset on frame identity ONLY — not on `paused`, not on `activeIndex` (a group
// change is always a frame change). `flush: 'sync'` so a fast swipe cannot paint
// a stale bar into the outgoing item.
watch(
  () => props.itemKey,
  () => {
    elapsed = 0;
    fired = false;

    // Re-paint after the patch: with `flush: 'sync'` the DOM has not been
    // patched yet, so `fills[activeIndex]` can still be `null` (this group has a
    // different segment count) or hold the OUTGOING item's element — and that
    // outgoing element is the one `paint()` has to strip the stale inline
    // `scaleX` from. This is also what a segment coming back from `data-done`
    // needs, or it keeps a stale fill for one frame.
    nextTick(paint);
  },
  { flush: "sync" },
);

// One effect, not two: it must also cover the initial state, where `paused` is
// already false and a plain `watch` would never fire.
watchEffect(() => (props.paused ? pause() : resume()));
</script>

<template>
  <!--
    `role="progressbar"` carries the value; every track is `aria-hidden` because
    the per-segment bar is decorative on its own.
  -->
  <div
    class="flex items-center gap-1 h-0.5"
    role="progressbar"
    aria-valuemin="0"
    :aria-valuemax="total"
    :aria-valuenow="activeIndex"
    :aria-valuetext="`پیشرفت ${faNumber(activeIndex + 1)} از ${faNumber(total)}`"
  >
    <!--
      Segment order is automatic: a `v-for` inside this `dir=rtl` flex row puts
      segment `0` physically on the RIGHT. No `flex-row-reverse`, which would
      fight the document direction.

      Exactly ONE fill per segment, always mounted, ref-keyed by the 1-based
      `i` — see the `fills` docblock above for why. The two state attributes are
      bound with `|| undefined` because the CSS selectors are PRESENCE
      selectors: `data-done="false"` would still match `[data-done]`.
    -->
    <span
      v-for="i in total"
      :key="i"
      class="relative flex-1 h-0.5 overflow-hidden rounded-full"
      :style="{ backgroundColor: STORY_VIEWER_COLORS.barTrack }"
      aria-hidden="true"
    >
      <span
        :ref="(el: unknown) => setFill(i, el as HTMLElement | null)"
        class="story-seg-fill absolute inset-0 rounded-full bg-white"
        :data-done="i - 1 < activeIndex || undefined"
        :data-active="i - 1 === activeIndex || undefined"
      />
    </span>
  </div>
</template>

<style scoped>
/**
 * `transform: scaleX`, never `width`: animating width reflows the track AND
 * every sibling segment on each frame and drops the compositor layer. scaleX
 * is compositor-only, which is the only reason the bar can track the clock at
 * 60 fps on a mid-range phone. These three states live in CSS rather than as
 * Tailwind utilities so that no utility can out-compete the engine's inline
 * `transform`.
 *
 * The flip side, which the engine owns: an inline `transform` out-competes
 * `[data-done]` too, so `paint()` REMOVES the inline transform from the segment
 * it stops writing to. Change one without the other and a finished segment
 * freezes at a partial fill.
 */
.story-seg-fill {
  transform: scaleX(0);
}

.story-seg-fill[data-done] {
  transform: scaleX(1);
}

.story-seg-fill[data-active] {
  /* Physical, and correct BECAUSE the app is permanently RTL: the bar must
     grow from the right edge towards the left. `origin-right` looks like a bug
     to a reader who has not internalised dir="rtl" — that is why it is spelled
     out here rather than left as a utility. */
  transform-origin: right center;
  will-change: transform;
}

/* A5 is deliberately exempt from the global reduced-motion rule the other
   scoped blocks carry: the progress bar *is* the information, not decoration,
   so a reader who asked for less motion still gets the countdown. Only these
   two transforms are dropped. */
@media (prefers-reduced-motion: reduce) {
  .story-seg-fill[data-done],
  .story-seg-fill[data-active] {
    animation: none;
    transition: none;
  }
}
</style>
