<script setup lang="ts">
/**
 * The soft-gray pill search field of the conversation list (Screen A).
 *
 * It is `UInput` under the hood — the keyboard, the paste, the autofill, the
 * mobile "search" return key and the focus handling are all free with it, and
 * re-writing them as a bare `<input>` (as the search page does today) is how a
 * field ends up with no label, no clear button and no loading state.
 *
 * ## WHY THE PADDING IS NOT SET HERE
 *
 * `ps-11` / `pe-11` look like they should be part of the pill's own geometry.
 * They are not: Nuxt UI's input theme adds them automatically whenever a leading
 * icon or a trailing slot exists, so writing them by hand would only be a second
 * place for the two to drift. What is left to own is the height, the pill, the
 * soft-gray fill and the focus ring — `variant="none"` throws away Nuxt UI's
 * standing 1px ring and `focus:outline-none` along with it, and no variant would
 * give the design its flat pill and a visible focus anyway.
 *
 * ## WHY THE FIELD IS `text-base` AND NOT `text-sm`
 *
 * ⚠️ 14px is below the threshold iOS Safari zooms on when an input takes focus,
 * and it does not zoom back on blur — so a reader who taps this pill is left
 * with a magnified page and an `h-dvh` column that no longer fits the screen.
 * There is no global input font-size rule to rescue it (`main.css` has none), so
 * 16px is stated here.
 *
 * ## WHY THE NAME IS THE PLACEHOLDER
 *
 * The field has four callers and they search four different things («کافه‌ها»,
 * «میزها», «میزهای پیوسته», «گفتگوها»), so no single written `aria-label` can be
 * right for more than one of them. The placeholder is already the correct name —
 * it is Persian, it says what the field is for, and the caller that passes a
 * different one passes the right one — so it is reused verbatim rather than
 * maintained beside it.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    placeholder: "جستجو در گفتگوها",
    loading: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const hasValue = computed(() => props.modelValue.length > 0);

const label = computed(() => props.placeholder);

/**
 * `unknown`, not `string`: `UInput`'s model is `AcceptableValue`, and this is
 * the narrowest honest place to turn that into the `string` this field promises.
 */
function onUpdate(value: unknown) {
  emit("update:modelValue", typeof value === "string" ? value : String(value ?? ""));
}

function clear() {
  emit("update:modelValue", "");
}
</script>

<template>
  <UInput
    :model-value="modelValue"
    :placeholder="placeholder"
    :loading="loading"
    :disabled="disabled"
    size="xl"
    variant="none"
    icon="solar:magnifer-linear"
    enterkeyhint="search"
    autocomplete="off"
    :aria-label="label"
    class="w-full"
    :ui="{
      base:
        'h-12 w-full rounded-full bg-x-primary-content-200 text-base text-x-text-body placeholder:text-x-text-subtitle focus:outline-none focus-visible:ring-2 focus-visible:ring-x-primary-500',
      trailing: 'pe-1',
    }"
    @update:model-value="onUpdate"
  >
    <!--
      `loading` hides the clear button rather than sitting beside it: the
      spinner already occupies the trailing end of the pill, and two controls in
      48px of width is a row of targets too small to hit.

      The placeholder is `x-text-subtitle` instead of `x-text-placeholder`
      (`#c4c4c4`) because that grey is ~1.6:1 on this fill — a placeholder a
      sighted reader cannot read is not a lighter placeholder, it is a missing
      label.
    -->
    <template #trailing>
      <button
        v-if="hasValue && !loading"
        type="button"
        aria-label="پاک کردن جستجو"
        class="text-x-text-subtitle hover:text-x-text-title focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full transition-colors"
        @click="clear"
      >
        <UIcon name="solar:close-circle-linear" size="20" aria-hidden="true" />
      </button>
    </template>
  </UInput>
</template>