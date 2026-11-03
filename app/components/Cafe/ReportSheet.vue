<script lang="ts">
/**
 * §7's `metadata.reason` vocabulary, as the ONE list the UI offers.
 *
 * ⚠️ **`reason` HAS NO ENUM IN THE BACKEND, AND THAT IS WHY IT LIVES HERE.**
 * `ICafeReportMetadata.reason` is a plain `string` on purpose (see its doc
 * comment): the endpoint stores `metadata` verbatim and never reads it back, so
 * there is no server enumeration to check against and a `CafeReportReason` union
 * would be a list this client invented. What the reader picks is therefore a UI
 * concern — and a UI concern belongs in the component that draws it, which is
 * why this is a module-level constant here rather than in `app/types/cafe.ts`
 * next to `CAFE_SORTS` (a contract this screen does not own and must not extend).
 *
 * ⚠️ The three keys that appear in `docs/X123ApiDocs.md` §7's own examples —
 * `harassment`, `spam`, `impersonation` — are reproduced EXACTLY, because a
 * moderation queue may well already be filtering on them. The two this document
 * has no example for (`inappropriate`, `other`) are free-form by the same
 * argument, and every report carries the note and the source beside the reason
 * so a queue never has to guess from the key alone.
 */
export interface ICafeReportReason {
  /** What goes into `metadata.reason`. Not a UI label. */
  value: string;
  /** What the reader reads. */
  label: string;
}

export const CAFE_REPORT_REASONS: readonly ICafeReportReason[] = [
  { value: "harassment", label: "آزار یا توهین" },
  { value: "spam", label: "اسپم یا تبلیغ" },
  { value: "impersonation", label: "جعل هویت" },
  { value: "inappropriate", label: "محتوای نامناسب" },
  { value: "other", label: "موارد دیگر" },
];

/**
 * §7's cap on `metadata.note` — the same figure `REPORT_NOTE_MAX` in
 * `app/stores/cafe.ts` and the message proxy enforce.
 *
 * Written here rather than imported because the store does not export it, and a
 * counter that disagrees with the boundary it counts would be a lie: the field
 * would say «۵۰۰» and the proxy would drop the note at 501.
 */
export const CAFE_REPORT_NOTE_MAX = 500;
</script>

<script setup lang="ts">
import type { CafeReportTarget } from "~/types/cafe";

/**
 * §7's report form — a reason, an optional note, and a submit button.
 *
 * ## IT OWNS NO REQUEST
 *
 * `submitting` and `error` are **props** and the finished reason goes out as an
 * event, exactly as `Goal/CreateSheet` documents: a form that also called the
 * store would have to be re-mounted to forget a failed attempt, and the parent
 * that owns the list is the only thing that knows when it is stale. So the page
 * calls `cafe.reportTarget(...)` and hands back the sentence it refused with.
 *
 * ## ⚠️ WHY THE SHEET, AND WHY TWO ENTRY POINTS
 *
 * Doc §7 opens one modal from the message context menu and one from the table
 * header's `⋯`, against the SAME endpoint with a different `report-for`. One
 * component serves both because the two forms are the same form: the only thing
 * that differs is which id is reported, and that is a prop rather than a second
 * file with a second copy of the reason list to drift.
 *
 * ## ⚠️ THE ID IS THE CALLER'S TO SUPPLY, AND FOR A TABLE IT MUST BE THE INTERNAL ONE
 *
 * `reportTarget({ target: "table", id })` needs the table's INTERNAL `id`, never
 * the `ch_` / `cv_` / `tb_` handle a URL carries — a report filed under the
 * handle names nothing the moderation queue can look up and still answers «ثبت
 * شد». The page resolves it through `cafe.internalTableId(...)`; this component
 * deliberately has no store access to do it wrongly on its own.
 *
 * ## ⚠️ THERE IS NO `source` PROP HERE, AND ITS ABSENCE IS THE TRUTH
 *
 * `cafe.reportTarget` accepts a `source` and does write it into `metadata.source`,
 * so this sheet once declared one and it was never read: the single call site
 * computes the same value itself from which level is being reported
 * (`«message-menu»` / `«table-menu»`), and passes it straight to the store. A prop
 * that promises a payload and sends nothing is worse than no prop — it is a
 * second place to look for an answer that already exists one screen up. Whoever
 * changes where the source is decided must change it there, not here.
 *
 * ## THE DRAFT SURVIVES A REFUSAL
 *
 * On failure the sheet stays open, `error` is drawn above the pinned button
 * beside the reason list, and nothing is cleared: a reader who typed 400
 * characters of explanation should not have to type them again because the network
 * blinked. The draft is reset only when the sheet closes **without** an error,
 * which is the success path.
 */

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** `report-for`. Decides which document the server writes. */
    target: CafeReportTarget;
    /** A request is in the air. Drives the button's loading state. */
    submitting?: boolean;
    /** The Persian refusal, already normalised by the store. */
    error?: string | null;
  }>(),
  { submitting: false, error: null },
);

