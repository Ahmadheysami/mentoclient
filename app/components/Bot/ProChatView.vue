<script setup lang="ts">
import { useIntervalFn, usePreferredReducedMotion } from "@vueuse/core";
import { PRO_BOT_REASONS } from "~/stores/pro-bot";
import type { ProBotChatResponse, ProChatTurn } from "~/types/pro-bot";

/**
 * A Pro panel's chatbot — the reuse unit.
 *
 * One component serves every panel that has a paid plan: it is given a `panel` id
 * and titled by its caller, and **no panel id appears anywhere in this file** —
 * not in the props, not in a route, not even in these comments, so the claim is
 * checkable with `grep`. The panel's own page is the only thing that says which
 * panel it is, and the next panel ships by rendering this with its own id, its
 * own title and its own gate. Everything below is read from the `panel` prop or
 * from `stores/pro-bot.ts`, which namespaces the conversation by that same id.
 *
 * ## What it is, and what it is not
 *
 * The **same** conversation as `/mentobot`: same endpoints, same assistant, same
 * prompts, same `GET /bot/chatbot-list` → create → `exists.default` round trip,
 * same optimistic turn. Only the surface is different — and the one thing that
 * genuinely cannot be copied is the typing.
 *
 * ## There is no streaming upstream. The typing is ours.
 *
 * `POST /panels/shared/modules/bot/{chatId}/chat` is a plain blocking JSON
 * request: no SSE, no chunked body, no socket event. The answer arrives whole,
 * in one piece, when it arrives. So the answer is put into state complete and then
 * *revealed* a few characters at a time, because that is the one difference
 * between a JSON response and a conversation — and because a spinner followed by
 * a wall of text is what makes an AI feature feel like a form submission.
 *
 * Two rules keep the illusion honest, and both cost nothing:
 *
 * - **The reveal is not the send.** `loading.send` is the truth about the request
 *   and stays true until the promise settles; the reveal is separate state that
 *   only runs afterwards. Nothing in the UI claims the answer is still arriving.
 * - **A tap ends it.** Revealing a 2,000-character answer at reading speed is
 *   slower than reading it, so the streaming bubble is a button. One tap, or
 *   Enter/Space on it, and the whole answer is there.
 *
 * ## Reduced motion is honoured, not merely ignored
 *
 * `usePreferredReducedMotion()` → `'reduce'` means the whole answer appears at
 * once and **no interval is ever created**: `startTyping()` returns before
 * `resume()`. A "faster" reveal is not reduced motion; a reveal at all is the
 * motion, so it is the reveal that goes. The same value decides whether the
 * auto-scroll is `'smooth'` or `'auto'`.
 *
 * ## Layout: this component owns the transcript, the panel layout owns the frame
 *
 * `layouts/panel.vue` is a `h-dvh` flex column whose only scroller is `<main>`,
 * and `<main>` cannot be given `min-h-0` from here. So this component is a
 * `h-full` flex column of exactly two parts — a `min-h-0` scroller and a
 * `shrink-0` composer — which keeps its own min-content height down to the
 * composer's and lets the composer sit on the bottom edge without any fixed
 * positioning.
 *
 * **No `position: fixed` here, and that is a deliberate break with
 * `/mentobot/index.vue`.** That page pins its header and its composer with
 * `fixed … left-1/2 -translate-x-1/2` because the `blank` layout gives it the
 * whole viewport. Inside the panel's `max-w-md` frame the same technique escapes
 * the frame, sits on top of `App/PanelHeader`, and cannot see the safe-area inset.
 * Two rules instead: `h-full` for the column, and a sticky composer that scrolls
 * with the transcript it belongs to.
 *
 * ## The markdown surface (a recorded decision, not an oversight)
 *
 * `Bot/ChatMessageGroup.vue` renders the ASSISTANT's answer with `v-html` after
 * `marked.parse`, and `marked` does not sanitise. That is unchanged and
 * unmodified here, because it is the existing `/mentobot` behaviour and the
 * content is our own backend's model output.
 *
 * **This component deliberately does not widen it.** The reader's own prompt is
 * rendered as TEXT — which is what `ChatMessageGroup` already does for
 * `{ type: 'user' }`, and which is why no `v-html` here ever receives something a
 * reader typed. The echoed `input` sub-document from the API is likewise never
 * rendered: only `question.prompt` is read, through a `typeof` check, and only the
 * `result` string goes to markdown. Adding a sanitiser (DOMPurify) would mean a
 * new dependency, which `AGENTS.md` forbids without a reason this feature has, so
 * the narrow surface stays narrow and is recorded here instead.
 */
