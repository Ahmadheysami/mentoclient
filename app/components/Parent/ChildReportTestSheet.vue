<script setup lang="ts">
import { faDate } from "~/utils/fa";
import { renderAiMarkdown } from "~/utils/markdown";
import { resultCodeText, testTypeLabel } from "~/utils/parent-report";
import type { ChildOverviewTestResultDto } from "~/types/parent-panel";

/**
 * The one place a result's stored content is read.
 *
 * The list above is intentionally shallow; a parent opens this sheet to see
 * what was recorded, so the backend HTML and the AI analysis are rendered only
 * here. The content is server-generated and already sanitized by the backend,
 * and no result id is used to build a public test-result URL: the report is the
 * record, not a link into the child's test flow.
 */
const props = defineProps<{
  result: ChildOverviewTestResultDto | null;
  childName: string;
}>();

const emit = defineEmits<{ close: [] }>();

const isOpen = computed<boolean>(() => props.result !== null);

const childLabel = computed<string>(() =>
  props.childName.trim() || "فرزند شما",
);

const title = computed<string>(() =>
  props.result?.title?.trim() || "نتیجه آزمون",
);

const description = computed<string>(() => `نتیجه ${childLabel.value}`);

const type = computed<string>(() =>
  testTypeLabel(props.result?.testType),
);

const date = computed<string>(() =>
  props.result ? faDate(props.result.completedAt) : "",
);

const code = computed<string>(() =>
  resultCodeText(props.result?.result?.code),
);

const resultTitle = computed<string>(() =>
  props.result?.result?.title?.trim() || "نتیجه ثبت‌شده",
);

const body = computed<string>(() => {
  const value = props.result?.result?.body;

  return typeof value === "string" ? value : "";
});

const categories = computed<string[]>(() => {
  const value = props.result?.categories;

  if (!Array.isArray(value)) return [];

  return value.filter(
    (category): category is string =>
      typeof category === "string" && category.trim().length > 0,
  );
});

const aiMarkdown = computed<string>(() => {
  const value = props.result?.aiAnalysis;

  if (typeof value !== "string" || value.trim().length === 0) return "";

  return renderAiMarkdown(value);
});

function onOpenChange(open: boolean) {
  if (!open) emit("close");
}
</script>

<template>
  <UModal
    fullscreen
    :open="isOpen"
    :title="title"
    :description="description"
    :ui="{ content: 'max-w-md mx-auto' }"
    @update:open="onOpenChange"
  >
    <template #body>
      <div
        v-if="result"
        class="rounded-[2rem] bg-linear-to-b from-x-parent-600 to-x-parent-700 px-4 py-5 text-white"
      >
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-yekan-bold">
            {{ type }}
          </span>
          <span
            v-if="date"
            class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] tabular-nums"
          >
            <UIcon name="solar:calendar-linear" size="13" aria-hidden="true" />
            <time :datetime="result.completedAt">{{ date }}</time>
          </span>
          <span
            v-if="code"
            class="max-w-full break-all rounded-full bg-white/15 px-2.5 py-1 text-[11px]"
          >
            کد {{ code }}
          </span>
        </div>

        <ul v-if="categories.length > 0" class="mt-3 flex flex-wrap gap-1.5">
          <li
            v-for="(category, index) in categories"
            :key="`${category}-${index}`"
            class="max-w-full break-words rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] leading-5"
          >
            {{ category }}
          </li>
        </ul>

        <h2 class="mt-4 break-words font-yekan-extra text-xl leading-8">
          {{ resultTitle }}
        </h2>
      </div>

      <div v-if="result" class="mt-3 space-y-3">
        <div
          v-if="body"
          class="content rounded-3xl bg-white px-3 py-4 text-sm leading-7"
          v-html="body"
        />
        <p
          v-else
          class="rounded-2xl bg-x-parent-warm-50 px-3 py-3 text-xs leading-6 text-x-text-subtitle"
        >
          متن نتیجه ثبت نشده است.
        </p>

        <div
          v-if="aiMarkdown"
          class="ai-markdown rounded-3xl bg-x-parent-warm-50 px-3 py-4 text-sm leading-7 text-x-text-body"
          v-html="aiMarkdown"
        />

        <p class="px-1 text-[11px] leading-6 text-x-text-subtitle">
          این نتیجهٔ ثبت‌شده در پروندهٔ فرزند شماست. برای مشاهدهٔ همهٔ آزمون‌ها به صفحهٔ آزمون‌ها برگردید.
        </p>
      </div>
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        block
        label="بستن"
        class="min-h-11"
        @click="emit('close')"
      />
    </template>
  </UModal>
</template>