const emit = defineEmits<{
  "update:open": [boolean];
  /** The chosen reason and note. The page turns them into the request. */
  submit: [payload: { reason: string; note: string }];
}>();

/** The sheet's own title — «گزارش پیام» and «گزارش میز» are different documents. */
const title = computed(() =>
  props.target === "message" ? "گزارش پیام" : "گزارش میز",
);

const description = computed(() =>
  props.target === "message"
    ? "دلیل گزارش را انتخاب کنید. گزارش شما برای بررسی مدیران ارسال می‌شود."
    : "دلیل گزارش این میز را انتخاب کنید. گزارش شما برای بررسی مدیران ارسال می‌شود.",
);

const reason = ref("");
const note = ref("");

const noteLength = computed(() => note.value.trim().length);

/** `maxlength` is a UX affordance; the store refuses an over-long note anyway. */
const noteTooLong = computed(() => noteLength.value > CAFE_REPORT_NOTE_MAX);

/** ⚠️ NO DEFAULT REASON. A report with no reason is not a report — the store
 * refuses it — so the button starts disabled rather than guessing on the
 * reader's behalf. */
const canSubmit = computed(
  () => reason.value !== "" && !props.submitting && !noteTooLong.value,
);

/**
 * The hint's own words, and why they live in a computed rather than in the markup.
 *
 * The element is permanently mounted so `aria-live` has something to announce
 * (see the note on it), so what has to change is the TEXT and not the node — an
 * empty string is what leaves the paragraph with nothing in it.
 */
const reportHint = computed(() =>
  reason.value === "" ? "برای ثبت گزارش یک دلیل را انتخاب کنید." : "",
);

function submit(): void {
  if (!canSubmit.value) return;

  emit("submit", { reason: reason.value, note: note.value.trim() });
}

/**
 * The draft is cleared on a CLOSE THAT CARRIED NO ERROR — the success path — and
 * kept on every other close, so a refusal leaves the reader's own words exactly
 * where they were.
 */
watch(
  () => props.open,
  (open, was) => {
    if (open === true || was === undefined) return;
    if (props.error !== null && props.error !== undefined) return;

    reason.value = "";
    note.value = "";
  },
);
</script>