const props = withDefaults(
  defineProps<{
    /**
     * The plan panel this chat belongs to. Also the key its conversation is
     * stored under, so two panels can be open in one session without sharing a
     * `chatId` or a transcript.
     */
    panel: string;
    title?: string;
    subtitle?: string;
  }>(),
  { title: "", subtitle: "" },
);

/** Chars revealed per tick. 3 × 60 ticks ≈ 180 chars/s — a readable pace. */
const CHARS_PER_TICK = 3;
/** ~60fps. */
const TICK_MS = 16;
/**
 * How close to the bottom still counts as "the reader is following along".
 *
 * Without this, auto-scrolling a reveal would yank the screen back down every
 * 16ms while somebody is reading three turns higher up. `following` is the answer
 * to that: it goes false as soon as the reader scrolls away and comes back on its
 * own.
 */
const STICK_SLOP_PX = 64;

/** What `ChatMessageGroup` shows for a 200 that carried no answer. */
const EMPTY_ANSWER = "پاسخی دریافت نشد";

/**
 * Openers for an empty transcript.
 *
 * Written for a psychology product, so they name a feeling or a stuck moment
 * rather than a feature, and none of them claims anything the assistant cannot
 * do — a list of "try asking about X" bullets would be a catalogue of the
 * backend, and the prompt is not one.
 */
const SUGGESTIONS = [
  "این روزها بیشتر از همه چه چیزی خسته‌ام می‌کند؟",
  "برای تغییر یک عادت، از کجا شروع کنم؟",
  "وقتی یک تصمیم سخت دارم، چطور تصمیم بگیرم؟",
  "چه تمرین کوتاهی برای آرام شدن پیشنهاد می‌کنی؟",
];

const store = useProBot();
/**
 * This panel's slot. Not a `computed`: `chatOf` is an idempotent initialiser of
 * an empty slot, and the reactive object it returns is what every template
 * binding below reads.
 */
const chat = store.chatOf(props.panel);
const planStore = usePlan();
const toast = useToast();

const draft = ref("");
const transcript = ref<HTMLDivElement>();
const reducedMotion = usePreferredReducedMotion();

/** Set when a re-`init` could not restore a missing conversation. */
const botMissing = ref(false);
/** Set when the reader's active plan is not this component's `panel`. */
const panelMismatch = ref(false);

/** Whether animation is permitted at all, for the reveal AND for auto-scroll. */
const motionAllowed = computed<boolean>(() => reducedMotion.value !== "reduce");

/** Whether the transcript is parked at the bottom and should keep following. */
let following = true;

const isLoading = computed<boolean>(
  () => chat.loading.init || chat.loading.history,
);

/**
 * Openers are worth offering only once there is a composer that can accept them,
 * and while the conversation is still loading that composer is disabled — a chip
 * that fills a box which cannot then be sent from is worse than no chip.
 */
const showSuggestions = computed<boolean>(
  () => chat.history.length === 0 && !isLoading.value,
);

/** The newest turn, or `undefined` for an empty transcript. */
const newest = computed<ProChatTurn | undefined>(
  () => chat.history[chat.history.length - 1],
);

/**
 * Index of the turn currently being revealed, or `-1`.
 *
 * `-1` is also what reduced motion produces, without any special case: under
 * `reduce` the whole answer is written in one call, so `revealed` is never below
 * the answer's length and this can never be an index.
 */
const revealingIndex = computed<number>(() => {
  const last = newest.value;

  if (!last || last.result === null || last.error === true) return -1;
  if (chat.revealed >= last.result.length) return -1;

  return chat.history.length - 1;
});

