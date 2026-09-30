<script setup lang="ts">
/**
 * The pill group, structurally identical to the panel filter on `/plans`: one
 * grey rounded container, `aria-pressed` per pill, and the same press, focus and
 * motion treatment. It is a file of its own only because two settings rows use
 * it — a control that appears twice and has to look identical twice is exactly
 * the case for one, and it was going to be copied a second time otherwise.
 *
 * `modelValue` is a plain `string` because the component cannot know which of
 * the two enums it is being used for. The callers narrow the emitted value back
 * through the guards in `~/types/settings` rather than casting a string into a
 * union, so a value the panel never offered cannot reach the cookie.
 */
defineProps<{
  modelValue: string;
  options: { value: string; label: string }[];
  label: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <!--
    `role="group"` + `aria-label` rather than a `radiogroup`: these are toggle
    buttons, they read fine one at a time, and a radio group would promise a
    keyboard contract (arrow keys, roving tabindex) this does not implement.
    `aria-pressed` is what actually carries the state.
  -->
  <div
    class="settings-segmented me-auto flex w-max gap-1 rounded-full bg-slate-100 p-1"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="h-11 shrink-0 snap-start rounded-full px-4 text-xs font-bold whitespace-nowrap transition-[color,background-color,translate] duration-200 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
      :class="
        option.value === modelValue
          ? 'bg-x-primary-900 text-white'
          : 'text-x-text-subtitle'
      "
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
/* A pill is a control, not content: no long-press menu, no text selection.
   `touch-action: manipulation` and the selection reset are already global for
   `button`, so only the callout is added here. */
.settings-segmented button {
  -webkit-touch-callout: none;
}

/* Hover only where a real pointer can hover — a hover that survives the tap is
   the oldest "this is a website" tell. The press alone is enough on touch. */
@media (hover: hover) and (pointer: fine) {
  .settings-segmented button:hover {
    translate: 0 -1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-segmented button:hover {
      translate: none;
    }
  }
}
</style>
