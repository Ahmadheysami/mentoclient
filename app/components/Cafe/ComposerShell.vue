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
 *
 * ## ⚠️ `maxlength` COMES FROM THE SCREEN, NOT FROM HERE
 *
 * §11 caps a message's text at 2000 characters and `stores/cafe.ts` enforces
 * that figure in `sendMessage` and `editMessage`, so the field must not carry a
 * second copy of the number. The thread screen owns the constant it passes down —
 * and it is the SAME constant the composer hands to the bubble's inline editor, so
 * the two fields on this screen cannot disagree about how long a message is.
 *
 * ## `loading` IS NOT `disabled`
 *
 * They are separate props because they mean separate things to a reader: a
 * disabled field is one this table will not accept writing in (a closed window, a
 * mute), while a loading field is one whose last send is still in the air. They
 * both stop the keys — §11's limiter is 30 messages per 60s and a double-tap
 * spends two of them on one intent — but only `disabled` is described to the
 * reader by the parent's placeholder.
 *
 * ## `focus()` IS EXPOSED, NOT A `focusSignal` PROP
 *
 * The parent needs to put the caret in this field (a «پاسخ» from the context
 * menu has to land somewhere the reader can type). A template ref with
 * `defineExpose({ focus })` is one typed call; a counter prop that the parent
 * increments is a second, invisible piece of state describing something the
 * component could simply be asked to do.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
    /** A send is in the air. Blocks typing and shows `aria-busy`. */
    loading?: boolean;
    /** §11's `MESSAGE_TEXT_MAX`, handed down by the thread screen. */
    maxlength?: number;
  }>(),
  { placeholder: "پیام بنویسید", disabled: false, loading: false, maxlength: undefined },
);

/** One flag for everything the reader can press, so no control can disagree. */
const inert = computed(() => props.disabled || props.loading);

const input = useTemplateRef<HTMLElement>("bar");

/**
 * Put the caret in the field. Called by the parent after «پاسخ» opens the
 * composer on a message — a reply the reader has to tap into is a reply they may
 * never write.
 *
 * ⚠️ IT QUERIES FOR THE NATIVE `<input>` rather than holding a ref to `UInput`:
 * the primitive exposes its `inputRef`, and depending on how Vue unwraps an
 * exposed ref would be a guess. The bar owns exactly one text field, so the
 * query is unambiguous and typed.
 */
function focus(): void {
  input.value?.querySelector<HTMLInputElement>("input")?.focus();
}

defineExpose({ focus });

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
 *
 * ⚠️ `inert` is the third guard: a send that is already in the air must not be
 * started again by the same keystroke, and the composer's own bar is the only
 * place that can know a send is in the air.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  if (inert.value) return;

  event.preventDefault();
  emit("submit");
}
</script>

<template>
  <div
    ref="bar"
    class="flex items-center gap-2 border-t border-slate-200 bg-x-primary-content-50 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
  >
    <UButton
      type="button"
      variant="ghost"
      icon="solar:add-circle-linear"
      :disabled="inert"
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
      :disabled="inert"
      :maxlength="maxlength"
      :aria-busy="loading ? 'true' : undefined"
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

      ⚠️ `aria-label` READS THE STATE while a send is in the air, so a screen-reader
      user is told the field is busy rather than meeting a field that has simply
      gone quiet.
    -->
    <UButton
      type="button"
      variant="solid"
      icon="solar:microphone-2-bold"
      :disabled="inert"
      :aria-label="loading ? 'در حال ارسال پیام' : 'ارسال پیام صوتی'"
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