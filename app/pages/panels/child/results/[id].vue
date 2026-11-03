<script setup lang="ts">
import { faDate } from "~/utils/fa";

/**
 * One exam result, in the child/teen panel.
 *
 * The read is the SAME child-scoped list the results index already uses
 * (`/api/test/results?scope=child`), so a tap from the list is instant and a
 * deep link costs one request. It deliberately does NOT reuse the adult page
 * `/test/done/[id]`: that one reads with the parent cookie and would show a
 * child nothing.
 *
 * Only `body` is rendered here — it is the reader's own interpretation. The
 * parent-facing `for` text belongs to the parent panel, so a child never sees
 * it, and the paid AI analysis is not offered in this panel at all.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "نتیجه آزمون" });

const route = useRoute();
const childPanel = useChildPanel();
const testStore = useTest();

const resultId = computed(() => String(route.params.id ?? ""));

const isChild = computed(() => childPanel.variant === "child");
const radius = computed(() => (isChild.value ? "rounded-3xl" : "rounded-xl"));

const isLoading = computed(() => testStore.state.loading.getTestsDone);

const result = computed(
  () => testStore.state.testResults.find((item) => item.id === resultId.value) ?? null,
);

const code = computed(() => {
  const value = result.value?.result?.code;
  return typeof value === "string" ? value.trim() : "";
});

const title = computed(() => {
  const value = result.value?.result?.title;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "نتیجه آزمون";
});

const body = computed(() => {
  const value = result.value?.result?.body;
  return typeof value === "string" ? value : "";
});

const testTitle = computed(() => result.value?.test?.title?.trim() || "آزمون");

const hasError = computed(
  () => !isLoading.value && Boolean(testStore.state.error),
);

async function loadResults() {
  await testStore.getTestResults(undefined, "child");
}

/**
 * Fetch unless THIS result is already in the store.
 *
 * "The store is not empty" is not enough: `testStore.state.testResults` is
 * shared with the adult pages, so a parent who read their own results on the
 * same device would leave a list here that can never contain this id. Matching
 * the id decides that safely — a result id is unique to one attempt.
 */
onMounted(async () => {
  const cached = testStore.state.testResults.some(
    (item) => item.id === resultId.value,
  );

  if (!cached) await loadResults();
});
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <div class="flex items-center justify-between gap-3">
      <h1 class="min-w-0 truncate font-yekan-extra text-base text-x-text-title">
        {{ testTitle }}
      </h1>
      <NuxtLink
        to="/panels/child/results"
        class="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-x-text-subtitle focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="
          isChild
            ? 'focus-visible:outline-x-kid-berry-700'
            : 'focus-visible:outline-x-teen-violet-600'
        "
      >
        <UIcon name="solar:arrow-right-linear" size="16" aria-hidden="true" />
        نتایج
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="mt-5 grid gap-3" aria-busy="true">
      <USkeleton class="h-40 bg-white" :class="radius" />
      <USkeleton class="h-32 bg-white" :class="radius" />
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="hasError"
      class="mt-5"
      variant="soft"
      color="error"
      :title="testStore.state.error ?? ''"
    >
      <template #actions>
        <UButton
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="loadResults"
        />
      </template>
    </UAlert>

    <!-- Not found -->
    <UiStateMessage
      v-else-if="!result"
      icon="solar:compass-linear"
      title="این نتیجه پیدا نشد"
      description="شاید نتیجه دیگری را دنبال می‌کردی. از فهرست نتایج مسیر درست را پیدا کن."
      action-label="همه نتایج"
      action-to="/panels/child/results"
    />

    <template v-else>
      <!-- Hero: the outcome, readable within a few seconds -->
      <section
        class="neu-raised mt-5 grid place-items-center gap-3 bg-white p-6 text-center"
        :class="radius"
      >
        <span
          class="grid size-16 place-items-center rounded-full"
          :class="
            isChild
              ? 'bg-x-kid-sun-100 text-x-kid-sun-700'
              : 'bg-x-teen-100 text-x-teen-700'
          "
          aria-hidden="true"
        >
          <UIcon name="solar:cup-star-bold" size="32" />
        </span>

        <h2
          class="break-words font-yekan-extra text-lg leading-8"
          :class="isChild ? 'text-x-kid-900' : 'text-x-text-title'"
        >
          {{ title }}
        </h2>

        <p class="text-xs text-x-text-subtitle">
          <time :datetime="result.createdAt">{{ faDate(result.createdAt) }}</time>
        </p>

        <p
          v-if="code"
          class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-yekan-bold"
          :class="
            isChild
              ? 'bg-x-kid-mint-100 text-x-kid-mint-700'
              : 'bg-x-teen-100 text-x-teen-700'
          "
        >
          کد نتیجه:
          <span dir="ltr" class="font-yekan-extra">{{ code }}</span>
        </p>
      </section>

      <!-- Interpretation: the reader's own text, never the parent's `for` -->
      <section class="neu-raised mt-4 bg-white p-5" :class="radius">
        <h2 class="font-yekan-bold text-sm text-x-text-title">تفسیر نتیجه</h2>
        <div
          v-if="body"
          class="content mt-3 whitespace-pre-line text-sm leading-8 text-x-text-body"
          v-html="body"
        />
        <p v-else class="mt-3 text-xs leading-6 text-x-text-subtitle">
          متن نتیجه ثبت نشده است.
        </p>
      </section>

      <UButton
        to="/panels/child/results"
        label="بازگشت به نتایج"
        icon="solar:alt-arrow-left-linear"
        trailing-icon
        block
        variant="soft"
        color="neutral"
        class="mt-4"
        :ui="{ base: 'h-12 justify-center ' + (isChild ? 'rounded-3xl' : 'rounded-xl') }"
      />
    </template>
  </div>
</template>
