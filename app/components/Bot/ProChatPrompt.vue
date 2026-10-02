<script setup lang="ts">
/**
 * The composer of a Pro panel chat — `Bot/ProChatView.vue`'s only job on the
 * writing side.
 *
 * **Fully controlled and completely ignorant of the store.** Everything arrives
 * as props and everything leaves as events, so this file can be dropped into any
 * screen that owns a textarea, and so `ProChatView` is free to decide what a
 * "send" means (an optimistic turn, a retry, a one-shot self-heal) without the
 * component knowing any of it. The counterpart to `Bot/ChatPrompt.vue`, which is
 * neither: it reads `stores/bot.ts` directly and is the reason a Pro panel needed
 * its own.
 *
 * **The `:ui` treatment is copied from `Bot/ChatPrompt.vue` on purpose** — the same
 * translucent `rounded-3xl` root, the same transparent body, the same round
 * `x-primary` submit button in the same corner. Two chats from two different
 * stacks have to read as one product, and that is cheaper in three CSS classes
 * than in a shared component that both would then have to be rewritten around.
 *
 * `autofocus` is off, as on `/mentobot`. On a phone the soft keyboard would
 * otherwise cover the transcript the moment the screen opens, which is the wrong
 * first frame for a conversation.
 */
withDefaults(
  defineProps<{
    /** The text in the box. Written by `v-model`, never by this component. */
    modelValue: string;
    /**
     * The composer is unavailable. The only caller disables it while a turn is in
     * flight, which is also why the send button doubles as the busy state below —
     * an empty prompt and a missing conversation are both states this component
     * never renders at all.
     */
    disabled?: boolean;
    placeholder?: string;
    maxrows?: number;
  }>(),
  {
    disabled: false,
    placeholder: "هر چه دربارهٔ حال خودتان می‌خواهید بنویسید…",
    maxrows: 4,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  /** The reader pressed send. Carries no text: the caller already has it. */
  submit: [];
}>();
</script>

<template>
  <UChatPrompt
    :model-value="modelValue"
    :disabled="disabled"
    :autofocus="false"
    :placeholder="placeholder"
    :maxrows="maxrows"
    :ui="{
      root: 'rounded-3xl bg-white/60 backdrop-[2px]',
      body: 'bg-transparent',
    }"
    @update:model-value="emit('update:modelValue', $event)"
    @submit.prevent="emit('submit')"
  >
    <template #footer>
      <div class="flex justify-end w-full">
        <div class="flex items-center">
          <!--
            The only control in this component that carries no text, so it needs a
            name of its own: `aria-label` on the button (Persian, and the verb the
            reader is performing) and `aria-hidden` on the icon inside it, which
            would otherwise be announced as an unnamed graphic. The precedent is
            `Astrology/Report.vue`'s two icon buttons.
          -->
          <UButton
            :disabled="disabled"
            :loading="disabled"
            type="submit"
            size="xl"
            color="x-primary"
            aria-label="ارسال پیام"
            :ui="{ base: 'rounded-full' }"
          >
            <UIcon name="solar:arrow-up-linear" size="18" aria-hidden="true" />
          </UButton>
        </div>
      </div>
    </template>
  </UChatPrompt>
</template>
