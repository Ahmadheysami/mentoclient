<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";

/**
 * The activation, in progress: what the reader is looking at from the frame they
 * press «مطمئنم، فعال‌سازی کن» until the answer arrives.
 *
 * ## WHY THIS IS A SCREEN AND NOT A SPINNER ON A BUTTON
 *
 * The call runs Gemini (`POST /panels/shared/modules/astrology`), so it can take
 * tens of seconds — long enough that a reader who cannot tell a request from a
 * freeze will press «تایید» again, leave the page, or assume the app is broken. A
 * spinner inside the confirmation's button is honest but small: it sits behind a
 * modal, it disappears the moment the dialog is dismissed, and it says nothing
 * about how long this is supposed to take. This panel replaces the form for the
 * whole of the request, and it is the durable half of the feedback — it survives
 * the reader closing the dialog mid-flight, which is exactly when they need to
 * see that something irreversible is still running.
 *
 * ## THE STAGES ARE NARRATION, NOT A MEASUREMENT
 *
 * Each line describes work that genuinely happens on the server, in the order it
 * happens, and none of them is a percentage. There is deliberately **no progress
 * bar**: the request has no stage this client can observe, so any bar that filled
 * up over time would be a number invented here — and a bar that stops at 90% and
 * waits would be a lie about a wait nobody has measured. The one honest signal
 * about duration is the last line, which appears only after the stages have run
 * out and says the process is slow.
 *
 * `useIntervalFn` is VueUse's own timer and stops itself when this component's
 * scope is disposed, so nothing keeps ticking after the panel is gone. It starts
 * in `onMounted` rather than with `immediate: true`, so no timer is created during
 * SSR at all.
 */

/**
 * The stages, in the order the server performs them.
 *
 * "ثبت" is what the handler does before Gemini is called (it writes the birth data
 * and charges the wallet), "محاسبهٔ نقشهٔ تولد" is the chart itself, and the last
 * one is the model writing the Markdown. Each is a real step, so a reader who
 * watches them go by is watching the real order of the work — and the numbering
 * index past the end is what brings in the honest "this takes a while" line.
 */
const STAGES = [
  "اطلاعات تولد شما در حال ثبت شدن است.",
  "نقشهٔ تولد شما در حال محاسبه است.",
  "گزارش شما توسط هوش مصنوعی نوشته می‌شود.",
] as const;

/** Held from here to the end of the request: it is a wait, and now we say so. */
const WAITING_LABEL =
  "این فرایند کمی طول می‌کشد؛ لطفاً تا پایان آن در همین صفحه بمانید.";

/**
 * How long one stage stays on screen. Four seconds is long enough to be read and
 * short enough that the panel does not look stuck on a slow connection; the
 * stages are narration, so a wrong guess costs nothing but a moment.
 */
const STAGE_MS = 4000;

/** How many stage lines have been shown, monotonically — never decremented. */
const stageIndex = ref(0);

const { resume: resumeStages } = useIntervalFn(() => {
  stageIndex.value += 1;
}, STAGE_MS, { immediate: false });

/**
 * `min` and not a wrap: past the last stage the honest line replaces the
 * narration and stays, instead of cycling back to the first one and implying the
 * request has started over.
 */
const stageLabel = computed<string>(
  () => STAGES[stageIndex.value] ?? WAITING_LABEL,
);

onMounted(resumeStages);
</script>

<template>
  <section
    class="rounded-3xl border border-x-primary-100 bg-white p-6 text-center"
    role="status"
    aria-live="polite"
  >
    <!--
      The same icon the plan checkout uses for its own in-flight transaction
      (`Plan/BuyModal.vue`), so "the app is working on your coins" looks the same
      wherever it happens. `aria-hidden` because the sentence below is what a
      screen reader should hear — an animated icon announces nothing.
    -->
    <UIcon
      name="line-md:loading-twotone-loop"
      size="40"
      aria-hidden="true"
      class="mx-auto text-x-primary-500"
    />

    <!--
      An `<h2>`, like every other section heading in this feature: the panel
      chrome already renders the page's `<h1>` (`AppPanelHeader`).
    -->
    <h2 class="mt-4 font-yekan-bold text-x-text-title">
      در حال فعال‌سازی طالع‌بینی
    </h2>

    <!--
      `min-h-14` reserves TWO lines (`leading-7`), so a stage swapping to a longer
      sentence cannot push the panel's own content around. The panel replaces the
      form in place, so any movement here is movement of the whole screen below
      the reader's thumb — the one shift this moment can least afford.
    -->
    <p
      class="mt-2 flex min-h-14 items-center justify-center text-sm leading-7 text-x-text-subtitle"
    >
      {{ stageLabel }}
    </p>

    <!--
      The indeterminate bar: motion with no percentage, so it promises nothing
      about how much is left. It is the only part of this panel that moves on its
      own, and it is the part that is dropped under `prefers-reduced-motion`.
    -->
    <div
      class="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-x-primary-100"
      aria-hidden="true"
    >
      <span class="astrology-activating__bar block h-full w-1/2 rounded-full bg-x-primary-500" />
    </div>
  </section>
</template>

<style scoped>
/*
 * `transform` is animated and `width` is not, so the sweep stays on the
 * compositor and never relayouts the track it slides inside.
 *
 * 1.1s, linear, infinite: a sweep that eases back and forth reads as a stall,
 * and this wait is genuinely long enough for that to be noticed.
 */
.astrology-activating__bar {
  animation: astrology-activating-sweep 1100ms linear infinite;
}

@keyframes astrology-activating-sweep {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(-100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  /*
   * The sweep stops and the track is left as a dim, full-width rule: the motion
   * was decoration, the bar's presence is information. The stage lines keep
   * advancing above it — those are words changing, not movement.
   */
  .astrology-activating__bar {
    animation: none;
    width: 100%;
    opacity: 0.4;
  }
}
</style>