/**
 * A failure that costs the reader the whole screen rather than one turn.
 *
 * `botMissing` is the `ERR_CHAT_BOT_NOT_FOUND` that survived a re-`init` and a
 * retry: at that point the panel's conversation can neither be found nor created,
 * and an empty chat box under a "no messages" note would be a lie about a broken
 * backend. `init`/`history` refusals come straight from the store, already
 * sanitised for display.
 */
const fatal = computed<{ icon: string; title: string; description?: string } | null>(
  () => {
    if (botMissing.value) {
      return {
        icon: "solar:user-speak-rounded-linear",
        title: "گفتگوی شما پیدا نشد",
        description:
          "این گفتگو روی این پنل ساخته نشده است. کمی بعد دوباره تلاش کنید.",
      };
    }

    const title = chat.error.init ?? chat.error.history;

    return title ? { icon: "solar:link-broken-linear", title } : null;
  },
);

/**
 * The assistant half of one turn, as `ChatMessageGroup` should draw it.
 *
 * `null` is the component's own "still thinking" signal (the three dots), which is
 * why a pending turn must NOT be handed `""` — an empty string renders nothing at
 * all and the dots would never stop.
 */
function assistantContent(turn: ProChatTurn, index: number): string | null {
  if (turn.result === null) return null;

  // A 200 with no answer. The request succeeded, so there is nothing to wait for;
  // the wording belongs here because the store keeps the truth (`result: ""`).
  if (turn.result.length === 0) return EMPTY_ANSWER;

  if (index !== revealingIndex.value) return turn.result;

  return turn.result.slice(0, chat.revealed);
}

/**
 * The action a turn owes the reader, if any.
 *
 * - `"wallet"` — the answer was refused for coins. A top-up is the way forward,
 *   because the identical retry would fail identically and offering it would be
 *   offering a dead end.
 * - `"retry"` — the request succeeded and returned nothing, so asking again is
 *   the only useful thing left.
 *
 * Only the NEWEST turn can carry one: both are facts about the last request, and
 * an older turn's answer is not going to change.
 */
function turnAction(
  turn: ProChatTurn,
  index: number,
): "wallet" | "retry" | null {
  if (index !== chat.history.length - 1) return null;

  if (turn.error === true) {
    return chat.sendReason === PRO_BOT_REASONS.tokenBalance ? "wallet" : null;
  }

  return turn.result === "" ? "retry" : null;
}

/**
 * "Tap the streaming bubble to finish it" — as real attributes, and ONLY while
 * it streams.
 *
 * A click handler on a plain `div` is invisible to a keyboard and to a screen
 * reader, so the affordance is not merely there for touch: the bubble becomes a
 * `button` role with a name and an `aria-label`, for exactly as long as the
 * affordance exists. `keydown` handles Enter and Space together because a button
 * answers both, and `preventDefault` keeps Space from scrolling the transcript.
 */
function revealAttributes(index: number): Record<string, unknown> {
  if (revealingIndex.value !== index) return {};

  return {
    role: "button",
    tabindex: "0",
    "aria-label": "نمایش کامل پاسخ",
    class: "cursor-pointer",
    onClick: finishTyping,
    onKeydown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      finishTyping();
    },
  };
}

function scrollChatToEnd(animated: boolean): void {
  const element = transcript.value;

  if (!element) return;

  element.scrollTo({
    top: element.scrollHeight,
    behavior: animated && motionAllowed.value ? "smooth" : "auto",
  });
}

function onTranscriptScroll(): void {
  const element = transcript.value;

  if (!element) return;

  following =
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    STICK_SLOP_PX;
}

/**
 * The simulated typing.
 *
 * `immediate: false` is load-bearing: no interval exists until `resume()`, and
 * `resume()` is only ever reached from `startTyping()`, which only ever runs after
 * a click. So there is no timer during SSR, none during the first paint, and none
 * on a screen nobody is talking to — and VueUse clears it with the component.
 */
const { pause: pauseTyping, resume: resumeTyping } = useIntervalFn(() => {
  store.revealUpTo(props.panel, chat.revealed + CHARS_PER_TICK);

  if (following) scrollChatToEnd(false);

  // `revealUpTo` clamps to the answer's own length, so this is the moment the
  // last character landed.
  if (revealingIndex.value === -1) pauseTyping();
}, TICK_MS, { immediate: false });

