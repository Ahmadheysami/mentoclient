<script setup lang="ts">
import type { TestAssets } from "~/types/test";
import { faNumber } from "~/utils/fa";

/**
 * One purchased test the reader can still take, as a whole card: what it is,
 * how much of it is left, and the one button that starts it.
 *
 * It is a component because TWO screens now render the same purchase — the test
 * hub at `/test/active` and the panel's tests hub at `/panels/big/tests` — and a
 * card copied into both would be free to drift, most visibly in the id the
 * button carries.
 *
 * ⚠️ **The CTA carries the ASSET id, not the test id.** `item.id` is the
 * purchase; `item.test[0].testId` is the catalogue entry, and it is only a link
 * into the shop (`/test?s=…`) because that page filters by it. Handing the exam
 * a catalogue id asks the server about a purchase that may not be this reader's.
 *
 * The markup is the one `/test/active` has always rendered, unchanged, so that
 * page keeps its exact appearance; the entrance animation and the stagger delay
 * stay with the `<li>` each page owns, because the delay is the row's position
 * in THAT page's list.
 */
defineProps<{ item: TestAssets }>();
</script>

<template>
  <article class="rounded-3xl bg-white p-4">
    <div class="flex items-center gap-3">
      <span
        class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-x-primary-100 text-x-primary-800"
      >
        <NuxtImg
          v-if="item.test[0]?.image"
          :src="item.test[0].image"
          :alt="item.test[0].title"
          class="size-12 object-cover"
        />
        <UIcon
          v-else
          name="solar:document-medicine-linear"
          size="24"
          aria-hidden="true"
        />
      </span>

      <div class="min-w-0 flex-1">
        <strong class="block truncate text-x-text-title">
          {{ item.test[0]?.title }}
        </strong>
        <span class="block text-xs text-x-text-subtitle">
          {{ faNumber(item.usedCount) }} از {{ faNumber(item.usageLimit) }}
          استفاده شده
        </span>
      </div>

      <span
        class="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-shadow-lg bg-linear-to-l from-x-primary-200 to-x-primary-100 text-white ring-1 ring-x-primary-300/60"
      >
        <UIcon name="solar:check-circle-linear" size="14" aria-hidden="true" />
        {{ item.status === "available" ? "فعال" : "غیرفعال" }}
      </span>
    </div>

    <UButton
      :to="`/test/active/exam?examId=${item.id}`"
      label="شروع آزمون"
      icon="solar:play-linear"
      block
      variant="solid"
      color="x-primary"
      class="mt-4"
      :ui="{ base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!' }"
    />

    <NuxtLink
      :to="`/test?s=${item.test[0]?.testId}`"
      class="mt-3 block text-center text-xs text-x-primary-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-600"
    >
      دیدن جزئیات این آزمون
    </NuxtLink>
  </article>
</template>