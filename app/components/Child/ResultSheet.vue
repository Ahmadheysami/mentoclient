<script setup lang="ts">
import { faDate } from "~/utils/fa";
import type { TestResult } from "~/types/test";

/**
 * One finished result, as a bottom sheet over the panel.
 *
 * Tapping a result card opens THIS instead of navigating: a child reads their
 * outcome where they are, and the full page (`/panels/child/results/[id]`)
 * stays one link away inside the sheet.
 *
 * ## WHY A SHEET AND NOT A FULL PAGE MODAL
 *
 * The panel is one-handed mobile use, and `Child/StorySheet.vue` already
 * established the idiom: a bottom sheet with a title row the reader can grab
 * and a single obvious way out. This is the same sheet with a hero card that
 * leans toward the pointer (`Child/TiltCard.vue`) — decoration on top of text
 * that is already readable, and switched off wherever a pointer cannot hover.
 *
 * Only the reader's own `body` is rendered. The parent-facing `for` text never
 * travels here: it is not the child's to read.
 */
const props = defineProps<{
  /** The result to show, or `null` to keep the sheet closed. */
  result: TestResult | null;
}>();

const emit = defineEmits<{ close: [] }>();

const childPanel = useChildPanel();
const bodyEl = ref<HTMLElement | null>(null);

const isOpen = computed<boolean>(() => props.result !== null);
const isChild = computed<boolean>(() => childPanel.variant === "child");

const testTitle = computed<string>(() => props.result?.test?.title?.trim() || "آزمون");

const resultTitle = computed<string>(() => {
  const value = props.result?.result?.title;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "نتیجه آزمون";
});

const code = computed<string>(() => {
  const value = props.result?.result?.code;
  return typeof value === "string" ? value.trim() : "";
});

const body = computed<string>(() => {
  const value = props.result?.result?.body;
  return typeof value === "string" ? value : "";
});

const detailTo = computed<string>(() =>
  props.result ? `/panels/child/results/${props.result.id}` : "",
);

function onUpdateOpen(open: boolean): void {
  if (!open) emit("close");
}

/** A newly shown result always starts at the top of its text. */
watch(
  () => props.result?.id,
  () => {
    nextTick(() => bodyEl.value?.scrollTo({ top: 0 }));
  },
);
</script>

<template>
  <UDrawer
    :open="isOpen"
    :ui="{
      overlay: 'z-50',
      content: [
        // Never override `fixed` (vaul portals this panel into <body>);
        // only trim the ring and centre the sheet — the same rule as
        // `Child/StorySheet.vue`.
        'z-50 mx-auto w-full max-w-md',
        isChild ? 'rounded-t-3xl bg-x-kid-50' : 'rounded-t-xl bg-x-teen-50',
      ],
      container: 'pb-[max(1rem,env(safe-area-inset-bottom))]',
    }"
    @update:open="onUpdateOpen"
  >
    <template #title>
      <span class="flex items-center gap-2">
        <span
          class="grid size-9 shrink-0 place-items-center"
          :class="
            isChild
              ? 'rounded-2xl bg-x-kid-sun-100 text-x-kid-sun-700'
              : 'rounded-xl bg-x-teen-100 text-x-teen-700'
          "
          aria-hidden="true"
        >
          <UIcon name="solar:cup-star-linear" size="22" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ testTitle }}</span>
        <UButton
          icon="solar:close-circle-linear"
          variant="ghost"
          color="neutral"
          aria-label="بستن نتیجه"
          :ui="{
            base: [
              'min-h-11 min-w-11 shrink-0 rounded-full',
              isChild
                ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-kid-berry-700'
                : 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-teen-violet-600',
            ],
          }"
          @click="emit('close')"
        />
      </span>
    </template>

    <template #description>
      {{ isChild ? "نتیجه آزمون تو آماده شد" : "نتیجهٔ آزمون شما" }}
    </template>

    <template #body>
      <!-- The outcome card: it leans toward the pointer on hover-capable
           devices and simply sits flat on touch, where the text below has to
           stay scrollable. -->
      <ChildTiltCard :max="7">
        <div
          class="grid place-items-center gap-2 rounded-3xl p-5 text-center"
          :class="
            isChild
              ? 'bg-linear-to-b from-x-kid-sun-50 to-white ring-1 ring-x-kid-sun-500/30'
              : 'bg-linear-to-b from-x-teen-50 to-white ring-1 ring-x-teen-violet-500/20'
          "
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

          <h3
            class="mt-1 break-words font-yekan-extra text-lg leading-8"
            :class="isChild ? 'text-x-kid-900' : 'text-x-text-title'"
          >
            {{ resultTitle }}
          </h3>

          <p class="text-xs leading-5 text-x-text-subtitle">
            <time v-if="result" :datetime="result.createdAt">
              {{ faDate(result.createdAt) }}
            </time>
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
        </div>
      </ChildTiltCard>

      <div
        ref="bodyEl"
        tabindex="-1"
        class="mt-3 max-h-[42dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="
          isChild
            ? 'focus-visible:outline-x-kid-berry-700'
            : 'focus-visible:outline-x-teen-violet-600'
        "
      >
        <div v-if="body" class="content text-start text-sm leading-7 text-x-text-body" v-html="body" />
        <p v-else class="text-sm text-x-text-subtitle">متن نتیجه ثبت نشده است.</p>
      </div>
    </template>

    <template #footer>
      <div class="grid gap-2">
        <NuxtLink
          v-if="detailTo"
          :to="detailTo"
          class="inline-flex min-h-11 items-center justify-center gap-1 text-xs font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2"
          :class="
            isChild
              ? 'text-x-kid-700 focus-visible:outline-x-kid-berry-700'
              : 'text-x-teen-violet-600 focus-visible:outline-x-teen-violet-600'
          "
          @click="emit('close')"
        >
          دیدن نتیجه در صفحهٔ اختصاصی
          <UIcon name="solar:alt-arrow-left-linear" size="14" aria-hidden="true" />
        </NuxtLink>

        <UButton
          label="بستن"
          variant="solid"
          color="neutral"
          block
          class="w-full justify-center"
          :ui="{
            base: [
              'h-12 focus-visible:outline-2 focus-visible:outline-offset-2',
              isChild
                ? 'rounded-3xl focus-visible:outline-x-kid-berry-700'
                : 'rounded-xl focus-visible:outline-x-teen-violet-600',
            ],
          }"
          @click="emit('close')"
        />
      </div>
    </template>
  </UDrawer>
</template>