/**
 * Begin (or skip) the reveal for the answer that just arrived.
 *
 * The reduced-motion branch returns BEFORE `resume()`, so no interval is created
 * at all: the whole answer is written with one call and the screen never moves.
 */
function startTyping(): void {
  const total = newest.value?.result?.length ?? 0;

  if (total === 0 || !motionAllowed.value) {
    store.revealUpTo(props.panel, total);
    return;
  }

  store.revealUpTo(props.panel, 0);
  following = true;
  resumeTyping();
}

/** The tap. Writes the whole answer and stops the interval in the same tick. */
function finishTyping(): void {
  pauseTyping();
  store.revealUpTo(props.panel, newest.value?.result?.length ?? 0);

  if (following) scrollChatToEnd(true);
}

async function submit(): Promise<void> {
  await send(draft.value);
}

async function retry(turn: ProChatTurn): Promise<void> {
  await send(turn.prompt);
}

/**
 * An opener fills the box and stops there.
 *
 * It does NOT send, and it does not focus: a tap that fires a question the reader
 * has not read yet is not what they asked for, and opening the soft keyboard
 * mid-scroll would move the composer out from under the thumb that just landed on
 * it. Filling the box leaves the send button, which is the deliberate one.
 */
function fillSuggestion(suggestion: string): void {
  draft.value = suggestion;
}

/**
 * Ask one question, and recover once from a missing conversation.
 *
 * The self-heal is one round trip and no more. `ERR_CHAT_BOT_NOT_FOUND` while the
 * plan is valid means the conversation this reader should have does not exist —
 * which `init()` creates — so the optimistic turn is dropped (a second `send()`
 * would push a second copy of the same question, one of them permanently red),
 * the panel is re-initialised, and the question is asked again. A second refusal
 * is not a race, it is a backend that disagrees with itself, and looping on it
 * would replace that with a spinner.
 */
async function send(text: string): Promise<void> {
  const question = text.trim();

  if (!question || chat.loading.send) return;

  draft.value = "";

  // From here the reader is following along, so the optimistic bubble scrolls
  // into view before the request is even on the wire.
  following = true;
  await nextTick();
  scrollChatToEnd(true);

  let response = await store.send(props.panel, question);

  if (isBotNotFound(response)) {
    // ⚠ Set BEFORE the attempt and only cleared by a SUCCESSFUL retry. A second
    // refusal is the spec'd end of this branch — the whole screen reports that the
    // conversation cannot be found — and clearing the flag eagerly on the way in
    // would leave the reader looking at an empty chat box under a backend that has
    // just said it cannot find the one conversation this screen is.
    botMissing.value = true;

    if (await store.init(props.panel)) {
      // Dropped only now: a retry pushes its own optimistic turn, and two copies
      // of one question — one of them permanently red — is the thing this branch
      // exists to prevent.
      store.discardLastTurn(props.panel);
      response = await store.send(props.panel, question);

      if (response?.success) botMissing.value = false;
    }
  }

  if (!response?.success) {
    // The reader's own words go back in the box. Losing a typed paragraph to a
    // failed request is the worst thing this screen could do, and the red bubble
    // already records that the question was tried.
    draft.value = question;
    reportFailure(response);
    return;
  }

  startTyping();
}

function isBotNotFound(
  response: ProBotChatResponse | null,
): boolean {
  return response?.reason === PRO_BOT_REASONS.botNotFound;
}

function isOutOfCoins(response: ProBotChatResponse | null): boolean {
  return response?.reason === PRO_BOT_REASONS.tokenBalance;
}

/**
 * The toast for a refused turn.
 *
 * Out of coins gets its own wording and its own figure: the reader's way out is a
 * top-up, and «ارتباط با دستیار برقرار نشد» under a wallet problem would send them
 * to retry a request that cannot succeed. `chat.error.send` is already the
 * sanitised message (`refusalMessage` in the store), so it is safe to show, and a
 * missing conversation that the full-width state is already reporting stays quiet.
 */
