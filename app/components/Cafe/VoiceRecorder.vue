<script setup lang="ts">
/**
 * The press-and-hold capture bar — what replaces the composer while a voice note
 * is being recorded.
 *
 * ## WHY IT IS EXACTLY THE COMPOSER'S HEIGHT
 *
 * `CafeComposerShell` is `px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]`
 * around a `h-12` field, and this bar uses the **same three paddings around the
 * same `h-12` row**. That is not tidiness — it is the whole point of swapping
 * between the two. A recording bar that is even 4px taller shifts every message
 * in the thread up by 4px when it appears, and the transcript visibly jumps at
 * the exact moment the reader is looking at it to check whether the mic picked
 * up their voice.
 *
 * ## WHY THE MIC IS AT THE INLINE-END AND THE TRASH AT THE INLINE-START
 *
 * Mirrored from Screen B, and deliberately the **same position the composer's
 * mic occupies** — it is literally the same button, lit up. The composer's DOM
 * order is `+`, input, mic, so the mic is the LAST child and renders at the
 * physical left in this hard-coded RTL. Here the trash is first and the mic is
 * last, which puts the trash at the physical right and the mic where the reader
 * just pressed. Moving the button they are holding to a different corner would
 * be the single most disorienting thing this component could do.
 *
 * ## THE WAVEFORM IS SEEDED, NOT RANDOM
 *
 * `Math.random()` in a render draws one waveform on the server and another on
 * the phone, and Vue patches the difference as a flash on the most animation-heavy
 * surface in the app. The 16 base heights are therefore derived from the bar's
 * index with FNV-1a — the same trick, and the same reason, as the playback
 * waveform in `CafeMessageBubble`.
 *
 * `amplitude` then *scales* that fixed shape rather than replacing it. That is
 * the "seeded/decaying" behaviour: the bars keep their identity while they grow
 * and shrink with the level, so the shape stays recognisable from one second to
 * the next instead of flickering into a different waveform 60 times a second —
 * which is what a purely random bar does, and it reads as noise rather than as
 * the reader's own voice.
 *
 * A 4px floor means silence still draws a row rather than an empty gap, which is
 * how the reader knows the recorder is running at all.
 *
 * ## WHY THERE IS NO `toggle` EVENT
 *
 * Switching between press-and-hold and tap-to-record is a *mode* the page owns
 * (it decides whether the mic is held or tapped), and it needs the
 * `MediaRecorder`, which this primitive must not know about. This component
 * emits `cancel` and `send` and nothing else, so a Phase 2 page cannot
 * accidentally build a mode switch on top of a bar that cannot tell the two
 * apart.
 *
 * ## WHY THE MIC BUTTON IS `disabled`
 *
 * **This bar only exists while a recording is already running.** It replaces the
 * composer the moment a recording starts; the press that started it is the
 * composer's own `mic` event. So the black mic here is not a control at all — it
 * is the one place the reader can see that the microphone is live, which is why
 * it pulses. The only two live controls are the trash (throw the take away) and
 * the send (keep it).
 *
 * That also settles the count: the brief's three regions — mic at the inline-end,
 * trash at the inline-start, waveform in the middle — leave no room for a fourth
 * control, so the send button sits beside the mic at the inline-end, outermost.
 * That is where the commit action belongs anyway: it is the one control whose
 * whole job is to be unambiguous, and the outermost edge of a row is the least
 * ambiguous position there is.
 */
const props = withDefaults(
  defineProps<{
    /** Lights the mic's pulse ring and opens the waveform up. */
    recording: boolean;
    /** Whole seconds elapsed. Drives the timer and the send button's disabled state. */
    seconds?: number;
    /** Input level, 0–1. Anything outside is clamped; anything non-finite reads 0. */
    amplitude?: number;
    disabled?: boolean;
  }>(),
  { seconds: 0, amplitude: 0, disabled: false },
);

const emit = defineEmits<{
  cancel: [];
  send: [];
}>();

/** 16 bars: enough to read as a waveform, few enough that 4px is still 4px. */
const BAR_COUNT = 16;

/** The resting height of a bar, and the most a bar can reach. */
const BAR_MIN = 4;
const BAR_MAX = 18;

/**
 * FNV-1a over the index, so every bar has a fixed, reproducible "voice" of its
 * own. `MessageBubble.waveform` uses the identical routine for the same reason.
 */
const BAR_SEED: number[] = Array.from({ length: BAR_COUNT }, (_, index) => {
  let hash = 2166136261 ^ (index + 1);

  hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  hash ^= hash >>> 16;

  return BAR_MIN + ((hash >>> 0) / 4294967295) * (BAR_MAX - BAR_MIN);
});

/**
 * `NaN`, a string, a negative number or 4 all arrive at a mic analyser at some
 * point, and each of them would otherwise become `NaN` in an inline style and
 * silently collapse the row to nothing.
 */
