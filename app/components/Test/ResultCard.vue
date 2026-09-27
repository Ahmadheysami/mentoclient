<script setup lang="ts">
import type { TestResult } from "~/types/test";
import { faDate } from "~/utils/fa";

/**
 * Calm, tappable summary of one finished attempt.
 * Always a real link to that attempt's own result page.
 */
defineProps<{
  item: TestResult;
  /** Small caption above the title, e.g. «تلاش ۱». */
  heading?: string;
}>();
</script>

<template>
  <NuxtLink
    :to="`/test/done/${item.id}`"
    class="flex items-center gap-3 rounded-3xl bg-white p-4 transition duration-200 ease-out hover:scale-95 hover:opacity-90 active:scale-95 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-600"
  >
    <span
      class="grid size-12 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
      aria-hidden="true"
    >
      <UIcon name="solar:clipboard-check-linear" size="24" />
    </span>

    <span class="min-w-0 flex-1">
      <span v-if="heading" class="block text-xs text-x-text-subtitle">
        {{ heading }}
      </span>
      <strong class="block truncate text-x-text-title">{{ item.test.title }}</strong>
      <time
        :datetime="item.createdAt"
        class="block text-xs text-x-text-subtitle"
      >
        {{ faDate(item.createdAt) }}
      </time>
    </span>

    <span
      class="shrink-0 truncate rounded-full px-3 py-1.5 text-xs font-medium bg-linear-to-l from-x-secondary-200 to-x-secondary-100 text-x-secondary-900 ring-1 ring-x-secondary-300/60 max-w-1/2"
    >
      {{ item.result.title }}
    </span>
  </NuxtLink>
</template>
