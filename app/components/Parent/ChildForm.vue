<script setup lang="ts">
import { jalaliToGregorianString } from "~/utils/jalali";

/**
 * The create-child form: name, family, birth date, gender.
 *
 * ## WHY THERE IS NO AVATAR FIELD
 *
 * `POST /child/create` accepts an avatar only at `/^\/uploads\/[\w./-]+$/`, which
 * is the shape the server's own upload pipeline produces, and `POST /user/avatar`
 * writes to the SIGNED-IN PARENT. There is no way to set a child's avatar from
 * this repository at all, so the Nuxt proxy drops the field and this form does
 * not offer a control that could only ever fail. The card's illustration branch
 * is what renders until the backend grows a real upload for children.
 *
 * ## WHY THE BIRTH DATE IS A JALALI MASK AND NOT A NATIVE `date` INPUT
 *
 * This app is Persian-first and every other date it asks for is typed in Jalali
 * (`components/Astrology/Form.vue`). A native date input renders the phone's own
 * locale — Gregorian on most of them — which on a Persian screen is a foreign
 * field for the one value a parent is least likely to want to guess at twice.
 * The mask is `####/##/##` and the conversion goes through
 * `app/utils/jalali.ts`, so there is ONE Jalali converter in this app rather than
 * two opinions about where Farvardin is.
 *
 * `jalaliToGregorianString` **throws** on an out-of-range month or day, and this
 * value is keystroke-driven, so `toEpochMs` answers `null` for a half-typed date
 * rather than letting a `RangeError` reach the render. It also answers `null` for
 * the ROLLOVER trap that converter documents: it range-checks the day against 31
 * and against nothing else, so `۱۳۹۵/۰۷/۳۱` comes back as `۱۳۹۵/۰۸/۰۱` — and a
 * birth date stored a month off, on a record nothing can re-derive, is not a
 * rounding error.
 */
const props = withDefaults(
  defineProps<{
    submitting: boolean;
  }>(),
  { submitting: false },
);

const emit = defineEmits<{
  submit: [input: { firstName: string; lastName: string; birthDate: number; gender: string }];
}>();

/** `####/##/##`, zero-padded — the shape the mask below produces. */
const BIRTH_PATTERN = /^1[3-4]\d{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/;

/** Esfand 29 or 30, never 31. */
function isRealJalaliDate(year: number, month: number, day: number): boolean {
  // Months 7–11 have no 31st at all.
  if (month >= 7 && day === 31) return false;

  if (month !== 12 || day !== 30) return true;

  // `1400/12/30` does not exist: the converter answers that rollover with
  // 1 Farvardin of the FOLLOWING year, which is how a bad date is detected here
  // without re-deriving the leap rule — there is one leap table in this app.
  try {
    return jalaliToGregorianString(year, month, day) !== jalaliToGregorianString(year + 1, 1, 1);
  } catch {
    return false;
  }
}

const firstName = ref("");
const lastName = ref("");
const birthDate = ref("");
const gender = ref<string>("");

/** The three choices upstream's schema is an enum over, in its own spelling. */
const genderOptions = [
  { value: "male", label: "پسر" },
  { value: "female", label: "دختر" },
  { value: "other", label: "دیگر" },
];

/**
 * The birth date as epoch milliseconds — the unit `POST /child/create` takes —
 * or `null` while it is not yet a real date.
 *
 * `Date.parse` on a `YYYY-MM-DD` string is UTC midnight by specification, which
 * is what makes this safe: the instant is derived from the value alone, so the
 * server render and the client hydration produce the same number. It reads no
 * clock and no locale.
 */
const birthEpochMs = computed<number | null>(() => {
  const value = birthDate.value.trim();

  if (!BIRTH_PATTERN.test(value)) return null;

  // Indexed rather than destructured: `noUncheckedIndexedAccess` makes a
  // destructured element `number | undefined`, and the converter below THROWS on an
  // out-of-range month or day — so an `undefined` slipping one call deeper would
  // become an unhandled `RangeError` in a keystroke handler.
  const parts = value.split("/").map(Number);
  const [year, month, day] = [parts[0]!, parts[1]!, parts[2]!];

  if (!isRealJalaliDate(year, month, day)) return null;

  const gregorian = jalaliToGregorianString(year, month, day);
  const epoch = Date.parse(`${gregorian}T00:00:00Z`);

  return Number.isNaN(epoch) ? null : epoch;
});

/**
 * Whether the reader has tried to submit yet.
 *
 * Every field starts empty, so validating from the first frame would put four
 * red messages on a form nobody has touched, which reads as "this form is broken"
 * rather than "fill it in". The store's refusal for a PREVIOUS attempt is a
 * different thing and the page shows that itself.
 */
const attempted = ref(false);

const errors = computed<Record<string, string>>(() => {
  if (!attempted.value) return {};

  const found: Record<string, string> = {};

  if (!firstName.value.trim()) {
    found.firstName = "نام را وارد کنید";
  }

  if (!birthDate.value.trim()) {
    found.birthDate = "تاریخ تولد را انتخاب کنید";
  } else if (birthEpochMs.value === null) {
    found.birthDate = "این تاریخ شمسی معتبر نیست.";
  } else if (birthEpochMs.value > Date.now()) {
    found.birthDate = "تاریخ تولد نمی‌تواند در آینده باشد";
  }

  if (!gender.value) {
    found.gender = "جنسیت را انتخاب کنید";
  }

  return found;
});

const isValid = computed<boolean>(() => Object.keys(errors.value).length === 0);

/**
 * The `####/##/##` mask, applied on the way in.
 *
 * Non-digits are dropped rather than refused, the run is cut to eight digits, and
 * the separators are re-inserted at 4 and 7 — so backspacing cannot strand the
 * value at `۱۳۹۵/` with the caret past the end, which a `maxlength` would allow.
 * `UInput` hands over the raw string rather than an `Event`, so the element is not
 * read back from the DOM at all.
 */
function onBirthInput(value: string | number): void {
  const digits = String(value).replace(/\D/g, "").slice(0, 8);

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);

  birthDate.value = month ? `${year}/${month}${day ? `/${day}` : ""}` : year;
}