<template>
  <!--
        Same geometry as `CafeAttachSheet` and `CafeMessageMenu`: a sheet that
        spans the phone column edge to edge with a ring around it reads as a
        floating card rather than as a sheet rising from the bottom edge.

        `body: 'p-0'` because this is a FORM: it draws its own rows with its own
        spacing, and a sheet that padded its own content is padding applied
        twice.

        ⚠️ `footer` IS NOT COSMETIC HERE — IT IS THE ONLY PLACE THE SUBMIT BUTTON
        CAN LIVE. `USlideover`'s `body` is `flex-1 overflow-y-auto`, so a button
        left in it sits below the fold on a short phone and on `lg` font scale,
        where every rem grows (`html[data-font-scale="lg"]` in `main.css`) and the
        five radios plus the note already fill the sheet. A reader who cannot see
        the button reads a disabled control with no explanation as «there is no
        submit button». The footer renders OUTSIDE the scroller, so the button is
        pinned to the bottom edge at any text size.
  -->
  <USlideover
    :open="open"
    side="bottom"
    :title="title"
    :description="description"
    :ui="{
      content:
        'mx-auto max-w-md divide-y-0 rounded-t-3xl ring-0 sm:ring-0 border-t border-slate-200',
      header: 'p-4 sm:p-4',
      body: 'p-0 sm:p-0',
      footer:
        'flex-col items-stretch px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4',
      title: 'text-base font-bold text-x-text-title',
      description: 'text-xs leading-6 text-x-text-subtitle',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <!--
        ⚠️ THE `id` IS LOAD-BEARING: an HTML form cannot span two slideover slots,
        so the pinned button in `#footer` below is submitted by naming its form
        owner (`form="cafe-report-form"`). That keeps the native submit semantics —
        Enter in a field still submits, and a screen reader still finds one form.
      -->
      <form
        id="cafe-report-form"
        class="flex flex-col gap-4 px-4 pt-1 pb-2"
        @submit.prevent="submit"
      >
        <!--
          `URadioGroup` rather than five hand-drawn radios: the primitive brings
          the roving focus, the arrow-key navigation and the fieldset semantics,
          and re-declaring any of those is exactly the work this screen should
          not be doing.
        -->
        <URadioGroup
          v-model="reason"
          :items="[...CAFE_REPORT_REASONS]"
          legend="دلیل گزارش"
          color="x-primary"
          :ui="{
            fieldset: 'space-y-1',
            label: 'text-[15px] leading-7 text-x-text-title',
          }"
        />

        <!--
          ⚠️ WHY THE DISABLED BUTTON NEEDS A SENTENCE UNDER IT.

          `canSubmit` refuses a report with no reason — the store refuses it too —
          so the button is grey until a radio is chosen. That rule is right, and a
          button that looks missing is not: the reader sees radios, a field and no
          way forward, and concludes the sheet has no submit at all.

          ⚠️ **PERMANENTLY MOUNTED, TEXT SWAPPED — never `v-if`'d.** A live region
          that is INSERTED is announced unreliably: several screen readers only
          watch a region that was already in the accessibility tree when the change
          happened, and the one sentence that most needs saying is the one before
          the reader has pressed anything. So the element is always there and only
          its words change.

          `empty:hidden` is what keeps that honest — with the text gone the
          paragraph takes no box, so a permanently mounted region leaves no hole in
          the form's `gap-4`. The interpolation is alone on its line for the same
          reason: whitespace around it would keep the element non-empty and defeat
          the utility.
        -->
        <p
          id="cafe-report-hint"
          aria-live="polite"
          class="empty:hidden text-xs leading-6 text-x-text-subtitle"
        >
          {{ reportHint }}
        </p>

        <div class="flex flex-col gap-1.5">
          <label
            for="cafe-report-note"
            class="text-[15px] leading-7 text-x-text-title"
          >
            توضیح (اختیاری)
          </label>

          <UTextarea
            id="cafe-report-note"
            v-model="note"
            :rows="3"
            autoresize
            :maxlength="CAFE_REPORT_NOTE_MAX"
            color="x-primary"
            variant="soft"
            placeholder="اگر خواستید توضیح بیشتری بنویسید…"
            :ui="{ base: 'rounded-2xl bg-white text-sm leading-7' }"
            class="w-full"
          />

          <!--
            The counter sits on the row BELOW the field rather than inside it, so
            it never pushes the text the reader is typing, and it turns red only
            past the boundary — which the field cannot actually reach because
            `maxlength` stops it first. ⚠️ It therefore reads ۵۰۰/۵۰۰ at most and
            the red state is unreachable by design: it exists so the reader knows
            the cap is there.
          -->
          <p
            class="text-xs leading-5 tabular-nums"
            :class="noteTooLong ? 'text-red-600' : 'text-x-text-subtitle'"
          >
            {{ faNumber(noteLength) }} از
            {{ faNumber(CAFE_REPORT_NOTE_MAX) }} نویسه
          </p>
        </div>

        <!--
          The refusal is drawn HERE, inside the scrolling body, above the pinned
          button that caused it, rather than as a toast that leaves before it is
          read — and never as a replacement for the form, which is why nothing
          above is disabled while it is shown: the whole point is that the reader
          can correct the reason and try again with the note they already wrote.
        -->
        <p
          v-if="error"
          role="alert"
          class="rounded-2xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700"
        >
          {{ error }}
        </p>
      </form>
    </template>

    <!--
      ⚠️ THE BUTTON IS PINNED HERE, OUTSIDE THE SCROLLING BODY, and that is the
      whole fix. Everything above it may scroll; this never does, so the sheet can
      be submitted without the reader discovering a control below the fold. The
      safe-area padding the form used to carry moved with it — it is the sheet's
      bottom edge, whichever slot owns it.

      ⚠️ `form="cafe-report-form"` IS NOT DECORATION: a form cannot span two
      slideover slots, so the button is still a **native submit of that form** —
      Enter keeps working and a screen reader still finds one form rather than a
      detached control. Only the `type` is unchanged; where it lives is not.

      ⚠️ `aria-describedby` NAMES WHY IT IS DIMMED. A disabled button announces as
      «unavailable» and nothing more, which is the exact reading that made this
      sheet look like it had no submit at all; the hint above says what the reader
      has to do first, and pointing at it costs one attribute.
    -->
    <template #footer>
      <UButton
        type="submit"
        form="cafe-report-form"
        aria-describedby="cafe-report-hint"
        block
        color="error"
        variant="solid"
        label="ارسال گزارش"
        :disabled="!canSubmit"
        :loading="submitting"
        :ui="{ base: 'min-h-11 rounded-full text-sm font-bold' }"
      />
    </template>
  </USlideover>
</template>
