<script setup lang="ts">
import type { AccessibilityWindow } from "~/types/parent-panel";

/**
 * The hours a child may be in the panel: a list of `HH:MM → HH:MM` windows, plus
 * the switch that closes the panel entirely.
 *
 * ## THE SCHEDULE IS READ, NOT RECONSTRUCTED
 *
 * `GET /modules/accessibility?child=<userId>` now answers with the very rows
 * `POST /modules/accessibility` stored, so the editor seeds from the server on
 * mount and repopulates after every save. The POST's own
 * `result.metadata.accessibility` remains the in-session confirmation of a
 * write, and its `disabled` field is STILL never read (the route writes
 * `disabled` and reads `disable`, which it never writes).
 *
 * ## WHY `from < to` IS CHECKED HERE AND NOT ONLY UPSTREAM
 *
 * Upstream is the validator and enforces it too, but a refusal arrives as a toast
 * about a request the parent has already made, and the field that caused it is
 * three rows up. The overnight window `22:00 → 06:00` is exactly the case this
 * catches: it reads as obviously valid on a phone and is refused by the server, so
 * it is refused INLINE, on the row, before any request exists.
 *
 * The switch below holds the parent's intent seeded from the GET row, and a
 * save carries it back in the POST body — never the POST response's `disabled`,
 * which is always `undefined` and would be a permanent lie.
 */
const props = withDefaults(
  defineProps<{
    /**
     * The schedule the SERVER confirmed — now readable, via
     * `GET /modules/accessibility`, so the editor seeds from it on mount
     * instead of starting blank and reporting itself.
     */
    windows?: AccessibilityWindow[];
    /** The panel-wide kill switch, as the server last stored it. */
    disable?: boolean;
    submitting: boolean;
    error: string | null;
  }>(),
  { windows: () => [], disable: false, submitting: false, error: null },
);

const emit = defineEmits<{
  save: [input: { windows: AccessibilityWindow[]; disable: boolean }];
}>();

/** `/^([01][0-9]|2[0-3]):[0-5][0-9]$/` — the shape the server's schema is. */
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * The draft, which is empty until a save confirms one — see the note at the top of
 * this file.
 *
 * A `reactive` array of plain objects rather than a `ref` per row: a window is
 * added and removed as a unit, and an array makes removing the third of three a
 * `splice` instead of three separate nulls the template has to filter out.
 */
const draft = reactive<AccessibilityWindow[]>([]);

/** The parent's own intent for the panel-wide switch — seeded from the server's copy. */
const disable = ref(props.disable);

const attempted = ref(false);

/**
 * Repopulate from the server's copy whenever it changes.
 *
 * Watched on the prop rather than assigned at mount, because a save made on another
 * device — or on this one before the screen was revisited — replaces the array, and
 * a draft that kept the parent's own last typing would then be showing something
 * the server had already accepted differently. The `attempted` reset is deliberate:
 * the errors belonged to a draft that no longer exists.
 */
watch(
  () => props.windows,
  (stored) => {
    draft.splice(0, draft.length, ...stored.map((window) => ({ ...window })));
    attempted.value = false;
  },
  { immediate: true },
);

watch(
  () => props.disable,
  (stored) => {
    disable.value = stored;
  },
);

/** `HH:MM` as minutes since midnight — the only way `from < to` is a comparison. */
function minutesOf(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null;

  // Indexed rather than destructured, because `noUncheckedIndexedAccess` makes a
  // destructured element `number | undefined` — and a `NaN` here would compare as
  // `false` against everything, so an unparseable time would silently pass the
  // overnight check instead of being reported.
  const parts = value.split(":").map(Number);

  return parts[0]! * 60 + parts[1]!;
}

/**
 * Per-row errors, keyed by index.
 *
 * Only the ONE rule this screen can answer before the server does: an overnight
 * window is not offered and not accepted. Everything else is upstream's to
 * validate, and duplicating its rules here would be a second validator to keep in
 * step with the first.
 */
const rowErrors = computed<Record<number, string>>(() => {
  const found: Record<number, string> = {};

  draft.forEach((window, index) => {
    const from = minutesOf(window.from);
    const to = minutesOf(window.to);

    if (from === null || to === null) {
      // found[index] = "ساعت را به شکل ۰۷:۰۰ وارد کنید.";
      return;
    }

    if (from >= to) {
      found[index] = "ساعت پایان باید بعد از ساعت شروع باشد.";
    }
  });

  return found;
});

const isValid = computed<boolean>(() => Object.keys(rowErrors.value).length === 0);

