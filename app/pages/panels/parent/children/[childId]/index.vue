<script setup lang="ts">
import { faRelative } from "~/utils/fa";
import {
  PARENT_ACTIVITY_TITLES,
  parentActivityKindOf,
  type ChildOverviewTestResultDto,
  type ParentActivityItem,
} from "~/types/parent-panel";

/**
 * One child's report: identity, the four headline figures, tests, goals, token
 * spending, access details and the account-event log — all from a single
 * `GET /child/{childId}/overview`.
 *
 * ## WHY THE THREE DECISIONS ARE STILL ON THIS PAGE
 *
 * The report reads; it does not decide. Assigning a test, creating the access
 * code and its allowed hours, and setting goals each own a screen with their own
 * loading, states and back navigation — and each is reachable by URL. They stay
 * here as the page's decisions nav so the report does not become the only way
 * into them.
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
  <div class="mx-auto w-11/12 pb-8 pt-4">
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

    <div v-else-if="!report" class="grid gap-3" aria-busy="true">
      <p class="sr-only" role="status">در حال بارگذاری گزارش</p>
      <USkeleton class="h-48 rounded-[2rem] bg-white" />
      <div class="grid grid-cols-2 gap-2">
        <USkeleton v-for="tile in 4" :key="tile" class="h-20 rounded-2xl bg-white" />
      </div>
      <USkeleton class="h-36 rounded-3xl bg-white" />
      <USkeleton class="h-32 rounded-3xl bg-white" />
      <USkeleton class="h-40 rounded-3xl bg-white" />
    </div>

    <template v-else>
      <UAlert
        v-if="error"
        variant="soft"
        color="error"
        title="به‌روزرسانی گزارش کامل نشد"
        class="mb-3 rounded-3xl"
      >
        <template #description>{{ error }}</template>
        <template #actions>
          <UButton
            type="button"
            size="sm"
            icon="solar:refresh-linear"
            label="تلاش دوباره"
            variant="outline"
            color="error"
            class="min-h-11"
            @click="reload"
          />
        </template>
      </UAlert>

      <p
        v-if="isLoading"
        role="status"
        class="mb-3 flex items-center gap-1.5 px-1 text-[11px] leading-5 text-x-text-subtitle"
      >
        <UIcon
          name="solar:refresh-linear"
          size="14"
          class="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        در حال به‌روزرسانی گزارش…
      </p>

      <ParentChildReportHero
        :report="report"
        :now="now"
        data-scroll-reveal
      />

      <nav
        :aria-label="`تصمیم‌های مربوط به ${childName}`"
        class="mt-4 grid gap-2"
        data-scroll-reveal
      >
        <NuxtLink
          v-for="item in decisions"
          :key="item.to"
          :to="item.to"
          class="neu-raised flex min-h-14 items-center gap-3 rounded-3xl bg-white p-3 transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
            aria-hidden="true"
          >
            <UIcon :name="item.icon" size="20" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-yekan-bold text-x-text-title">{{ item.title }}</span>
            <span class="block truncate text-xs text-x-text-subtitle">{{ item.description }}</span>
          </span>
          <UIcon
            name="solar:alt-arrow-left-linear"
            size="18"
            class="shrink-0 text-x-parent-300"
            aria-hidden="true"
          />
        </NuxtLink>
      </nav>

      <ParentChildReportSummary
        :report="report"
        class="mt-4"
        data-scroll-reveal
      />

      <ParentChildReportTests
        :tests="report.tests"
        :child-id="childId"
        :child-name="childName"
        class="mt-6"
        data-scroll-reveal
        @open="selectedResult = $event"
      />

      <ParentChildReportGoals
        :goals="report.goals"
        :child-id="childId"
        class="mt-6"
        data-scroll-reveal
      />

      <ParentChildReportTokens
        :tokens="report.tokens"
        :balances="report.balances"
        :now="now"
        class="mt-6"
        data-scroll-reveal
      />

      <ParentChildReportProfile
        :general="report.general"
        :child="report.child"
        :now="now"
        class="mt-6"
        data-scroll-reveal
      />

      <section
        id="report-activities"
        aria-labelledby="report-activities-title"
        class="mt-6 scroll-mt-20"
        data-scroll-reveal
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 id="report-activities-title" class="text-sm font-yekan-bold text-x-text-title">
              رویدادهای حساب
            </h2>
            <p v-if="lastActivity" class="mt-1 text-xs leading-6 text-x-text-subtitle">
              آخرین رویداد {{ lastActivity }}
            </p>
          </div>

          <NuxtLink
            to="/panels/parent/activity"
            aria-label="همه رویدادهای حساب"
            class="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-xs text-x-parent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          >
            همه
          </NuxtLink>
        </div>

        <ParentChildActivityList
          :items="activityItems"
          :loading="false"
          :error="null"
          :now="now"
          compact-empty
          class="mt-3"
        />
      </section>

      <ParentChildReportTestSheet
        :result="selectedResult"
        :child-name="childName"
        @close="selectedResult = null"
      />
    </template>
  </div>
</template>
