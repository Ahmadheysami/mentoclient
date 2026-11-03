<script setup lang="ts">
import { faRelative } from "~/utils/fa";
import {
  PARENT_ACTIVITY_TITLES,
  parentActivityKindOf,
  type ChildOverviewTestResultDto,
  type ParentActivityItem,
} from "~/types/parent-panel";

/**
 * One child's report: identity, the four headline figures, the three decisions a
 * parent can make, tests, goals, token spending, access details and the
 * account-event log — all from a single `GET /child/{childId}/overview`.
 *
 * ## THE DESIGN
 *
 * A native case-file: the child's name on the ivory ground, then white surfaces
 * split by hairlines. Figures are label over value, numbers are right-aligned in
 * tabular digits, and nothing is raised above the page except the result sheet
 * that floats over it. Colour is spent in exactly two places — the test
 * composition bar and the links that leave the screen — because on this screen
 * colour means «this needs attention».
 *
 * ## WHY THE THREE DECISIONS ARE STILL ON THIS PAGE
 *
 * The report reads; it does not decide. Assigning a test, creating the access
 * code and its allowed hours, and setting goals each own a screen with their own
 * loading, states and back navigation — and each is reachable by URL. They stay
 * here as one grouped list so the report does not become the only way into them.
 *
 * ## WHY THIS PAGE NO LONGER RUNS THREE READS
 *
 * The report endpoint already carries the profile, counters, activity log,
 * goals and converted token figures. Loading the detail endpoint as well would
 * duplicate three requests for data this screen does not use and could leave
 * the screen half-updated. `loadChildReport` is the only read here.
 *
 * ## WHY THE CLOCK IS STILL A PROP
 *
 * `now` is `undefined` during SSR and the first client paint, so `faRelative`
 * falls back to an absolute date on both sides. Only after mount does the page
 * read the clock once and pass it down. A `Date.now()` inside a render would
 * produce a different string on the server and at hydration.
 *
 * ## WHY A CACHED REPORT SURVIVES A REFRESH FAILURE
 *
 * `loadChildReport` keeps the last successful report for every refusal except
 * `ERR_CHILD_NOT_FOUND`. This page shows that cached report with a quiet retry
 * banner instead of replacing a readable screen with an error state.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "گزارش فرزند",
});

useSeoMeta({ title: "گزارش فرزند" });

const route = useRoute();
const parentPanel = useParentPanel();

const childId = computed<string>(() => String(route.params.childId ?? ""));

const now = ref<number>();
const selectedResult = ref<ChildOverviewTestResultDto | null>(null);

const report = computed(
  () => parentPanel.state.reports[childId.value] ?? null,
);

const isLoading = computed<boolean>(
  () => parentPanel.state.loading.reports[childId.value] === true,
);

const error = computed<string | null>(
  () => parentPanel.state.error.reports[childId.value] ?? null,
);

const reason = computed<string | null>(
  () => parentPanel.state.reportReason[childId.value] ?? null,
);

const notFound = computed<boolean>(
  () => reason.value === "ERR_CHILD_NOT_FOUND",
);

/**
 * What a parent can decide about this child. Each row is a link and not a
 * control, because every one of them owns a screen of its own.
 */
const decisions = computed(() => [
  {
    to: `/panels/parent/children/${childId.value}/tests`,
    icon: "solar:clipboard-list-linear",
    title: "آزمون‌های فرزند",
    description: "تخصیص آزمون و سابقهٔ آزمون‌های او",
  },
  {
    to: `/panels/parent/children/${childId.value}/access`,
    icon: "solar:key-minimalistic-linear",
    title: "دسترسی",
    description: "ساخت کد دسترسی و ساعت‌های ورود",
  },
  {
    to: `/panels/parent/children/${childId.value}/goals`,
    icon: "solar:flag-linear",
    title: "هدف‌گذاری",
    description: "هدف‌های فرزندتان و جایزهٔ هر مرحله",
  },
]);

const childName = computed<string>(() => {
  const first = report.value?.child.fullName?.first;

  return typeof first === "string" && first.trim().length > 0
    ? first.trim()
    : "فرزند شما";
});

/**
 * The report carries `performanceModel` rows, whose `description` is an
 * internal prefix (`child-created:<userId>`) and must never be printed. The
 * kind map is the only thing read from it.
 */
const activityItems = computed<ParentActivityItem[]>(() => {
  const current = report.value;

  if (!current) return [];

  const rows = (Array.isArray(current.activities?.recent)
    ? current.activities.recent
    : []
  ).filter((row) => typeof row === "object" && row !== null);

  return rows.map((row, index) => {
    const kind = parentActivityKindOf(row.description);

    return {
      id: `${current.child.userId}:${row.createdAt}:${index}`,
      childId: current.child.userId,
      childName: childName.value,
      title: PARENT_ACTIVITY_TITLES[kind],
      kind,
      when: row.createdAt,
    };
  });
});

const lastActivity = computed<string>(() => {
  const value = report.value?.activities?.lastAt;

  if (!value) return "";

  return faRelative(value, now.value);
});

function reload() {
  void parentPanel.loadChildReport(childId.value, true);
}

onMounted(() => {
  now.value = Date.now();
  void parentPanel.loadChildReport(childId.value, true);
});