const level = computed(() => {
  const raw = props.amplitude;

  if (!Number.isFinite(raw)) return 0;

  return Math.min(Math.max(raw, 0), 1);
});

/**
 * While idle the bars sit at their floor; while recording they scale with the
 * level. A partial `level` on an idle bar would make the recorder look like it
 * is hearing something before the reader has said anything.
 */
const bars = computed(() =>
  BAR_SEED.map((seed) => {
    const height = props.recording ? BAR_MIN + (seed - BAR_MIN) * level.value : BAR_MIN;

    return `${Math.round(height)}px`;
  }),
);

/** Persian zero, because `padStart` on «۵» has to be padded with a Persian digit. */
const PERSIAN_ZERO = "۰";

/**
 * `mm:ss` in Persian digits, `tabular-nums` so the label does not jitter as the
 * seconds tick — a timer that shifts sideways twice a second is unreadable.
 *
 * Minutes are not wrapped at 60 and are **not** abbreviated: «۱:۰۵» is ambiguous
 * (is it one minute or an hour and a bit?) and a voice note longer than an hour
 * is not a thing this app can produce.
 */
const timer = computed(() => {
  const total = Number.isFinite(props.seconds) ? Math.max(Math.floor(props.seconds), 0) : 0;

  const minutes = faNumber(Math.floor(total / 60));
  const seconds = faNumber(total % 60).padStart(2, PERSIAN_ZERO);

  return `${minutes}:${seconds}`;
});

/**
 * Nothing was captured, so there is nothing to send. A `disabled` send button is
 * the honest drawing of that; enabling it and refusing on press would be a
 * control that lies about what it can do.
 */
const canSend = computed(() => props.seconds > 0 && !props.disabled);
</script>

<template>
  <!--
    `bg-x-primary-content-50`, unlike the composer's `x-primary-content-200`
    bar: while recording, the input pill is gone and there is nothing for a gray
    bar to separate. The two bars share their padding, not their ground.

    `aria-live` is deliberately absent. A timer that announces itself every
    second would interrupt a screen reader mid-sentence for the whole length of
    the recording; `role="timer"` below is the accessible way to expose the
    elapsed time without announcing it.
  -->
  <div
    class="flex items-center gap-2 border-t border-slate-200 bg-x-primary-content-50 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
  >
    <button
      type="button"
      :disabled="disabled"
      aria-label="لغو ضبط"
      class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-x-text-subtitle transition-colors hover:bg-x-primary-content-200 disabled:cursor-not-allowed disabled:opacity-40"
      @click="emit('cancel')"
    >
      <UIcon name="solar:trash-bin-trash-linear" size="22" aria-hidden="true" />
    </button>

    <span class="flex h-12 min-w-0 flex-1 items-center justify-center gap-2.5" aria-hidden="true">
      <span
        v-for="(height, index) in bars"
        :key="index"
        class="w-0.5 shrink-0 rounded-full transition-[height] duration-100 ease-out motion-reduce:transition-none"
        :class="recording ? 'bg-x-text-title' : 'bg-x-primary-content-300'"
        :style="{ height }"
      />

      <!--
        The Persian timer. `role="timer"` with `aria-live` left at its implicit
        `off` — a screen reader can read it on demand without being interrupted
        once per second.
      -->
      <span
        role="timer"
        aria-label="مدت ضبط"
        class="text-x-text-subtitle ms-1 shrink-0 text-sm font-bold tabular-nums"
      >
        {{ timer }}
      </span>
    </span>

    <!--
        The mic. It is `disabled` and it is **meant** to be: this bar only exists
        while a recording is already running, so the button is the one place the
        reader can see that the mic is live — the same job `ChatHeader`'s call
        buttons and `MessageBubble`'s play button do in Phase 1, and the same
        reason none of them pretend to act. Starting a recording belongs to the
        composer's `mic` event; this component renders its consequences.
      -->
      <button
        type="button"
        disabled
        :aria-label="recording ? 'در حال ضبط' : 'ضبط متوقف است'"
        class="grid size-11 shrink-0 place-items-center rounded-full bg-x-text-title text-x-primary-content-50 disabled:cursor-not-allowed"
        :class="recording ? 'animate-pulse ring-4 ring-x-primary-500/30 motion-reduce:animate-none' : 'opacity-60'"
      >
        <UIcon name="solar:microphone-2-bold" size="22" aria-hidden="true" />
      </button>

      <button
        type="button"
        :disabled="!canSend"
        :aria-label="canSend ? 'ارسال پیام صوتی' : 'برای ارسال، ابتدا ضبط کنید'"
        class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-x-primary-content-50 transition disabled:cursor-not-allowed disabled:opacity-40"
        :class="canSend ? 'bg-x-primary-500 hover:bg-x-primary-600' : 'bg-x-primary-content-300'"
        @click="emit('send')"
      >
        <UIcon name="solar:send-square-linear" size="22" aria-hidden="true" />
      </button>
  </div>
</template>