<script setup lang="ts">
import { GOAL_DOMAINS_META, type GoalDomain, type GoalMessage } from "~/types/goal";
import { faDate, faRelative } from "~/utils/fa";
import { renderAiMarkdown } from "~/utils/markdown";

/**
 * One weekly message: the AI's Markdown guidance, read in full.
 *
 * ⚠️ `{id}` here is the **MESSAGE** uniqid (`message.id`) — NOT the parent goal's
 * id and NOT `_id`. The route is `/panels/big/goal/message/{id}` while the goal
 * above it is `/panels/big/goal/{id}`, and the two ids belong to different
 * documents of the same feature. Vue Router resolves the static `message/`
 * segment before the dynamic `[id]` one, so this page owns that path and the goal
 * page's `[id]` can never swallow it.
 *
 * ⚠️ **An absent `result` is an EMPTY STATE, NEVER AN ERROR.** Upstream performs
 * no existence check on this route: an unknown id answers `201 { success: true }`
 * with `result` missing. The store therefore writes `null` and raises nothing, and
 * this page says «متن این پیام در دسترس نیست» — because that is exactly what has
 * happened, and a red toast over an empty screen would call a missing report a
 * failure.
 *
 * ⚠️ **The four states are tested in this order for a reason.** `error.message`
 * is tested BEFORE `html === null`, because a refusal leaves the report `null`
 * too: with the empty test first, every network failure rendered as «the text is
 * not available» and the retry button below it was unreachable — the one state
 * that CAN succeed on a second attempt was the one state with no way to ask.
 *
 * The body is rendered from Markdown and inserted as HTML, which is the one place
 * on this feature where untrusted text becomes markup. `renderAiMarkdown` is the
 * one renderer for model-written Markdown in this app: it drops every raw-HTML
 * token (so no `<script>`, no `onerror`) and blanks a link or image destination
 * whose scheme is not `http(s)`/`mailto`/`tel` — which is the half a
 * raw-HTML ban alone cannot do, because `[x](javascript:alert(1))` contains no
 * HTML token and would otherwise render as a live `<a>`. `ai-markdown` then
 * styles the result. `ChatMessageGroup.vue` does the same for the bot, which is
 * the precedent — this page does not introduce the pattern.
 */
/**
 * `key` on the route, and the reason the report re-enters when the reader moves
 * from one week to the next.
 *
 * Vue Router reuses a component instance when only the PARAMETERS of a route
 * change, so without this the page would be patched in place: the previous week's
 * report would sit under the new week's heading for the length of the request
 * (`getMessage` blanks the report, which is what turns that into a skeleton), and
 * `onMounted` below — which reads the clock and asks for the report — would not
 * run a second time. With the key, a different message is a different component and
 * a clean mount. `fullPath` rather than the bare param so a query change is a new
 * page too, which is the same rule stated at its widest.
 *
 * This is also why there is no `watch` on the message id anywhere in this file: a
 * param change cannot arrive without changing the key, so such a watcher would never
 * fire and would only claim a protection it does not provide. `onMounted` is the
 * single place this page asks for a report.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "پیام هفتگی",
  key: (route) => route.fullPath,
});

useSeoMeta({ title: "پیام هفتگی" });

const route = useRoute();
const goalStore = useGoal();

const messageId = computed<string>(() => String(route.params.id ?? ""));

/**
 * The reader's clock, read once on mount.
 *
 * A prop and not a `Date.now()` inside a computed, because the page says when this
 * week's guidance arrived and a relative rendering of that produced on the server
 * and again at hydration can disagree — a text mismatch Vue reports. `undefined`
 * until mount keeps the two renders identical; `faRelative` falls back to the
 * absolute `faDate` in the meantime, which both renders produce identically.
 */
const now = ref<number>();

const isLoading = computed<boolean>(() => goalStore.state.loading.message);

/**
 * The report as HTML, or `null` when there is none.
 *
 * `null` is a first-class answer here (see the header), and an empty string is
 * collapsed into it so the page cannot render an empty `.ai-markdown` box that
 * looks like a broken report.
 */
const html = computed<string | null>(() => {
  const result = goalStore.state.message;

  if (!result) return null;

  return renderAiMarkdown(result);
});

