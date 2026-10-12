<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * «استخدام» — the Recruitment feature: a locked preview of the hiring
 * pipeline this panel will offer.
 *
 * ## WHAT THIS PAGE PROMISES
 *
 * A future recruitment pipeline: the reader will be able to post job
 * openings, review resumes, schedule interviews and hire — all from this
 * panel. Today it is a locked visual preview showing the four-stage pipeline
 * and two fictional job cards.
 *
 * ## EVERYTHING HERE IS FICTIONAL
 *
 * The pipeline stages, the job titles, the departments and the applicant
 * counts are all invented data hard-coded in this file. No API call is made
 * and no real user data is rendered. The page exists to show the reader what
 * the feature WILL look like when it ships — a promise of capability, not a
 * working tool. The lock is communicated three ways, consistent with the rest
 * of the employer panel:
 *
 *   1. A gold «به‌زودی» badge in the header (same token, same ring, same
 *      `font-yekan-bold font-normal` pairing as `ComingSoonCard.vue`).
 *   2. A `UButton` with `:disabled="true"` — visibly greyed, non-operational,
 *      but still a real `<button>` element in the DOM so a screen reader
 *      announces it as disabled rather than absent.
 *   3. A short paragraph stating plainly that the data is illustrative.
 *
 * ## THE PIPELINE IS A VERTICAL STEPPER
 *
 * The four stages are drawn as a numbered vertical stepper — a dot, a
 * connector line, the stage name and its candidate count — rather than a
 * horizontal chip row. On a phone a horizontal row of four stages is cramped
 * (~90px each) and the arrows between them become noise; the vertical
 * stepper gives each stage a full line, reads top-to-bottom in the same
 * order the pipeline flows, and makes the funnel visible: the count drops
 * from stage to stage, which is the one thing a pipeline diagram must show.
 *
 * The connector line is a `w-0.5` absolute bar between the dots, drawn only
 * between stages (not after the last), in `bg-gray-200` — a hairline,
 * because a rule and an outline are not the same job and this one only has
 * to say "these are connected".
 *
 * ## THE SHADCN/UI-INSPIRED LIGHT THEME IS THE PAGE'S VISUAL IDENTITY
 *
 * The redesign moves this page to the employer panel's shadcn/ui-inspired
 * system: one white card with `rounded-xl shadow-sm border border-gray-200`,
 * the pipeline's numbered dots in the indigo accent (the panel's
 * "active/progress" signal), and the two job cards in `bg-gray-50` and
 * `bg-indigo-50` surfaces with hairlines. Recruitment is a process, and the
 * page's design still says so: ordered stages, aligned columns, no decoration
 * that is not carrying information.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "استخدام",
});

useSeoMeta({
  title: "استخدام",
});

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
 * The counts form a funnel — ۱۲ → ۸ → ۴ → ۱ — because a pipeline whose counts
 * did not drop would not read as a pipeline. The drop is the information.
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
 * chip palette below.
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
 * The chip background classes for the job cards.
 *
 * Two shadcn/ui-inspired surfaces cycling so the two cards are visually
 * distinct: `bg-gray-50` with a neutral hairline, and `bg-indigo-50` with an
 * indigo hairline — the same pairing the radar page's icon chip uses, so
 * the two previews read as one family inside the employer panel.
 */
