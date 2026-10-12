<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * «آزمون گرفتن از دیگران» — the Assessment Others feature: a locked
 * preview of the invitation-link workflow this panel will offer.
 *
 * ## WHAT THIS PAGE PROMISES
 *
 * A future workflow where the reader can send assessment invitations to
 * colleagues or candidates via a shareable link, track their completion
 * status, and review aggregated results. Today it is a locked visual
 * preview showing the invitation-link concept and three fictional status
 * indicators.
 *
 * ## EVERYTHING HERE IS FICTIONAL
 *
 * The invitation URL, the assessment names, the status labels and the
 * counts are all invented data hard-coded in this file. No API call is
 * made and no real user data is rendered. The page exists to show the
 * reader what the feature WILL look like when it ships. The lock is
 * communicated three ways, consistent with the rest of the employer panel:
 *
 *   1. A gold «به‌زودی» badge in the header (same token, same ring, same
 *      `font-yekan-bold font-normal` pairing as `ComingSoonCard.vue`).
 *   2. A `UButton` with `:disabled="true"` — visibly greyed, non-operational,
 *      but still a real `<button>` element in the DOM so a screen reader
 *      announces it as disabled rather than absent.
 *   3. A short paragraph stating plainly that the data is illustrative.
 *
 * ## THE SHADCN/UI-INSPIRED LIGHT THEME IS THE PAGE'S VISUAL IDENTITY
 *
 * The redesign moves this page to the employer panel's shadcn/ui-inspired
 * system: a white card with `rounded-xl shadow-sm border border-gray-200`,
 * the invitation-link card with a dashed hairline that reads as "a link
 * you could copy", and a three-column status row of `bg-gray-50` cards that
 * shows at a glance where every invitation stands. The subject is tracking,
 * and the page's design says so — status dots, counts, and a clear visual
 * hierarchy from sent to completed.
 *
 * ## THE INVITATION LINK CARD
 *
 * A mock link card showing a fictional URL with a copy button icon. The
 * URL is `https://mentoya.app/a/abc123` — clearly a placeholder, not a
 * real deep link. The card has a dashed border to read as "a link you
 * could copy" without being an actual interactive element. The whole card
 * is `aria-hidden` because it is illustrative — a screen reader does not
 * need to hear a fictional URL.
 *
 * ## STATUS INDICATORS
 *
 * Three fictional invitation statuses shown as a row of small cards:
 * «ارسال شده» (sent), «در انتظار تکمیل» (awaiting), «تکمیل شده» (completed).
 * Each has a coloured dot and a count. The colors are:
 *   - Sent: blue (in flight)
 *   - Awaiting: amber (in progress)
 *   - Completed: emerald (success)
 *
 * ⚠️ THE DOTS ARE LITERALS, NOT `x-*` TOKENS, ON PURPOSE. This page is
 * painted with the shadcn/ui-inspired palette directly rather than through
 * the `.employer-panel` scope, and three dots in one
 * colour would destroy the only distinction the row has. The three
 * literals are bright enough to read as dots on the light cards.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "آزمون گرفتن از دیگران",
});

useSeoMeta({
  title: "آزمون گرفتن از دیگران",
});

/**
 * One fictional invitation status.
 *
 * `label` is the Persian status name. `count` is the fictional number of
 * invitations in that state. `dotColor` is the Tailwind background class
 * for the status dot.
 */
interface InvitationStatus {
  label: string;
  count: number;
  dotColor: string;
}

/**
 * Three illustrative invitation statuses.
 *
 * ⚠️ ALL DATA IS FICTIONAL. The counts are illustrative and do not
 * represent real invitations.
 */
const statuses: InvitationStatus[] = [
  { label: "ارسال شده", count: 5, dotColor: "bg-blue-500" },
  { label: "در انتظار تکمیل", count: 3, dotColor: "bg-amber-400" },
  { label: "تکمیل شده", count: 2, dotColor: "bg-emerald-500" },
];

/**
 * The fictional invitation link.
 *
 * A clearly placeholder URL. Not a real deep link. Not clickable.
 */
