<script setup lang="ts">
/**
 * Centred calm message for the empty / error / not-found states of the test
 * screens. Never alarming: soft icon, one sentence, one optional way out.
 *
 * `compact` is the same message at section scale — no 55dvh stage, a smaller
 * icon — for previews inside a longer page (the child home), where a
 * viewport-height empty block would swallow every section after it.
 */
withDefaults(
  defineProps<{
    icon: string;
    title: string;
    description?: string;
    actionLabel?: string;
    /** Mutually exclusive with `actionLabel`: an internal navigation target. */
    actionTo?: string;
    /** Section-scale layout instead of the full 55dvh stage. */
    compact?: boolean;
  }>(),
  {
    description: undefined,
    actionLabel: undefined,
    actionTo: undefined,
    compact: false,
  },
);

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div
    class="grid place-items-center text-center"
    :class="compact ? 'py-5' : 'h-[55dvh]'"
  >
    <div class="grid place-items-center px-4" :class="compact ? 'gap-2' : 'gap-3'">
      <span
        class="grid place-items-center rounded-full bg-x-primary-100 text-x-primary-800"
        :class="compact ? 'size-12' : 'size-20'"
        aria-hidden="true"
      >
        <UIcon :name="icon" :size="compact ? 24 : 40" />
      </span>

      <p class="text-sm leading-7 text-x-text-body">{{ title }}</p>
      <p v-if="description" class="text-xs leading-6 text-x-text-subtitle">
        {{ description }}
      </p>

      <UButton
        v-if="actionTo"
        :to="actionTo"
        :label="actionLabel"
        icon="solar:alt-arrow-left-linear"
        trailing-icon
        variant="solid"
        color="x-primary"
        class="mt-1"
        :ui="{ base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!' }"
      />
      <UButton
        v-else-if="actionLabel"
        :label="actionLabel"
        icon="solar:refresh-linear"
        variant="solid"
        color="x-primary"
        class="mt-1"
        :ui="{ base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!' }"
        @click="emit('action')"
      />
    </div>
  </div>
</template>
