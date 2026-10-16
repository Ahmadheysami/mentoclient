<script setup lang="ts">
/**
 * One row of a settings list — the Telegram/iOS row, not the grouped card.
 *
 * ## WHY THIS COMPONENT Renders ONE ROW AND NOT A GROUP
 *
 * The obvious API is a `SettingGroup` that takes rows and clips them into a
 * rounded card with a ring and vertical padding. It is not written that way, for
 * one reason: **the group's appearance is a decision about the screen, not about
 * a row.** The café settings page groups «حساب» under one card and leaves
 * «خروج» as a lone danger row outside any card, and a group component cannot
 * express that without a `grouped` prop on every row plus a wrapper slot and a
 * `first`/`last` prop each — four booleans to describe "I am an edge".
 *
 * So the page writes the wrapper itself:
 *
 * ```html
 * <div class="overflow-hidden rounded-2xl bg-x-primary-content-50 ring-1 ring-slate-200/70">
 *   <CafeSettingRow … /> <!-- its `not-last:border-b` does the dividing -->
 * </div>
 * ```
 *
 * and gets the rounding, the ring, the padding and the clipping for free. One
 * `not-last:` on the row is the whole contract, and it only behaves because the
 * rows are siblings inside that wrapper — which is why this is a row and not a
 * wrapper around one.
 *
 * ## WHY THE ROW IS NEVER AN INTERACTIVE CONTAINER
 *
 * `to` renders a `NuxtLink`, `type: 'button'` renders a `<button>`, and a switch
 * renders a plain `<div>` with the `USwitch` inside it. Those three are mutually
 * exclusive on purpose:
 *
 * Nesting a control inside another is the oldest accessibility bug in settings
 * lists. A `<button>` inside a `NuxtLink` makes Enter and Space ambiguous, puts
 * two tab stops on one visual row, and gives a screen reader two names for one
 * control. So there is no such combination, and `type` exists precisely to
 * declare which single thing the row is.
 *
 * The cost is that a switch row's *label* is not itself a tap target — pressing
 * «صدای اعلان‌ها» does nothing, only the switch does. That is the right trade:
 * making it work would require a `<label>` wrapping a `role="switch"` **button**,
 * which does not associate at all, or a `div` with a `click` handler that is
 * invisible to a keyboard. The switch therefore carries the Persian `aria-label`,
 * so it is still announced by its own name.
 */
const props = withDefaults(
  defineProps<{
    /** Iconify name. The one Iconify name this component never guesses. */
    icon: string;
    label: string;
    /** The quiet line under the label. */
    description?: string;
    /** Right-hand text: the current setting. Never a control. */
    value?: string;
    /** Makes the row a link. Takes precedence over `type: 'button'`. */
    to?: string;
    type?: "link" | "switch" | "value" | "button";
    /** `true` when bound. The switch is only drawn for `type: 'switch''. */
    modelValue?: boolean;
    tone?: "default" | "danger";
    /**
     * Tailwind classes for the leading tile — e.g. `"bg-x-primary-50
     * text-x-primary-800"`. Exists so a page can give one row its own hue
     * without this component inventing a palette; `tone` picks the fallback.
     */
    accent?: string;
  }>(),
  { type: "value", tone: "default" },
);

const emit = defineEmits<{
  "update:modelValue": [boolean];
}>();

/**
 * `default` is the app's own accent at its lightest tint; `danger` is the one
 * red the cafe feature already uses (`CafeStateBlock`'s error block), so a
 * destructive row is red without a second red being introduced here.
 */
const TONES = {
  default: "bg-x-primary-50 text-x-primary-800",
  danger: "bg-red-50 text-red-600",
} as const;

const tileClass = computed(() => props.accent ?? TONES[props.tone]);

/** A chevron only where there is somewhere to go. */
const showsChevron = computed(
  () => props.type === "link" && Boolean(props.to),
);

/**
 * Exactly one element per row, chosen once and read in one place.
 *
 * `NuxtLink` is returned as the **component**, never as its name: it is a
 * compile-time auto-import rather than a globally registered component, so the
 * string `'NuxtLink'` falls through `<component>`'s native-element branch and
 * SSR emits a literal `<NuxtLink to="…">` custom element — inert, and announced
 * as neither a link nor a row. `resolveComponent()` must run in setup, so it
 * cannot be written here inline.
 */