watch(childId, (id) => {
  selectedResult.value = null;
  now.value = import.meta.client ? Date.now() : undefined;

  if (!id) return;

  void parentPanel.loadChildReport(id, true);
});
</script>

<template>
  <div class="mx-auto px-4 pb-10 pt-3">
    <UiStateMessage
      v-if="notFound"
      icon="solar:user-block-linear"
      title="این فرزند پیدا نشد"
      description="ممکن است حذف شده باشد یا دسترسی شما به آن تغییر کرده باشد."
      action-label="بازگشت به فرزندان"
      action-to="/panels/parent/children"
    />

    <UiStateMessage
      v-else-if="!report && error"
      icon="solar:link-broken-linear"
      title="گزارش فرزند خوانده نشد"
      :description="error"
      action-label="تلاش دوباره"
      @action="reload"
    />

    <div v-else-if="!report" class="grid gap-4" aria-busy="true">
      <p class="sr-only" role="status">در حال بارگذاری گزارش</p>

      <div class="flex items-center gap-3.5 px-1">
        <USkeleton class="size-16 shrink-0 rounded-full bg-white" />
        <div class="grid flex-1 gap-2">
          <USkeleton class="h-5 w-2/3 rounded-md bg-white" />
          <USkeleton class="h-3 w-1/3 rounded-md bg-white" />
        </div>
      </div>

      <USkeleton class="h-40 rounded-2xl bg-white" />
      <USkeleton class="h-56 rounded-2xl bg-white" />
      <USkeleton class="h-24 rounded-2xl bg-white" />
      <USkeleton class="h-40 rounded-2xl bg-white" />
    </div>

    <template v-else>
      <div
        v-if="error"
        class="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3"
      >
        <p class="font-yekan-bold text-xs leading-5 text-red-700">
          به‌روزرسانی گزارش کامل نشد
        </p>
        <p class="mt-1 text-xs leading-6 text-red-700">
          {{ error }}
        </p>
        <button
          type="button"
          class="mt-1 inline-flex min-h-11 items-center text-xs font-yekan-bold text-red-700 underline decoration-red-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          @click="reload"
        >
          تلاش دوباره
        </button>
      </div>

      <p
        v-if="isLoading"
        role="status"
        class="mb-2 flex items-center gap-1.5 px-1 text-xs leading-5 text-x-text-subtitle"
      >
        <UIcon
          name="solar:refresh-linear"
          size="14"
          class="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        در حال به‌روزرسانی گزارش…
      </p>

      <ParentChildReportHero :report="report" :now="now" />

      <ParentChildReportSummary :report="report" class="mt-5" />

      <nav
        :aria-label="`تصمیم‌های مربوط به ${childName}`"
        class="mt-5 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white"
      >
        <NuxtLink
          v-for="item in decisions"
          :key="item.to"
          :to="item.to"
          class="flex min-h-14 items-center gap-3 border-b border-x-parent-warm-100 px-4 py-3 transition-colors duration-150 ease-out last:border-b-0 active:bg-x-parent-warm-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-x-parent-500"
        >
          <UIcon
            :name="item.icon"
            size="18"
            class="shrink-0 text-x-text-subtitle"
            aria-hidden="true"
          />

          <span class="min-w-0 flex-1">
            <span class="block text-sm font-yekan-bold text-x-text-title">
              {{ item.title }}
            </span>
            <span class="mt-0.5 block truncate text-xs text-x-text-subtitle">
              {{ item.description }}
            </span>
          </span>

          <UIcon
            name="solar:alt-arrow-left-linear"
            size="16"
            class="shrink-0 text-x-parent-300"
            aria-hidden="true"
          />
        </NuxtLink>
      </nav>

      <ParentChildReportTests
        :tests="report.tests"
        :child-id="childId"
        :child-name="childName"
        class="mt-7"
        @open="selectedResult = $event"
      />

      <ParentChildReportGoals
        :goals="report.goals"
        :child-id="childId"
        class="mt-7"
      />

      <ParentChildReportTokens
        :tokens="report.tokens"
        :balances="report.balances"
        :now="now"
        class="mt-7"
      />

      <ParentChildReportProfile
        :general="report.general"
        :child="report.child"
        :now="now"
        class="mt-7"
      />

      <section
        id="report-activities"
        aria-labelledby="report-activities-title"
        class="mt-7 scroll-mt-20"
      >
        <div class="flex items-baseline justify-between gap-3 px-1">
          <div class="min-w-0">
            <h2
              id="report-activities-title"
              class="font-yekan-bold text-sm text-x-text-title"
            >
              رویدادهای حساب
            </h2>
            <p v-if="lastActivity" class="mt-1 text-xs leading-5 text-x-text-subtitle">
              آخرین رویداد {{ lastActivity }}
            </p>
          </div>

          <NuxtLink
            to="/panels/parent/activity"
            aria-label="همه رویدادهای حساب"
            class="inline-flex min-h-11 shrink-0 items-center text-xs text-x-parent-700 underline decoration-x-parent-200 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          >
            همه
          </NuxtLink>
        </div>

        <ParentChildReportActivity :items="activityItems" :now="now" class="mt-2" />
      </section>

      <ParentChildReportTestSheet
        :result="selectedResult"
        :child-name="childName"
        @close="selectedResult = null"
      />
    </template>
  </div>
</template>
