<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import type { ChildAssignedTest } from "~/types/child-panel";

/**
 * One assigned exam: title, image, tags, how much of it is left, and the
 * real «شروع» button the prototype card deliberately lacked.
 *
 * A card with no attempt left is NOT hidden and NOT an error — it renders
 * disabled with a «باقی‌نمانده» chip — and an expired asset says
 * «منقضی شده» rather than pretending it is still playable. A consumed one
 * says «انجام‌شده»: done, not left over.
 */
const props = defineProps<{ asset: ChildAssignedTest }>();

const childPanel = useChildPanel();

const body = computed(() => props.asset.test?.[0] ?? null);

const remaining = computed(() =>
  Math.max(0,
    (Number.isFinite(props.asset.usageLimit) ? props.asset.usageLimit : 0) -
      (Number.isFinite(props.asset.usedCount) ? props.asset.usedCount : 0)),
);

const expired = computed(() => {
  if (typeof props.asset.expireDate !== "string" || props.asset.expireDate.length === 0)
    return false;

  const at = childPanel.state.readAt;

  if (at === null) return false;

  const deadline = Date.parse(props.asset.expireDate);

  return Number.isFinite(deadline) && deadline <= at;
});

/** The asset has no usable attempt left, for reasons other than being consumed. */
const exhausted = computed(() => props.asset.status !== "consumed" && remaining.value === 0);

const isChild = computed(() => childPanel.variant === "child");
</script>

<template>
  <article
    class="neu-raised flex gap-3 bg-white p-3"
    :class="isChild ? 'rounded-3xl' : 'rounded-xl'"
  >
    <img
      v-if="body?.image"
      :src="body.image"
      :alt="body?.title ?? ''"
      class="size-16 shrink-0 object-cover"
      :class="isChild ? 'rounded-2xl' : 'rounded-lg'"
      width="64"
      height="64"
    >
    <span
      v-else
      class="grid size-16 shrink-0 place-items-center"
      :class="isChild ? 'rounded-2xl bg-x-kid-mint-100 text-x-kid-mint-700' : 'rounded-lg bg-x-teen-100 text-x-teen-700'"
      aria-hidden="true"
    >
      <UIcon name="solar:clipboard-list-bold" size="22" />
    </span>

    <div class="min-w-0 flex-1">
      <h3 class="truncate font-yekan-bold text-sm text-x-text-title">
        {{ body?.title ?? 'آزمون' }}
      </h3>
      <p v-if="body?.tags?.length" class="mt-0.5 truncate text-xs text-x-text-subtitle">
        {{ body.tags.join(' · ') }}
      </p>
      <p class="mt-0.5 text-xs text-x-text-subtitle">
        {{ faNumber(remaining) }} بار باقی‌مانده
      </p>

      <NuxtLink
        v-if="!exhausted && !expired && asset.status !== 'consumed'"
        :to="`/panels/child/tests/${asset.id}`"
        class="neu-control mt-2 inline-flex h-11 items-center justify-center px-4 text-xs font-yekan-bold transition-transform duration-150 ease-soft active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="isChild ? 'rounded-2xl bg-x-kid-mint-100 text-x-kid-mint-700 focus-visible:outline-x-kid-mint-700' : 'rounded-xl bg-x-teen-100 text-x-teen-700 focus-visible:outline-x-teen-violet-600'"
      >
        شروع
      </NuxtLink>

      <p
        v-else-if="asset.status === 'consumed'"
        class="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-yekan-bold"
        :class="isChild ? 'bg-x-kid-mint-100 text-x-kid-mint-700' : 'bg-x-teen-100 text-x-teen-700'"
      >
        <UIcon name="solar:check-circle-bold" size="14" aria-hidden="true" />
        انجام‌شده
      </p>

      <p
        v-else-if="expired"
        class="mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-yekan-bold"
        :class="isChild ? 'bg-x-kid-berry-100 text-x-kid-berry-700' : 'bg-red-50 text-red-500'"
      >
        منقضی شده
      </p>

      <p
        v-else
        class="mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-yekan-bold"
        :class="isChild ? 'bg-x-kid-mint-100 text-x-kid-mint-700' : 'bg-x-teen-100 text-x-teen-700'"
      >
        باقی‌نمانده
      </p>
    </div>
  </article>
</template>
