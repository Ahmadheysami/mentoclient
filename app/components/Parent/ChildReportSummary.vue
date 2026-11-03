<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import type { ChildOverviewDto } from "~/types/parent-panel";

/**
 * The four figures that answer «این فرزند در چه وضعی است؟» — tests taken, goals
 * set, tokens left and account events — in one surface split by hairlines.
 *
 * ## WHY ONE SURFACE AND NOT FOUR CARDS
 *
 * These are peer numbers, read together and compared. Four bordered cards would
 * give each one its own frame and its own icon, which is four times the chrome
 * for the same four values at a smaller size. One sheet with dividers keeps the
 * values at 24px on a 320px phone.
 *
 * ## WHY THERE IS NO ICON
 *
 * The label under each figure already names it («آزمون کامل‌شده»), so an icon
 * would be a second name for the same thing in the smallest space on the screen.
 * The label is the only grey thing in a cell; the figure is ink.
 *
 * Each cell is still a link into the section it summarises, and its accessible
 * name says where it goes, because «آزمون» alone does not say what pressing it
 * does.
 */
const props = defineProps<{ report: ChildOverviewDto }>();

const testsCapped = computed<boolean>(
  () =>
    Array.isArray(props.report.tests.recent) &&
    props.report.tests.recent.length >= 50,
);

const items = computed(() => {
  const entries = [
    {
      href: "#report-tests",
      label: testsCapped.value ? "آزمون در ۵۰ نتیجهٔ آخر" : "آزمون کامل‌شده",
      value: props.report.tests.completed,
      destination: "گزارش آزمون‌ها",
    },
    {
      href: "#report-goals",
      label: "هدف",
      value: props.report.goals.total,
      destination: "اهداف و جایزه‌ها",
    },
    {
      href: "#report-tokens",
      label: "موجودی توکن",
      value: props.report.tokens.balanceTokens,
      destination: "مصرف و موجودی",
    },
    {
      href: "#report-activities",
      label: "رویداد حساب",
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
  <nav
    aria-label="بخش‌های گزارش"
    class="grid grid-cols-2 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white"
  >
    <a
      v-for="(item, index) in items"
      :key="item.href"
      :href="item.href"
      :aria-label="item.ariaLabel"
      class="flex min-h-20 min-w-0 flex-col justify-center gap-1 px-4 py-3 transition-colors duration-150 ease-out active:bg-x-parent-warm-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-x-parent-500"
      :class="[
        index % 2 === 0 ? 'border-e border-x-parent-warm-100' : '',
        index > 1 ? 'border-t border-x-parent-warm-100' : '',
      ]"
    >
      <span class="min-w-0 text-xs leading-5 text-x-text-subtitle">
        {{ item.label }}
      </span>
      <span
        class="font-yekan-bold text-2xl leading-8 text-x-text-title tabular-nums"
      >
        {{ faNumber(item.value) }}
      </span>
    </a>
  </nav>
</template>
