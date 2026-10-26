<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import type { ChildOverviewDto } from "~/types/parent-panel";

/**
 * The report's four anchors, in one tray and two columns.
 *
 * Four columns would put four 70px tiles on a 320px phone; the values are the
 * point of this tray, so they get the width instead of the icon column. Each
 * tile's accessible name repeats the figure and names the section it opens,
 * because the visible label alone («آزمون») does not say what pressing it does.
 */
const props = defineProps<{ report: ChildOverviewDto }>();

const testsCapped = computed<boolean>(
  () =>
    Array.isArray(props.report.tests.recent) &&
    props.report.tests.recent.length >= 50,
);

const testsLabel = computed<string>(() =>
  testsCapped.value ? "آزمون (۵۰ نتیجهٔ آخر)" : "آزمون",
);

const items = computed(() => {
  const entries = [
    {
      href: "#report-tests",
      icon: "solar:clipboard-list-linear",
      label: testsLabel.value,
      value: props.report.tests.completed,
      destination: "گزارش آزمون‌ها",
    },
    {
      href: "#report-goals",
      icon: "solar:flag-linear",
      label: "هدف",
      value: props.report.goals.total,
      destination: "اهداف و جایزه‌ها",
    },
    {
      href: "#report-tokens",
      icon: "solar:wallet-money-linear",
      label: "موجودی توکن",
      value: props.report.tokens.balanceTokens,
      destination: "مصرف و موجودی",
    },
    {
      href: "#report-activities",
      icon: "solar:pulse-2-linear",
      label: "فعالیت",
      value: props.report.activities.total,
      destination: "رویدادهای حساب",
    },
  ];

  return entries.map((entry) => ({
    ...entry,
    ariaLabel: `${entry.label}: ${faNumber(entry.value)} — رفتن به ${entry.destination}`,
  }));
});
</script>

<template>
  <nav aria-label="بخش‌های گزارش" class="neu-raised-lg rounded-3xl bg-white p-2">
    <div class="grid grid-cols-2 gap-2">
      <a
        v-for="item in items"
        :key="item.href"
        :href="item.href"
        :aria-label="item.ariaLabel"
        class="neu-inset flex min-h-20 min-w-0 flex-col justify-between gap-2 rounded-2xl bg-x-parent-warm-100 p-3 text-start transition-transform duration-150 ease-soft active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        <span class="flex items-center gap-2">
          <span
            class="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-x-parent-700"
            aria-hidden="true"
          >
            <UIcon :name="item.icon" size="18" />
          </span>
          <span class="min-w-0 text-[11px] leading-5 text-x-text-subtitle">
            {{ item.label }}
          </span>
        </span>

        <span class="font-yekan-extra text-lg leading-6 text-x-parent-600 tabular-nums">
          {{ faNumber(item.value) }}
        </span>
      </a>
    </div>
  </nav>
</template>
