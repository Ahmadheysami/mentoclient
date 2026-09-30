<script setup lang="ts">
/**
 * A confirmation for the three actions on this page that remove something.
 *
 * The body is the EXISTING `Ui/Alert.vue` — the same composition the café
 * table already uses — because it already carries the icon disc, the two
 * buttons and their cancel/accept wiring, and a second one would only be a
 * copy that drifts.
 */
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    /** The dialog's accessible name; `Ui/Alert` draws its own visible title. */
    confirmLabel: string;
    loading?: boolean;
  }>(),
  { description: undefined, loading: false },
);

const emit = defineEmits<{ "update:open": [boolean]; confirm: [] }>();
</script>

<template>
  <UModal
    :open="open"
    :title="confirmLabel"
    :ui="{ content: 'w-96 max-md:w-85 rounded-3xl shadow-none' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UiAlert
        :title="title"
        :description="description"
        :loading="loading"
        @accept="emit('confirm')"
        @cancel="emit('update:open', false)"
      />
    </template>
  </UModal>
</template>
