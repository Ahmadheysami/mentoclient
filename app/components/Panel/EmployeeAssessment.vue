<script setup lang="ts">
/**
 * «آزمون گرفتن از دیگران» — the Assessment Others locked demo.
 *
 * ## WHAT THIS CARD PROMISES
 *
 * A future workflow where the reader can send assessment invitations to
 * colleagues or candidates via a shareable link, track their completion
 * status, and review aggregated results. Today it is a locked visual
 * preview showing the invitation-link concept and three fictional status
 * indicators.
 *
 * ## THE INVITATION LINK CARD
 *
 * A mock link card showing a fictional URL with a copy button icon. The
 * URL is `https://mentoya.app/a/abc123` — clearly a placeholder, not a
 * real deep link. The card has a dashed border to read as "a link you
 * could copy" without being an actual interactive element.
 *
 * ## STATUS INDICATORS
 *
 * Three fictional invitation statuses shown as a row of small cards:
 * «ارسال شده» (sent), «در انتظار تکمیل» (awaiting), «تکمیل شده» (completed).
 * Each has a colored dot and a count. The colors are:
 *   - Sent: sky (informational)
 *   - Awaiting: gold/amber (in progress)
 *   - Completed: lime (success)
 *
 * These are the same semantic colors used elsewhere in the app, so the
 * reader already knows what they mean.
 *
 * ## LOCK INDICATOR
 *
 * Same gold «به‌زودی» badge pattern. The CTA is a disabled `UButton`.
 */

/**
 * One fictional invitation status.
 *
 * `label` is the Persian status name. `count` is the fictional number of
 * invitations in that state. `color` is the Tailwind text colour class for
 * the status dot. `bg` is the Tailwind background class for the status
 * dot.
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
  { label: "ارسال شده", count: 5, dotColor: "bg-x-sky-500" },
  { label: "در انتظار تکمیل", count: 3, dotColor: "bg-x-gold-500" },
  { label: "تکمیل شده", count: 2, dotColor: "bg-x-lime-500" },
];

/**
 * The fictional invitation link.
 *
 * A clearly placeholder URL. Not a real deep link. Not clickable.
 */
const FICTIONAL_LINK = "https://mentoya.app/a/abc123";
</script>

<template>
  <section
    aria-labelledby="employee-assessment-heading"
    class="rounded-4xl bg-white p-4 ring-1 ring-x-sky-300"
  >
    <!-- ===== Header ===== -->
    <div class="flex items-start gap-3">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-2xl bg-x-sky-100 text-x-text-title"
        aria-hidden="true"
      >
        <UIcon name="solar:clipboard-text-linear" size="20" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <h3
            id="employee-assessment-heading"
            class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-x-text-title"
          >
            آزمون گرفتن از دیگران
          </h3>

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

        <p class="mt-1.5 text-xs leading-6 text-x-text-subtitle">
          ارسال لینک آزمون به داوطلبان و همکاران؛ پیگیری وضعیت تکمیل و مشاهدهٔ
          نتایج.
        </p>
      </div>
    </div>

    <!-- ===== Invitation link card ===== -->
    <div
      class="mt-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-x-sky-200 bg-x-mist-50 p-3"
      aria-hidden="true"
    >
      <span
        class="grid size-10 shrink-0 place-items-center rounded-xl bg-x-sky-100 text-x-text-title"
      >
        <UIcon name="solar:link-linear" size="18" />
      </span>

      <div class="min-w-0 flex-1">
        <p class="text-[11px] leading-5 text-x-text-subtitle">لینک دعوت</p>
        <p
          class="mt-0.5 truncate font-mono text-xs leading-5 text-x-text-title"
          dir="ltr"
        >
          {{ FICTIONAL_LINK }}
        </p>
      </div>

      <UIcon
        name="solar:copy-linear"
        size="18"
        class="shrink-0 text-x-text-muted"
      />
    </div>

    <!-- ===== Status indicators ===== -->
    <div
      class="mt-3 grid grid-cols-3 gap-2"
      aria-hidden="true"
    >
      <div
        v-for="status in statuses"
        :key="status.label"
        class="flex flex-col items-center gap-1.5 rounded-2xl bg-x-mist-50 p-3 ring-1 ring-x-sky-200"
      >
        <span
          class="size-2 rounded-full"
          :class="status.dotColor"
        />
        <span class="text-[11px] leading-5 text-x-text-subtitle">
          {{ status.label }}
        </span>
        <span class="font-yekan-bold text-sm leading-6 text-x-text-title">
          {{ status.count }}
        </span>
      </div>
    </div>

    <!-- ===== CTA ===== -->
    <UButton
      block
      color="x-primary"
      size="lg"
      class="mt-4"
      disabled
    >
      ارسال دعوت‌نامه
    </UButton>
  </section>
</template>
