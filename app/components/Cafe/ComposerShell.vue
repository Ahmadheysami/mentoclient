<script setup lang="ts">
/**
 * The bottom composer of a conversation (Screen B): a `+` attach button, a pill
 * input, and a black mic button.
 *
 * ## WHY IT OWNS NO SENDING
 *
 * It emits `submit` and nothing else. What a message becomes — trimmed, empty,
 * rate-limited, optimistically echoed into the thread — is the parent's decision
 * and needs the socket, which this primitive must not know about.
 *
 * ## WHY THE BAR IS WHITE AND THE PILL IS GRAY
 *
 * Screen B of `docs/design/cafe-ui.webp` draws the reverse of a gray bar: the bar
 * itself is white, lifted off the gray thread only by its **hairline top border**,
 * and the input pill is the gray `x-primary-content-200` rounded-full sitting on
 * it. The user asked for the design to resemble the reference, so that is what
 * this draws.
 *
 * It is also the idiom `CafeSearchPill` already uses on every list screen — a
 * gray field on white — so the pill is one filled surface rather than two, and
 * the only thing separating the bar from the messages above it is a one-pixel
 * rule that says "different surface", not a colour change that says "different
 * surface" louder.
 *
 * The `+` button's hover wash follows the bar: it was `…-content-50` white
 * because the bar under it was gray, and on a white bar that would be a hover
 * with nothing to see.
 *
 * ## WHY `env(safe-area-inset-bottom)` IS IN THE PADDING
 *
 * On a home-indicator phone, `pb-3` alone leaves the mic button under the bar
 * the OS draws. `max(…)` keeps the visual padding on every device and grows only
 * where the inset is real — the same recipe `Child/Nav.vue` uses.
 *
 * ⚠️ `text-base` on the field and not `text-sm`: 14px is under the size iOS
 * Safari zooms on focus, and it does not zoom back on blur, so a reader who taps
 * the composer is left with a magnified page. There is no global input
 * font-size rule to carry this, so the 16px is stated here — the same fix
 * `SearchPill` makes.
 */
withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { placeholder: "پیام بنویسید", disabled: false },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  attach: [];
  mic: [];
  submit: [];
}>();

function onUpdate(value: unknown) {
  emit(
    "update:modelValue",
    typeof value === "string" ? value : String(value ?? ""),
  );
}

/**
 * ## WHY THIS CAN OWN ENTER WITHOUT FIGHTING THE CARET
 *
 * Direction has nothing to do with it: Enter is Enter in an RTL field, and the
 * soft keyboard's return key is a *send* key here because `enterkeyhint="send"`
 * is set on the input. What does matter is the Persian IME — Enter first
 * **accepts the composed letter**, and submitting on that keystroke would send a
 * half-typed word. `isComposing` is the guard, and Shift+Enter stays a newline
 * for the reader who wants one.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

  event.preventDefault();
  emit("submit");
}
</script>

<template>
  <div
    class="flex items-center gap-2 border-t border-slate-200 bg-x-primary-content-50 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
  >
    <UButton
      type="button"
      variant="ghost"
      icon="solar:add-circle-linear"
      :disabled="disabled"
      aria-label="افزودن پیوست"
      class="shrink-0"
      :ui="{
        base:
          'size-11 rounded-full text-x-text-title hover:bg-x-primary-content-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-500',
        leadingIcon: 'size-6',
      }"
      @click="emit('attach')"
    />

    <UInput
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      size="xl"
      variant="none"
      enterkeyhint="send"
      autocomplete="off"
      aria-label="متن پیام"
      class="min-w-0 flex-1"
      :ui="{
        base:
          'h-12 w-full rounded-full bg-x-primary-content-200 text-base text-x-text-body placeholder:text-x-text-subtitle focus:outline-none focus-visible:ring-2 focus-visible:ring-x-primary-500',
      }"
      @update:model-value="onUpdate"
      @keydown="onKeydown"
    />

    <!--
      The one place the app uses near-black as an *action*: pressing to speak is
      the commit gesture, and it should not look like the `+` next to it. Same
      `x-text-title` ink as an outgoing bubble, so the reader's own actions and
      the reader's own words share a colour.
    -->
    <UButton
      type="button"
      variant="solid"
      icon="solar:microphone-2-bold"
      :disabled="disabled"
      aria-label="ارسال پیام صوتی"
      class="shrink-0"
      :ui="{
        base:
          'size-11 rounded-full bg-x-text-title text-x-primary-content-50 hover:bg-x-text-subtitle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-500',
        leadingIcon: 'size-6',
      }"
      @click="emit('mic')"
    />
  </div>
</template>