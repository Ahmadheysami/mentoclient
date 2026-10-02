<script setup lang="ts">
import { renderAiMarkdown } from "~/utils/markdown";
import { faDate, faNumber } from "~/utils/fa";

/**
 * One astrology report: the AI Markdown, rendered, plus the copy/share footer.
 *
 * ## THE MARKDOWN IS UNTRUSTED TEXT
 *
 * `renderAiMarkdown` output goes into `v-html`, which is why it is rendered
 * inside the existing `.ai-markdown` class rather than through a new one — that
 * class already styles every element an AI report actually contains (`h1`–`h4`, lists,
 * `code`, tables, links) and `main.css` is where it lives. That function is the
 * ONE renderer for model-written Markdown in this app — it drops raw HTML tokens
 * and blanks a link destination whose scheme is not `http(s)`/`mailto`/`tel` —
 * and it is what `Bot/ChatMessageGroup.vue` gives a bot answer, which is the
 * established precedent for AI text in this app. See `app/utils/markdown.ts`.
 *
 * ## THE FOOTER MIRRORS `Bot/ChatMessageGroup`
 *
 * Copy the **raw Markdown**, not the rendered HTML: the reason to copy a report
 * is to paste it somewhere that renders Markdown, and pasting a page's inner
 * markup into a chat window is what that idiom avoids. Both buttons are ghost
 * and icon-only, exactly as they are there — the share button down to being
 * rendered unconditionally, with the capability checked inside its handler.
 *
 * ## `title` IS OPTIONAL, AND THE LIST IS WHY
 *
 * «گزارش فعال‌سازی» is the right heading for the report an activation produced and
 * the WRONG one for a saved monthly report, so the hub hands its own title down —
 * and hands `null` where the row that owns this body has already printed that title
 * in its own header, which would otherwise say the same Jalali month twice in one
 * card. `null` takes the whole header away with it, the date included, because the
 * row prints the same `createdAt` beside the title.
 *
 * The default is unchanged, so the activation page keeps its heading and no existing
 * call site changes. Note there is deliberately no id on that `<h2>`: this component
 * renders once per saved report as well as once for the in-session one, and a fixed
 * id here would be duplicated across the hub's own list.
 *
 * ## `spentTokens` IS A COST, NOT A BALANCE
 *
 * `token` on the activation response is what that call **spent**. It is rendered
 * here — once, labelled «توکن مصرف‌شده» — through `faNumber` and deliberately
 * **not** through `formatCoins`: that function is the only thing in this app
 * that makes a *balance* legible, and running a cost through it would put a
 * number next to «سکه» that reads as a remaining balance and is not one. See
 * `app/utils/coin.ts`.
 */
const props = withDefaults(
  defineProps<{
    /**
     * The heading this report is filed under, or `null` for no heading at all.
     *
     * See the file header: the default is the activation's own title, and the
     * saved-reports list passes `null` because its row header already names the
     * Jalali month.
     */
    title?: string | null;
    markdown: string;
    /** ISO timestamp of the activation, or `null` when it is not known. */
    submittedAt?: string | null;
    /** ⚠ Tokens SPENT by the activation — never a balance. */
    spentTokens?: number | null;
  }>(),
  { title: "گزارش فعال‌سازی", submittedAt: null, spentTokens: null },
);

const { $toast } = useNuxtApp();

const html = computed<string>(() => renderAiMarkdown(props.markdown));

/**
 * `faDate`, not `faRelative`: a relative time depends on the clock, so it cannot
 * be rendered during SSR without risking a hydration mismatch (see
 * `faRelative`'s own note). The absolute date is deterministic and is also the
 * honest label here — this report is not "a moment ago", it is the one produced
 * by the activation.
 */
const submittedLabel = computed<string>(() => faDate(props.submittedAt ?? null));

const spentLabel = computed<string>(() =>
  props.spentTokens === null || props.spentTokens === undefined
    ? ""
    : `${faNumber(props.spentTokens)} توکن مصرف‌شده`,
);

async function copyReport(): Promise<void> {
  try {
    if (import.meta.client && navigator.clipboard) {
      await navigator.clipboard.writeText(props.markdown);

      $toast.success("کپی شد");
    }
  } catch {
    $toast.error("کپی نشد");
  }
}

/**
 * The Web Share API, checked **inside** the handler and not by hiding the button.
 *
 * ⚠ `import.meta.client` is `false` during SSR, so a `v-if` on a capability that
 * depends on it renders NO button in the server's HTML and one in the first
 * client render — a structural hydration mismatch on every report, inside the very
 * subtree that holds the `v-html` body. `"share" in navigator` is still the only
 * check that does not throw (the API is absent on desktop browsers and inside some
 * in-app webviews), so it is asked at the moment it is needed: a press on a browser
 * without it is a no-op rather than a `TypeError`.
 *
 * The button is rendered unconditionally — the established shape in this app, and
 * `Bot/ChatMessageGroup`'s share button is written this way for the same reason.
 */
async function shareReport(): Promise<void> {
  if (!import.meta.client || !("share" in navigator)) return;

  try {
    await navigator.share({
      title: "طالع‌بینی منتویا",
      text: props.markdown,
    });
  } catch {
    // A share sheet the reader dismisses rejects. That is the expected outcome of
    // opening one, not a failure to report.
  }
}
</script>

<template>
  <article class="animate__animated animate__fadeInUp">
    <!--
      The heading is an `<h2>`: `AppPanelHeader` already renders the page's `<h1>`,
      so this section names itself one level below it rather than claiming the
      document outline.

      The whole header — heading and date together — is dropped when there is no
      `title`, which is the saved-reports list: its row already prints the Jalali
      month and the same `createdAt` in its own header, and repeating both here
      would name the same month twice in one card.
    -->
    <header v-if="props.title" class="mb-3 flex items-baseline justify-between gap-2">
      <h2 class="min-w-0 truncate font-yekan-bold text-x-text-title">
        {{ props.title }}
      </h2>

      <span
        v-if="submittedLabel"
        class="shrink-0 text-[11px] text-x-text-subtitle"
      >
        {{ submittedLabel }}
      </span>
    </header>

    <!--
      `overflow-wrap: anywhere` is already inside `.ai-markdown`, which is what
      keeps a long unbroken Persian token from pushing a horizontal scrollbar
      onto a 320px screen.
    -->
    <div
      class="ai-markdown rounded-3xl border border-slate-200/90 bg-white p-4"
      v-html="html"
    />

    <!--
      The cost of the call that produced this report, once, and only when the
      server reported one. A hidden row beats a «—»: this is not a balance that
      failed to load, it is a figure some accounts never have.
    -->
    <p
      v-if="spentLabel"
      class="mt-2 text-center text-[11px] text-x-text-subtitle"
    >
      {{ spentLabel }}
    </p>

    <div class="mt-2 flex items-center gap-2">
      <UButton
        variant="ghost"
        size="sm"
        icon="solar:copy-linear"
        aria-label="کپی گزارش"
        @click="copyReport"
      />

      <!--
        Rendered on every platform, capability and all — see `shareReport`. The
        server's HTML and the first client render have to be identical, and a button
        that exists only where the Web Share API does is exactly the shape that
        breaks that.
      -->
      <UButton
        variant="ghost"
        size="sm"
        icon="solar:share-linear"
        aria-label="اشتراک‌گذاری گزارش"
        @click="shareReport"
      />
    </div>
  </article>
</template>