const FICTIONAL_LINK = "https://mentoya.app/a/abc123";
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      One card for the whole page, matching the other three feature pages'
      structure so the four read as a set. `rounded-xl
      bg-white p-4 shadow-sm border border-gray-200` is the
      employer panel's shadcn/ui-inspired standard card surface.
    -->
    <section
      aria-labelledby="employer-assessment-heading"
      class="rounded-xl bg-white p-4 shadow-sm border border-gray-200"
    >
      <!-- ===== Header: icon chip + title + «به‌زودی» badge ===== -->
      <div class="flex items-start gap-3">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
          aria-hidden="true"
        >
          <UIcon name="solar:clipboard-text-linear" size="18" />
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-2">
            <h2
              id="employer-assessment-heading"
              class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-gray-900"
            >
              آزمون گرفتن از دیگران
            </h2>

            <!--
              The gold «به‌زودی» badge — identical pattern to
              ComingSoonCard.vue. See the file header for why the
              `font-yekan-bold font-normal` pairing is required.
            -->
            <UBadge
              color="warning"
              class="shrink-0"
              :ui="{
                base: 'gap-1.5 rounded-full bg-x-gold-200 px-2.5 py-0.5 text-[11px] leading-5 font-yekan-bold font-normal text-x-gold-700 ring-1 ring-x-gold-500/40',
              }"
            >
              <span
                class="size-1.5 shrink-0 rounded-full bg-x-gold-700"
                aria-hidden="true"
              />
              به‌زودی
            </UBadge>
          </div>

          <p class="mt-1 text-xs leading-5 text-gray-500">
            ارسال لینک آزمون به داوطلبان و همکاران؛ پیگیری وضعیت تکمیل و
            مشاهدهٔ نتایج.
          </p>
        </div>
      </div>

      <!-- ===== Invitation link card ===== -->
      <!--
        A dashed-border card showing the fictional invitation URL. `aria-hidden`
        because it is illustrative — a screen reader does not need to hear a
        placeholder URL. The `border-dashed` reads as "a link you could copy"
        without being an actual interactive element.

        The URL is `dir="ltr"` and `font-mono` because it is a Latin string
        and must not be reordered by the RTL layout; everything around it
        stays Persian and RTL.
      -->
      <div
        class="mt-4 flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3"
        aria-hidden="true"
      >
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
        >
          <UIcon name="solar:link-linear" size="18" />
        </span>

        <div class="min-w-0 flex-1">
          <p class="text-[11px] leading-5 text-gray-500">لینک دعوت</p>
          <p
            class="mt-0.5 truncate font-mono text-xs leading-5 text-gray-900"
            dir="ltr"
          >
            {{ FICTIONAL_LINK }}
          </p>
        </div>

        <UIcon
          name="solar:copy-linear"
          size="18"
          class="shrink-0 text-gray-400"
        />
      </div>

      <!-- ===== Status indicators ===== -->
      <!--
        Three status cards in a 3-column grid. Each shows a coloured dot, the
        status label and the count. `aria-hidden` because they are illustrative
        previews of fictional data.

        The grid is `grid-cols-3` — one column per status — so the three
        states read left-to-right (in RTL: right-to-left) as a progression
        from sent to completed. The counts are Persian digits, consistent
        with every other number on this app.
      -->
      <div class="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
        <div
          v-for="status in statuses"
          :key="status.label"
          class="flex flex-col items-center gap-1.5 rounded-lg bg-gray-50 p-3 border border-gray-200"
        >
          <span
            class="size-2 rounded-full"
            :class="status.dotColor"
          />
          <span class="text-[11px] leading-5 text-gray-500">
            {{ status.label }}
          </span>
          <span class="font-yekan-bold text-sm leading-6 text-gray-900">
            {{ faNumber(status.count) }}
          </span>
        </div>
      </div>

      <!-- ===== Explanation ===== -->
      <p class="mt-4 text-xs leading-5 text-gray-500">
        این صفحه پیش‌نمایشی از قابلیت آزمون گرفتن از دیگران است. لینک دعوت،
        وضعیت‌ها و تعدادها کاملاً فرضی و برای نمایش شکل ابزار در نظر گرفته
        شده‌اند.
      </p>

      <!-- ===== CTA — disabled, clearly locked ===== -->
      <!--
        The locked CTA is the employer accent with white-on-indigo ink — the
        panel's primary-action pairing. The `:ui` override is the same
        technique `Test/ActiveCard.vue` uses for its own button.
      -->
      <UButton
        block
        color="x-primary"
        size="lg"
        class="mt-4"
        disabled
        :ui="{ base: 'bg-indigo-600! text-white! hover:bg-indigo-700!' }"
      >
        ارسال دعوت‌نامه
      </UButton>
    </section>
  </div>
</template>