function reportFailure(response: ProBotChatResponse | null): void {
  if (isOutOfCoins(response)) {
    toast.add({
      color: "x-primary",
      icon: "solar:wallet-money-linear",
      title: "سکه‌های شما کافی نیست",
      description: "برای ادامهٔ گفتگو، سکه بخرید.",
    });
    return;
  }

  if (isBotNotFound(response) && botMissing.value) return;

  toast.add({
    color: "error",
    icon: "solar:link-broken-linear",
    title: chat.error.send ?? "پیام شما ارسال نشد",
  });
}

/** The whole screen again: exactly the mount sequence, minus the panel check. */
async function restart(): Promise<void> {
  botMissing.value = false;

  await start();
}

/**
 * `init()` → `loadHistory()`, the sequence `/mentobot` runs, with ONE difference:
 * history is not requested when `init()` did not resolve a `chatId`.
 *
 * Without a `chatId` the history endpoint answers for whatever the server
 * considers the panel's default conversation. That is usually right and it is
 * never *chosen*, and this component may be mounted on any panel — so the screen
 * is asked for a conversation it has no id for, and gets a 200 with somebody
 * else's turns in it. Refusing is one line and cannot be wrong.
 */
async function start(): Promise<void> {
  if (!(await store.init(props.panel))) return;

  if (await store.loadHistory(props.panel)) {
    following = true;
    await nextTick();
    scrollChatToEnd(false);
  }
}

onMounted(async () => {
  /**
   * The gate has already run — `middleware/panel-plan.ts` bounced a reader whose
   * plan is not this panel's — so this is defence in depth for the REUSE case:
   * this component is handed a `panel` id by a page, and the page is the thing
   * that can get it wrong. `activeSubscription` is the SELECTED plan, so the one
   * case that reaches here is a page mounted under the wrong panel, or with no
   * panel at all.
   *
   * Failing VISIBLY is the requirement: an empty chat box under a panel that does
   * not own the reader looks exactly like a fresh conversation, and it would
   * invite them to type into it. Nothing below this branch is mounted — no
   * transcript, no composer, and no request.
   */
  if (planStore.activeSubscription?.panel !== props.panel) {
    panelMismatch.value = true;
    return;
  }

  await start();
});
</script>

