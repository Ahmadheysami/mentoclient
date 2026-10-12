<script setup lang="ts">
import { useScroll } from "@vueuse/core";
import { renderAiMarkdown } from "~/utils/markdown";

const props = defineProps<{
  /** Whether the sheet is open. The page owns the open state. */
  open: boolean;
  /** The step's award line, surfaced as the sheet's heading. */
  title: string;
  /** The story's raw Markdown; rendered through the audited AI renderer only. */
  markdown: string | null;
}>();

const emit = defineEmits<{
  /** The reader dismissed the sheet without finishing (X, drag, overlay). */
  close: [];
  /** The reader reached the end and asked to go back. Page records this. */
  finished: [];
}>();

const childPanel = useChildPanel();

const bodyEl = ref<HTMLElement | null>(null);
const { y, arrivedState } = useScroll(bodyEl);

/**
 * How far the story is read, 0–100. Driven by the real scroll position of the
 * story scroller — never faked, never persisted anywhere.
 */
const progress = computed<number>(() => {
  const el = bodyEl.value;
  if (!el) return 0;

  const max = el.scrollHeight - el.clientHeight;
  if (max <= 0) return 100;

  return Math.min(100, Math.max(0, Math.round((y.value / max) * 100)));
});

/** True at the end of the story, or immediately when nothing scrolls. */
const reachedEnd = computed<boolean>(() => {
  const el = bodyEl.value;
  if (!el) return false;

  const max = el.scrollHeight - el.clientHeight;
  return max <= 0 || arrivedState.bottom;
});

/**
 * The label of the primary action, latched: once the reader reaches the end it
 * never flips back to «شروع داستان» mid-session, even if they scroll up again.
 */
const finished = ref(false);

watch(reachedEnd, (atEnd) => {
  if (atEnd) finished.value = true;
});

function onUpdateOpen(open: boolean): void {
  if (!open) emit("close");
}

/** A new open always starts fresh: scroller at the top, finished latch cleared. */
watch(
  () => props.open,
  (open) => {
    if (!open) {
      finished.value = false;
      return;
    }

    nextTick(() => {
      bodyEl.value?.scrollTo({ top: 0 });
    });
  },
);

function reducedMotion(): boolean {
  return (
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** «شروع داستان» begins from the first line and hands focus to the scroller. */
function startReading(): void {
  const el = bodyEl.value;
  if (!el) return;

  el.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}

/** «خواندم، برگردم» tells the page to record this read and to close. */
function finishReading(): void {
  emit("finished");
}
</script>

<template>
  <UDrawer
    :open="open"
    :title="title"
    :ui="{
      overlay: 'z-50',
      content: [
        // Never override `fixed` (vaul portals this panel into <body>);
        // only trim the ring and centre the sheet. `relative`/`ring-0`/etc.
        // would tail-merge the defaults away and the panel drops out of
        // the viewport, leaving only the backdrop.
        'z-50 mx-auto w-full max-w-md',
        childPanel.variant === 'child'
          ? 'rounded-t-3xl bg-x-kid-50'
          : 'rounded-t-xl bg-x-teen-50',
      ],
      container: 'pb-[max(1rem,env(safe-area-inset-bottom))]',
    }"
    @update:open="onUpdateOpen"
  >
    <template #title>
      <span class="flex items-center gap-2">
        <img
          :src="
            childPanel.variant === 'child'
              ? '/images/panels/kid-3d-mascot.svg'
              : '/images/panels/teen-avatar.svg'
          "
          alt=""
          aria-hidden="true"
          class="size-8 shrink-0"
          width="32"
          height="32"
        >
        <span class="min-w-0 flex-1 truncate">{{ title }}</span>
        <UButton
          icon="solar:close-circle-linear"
          variant="ghost"
          color="neutral"
          aria-label="بستن داستان"
          :ui="{
            base: [
              'min-h-11 min-w-11 shrink-0 rounded-full',
              childPanel.variant === 'child'
                ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-kid-berry-700'
                : 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-teen-violet-600',
            ],
          }"
          @click="emit('close')"
        />
      </span>
    </template>

    <template #description>
      {{
        childPanel.variant === 'child'
          ? 'داستانِ امروزت رو بخون'
          : 'یادداشت ویژهٔ این مرحله'
      }}
    </template>

    <template #body>
      <div class="relative flex flex-col gap-3">
        <!-- Variant art as the sheet's voice; purely decorative, never the only meaning. -->
        <img
          v-if="childPanel.variant === 'child'"
          src="/images/panels/kid-blob.svg"
          alt=""
          aria-hidden="true"
          class="pointer-events-none absolute -top-5 -end-2 size-16 opacity-70"
          width="64"
          height="64"
        >
        <img
          v-else
          src="/images/panels/teen-blob.svg"
          alt=""
          aria-hidden="true"
          class="pointer-events-none absolute -top-5 -end-2 size-16 opacity-40"
          width="64"
          height="64"
        >

        <!-- Slim, honest reading progress: only the scroll position of the story. -->
        <div
          class="h-2 w-full overflow-hidden rounded-full"
          :class="
            childPanel.variant === 'child'
              ? 'bg-x-kid-sun-100'
              : 'bg-x-teen-200/60'
          "
          role="progressbar"
          aria-label="پیشرفت خواندن داستان"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full transition-[width] duration-300 ease-soft motion-reduce:transition-none"
            :class="
              childPanel.variant === 'child'
                ? 'bg-x-kid-sun-500'
                : 'bg-x-teen-mint-700'
            "
            :style="{ width: `${progress}%` }"
          />
        </div>

        <div
          ref="bodyEl"
          tabindex="-1"
          class="max-h-[52dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          :class="
            childPanel.variant === 'child'
              ? 'focus-visible:outline-x-kid-berry-700'
              : 'focus-visible:outline-x-teen-violet-600'
          "
        >
          <div
            v-if="markdown"
            class="ai-markdown text-start text-sm leading-8 text-x-text-body"
            v-html="renderAiMarkdown(markdown)"
          />
          <p v-else class="text-sm text-x-text-subtitle">
            داستانی برای این مرحله نیست.
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        :label="finished ? 'خواندم، برگردم' : 'شروع داستان'"
        variant="solid"
        color="x-primary"
        class="w-full justify-center"
        :ui="{
          base: [
            'h-12 focus-visible:outline-2 focus-visible:outline-offset-2',
            childPanel.variant === 'child'
              ? 'rounded-3xl bg-x-kid-sun-500! text-x-kid-900! focus-visible:outline-x-kid-berry-700'
              : 'rounded-xl bg-x-teen-violet-300! text-x-teen-900! focus-visible:outline-x-teen-violet-600',
          ],
        }"
        @click="finished ? finishReading() : startReading()"
      />
    </template>
  </UDrawer>
</template>