const NuxtLinkComponent = resolveComponent("NuxtLink");

const element = computed(() => {
  if (props.to) return NuxtLinkComponent;
  if (props.type === "button") return "button";

  return "div";
});

/** `to` takes precedence over `type: 'button'`, so this cannot read `element` alone. */
const isButton = computed(() => Boolean(props.type === "button") && !props.to);

/**
 * A `div` is not focusable and must not pretend to be: it gets no hover wash, no
 * focus ring and no `aria-label`, because all three of those promise an action
 * the row does not have. Only a link or a button gets them.
 */
const isActionable = computed(() => element.value !== "div");
</script>

<template>
  <component
    :is="element"
    :to="to"
    :type="isButton ? 'button' : undefined"
    :aria-label="isActionable ? label : undefined"
    class="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start transition-colors not-last:border-b border-slate-100"
    :class="
      isActionable
        ? `focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 hover:bg-x-primary-content-200/60 ${
            tone === 'danger' ? 'text-red-600' : ''
          }`
        : ''
    "
  >
    <!--
      `size-9` (36px) rather than the `size-11` of a touch target: the tile is
      the row's *illustration*, not its target — the whole row is. A 44px tile
      would push the row past 64px for no reason and make a twelve-row settings
      screen taller than the viewport.
    -->
    <span
      class="grid size-9 shrink-0 place-items-center rounded-xl"
      :class="tileClass"
      aria-hidden="true"
    >
      <UIcon :name="icon" size="20" />
    </span>

    <span class="min-w-0 flex-1">
      <span
        class="block truncate text-[15px] font-bold"
        :class="tone === 'danger' ? 'text-red-600' : 'text-x-text-title'"
      >
        {{ label }}
      </span>

      <span
        v-if="description"
        class="mt-0.5 block text-xs leading-5 text-x-text-subtitle"
      >
        {{ description }}
      </span>
    </span>

    <!--
      `value` is text, never a control. It sits before the chevron so the chevron
      is always the last thing on the row and the eye learns one position for
      "this goes somewhere".
    -->
    <span
      v-if="value"
      class="shrink-0 text-xs text-x-text-subtitle tabular-nums"
    >
      {{ value }}
    </span>

    <!--
      ⚠️ THE `before:` PSEUDO-ELEMENT IS A 44px HIT AREA, NOT A BIGGER SWITCH.

      `USwitch` with no `size` takes `md` — a `w-9` × `h-5` track, i.e. 36×20px,
      which is less than half the `size-11` every other target in this feature is.
      Growing the track would change a signed-off design, so only the TARGET
      grows: an empty `::before` stretched 12px above and below the button, and
      part of the button's own box for hit-testing. The drawn switch is exactly
      the size it was.

      ⚠️ AND IT IS NOT A `<label>`. `SwitchRoot` renders a `role="switch"`
      **button**, and a `<label>` associates with form controls — an implicit
      label/`for`, or `aria-labelledby` — never with a button element, so
      wrapping one would make «صدای اعلان‌ها» a click target that silently does
      nothing, or worse: a second name on the switch. The Persian `aria-label`
      below is the association, which is why the header says the label is not a
      tap target.

      ⚠️ AND THE `base` STRING IS A TEMPLATE LITERAL. Tailwind reads class names
      out of this file's RAW TEXT, so a single-quoted `'… before:content-[\'\'] …'`
      hands the scanner backslashes it does not recognise, the utility is never
      generated, and the `::before` ends up with no `content` at all — no box, no
      hit area, and nothing on screen to say so. Written literally it scans, and
      compiles to `content: ""`.
    -->
    <USwitch
      v-if="type === 'switch'"
      :model-value="modelValue"
      :aria-label="label"
      color="x-primary"
      class="shrink-0"
      :ui="{
        base: `relative before:absolute before:inset-y-[-12px] before:inset-x-0 before:content-['']`,
      }"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <UIcon
      v-if="showsChevron"
      name="solar:alt-arrow-left-linear"
      size="18"
      class="shrink-0 opacity-40"
      aria-hidden="true"
    />

    <slot name="end" />
  </component>
</template>