<template>
  <!--
    A panel this reader's plan does not own. Nothing above this state is mounted:
    no transcript, no composer, no request.
  -->
  <UiStateMessage
    v-if="panelMismatch"
    icon="solar:shield-cross-linear"
    title="این گفتگو برای پنل دیگری است"
    description="دستیار هر پنل جداگانه است. به پنل خودتان برگردید تا گفتگو کنید."
  />

  <!--
    A failure that costs the screen. Full width on purpose: there is no transcript
    to keep, and a notice floating over an empty one would read as "no messages".
    `h-[55dvh]` is `UiStateMessage`'s own root, which is why the retry is offered
    here rather than as an inline button.
  -->
  <UiStateMessage
    v-else-if="fatal"
    :icon="fatal.icon"
    :title="fatal.title"
    :description="fatal.description"
    action-label="تلاش دوباره"
    @action="restart"
  />

  <!--
    `h-full` + `min-h-0` on the column is what makes this fill the space
    `layouts/panel.vue` gives `<main>` and still collapse to the height of the
    composer — see the docblock above for why that matters to a container this file
    cannot edit.
  -->
  <div v-else class="flex h-full min-h-0 flex-col">
    <div
      ref="transcript"
      role="region"
      aria-label="گفتگو با دستیار"
      class="custom-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
      @scroll="onTranscriptScroll"
    >
      <!--
        The conversation's own identity. `App/PanelHeader` names the PAGE, so this
        is the part of the screen that says who is being talked to.
      -->
      <div class="flex items-start gap-3 pt-4 pb-1">
        <span
          class="grid size-11 shrink-0 place-items-center rounded-2xl bg-white shadow-xs ring-1 ring-x-primary-100 text-x-primary-700"
          aria-hidden="true"
        >
          <UIcon name="solar:user-speak-rounded-linear" size="22" />
        </span>

        <div class="min-w-0 grid gap-0.5 pt-1">
          <p v-if="title" class="font-yekan-bold text-x-text-title">{{ title }}</p>
          <p v-if="subtitle" class="text-xs leading-6 text-x-text-subtitle">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <!--
        The one skeleton, for both reads. `aria-busy` because this is the only
        frame where nothing is knowable yet.
      -->
      <div v-if="isLoading" class="grid place-items-center py-16" aria-busy="true">
        <div class="grid place-items-center gap-3 text-center">
          <UIcon
            name="line-md:loading-loop"
            size="32"
            class="text-x-primary-600"
          />
          <p class="text-sm text-x-text-subtitle">در حال آماده‌سازی گفتگو ...</p>
        </div>
      </div>

      <template v-else-if="chat.history.length === 0">
        <!--
          An empty transcript is not an error and not a dead end, so it offers
          openings rather than an apology. The chips live ABOVE the composer, which
          is where the reader's eye already is.
        -->
        <div class="pt-6 pb-2 text-center">
          <p class="text-sm leading-7 text-x-text-subtitle">
            برای شروع، یکی از این‌ها را انتخاب کنید یا خودتان بنویسید.
          </p>
        </div>
      </template>

      <template v-else>
        <!--
          Keyed by position, because the endpoint has no id, no timestamp and no
          role: `question` and `result` are all a turn is. Turns are only appended,
          and a send replaces its own slot rather than adding one, so a position
          key is stable here.
        -->
        <div
          v-for="(turn, index) in chat.history"
          :key="index"
          v-bind="revealAttributes(index)"
        >
          <BotChatMessageGroup
            :error="turn.error === true"
            type="text"
            :messages="[
              { type: 'user', content: turn.prompt },
              { type: 'assistant', content: assistantContent(turn, index) },
            ]"
          />

          <!--
            Same side as the answer it belongs to (`justify-end`, the inline-end in
            this RTL app), and never above it.
          -->
          <div
            v-if="turnAction(turn, index) === 'wallet'"
            class="flex justify-end px-3 pb-1"
          >
            <UButton
              to="/wallet"
              size="sm"
              variant="soft"
              color="x-primary"
              label="خرید سکه"
              icon="solar:wallet-money-linear"
              trailing-icon
              :ui="{ base: 'rounded-full' }"
            />
          </div>

          <div
            v-else-if="turnAction(turn, index) === 'retry'"
            class="flex justify-end px-3 pb-1"
          >
            <UButton
              size="sm"
              variant="soft"
              color="x-primary"
              label="ارسال دوباره"
              icon="solar:refresh-linear"
              :ui="{ base: 'rounded-full' }"
              @click="retry(turn)"
            />
          </div>

          <!--
            The tap hint, only while it is true. It disappears with the affordance,
            and is `aria-hidden` because the bubble itself is the button and already
            carries the label.
          -->
          <p
            v-if="revealingIndex === index"
            aria-hidden="true"
            class="px-3 pb-2 text-center text-xs text-x-text-subtitle"
          >
            برای دیدن کامل پاسخ، روی آن بزنید.
          </p>
        </div>
      </template>
    </div>

    <!--
      The composer. `shrink-0` and a translucent bar of its own colour, so the
      transcript passes under it and never shows through the text — and no
      `pb-33` hack, because there is no bottom bar in the panel layout to clear.
    -->
    <div
      class="shrink-0 bg-x-primary-content-100/95 px-4 pt-2 pb-3 backdrop-blur-xl"
    >
      <ul v-if="showSuggestions" class="mb-2.5 flex flex-wrap gap-2">
        <li v-for="suggestion in SUGGESTIONS" :key="suggestion">
          <!--
            `size="sm"` and no fixed height, so a two-line opener wraps instead of
            being clipped — these are sentences, and they are the longest strings
            on the screen.
          -->
          <UButton
            size="sm"
            variant="soft"
            color="x-primary"
            :label="suggestion"
            :ui="{ base: 'leading-6 font-normal' }"
            @click="fillSuggestion(suggestion)"
          />
        </li>
      </ul>

      <BotProChatPrompt
        v-model="draft"
        :disabled="chat.loading.send || isLoading"
        placeholder="هر چه دربارهٔ حال خودتان می‌خواهید بنویسید…"
        @submit="submit"
      />
    </div>
  </div>
</template>
