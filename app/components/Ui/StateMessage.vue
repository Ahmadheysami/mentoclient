<script setup lang="ts">
/**
 * Centred calm message for the empty / error / not-found states of the test
 * screens. Never alarming: soft icon, one sentence, one optional way out.
 */
withDefaults(
  defineProps<{
    icon: string;
    title: string;
    description?: string;
    actionLabel?: string;
    /** Mutually exclusive with `actionLabel`: an internal navigation target. */
    actionTo?: string;
  }>(),
  { description: undefined, actionLabel: undefined, actionTo: undefined },
);

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div class="grid h-[55dvh] place-items-center text-center">
    <div class="grid place-items-center gap-3 px-4">
      <span
        class="grid size-20 place-items-center rounded-full bg-x-primary-100 text-x-primary-800"
        aria-hidden="true"
      >
        <UIcon :name="icon" size="40" />
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