const JOB_TINTS = [
  "rounded-lg bg-gray-50 p-3 border border-gray-200",
  "rounded-lg bg-indigo-50 p-3 border border-indigo-200",
];
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      One card for the whole page, matching the radar page's structure so the
      four feature pages read as a set. `rounded-xl bg-white p-4 shadow-sm
      border border-gray-200` is the employer panel's shadcn/ui-inspired
      standard card surface.
    -->
    <section
      aria-labelledby="employer-recruitment-heading"
      class="rounded-xl bg-white p-4 shadow-sm border border-gray-200"
    >
      <!-- ===== Header: icon chip + title + «به‌زودی» badge ===== -->
      <div class="flex items-start gap-3">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
          aria-hidden="true"
        >
          <UIcon name="solar:user-check-rounded-linear" size="18" />
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-2">
            <h2
              id="employer-recruitment-heading"
              class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-gray-900"
            >
              استخدام
            </h2>

            <!--
              The gold «به‌زودی» badge — identical pattern to ComingSoonCard.vue.
              See the file header for why the `font-yekan-bold font-normal`
              pairing is required.
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
            انتشار آگهی، بررسی رزومه، مصاحبه و استخدام نیرو — همه در یک پنل
            واحد.
          </p>
        </div>
      </div>

      <!-- ===== Pipeline stepper ===== -->
      <!--
        A vertical stepper of the four stages. Each row is a dot (with the
        stage's number) and the stage's name and count; a `w-0.5` connector
        bar runs between consecutive dots.

        The rows are NOT `aria-hidden`: the pipeline is content, not
        decoration, and a screen reader should be able to read the four
        stages and their counts. The connector line is `aria-hidden` because
        it is a visual aid with no semantic content.

        The dots are the employer accent with white-on-indigo numerals — the
        panel's progress signal, so the funnel reads as "these stages are
        live" even though the feature is locked.

        `start-4` on the connector aligns it with the centre of the `size-8`
        dot (8 / 2 = 4 = 16px); `top-8` starts it at the bottom of the dot
        and `bottom-0` runs it to the next row.
      -->
      <ol class="mt-5 flex flex-col">
        <li
          v-for="(stage, i) in stages"
          :key="stage.label"
          class="relative flex gap-3"
        >
          <!-- Connector line between dots — not after the last stage -->
          <span
            v-if="i < stages.length - 1"
            class="absolute top-8 bottom-0 start-4 w-0.5 bg-gray-200"
            aria-hidden="true"
          />

          <!--
            The numbered dot. `size-8` with the number centred in it; the
            number is the stage's position in the pipeline and is Persian
            because every number on this app is Persian.
          -->
          <span
            class="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-indigo-600 font-yekan-bold text-xs text-white"
            aria-hidden="true"
          >
            {{ faNumber(i + 1) }}
          </span>

          <!-- Stage name and candidate count -->
          <div class="min-w-0 flex-1 pb-5">
            <p class="font-yekan-bold text-sm leading-6 text-gray-900">
              {{ stage.label }}
            </p>
            <p class="mt-0.5 text-xs leading-5 text-gray-500">
              {{ faNumber(stage.count) }} متقاضی
            </p>
          </div>
        </li>
      </ol>

      <!-- ===== Fictional job cards ===== -->
      <!--
        Two job cards in a 2-column grid. `aria-hidden` because they are
        illustrative previews of fictional jobs — the card's heading and
        description already explain the feature, and a screen reader does
        not need to hear «۷ متقاضی» for a job that does not exist.

        The tint cycles through `JOB_TINTS` so the two cards are visually
        distinct, in the employer panel's shadcn/ui-inspired gray and indigo
        surfaces.
      -->
      <div class="mt-2 grid grid-cols-2 gap-3" aria-hidden="true">
        <div
          v-for="job in jobs"
          :key="job.title"
          :class="JOB_TINTS[job.color % JOB_TINTS.length]"
        >
          <p class="truncate font-yekan-bold text-xs leading-5 text-gray-900">
            {{ job.title }}
          </p>
          <p class="mt-0.5 truncate text-[11px] leading-5 text-gray-500">
            {{ job.department }}
          </p>
          <p class="mt-1.5 text-[11px] leading-5 text-gray-500">
            {{ faNumber(job.applicants) }} متقاضی
          </p>
        </div>
      </div>

      <!-- ===== Explanation ===== -->
      <p class="mt-4 text-xs leading-5 text-gray-500">
        این صفحه پیش‌نمایشی از قابلیت استخدام است. مراحل، آگهی‌ها و تعداد
        متقاضیان کاملاً فرضی و برای نمایش شکل ابزار در نظر گرفته شده‌اند.
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
        ایجاد آگهی جدید
      </UButton>
    </section>
  </div>
</template>
