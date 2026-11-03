<script setup lang="ts">
import type { DiscRawScore } from "~/types/test";

/**
 * The three DISC profiles, in the order the result page asks for them:
 * least similarity, most similarity, then the average/final profile.
 *
 * This component is only mounted from the single-result page after the test
 * configuration has confirmed the attempt is DISC — MBTI and every other test
 * type never reach it.
 */
const props = defineProps<{ scores: DiscRawScore }>();

const charts = computed(() => [
  {
    key: "leastGraph",
    title: "کمترین شباهت",
    subtitle: "Least Similarity",
    scores: props.scores.leastGraph,
  },
  {
    key: "mostGraph",
    title: "بیشترین شباهت",
    subtitle: "Most Similarity",
    scores: props.scores.mostGraph,
  },
  {
    key: "finalProfile",
    title: "میانگین و نتیجه نهایی",
    subtitle: "Average & Final Profile",
    scores: props.scores.finalProfile,
  },
]);
</script>

<template>
  <section class="space-y-3" aria-labelledby="disc-charts-heading">
    <header class="flex items-end justify-between gap-3 px-1">
      <div>
        <h2
          id="disc-charts-heading"
          class="text-sm font-bold text-x-text-title"
        >
          نیم‌رخ شخصیتی DISC
        </h2>
        <p class="mt-0.5 text-xs leading-6 text-x-text-subtitle">
          سه نیم‌رخ این آزمون، از کمترین تا بیشترین شباهت.
        </p>
      </div>
    </header>

    <TestDiscChart
      v-for="chart in charts"
      :key="chart.key"
      :title="chart.title"
      :subtitle="chart.subtitle"
      :scores="chart.scores"
    />
  </section>
</template>
