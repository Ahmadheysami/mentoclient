<script setup lang="ts">
/**
 * The one async-state block the whole cafe feature uses: the list skeleton, the
 * empty list, and the failed request. One component rather than three inline
 * blocks per screen, because «the rows did not arrive» and «the rows arrived and
 * there are none» are different answers to the same question — a screen that
 * redraws them differently is a screen whose loading state looks like an error.
 *
 * It is not a replacement for `Ui/StateMessage`, which is a calm one-line
 * message with no loading variant; this one owns the loading skeleton and takes
 * its action as a slot so the caller decides whether the button retries, logs in
 * or navigates.
 */
const props = withDefaults(
  defineProps<{
    state: "loading" | "empty" | "error";
    title?: string;
    description?: string;
    /** Iconify name. Defaults to the one that matches `state`. */
    icon?: string;
    /** Skeleton lines for `loading` — a chat thread needs fewer than a list. */
    rows?: number;
  }>(),
  { rows: 4 },
);

const DEFAULTS = {
  empty: {
    title: "هنوز گفتگویی ندارید",
    description: "به یکی از میزها بپیوندید تا گفتگو شروع شود",
    icon: "solar:chat-round-linear",
  },
  error: {
    title: "گفتگوها بارگذاری نشد",
    description: "اتصال اینترنت را بررسی کنید و دوباره تلاش کنید",
    icon: "solar:close-circle-linear",
  },
} as const;

const copy = computed(() =>
  props.state === "empty" || props.state === "error" ? DEFAULTS[props.state] : null,
);

const resolvedTitle = computed(
  () => props.title ?? copy.value?.title ?? "",
);

const resolvedIcon = computed(
  () => props.icon ?? copy.value?.icon ?? "solar:chat-round-linear",
);

const isError = computed(() => props.state === "error");
</script>

<template>
  <!--
    The loading variant is a stack of rows, not a centred card: a list that
    shows a centred "loading" card reserves a viewport of vertical space it will
    then take back, and the list jumps when the rows arrive. These are the same
    USkeletons `CafeChatItemSkeleton` draws, in the feature's own soft gray,
    because that component cannot take a variant and a thread wants fewer rows
    than a list.

    `role="status"` replaces the skeleton rows with one spoken sentence: an
    assistive technology that walked four empty bars would say «group, group,
    group» and never say the list is loading.
  -->
  <div
    v-if="state === 'loading'"
    class="flex flex-col gap-3 px-4 py-3"
    role="status"
  >
    <span class="sr-only">در حال بارگذاری</span>

    <div
      v-for="row in rows"
      :key="row"
      class="flex items-center gap-3"
      :aria-hidden="row > 1 ? 'true' : undefined"
    >
      <USkeleton class="bg-x-primary-content-200 size-12 shrink-0 rounded-full" />
      <div class="flex-1 space-y-2">
        <USkeleton class="bg-x-primary-content-200 h-4 w-2/5 rounded-full" />
        <USkeleton class="bg-x-primary-content-200 h-3 w-3/5 rounded-full" />
      </div>
    </div>
  </div>

  <div
    v-else
    class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    role="status"
  >
    <span
      class="grid size-20 place-items-center rounded-3xl"
      :class="
        isError ? 'bg-red-50 text-red-500' : 'bg-x-primary-50 text-x-primary-500'
      "
      aria-hidden="true"
    >
      <UIcon :name="resolvedIcon" size="40" />
    </span>

    <p class="text-sm font-bold text-x-text-body">{{ resolvedTitle }}</p>
    <p
      v-if="description ?? copy?.description"
      class="max-w-xs text-xs leading-6 text-x-text-subtitle"
    >
      {{ description ?? copy?.description }}
    </p>

    <!-- The caller owns the action: retry, sign in, or go somewhere else. -->
    <slot name="action" />
  </div>
</template>