/**
 * This message as the store holds it, or `null` on a deep link.
 *
 * ⚠️ **THE PARENT GOAL'S ID LIVES ONLY HERE, AND THAT IS A REAL LIMITATION.**
 * The single message route answers `result` and `input` and nothing else — no
 * `moduleId`, no goal id — so the only place a `moduleId` exists is the
 * `GET /goal/{id}/messages` list. A reader who arrives by deep link or by a cold
 * refresh has an empty store, so this is `null` and there is no «بازگشت به هدف»:
 * there is nothing to name a goal from. The header below still renders, because
 * `input` comes back with the report itself (see `week`).
 *
 * A second request cannot fix the link, for the reason that created the gap — the
 * response does not name the parent — and guessing a goal id from a message id
 * would put a «back to your goal» link under somebody else's goal.
 *
 * On the normal path this is not empty: `goal/[id].vue` drops its reading state
 * on the way IN rather than on an `onBeforeUnmount`, precisely so the ladder this
 * entry is read from is still warm when a reader taps a week in it.
 */
const message = computed<GoalMessage | null>(() => {
  const id = messageId.value;

  if (id === "") return null;

  return goalStore.state.messages.find((item) => item.id === id) ?? null;
});

/**
 * The parent goal's uniqid, for the link back to the ladder — or `null`.
 *
 * `null` on a deep link, and the template drops the link rather than inventing a
 * destination; see above.
 */
const goalId = computed<string | null>(() => message.value?.moduleId ?? null);

/**
 * The week this report is about: the category it belongs to and the day its
 * window closes.
 *
 * **`input` has two sources and they agree by construction.** It is the ladder
 * entry's when this message is in the store, and the single-message RESPONSE's
 * own copy otherwise — `getMessage` keeps it for exactly this, and both are the
 * goal data the week was opened with, so the heading can never disagree with the
 * report below it. That second source is what makes the header survive a deep
 * link at all.
 *
 * ⚠️ **`createdAt` HAS ONE SOURCE ONLY, AND ON A DEEP LINK THAT IS A GAP.** It
 * belongs to the MESSAGE document: `input` carries the goal's data, not the
 * window's, and the single-message route returns no `createdAt` of its own. So
 * the «n روز پیش» chip is absent for a reader who came by URL — the category and
 * the closing date below still render, and the report itself is never affected.
 * Guessing it from `input` would date the week from the goal's creation.
 *
 * `domain` is `null` until one of the two sources has answered, and every consumer
 * is written to expect that: a header with no domain renders no chip rather than
 * a wrong one.
 */
const week = computed<{
  domain: GoalDomain | null;
  expiresAt: number | null;
  createdAt: string;
}>(() => {
  const input = message.value?.input ?? goalStore.state.messageInput;

  if (!input) {
    return { domain: null, expiresAt: null, createdAt: "" };
  }

  return {
    domain: input.domain,
    expiresAt: input.expiredAt || null,
    // Ladder only — see the note above. This is `""`, and not `null`, on a deep
    // link so `createdText` is empty rather than a date with no source.
    createdAt: message.value?.createdAt ?? "",
  };
});

/** «۳ روز پیش» once mounted, the absolute date until then. See `now`. */
const createdText = computed<string>(() =>
  week.value.createdAt === ""
    ? ""
    : faRelative(week.value.createdAt, now.value),
);

/** When this week's window closes, or `""` when the figure is not usable. */
const expiresText = computed<string>(() =>
  week.value.expiresAt ? faDate(week.value.expiresAt) : "",
);

function retry() {
  goalStore.getMessage(messageId.value);
}

