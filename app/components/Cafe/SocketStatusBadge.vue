<script setup lang="ts">
import type { CafeSocketStatus } from "~/stores/cafeSocket";

/**
 * The `/cafe` connection pill — «متصل», «در حال اتصال», «قطع اتصال».
 *
 * ## ⚠️ NOTHING IS RENDERED UNTIL MOUNT — A HYDRATION GATE, NOT A LOADER
 *
 * The store's initial `status` is `"disconnected"` because that is the only
 * value true at every point of the server render, where no socket exists; on
 * the client the plugin flips it to `"connecting"` during plugin init, i.e.
 * BEFORE hydration runs. A badge that read `status` straight from the template
 * would therefore ship «قطع اتصال» in the server's HTML and show «در حال اتصال»
 * on the first client frame — a hydration mismatch, on a word. The `v-if`
 * below makes both the server and the hydrating client render an empty comment
 * node; the pill appears on the next tick, once `onMounted` has run.
 *
 * The gate lives here rather than in a `<ClientOnly>` at the call site because
 * the invariant belongs to the component that reads the store: every header
 * that ever renders the pill is safe by construction, and a future call site
 * cannot silently forget the wrapper and reintroduce the mismatch. The store's
 * own header names this component for exactly this job, and the page's `now`
 * ref (`app/pages/cafe/index.vue`) is the same shape: unset during SSR, set on
 * mount.
 *
 * ## WHY `disconnected` WEARS NEUTRAL AND NOT `error`
 *
 * Per the plugin's header, having no session is a state, not a failure — the
 * ticket route answers `200` with an empty token precisely so a signed-out
 * visitor is not told something went wrong. An error-red pill would contradict
 * that on every signed-out visit, and the same red would then have to stand
 * for a genuine drop too. So: success / warning / neutral.
 *
 * ## THE WORD IS THE STATE; THE DOT ONLY REINFORCES IT
 *
 * The pill always renders a word, so state survives greyscale, colour
 * blindness and a screen reader with no hue carrying meaning. The dot is
 * `bg-current` — the badge's own ink, so the tone table below drives both —
 * and `aria-hidden`, because the word beside it is the state. `connecting` is
 * the one state that animates: the dot pulses, and `motion-reduce:animate-none`
 * removes the animation entirely for a reader whose OS asks for reduced motion
 * rather than shortening it — the rule `main.css` states for every animation.
 *
 * ## WHY THE PREFIX IS REAL TEXT AND NOT AN `aria-label`
 *
 * The pill is `role`-less, and a name supplied through `aria-label` on a
 * generic element is at risk of being ignored — which would leave an anonymous
 * «متصل» with no hint of what it describes. So «وضعیت اتصال:» is an `sr-only`
 * span inside the badge: real text, part of the content, announced whatever
 * the element's role turns out to be, with the visible word completing the
 * sentence. This deliberately diverges from the house `aria-label` pattern.
 *
 * ## WHY THE SURFACE IS SPELLED OUT RATHER THAN `variant="soft"`
 *
 * A variant badge inks its text with the 500 shade of the colour, which
 * measures ~2.1–2.8:1 on its own tint — under AA for 12px text. So the surface
 * follows the house recipe (`UnreadBadge`, `ComingSoonCard`) instead: a `-100`
 * tint, a `-200` hairline ring — the fill alone is near-invisible on white —
 * and the dark end of the ramp as ink: 6.49:1, 6.38:1 and 9.51:1 for the three
 * states, all clear of AA.
 *
 * ## WHY THE ERROR IS A `title` AND AN `sr-only` DESCRIPTION, NOT TEXT
 *
 * `lastError` is the backend's refusal sentence (`"invalid token"`,
 * `"Authenticate to log in"`) and nothing else — the store never holds a
 * credential. It stays out of the header row, which has room for one word: a
 * `title` covers hover on a desktop browser, and the hidden span it points at
 * via `aria-describedby` is the copy that reaches a screen reader on the phone
 * this app is for. It is rendered verbatim, only when the store put something
 * there, and it always describes the **current** state: the store sets it on a
 * failure and `markConnected()` clears it on the next successful connection,
 * so a pill that reads «متصل» can never still be carrying a refusal that no
 * longer applies.
 *
 * Role-less on purpose, like `UnreadBadge`: this is status content, not a live
 * region. `role="status"` was considered and rejected — `reconnect_attempt`
 * flips the state to `connecting` on every backoff attempt, so a live region
 * would announce «در حال اتصال» again on every retry, to the very reader whose
 * connection is already struggling.
 */
const cafeSocket = useCafeSocket();

/**
 * The hydration gate. `false` on the server and through hydration; flipped
 * once, by the `onMounted` below — see the header for why nothing may render
 * before it.
 */
const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});

const status = computed(() => cafeSocket.state.status);

/**
 * The refusal, exactly as the store holds it. Bindings below never compose it
 * with anything and never render it as visible text.
 */
const lastError = computed(() => cafeSocket.state.lastError);

/** One row per state, so the word and the tone can never disagree. */
const STATUS: Record<
  CafeSocketStatus,
  { label: string; color: "success" | "warning" | "neutral" }
> = {
  connected: { label: "متصل", color: "success" },
  connecting: { label: "در حال اتصال", color: "warning" },
  disconnected: { label: "قطع اتصال", color: "neutral" },
};

/**
 * The pill's surface per state: the house recipe (a `-100` tint, a `-200`
 * hairline) with the ink from the dark end of the ramp. The three ratios are
 * in the header — do not lighten an ink without re-measuring it.
 */
const TONES: Record<CafeSocketStatus, string> = {
  connected: "bg-success-100 text-success-800 ring-success-200",
  connecting: "bg-warning-100 text-warning-800 ring-warning-200",
  disconnected: "bg-neutral-100 text-neutral-700 ring-neutral-200",
};

const presentation = computed(() => STATUS[status.value]);

/**
 * The prefix half of «وضعیت اتصال: متصل», rendered as real (visually hidden)
 * text below; the visible word beside it completes the sentence. See the
 * header for why this is content and not an `aria-label`.
 */
const accessibleLabel = computed(() => "وضعیت اتصال:");

/**
 * `useId`, not a literal (`Settings/Preferences.vue` uses the same): a compact
 * and a large header can both be mounted mid-transition, and a duplicated id
 * would point both descriptions at whichever refusal mounted first.
 */
const errorId = useId();
</script>

<template>
  <!-- The `v-if` is the hydration gate described in the header — not a loader. -->
  <UBadge
    v-if="mounted"
    :color="presentation.color"
    :class="TONES[status]"
    :title="lastError ?? undefined"
    :aria-describedby="lastError ? errorId : undefined"
    :ui="{
      base: 'ring-1 h-6 gap-1.5 rounded-full px-2 py-0 text-xs leading-none',
    }"
  >
    <span
      class="size-1.5 shrink-0 rounded-full bg-current"
      :class="
        status === 'connecting' ? 'animate-pulse motion-reduce:animate-none' : ''
      "
      aria-hidden="true"
    />

    <!-- The prefix as real (screen-reader-only) text — see the header. -->
    <span class="sr-only">{{ accessibleLabel }}</span>

    {{ presentation.label }}

    <!-- The refusal, verbatim and never visible; `aria-describedby` above is its only reader. -->
    <span v-if="lastError" :id="errorId" class="sr-only">{{ lastError }}</span>
  </UBadge>
</template>
