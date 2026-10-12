<script setup lang="ts">
/**
 * «استخدام» — the Recruitment locked demo.
 *
 * ## WHAT THIS CARD PROMISES
 *
 * A future recruitment pipeline: the reader will be able to post job
 * openings, review resumes, schedule interviews and hire — all from this
 * panel. Today it is a locked visual preview showing the four-stage
 * pipeline and two fictional job cards.
 *
 * ## THE PIPELINE IS A HORIZONTAL STAGE VIEW
 *
 * Four stages connected by arrows, drawn as a flex row of chips with
 * chevron separators. On a 320px phone the row wraps to two lines
 * (`flex-wrap`), which is fine — the stages are still readable in order.
 * Each stage is a small rounded chip with a number and a label, so the
 * reader can scan the flow left-to-right (in RTL: right-to-left) without
 * reading a paragraph.
 *
 * ## JOB CARDS ARE FICTIONAL
 *
 * Two illustrative job openings with invented titles, departments and
 * applicant counts. No real company data is shown. The cards are
 * `aria-hidden` because they are purely visual — the card's heading and
 * description already explain the feature, and a screen reader does not
 * need to hear «۳ متقاضی» for a job that does not exist.
 *
 * ## LOCK INDICATOR
 *
 * Same gold «به‌زودی» badge pattern as `ComingSoonCard.vue` and
 * `EmployeeRadar.vue`. The CTA is a disabled `UButton`.
 */

/**
 * One stage in the recruitment pipeline.
 *
 * `label` is the Persian stage name. `count` is the fictional number of
 * candidates at that stage (illustrative only).
 */
interface PipelineStage {
  label: string;
  count: number;
}

/**
 * The four recruitment stages, in order.
 *
 * ⚠️ ALL DATA IS FICTIONAL. The counts are illustrative and do not
 * represent real candidates.
 */
const stages: PipelineStage[] = [
  { label: "ارسال درخواست", count: 12 },
  { label: "بررسی رزومه", count: 8 },
  { label: "مصاحبه", count: 4 },
  { label: "استخدام", count: 1 },
];

/**
 * One fictional job opening.
 *
 * `title` is the job title. `department` is the fictional department name.
 * `applicants` is the fictional applicant count. `color` indexes into the
 * pastel chip palette.
 */
interface FictionalJob {
  title: string;
  department: string;
  applicants: number;
  color: number;
}

/**
 * Two illustrative job openings.
 *
 * ⚠️ ALL DATA IS FICTIONAL. These jobs do not exist.
 */
const jobs: FictionalJob[] = [
  {
    title: "طراح رابط کاربری",
    department: "طراحی و محصول",
    applicants: 7,
    color: 0,
  },
  {
    title: "توسعه‌دهندهٔ فرانت‌اند",
    department: "فنی و مهندسی",
    applicants: 5,
    color: 1,
  },
];

/**
 * The pastel chip background classes for the job cards.
 *
 * Two tints cycling so the two cards are visually distinct. Same palette
 * family as the radar avatars.
 */
const JOB_TINTS = [
  "bg-x-sky-100 text-x-sky-700",
  "bg-x-lime-100 text-x-text-title",
];
</script>

<template>
  <section
    aria-labelledby="employee-recruitment-heading"
    class="rounded-4xl bg-white p-4 ring-1 ring-x-sky-300"
  >
    <!-- ===== Header ===== -->
    <div class="flex items-start gap-3">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-2xl bg-x-sky-100 text-x-text-title"
        aria-hidden="true"
      >
        <UIcon name="solar:user-check-rounded-linear" size="20" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <h3
            id="employee-recruitment-heading"
            class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-x-text-title"
          >
            استخدام
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
          انتشار آگهی، بررسی رزومه، مصاحبه و استخدام نیرو — همه در یک پنل واحد.
        </p>
      </div>
    </div>

    <!-- ===== Pipeline stages ===== -->
    <div
      class="mt-4 flex flex-wrap items-center gap-2"
      aria-hidden="true"
    >
      <template v-for="(stage, i) in stages" :key="stage.label">
        <span
          class="rounded-full bg-x-sky-100 px-3 py-1.5 text-[11px] font-yekan-bold leading-5 text-x-text-title"
        >
          {{ stage.label }}
        </span>
        <UIcon
          v-if="i < stages.length - 1"
          name="solar:alt-arrow-left-linear"
          size="14"
          class="shrink-0 text-x-text-muted"
        />
      </template>
    </div>

    <!-- ===== Fictional job cards ===== -->
    <div
      class="mt-3 grid grid-cols-2 gap-2"
      aria-hidden="true"
    >
      <div
        v-for="job in jobs"
        :key="job.title"
        class="rounded-2xl p-3 ring-1 ring-x-sky-200"
        :class="JOB_TINTS[job.color % JOB_TINTS.length]"
      >
        <p class="truncate font-yekan-bold text-xs leading-5 text-x-text-title">
          {{ job.title }}
        </p>
        <p class="mt-0.5 truncate text-[11px] leading-5 text-x-text-subtitle">
          {{ job.department }}
        </p>
        <p class="mt-1.5 text-[11px] leading-5 text-x-text-subtitle">
          {{ job.applicants }} متقاضی
        </p>
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
      ایجاد آگهی جدید
    </UButton>
  </section>
</template>