onMounted(async () => {
  now.value = Date.now();

  // ⚠️ GUARDED, because `getMessage` interpolates this into a request path.
  // The route always supplies a segment, so `""` is not reachable by navigating —
  // but an unguarded call would put `/api/goal/message/` (a DIFFERENT route, the
  // collection) on the wire if it ever were, and that returns a shape this page
  // would read as a report. An unresolvable id renders the empty state, which is
  // the honest answer for one.
  if (messageId.value !== "") await goalStore.getMessage(messageId.value);
});
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      The way back to the ladder this report belongs to. `Util/BackBtn` in the
      panel header points at the panel hub, which is a whole screen away from a
      single week's guidance, so the parent goal is offered here where it is
      actually wanted. Present on the normal path — the ladder stays warm on the
      way in here — and omitted on a deep link, where no goal id is known; see
      `goalId`.
    -->
    <NuxtLink
      v-if="goalId"
      :to="`/panels/big/goal/${goalId}`"
      class="group inline-flex items-center gap-1.5 text-xs text-x-text-subtitle transition-colors duration-150 ease-out hover:text-x-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none"
    >
      بازگشت به هدف
      <!--
        The arrow nudges on hover: 2px, 150ms, `-translate-x-0.5` — LEFTWARD, the
        way the icon is drawn, which is the rule `Features/Story/LinkColorized.vue`
        already follows for its own left arrow. **No `rtl:` variant, on purpose:**
        left is this layout's inline-END, so an `rtl:` copy of this class would
        move the arrow against its own direction. `motion-reduce` kills both the
        transition and the transform.
      -->
      <UIcon
        name="solar:arrow-left-linear"
        size="16"
        aria-hidden="true"
        class="transition-transform duration-150 ease-out group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </NuxtLink>

    <!--
      The week's own header: which category it belongs to and when its window
      closes. Without it the report is an undated wall of Markdown, and the reader
      is being asked to act on it — «این هفته چه کردید» is the question the ladder
      asks, and a report with no week beside it does not say which week.

      Every field is `v-if`-guarded, so a message whose `input` has not arrived from
      either source yet renders the report alone rather than an empty chip, and one
      with no ladder entry renders without the «n روز پیش» chip rather than with a
      date it cannot source. The report itself is unaffected by any of this — it is
      the ONE thing this page is for.
    -->
    <div
      v-if="week.domain || createdText || expiresText"
      class="reveal mt-3 flex flex-wrap items-center gap-2"
    >
      <UBadge
        v-if="week.domain"
        variant="soft"
        :icon="GOAL_DOMAINS_META[week.domain].icon"
        :label="GOAL_DOMAINS_META[week.domain].label"
        :ui="{
          base:
            'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-primary-500 to-x-primary-200 text-x-primary-900 ring-x-primary-300/60',
        }"
      />

      <UBadge
        v-if="createdText"
        variant="soft"
        color="neutral"
        icon="solar:calendar-date-linear"
        :label="createdText"
        :ui="{ base: 'gap-1 rounded-full px-2.5 py-1 text-xs font-medium' }"
      />

      <UBadge
        v-if="expiresText"
        variant="soft"
        icon="solar:hourglass-linear"
        :label="`پایان هفته: ${expiresText}`"
        :ui="{
          base:
            'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-primary-content-600 to-x-primary-content-400 text-x-primary-content-900 ring-x-primary-content-400/60',
        }"
      />
    </div>

    <div class="mt-3">
      <!-- SKELETON FIRST, and it is the server render too: `loading.message` starts
           `true` (the same rule as the goal list and the ladder) precisely so the
           first frame cannot claim a report is missing before one has been asked
           for. -->
      <div v-if="isLoading" aria-busy="true">
        <TestListSkeleton shape="row" :rows="3" label="در حال دریافت متن پیام" />
      </div>

      <!--
        A refusal that is a real failure — the network, the server's own error —
        gets a retry, because this one CAN succeed on a second attempt. Tested
        before the empty state above it in the chain; see the header.
      -->
      <UiStateMessage
        v-else-if="goalStore.state.error.message"
        icon="solar:link-broken-linear"
        :title="goalStore.state.error.message"
        action-label="تلاش دوباره"
        @action="retry"
      />

      <!--
        No report. This is an EMPTY STATE, not a failure — see the header — so it
        carries no retry button either: re-asking an endpoint that performs no
        existence check would produce the same absence for ever.
      -->
      <UiStateMessage
        v-else-if="html === null"
        icon="solar:document-text-linear"
        title="متن این پیام در دسترس نیست"
        description="ممکن است این پیام برای این حساب ساخته نشده باشد یا متن آن هنوز آماده نشده باشد."
        action-label="بازگشت به هدف‌ها"
        action-to="/panels/big/goals"
      />

      <!--
        The ONE `v-html` on this feature, and it is unavoidable: the report is
        Markdown, and `.ai-markdown` styles the rendered result. `renderAiMarkdown`
        above drops raw HTML from the source and blanks a dangerous link
        destination, so what arrives here is markup `marked` itself produced from
        the text — with its own escaping of `href`, `title` and `alt` intact.

        `reveal` is the house entrance, and it is `both`-filled (see `main.css`), so
        the report is invisible until its own 320ms turn rather than flashing in.
        It plays once per message because the route key is the message id, so
        navigating from one week to the next re-enters it — which is the point: the
        reader is looking at a different document.
      -->
      <article
        v-else
        class="ai-markdown reveal rounded-3xl bg-white p-4 shadow-xs ring-1 ring-x-primary-100"
        v-html="html"
      />
    </div>
  </div>
</template>