/**
 * Hand the payload up. The page decides when to send it — this component does not
 * call the API and does not navigate.
 */
function onSubmit(): void {
  attempted.value = true;

  if (!isValid.value || props.submitting) return;

  const birthDateMs = birthEpochMs.value;

  // Unreachable while `isValid` — the pattern, the real-date check and the future
  // check are all run there — but the payload type is not nullable, and a `null`
  // reaching it would be `birthDate: null` on a request the server refuses with a
  // message about a field the reader never saw.
  if (birthDateMs === null) return;

  emit("submit", {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    birthDate: birthDateMs,
    gender: gender.value,
  });
}
</script>

<template>
  <form class="grid gap-4" novalidate @submit.prevent="onSubmit">
    <div class="grid grid-cols-2 gap-3">
      <UFormField label="نام" required :error="Boolean(errors.firstName)" :help="errors.firstName">
        <UInput
          v-model="firstName"
          placeholder="نام فرزند"
          class="w-full"
          :ui="{ base: 'neu-inset w-full rounded-2xl' }"
        />
      </UFormField>

      <UFormField
        label="نام خانوادگی"
        :error="false"
        :help="undefined"
      >
        <UInput
          v-model="lastName"
          placeholder="نام خانوادگی"
          class="w-full"
          :ui="{ base: 'neu-inset w-full rounded-2xl' }"
        />
      </UFormField>
    </div>

    <UFormField
      label="تاریخ تولد"
      required
      :error="Boolean(errors.birthDate)"
      :help="errors.birthDate"
    >
      <UInput
        :model-value="birthDate"
        type="text"
        inputmode="numeric"
        dir="ltr"
        placeholder="۱۳۹۵/۰۵/۱۵"
        class="w-full"
        :ui="{ base: 'neu-inset w-full rounded-2xl' }"
        @update:model-value="onBirthInput($event)"
      />
    </UFormField>

    <UFormField label="جنسیت" required :error="Boolean(errors.gender)" :help="errors.gender">
      <USelect
        v-model="gender"
        :items="genderOptions"
        value-key="value"
        placeholder="انتخاب کنید"
        class="w-full"
        :ui="{ base: 'neu-inset w-full rounded-2xl' }"
      />
    </UFormField>

    <UButton
      type="submit"
      label="ساخت فرزند"
      icon="solar:user-plus-rounded-linear"
      variant="solid"
      :loading="submitting"
      :disabled="submitting"
      block
      class="mt-1 h-12 rounded-full font-yekan-bold"
      :ui="{ base: 'bg-x-parent-600! text-white! hover:bg-x-parent-700!' }"
    />
  </form>
</template>