/** The empty draft the «افزودن بازه» button installs. */
function addWindow(): void {
  draft.push({ from: "", to: "" });
}

function removeWindow(index: number): void {
  draft.splice(index, 1);
}

function onSubmit(): void {
  attempted.value = true;

  if (!isValid.value) return;

  // A half-typed row cannot reach here — `isValid` is false for it — so this is
  // the same narrowing the payload type needs rather than a filter that could
  // silently drop a window the parent meant to save.
  emit("save", {
    windows: draft.map((window) => ({ from: window.from, to: window.to })),
    disable: disable.value,
  });
}
</script>

<template>
  <form class="grid gap-3" novalidate @submit.prevent="onSubmit">
    <!--
      The honesty note. It is above the list rather than below it, because the
      empty list below is what it is explaining, and a reader who meets the list
      first has already drawn the wrong conclusion from it.
    -->
    <UAlert
      v-if="error"
      variant="soft"
      color="error"
      title="زمان‌های دسترسی ذخیره نشد"
    >
      <template #description>{{ error }}</template>
    </UAlert>

    <p
      v-if="draft.length === 0"
      class="text-xs leading-6 text-x-text-subtitle"
    >
      هنوز بازه‌ای اضافه نشده است. اگر بازه‌ای نساختید و ذخیره را بزنید، دسترسی فرزند
      در همهٔ ساعت‌ها باز می‌ماند.
    </p>

    <ul v-else class="grid gap-3">
      <li
        v-for="(window, index) in draft"
        :key="index"
        class="neu-inset rounded-2xl bg-white p-3"
      >
        <div class="flex items-end gap-2">
          <UFormField
            label="از ساعت"
            class="min-w-0 flex-1"
            :error="Boolean(rowErrors[index])"
            :help="rowErrors[index]"
          >
            <UInput
              v-model="draft[index]!.from"
              type="time"
              dir="ltr"
              class="w-full"
              :ui="{ base: 'w-full rounded-2xl' }"
            />
          </UFormField>

          <UFormField label="تا ساعت" class="min-w-0 flex-1">
            <UInput
              v-model="draft[index]!.to"
              type="time"
              dir="ltr"
              class="w-full"
              :ui="{ base: 'w-full rounded-2xl' }"
            />
          </UFormField>

          <UButton
            type="button"
            icon="solar:trash-bin-trash-linear"
            color="error"
            variant="ghost"
            aria-label="حذف این بازه"
            class="size-11 shrink-0 rounded-full"
            :ui="{ base: 'size-11 min-h-11 rounded-full' }"
            @click="removeWindow(index)"
          />
        </div>
      </li>
    </ul>

    <UButton
      type="button"
      icon="solar:add-circle-linear"
      label="افزودن بازه"
      variant="soft"
      class="h-11 justify-center rounded-full"
      :ui="{ base: 'bg-x-parent-100! text-x-parent-700! hover:bg-x-parent-200!' }"
      @click="addWindow"
    />

    <!--
      `as="row"` is not available here (that is `Settings/Row.vue`'s own shape) and
      a `<button>` inside a `<button>` is unreachable for a keyboard, so this is a
      plain label wired to the switch by `for` — the way a settings row does it.
    -->
    <label
      for="parent-accessibility-disable"
      class="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-4 py-3"
    >
      <UIcon
        name="solar:shield-cross-linear"
        size="22"
        class="shrink-0 text-x-parent-500"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-yekan-bold text-x-text-title">
          بستن کامل پنل فرزند
        </span>
        <span class="block text-xs leading-5 text-x-text-subtitle">
          حتی داخل بازه‌های بالا هم فرزند وارد نمی‌شود.
        </span>
      </span>
      <USwitch
        id="parent-accessibility-disable"
        v-model="disable"
        color="x-primary"
      />
    </label>

    <UButton
      type="submit"
      label="ذخیره زمان‌های دسترسی"
      icon="solar:check-circle-linear"
      variant="solid"
      :loading="submitting"
      :disabled="submitting"
      block
      class="h-12 rounded-full font-yekan-bold"
      :ui="{ base: 'bg-x-parent-600! text-white! hover:bg-x-parent-700!' }"
    />

    <!-- The submit guard is invisible to a keyboard user otherwise. -->
    <p v-if="attempted && !isValid" class="text-xs text-x-text-subtitle" role="alert">
      ساعت پایان هر بازه باید بعد از ساعت شروع آن باشد.
    </p>
  </form>
</template>
