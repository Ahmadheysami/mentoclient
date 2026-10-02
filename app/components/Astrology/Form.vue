<script setup lang="ts">
import { IRAN_PROVINCES } from "~/data/iran-provinces";
import {
  type AstrologyCity,
  type AstrologyFormInput,
} from "~/types/astrology";
import { jalaliToGregorianString } from "~/utils/jalali";
import { faNumber } from "~/utils/fa";

/**
 * The birth-data form of the astrology feature — the one form in this app whose
 * answer is PERMANENT.
 *
 * Upstream stores the submitted object **verbatim**, the schema is not
 * `.strict()`, and a second activation is refused with
 * `ERR_MODULE_ASTROLOGT_ONCE`: there is no way to correct a typo afterwards. So
 * two things are load-bearing here and neither is decoration:
 *
 * - every format is produced **here**, exactly as the server's regexes want it,
 *   so `ERR_VALIDATION` is close to unreachable;
 * - and the page that hosts this component makes the reader confirm before the
 *   call is fired (see `pages/panels/big/astrology/new.vue`), which is why the
 *   permanence is spelled out in full here too — the reader meets this form long
 *   before they meet that dialog.
 *
 * ## WHY THE CITY PICKER IS A `UInputMenu` AND NOT A `USelect`
 *
 * `USelect` in Nuxt UI 4.9 **does not filter**. Verified in
 * `@nuxt/ui/dist/runtime/components/Select.vue`: it renders `SelectContent` and
 * hands every item to reka's `SelectRoot`, whose only text handling is
 * `useTypeahead` — a keyboard shortcut that JUMPS the highlight to a matching
 * option. There is no search field, no filtering and no `filterable` prop (that
 * was Nuxt UI v2 and is gone). So a `USelect` over the 344-city list is a list
 * the reader has to scroll blind on a phone.
 *
 * `UInputMenu` is Nuxt UI's own searchable listbox — the same library, not a
 * hand-rolled one: a `Combobox` with a real search field, `useFilter` doing
 * `contains`/`startsWith` scoring over `filterFields`, and a `virtualize` prop
 * built for exactly this size. So the picker stays inside rule 6 while actually
 * being usable. The 31-item province list keeps `USelect`, which is the right
 * control for a fixed short list and needs no search.
 *
 * `virtualize` matters here and not for style: 344 mounted rows in a portal on a
 * mid-range phone is a visible stall every time the menu opens. Nuxt UI flattens
 * groups when virtualizing, and this list is flat, so nothing is lost.
 *
 * ## WHY THE DRAFT IS LOCAL
 *
 * Province, city, date and time are `ref`s in this component and never enter the
 * store. They describe a form that has not been submitted, they are meaningless
 * once the reader leaves, and a half-typed birth date kept in shared state is one
 * `reset()` away from being submitted to an endpoint that accepts it exactly
 * once. The store holds only what the server has actually said.
 */
const props = withDefaults(
  defineProps<{
    cities: AstrologyCity[];
    citiesLoading: boolean;
    citiesError: string | null;
    submitting: boolean;
    /** The activation refusal, rendered inline beside the fields. */
    error?: string | null;
  }>(),
  { error: null },
);

const emit = defineEmits<{ submit: [payload: AstrologyFormInput] }>();

/* ------------------------------------------------------------------ draft --- */

/** The 31 provinces as the mutable array `USelect` expects — see the template. */
const provinces = computed<string[]>(() => [...IRAN_PROVINCES]);

const province = ref<string | undefined>(undefined);

/** The picked city object. `undefined` until one is chosen. */
const city = ref<AstrologyCity | undefined>(undefined);

/** Free-text city name, used only when the list is unavailable. */
const manualCity = ref("");

/** Coordinates as TEXT while the reader types them, numbers on the wire. */
const manualLat = ref("");
const manualLong = ref("");

/** Masked `####/##/##`. The backend wants slashes and a 13xx/14xx year. */
const solarDate = ref("");

/** `HH:MM` from a native time input; padded to `HH:MM:SS` on submit. */
const time = ref("");

/** Defaults to «ایران», which is also the server's own default. */
const country = ref("ایران");

/**
 * Whether this reader is filling the city and the coordinates in by hand.
 *
 * **`!citiesLoading` is the load-bearing half.** `state.loading.cities` starts
 * `true` (see `stores/astrology.ts`), so on the first frame the list is empty
 * AND still loading — and testing the length alone would flash the two manual
 * coordinate inputs for a moment before swapping them for the picker. That swap
 * also destroys whatever the reader had typed, so the condition is "the list is
 * gone and it is not coming", not "the list has not arrived yet".
 */
const withoutCityList = computed<boolean>(
  () => !props.citiesLoading && props.cities.length === 0,
);

/* -------------------------------------------------------------- validation --- */

/**
 * `solarDate`, checked against the server's own regex
 * `/^(1[3-4]\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[0-1]$)/`, written out
 * here with the misplaced `$` repaired and the end anchored.
 *
 * The repair is safe in the only direction that matters: every day this accepts
 * (`01`–`31`, zero-padded) also matches that alternation upstream, so a form
 * this component lets through is a request the server cannot refuse on shape.
 */
const SOLAR_DATE_PATTERN = /^(1[3-4]\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/;

/** `time` after padding: `/^\d+:\d+:\d+$/`. */
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

/** The picked or typed coordinates, as numbers. `NaN` while incomplete. */
const lat = computed<number>(() =>
  withoutCityList.value ? Number(manualLat.value) : (city.value?.lat ?? Number.NaN),
);

const long = computed<number>(() =>
  withoutCityList.value ? Number(manualLong.value) : (city.value?.long ?? Number.NaN),
);

const cityName = computed<string>(() =>
  withoutCityList.value ? manualCity.value.trim() : (city.value?.label ?? ""),
);

/**
 * The Gregorian mirror, or `null` while the Jalali half is not yet a date.
 *
 * `jalaliToGregorianString` **throws** on an out-of-range year or a month/day
 * outside 1–12 / 1–31, and this is a keystroke-driven value: half of `1404/0` is
 * not a date and must render as "not yet", not as an unhandled `RangeError`. The
 * `try` is therefore the normal path for a partially typed date, not a defensive
 * afterthought. Years are already bounded to 13xx/14xx by the pattern, which is
 * well inside the leap table's coverage.
 *
 * The leap-year check is the question `app/utils/jalali.ts` explicitly leaves
 * to its caller: **1400 is not a leap year**, so `1400/12/30` is not a
 * date, and the converter answers that rollover with the next real day —
 * `2022-03-21` — silently. It is detected by comparing against 1 Farvardin of the
 * following year rather than by re-deriving the leap rule here, so there is one
 * leap table in this app and not two. Sending it would store a birth date one
 * day off on a chart that can never be corrected.
 */
const gregorianDate = computed<string | null>(() => {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(solarDate.value);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  try {
    // ⚠ THE ROLLOVER TRAP: `jalaliToGregorian` range-checks the day against 31 and
    // against nothing else, so a day that does not exist in THAT month comes back
    // as the first day of the next one — `1370/07/31` converts to `1991-10-23`,
    // which is `1370/08/01`. Months 7-12 have no 31st at all (7-11 are 30 days,
    // Esfand 29 or 30), so the pattern's `31` admits six dates a month of them.
    // `gregorianDate` is what the chart is computed from and the record is stored
    // verbatim with no second try, so it is refused here rather than submitted a
    // month off with a «برابر با …» beside it that reads as confirmation.
    if (month >= 7 && day === 31) return null;

    const converted = jalaliToGregorianString(year, month, day);

    if (month === 12 && day === 30) {
      const nextYearStart = jalaliToGregorianString(year + 1, 1, 1);

      if (converted === nextYearStart) return null;
    }

    return converted;
  } catch {
    return null;
  }
});

/**
 * Whether the reader has tried to submit yet.
 *
 * Every field starts empty, so validating from the first frame would put four
 * red messages on a form nobody has touched — which reads as "this form is
 * broken" rather than "fill it in". The store's own refusal for the *previous*
 * attempt (`props.error`) is a different thing and is shown from the first
 * frame, because it happened before this form was on screen.
 */
const attempted = ref(false);

/** One message per field, or `null`. Keys are rendered where the reader is looking. */
const errors = computed<Record<string, string>>(() => {
  if (!attempted.value) return {};

  const found: Record<string, string> = {};

  if (!province.value) {
    found.province = "استان تولد را انتخاب کنید.";
  }

  if (!cityName.value) {
    found.city = "شهر تولد را انتخاب کنید.";
  }

  if (withoutCityList.value) {
    // The Iranian gazetteer spans 25–61 N and 25–63 E and cannot contain a
    // negative longitude, but a typed value can — and the schema
    // (`z.number().min(1)`) refuses one outright.
    if (!Number.isFinite(lat.value) || lat.value < 1) {
      found.lat = "عرض جغرافیایی را به‌صورت عدد وارد کنید.";
    }

    if (!Number.isFinite(long.value) || long.value < 1) {
      found.long = "طول جغرافیایی را به‌صورت عدد وارد کنید.";
    }
  }

  if (!solarDate.value) {
    found.solarDate = "تاریخ تولد شمسی را وارد کنید.";
  } else if (!SOLAR_DATE_PATTERN.test(solarDate.value)) {
    found.solarDate = "تاریخ شمسی باید به شکل ۱۳۷۰/۰۵/۱۵ باشد.";
  } else if (gregorianDate.value === null) {
    found.solarDate = "این تاریخ شمسی معتبر نیست.";
  }

  if (!time.value) {
    found.time = "ساعت تولد را وارد کنید.";
  } else if (!TIME_PATTERN.test(`${time.value}:00`)) {
    found.time = "ساعت تولد معتبر نیست.";
  }

  return found;
});

const isValid = computed<boolean>(() => Object.keys(errors.value).length === 0);

/* ----------------------------------------------------------------- inputs --- */

/**
 * The `####/##/##` mask, applied on the way in.
 *
 * Non-digits are dropped rather than refused, the run is cut to eight digits so
 * the value can never outgrow the field the backend has a regex for, and the
 * separators are re-inserted at 4 and 7. Doing it here rather than with a
 * `maxlength` means backspacing cannot strand the string at `1370/` with the
 * caret past the end.
 */
function onDateInput(event: Event): void {
  const digits = (event.target as HTMLInputElement).value
    .replace(/\D/g, "")
    .slice(0, 8);

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);

  solarDate.value = month
    ? `${year}/${month}${day ? `/${day}` : ""}`
    : year;
}

/* ----------------------------------------------------------------- submit --- */

/**
 * Hand the payload up. The page decides when to send it — this component does
 * not call the API, and it does not navigate.
 */
function onSubmit(): void {
  attempted.value = true;

  if (!isValid.value || props.submitting) return;

  const gregorian = gregorianDate.value;

  // Unreachable while `isValid` — the pattern and the converter are checked
  // there — but the payload type is not nullable and a `null` reaching it would
  // be a `gregorianDate: null` on a request the server refuses with a message
  // about a field the reader never saw.
  if (gregorian === null) return;

  emit("submit", {
    province: province.value ?? "",
    city: cityName.value,
    lat: lat.value,
    long: long.value,
    // A native time input is `HH:MM`, already zero-padded; the schema's
    // `/^\d+:\d+:\d+$/` wants seconds, and a birth time is never known to the
    // second — so `:00` is the honest figure, not a made-up one.
    time: `${time.value}:00`,
    solarDate: solarDate.value,
    gregorianDate: gregorian,
    // A cleared field falls back to «ایران» rather than sending `""`. Upstream
    // this key `.default("ایران")`s — but its `.default()`s are inert and the
    // schema is not `.strict()`, so an empty string would be STORED as the
    // country on a record that can never be edited.
    //
    // `timezone` is NOT sent at all, and the asymmetry with the line above is
    // deliberate rather than an oversight. `country` has an honest default here —
    // the province list is Iran-only, so «ایران» is what a cleared field means —
    // while a birth timezone is a fact about a person this form never asks for,
    // and the coordinates can be typed by hand for anywhere. Putting a constant
    // there would store a claim the app was not told. Absent is stored as absent:
    // the store forwards `timezone` only when it is defined
    // (`stores/astrology.ts`), so the alternative — an empty string — is exactly
    // what the comment above is refusing to send. What the backend does with a
    // missing `timezone` is not documented to this app; if it ever is, this is
    // the line to revisit.
    country: country.value.trim() || "ایران",
  });
}
</script>

<template>
  <form class="grid gap-4" novalidate @submit.prevent="onSubmit">
    <!--
      The city list is a third party's, so its failure is reported HERE rather
      than as a failed screen: the reader is told the list is missing, told the
      coordinates can be typed instead, and the form below stays fully usable.
      A refusal that hid the form would take away the one thing they can still
      do. `color="warning"` and not `error` — nothing is wrong with what they did.

      Nuxt UI's own `UAlert`, not `Ui/Alert`: that one is `grid place-items-center`
      with an 18×18 icon disc and a confirm/cancel pair, so it is built for a
      modal body (it is `Settings/ConfirmModal`'s) and an inline banner in it
      would be all centre and no edge.
    -->
    <UAlert
      v-if="citiesError"
      variant="soft"
      color="warning"
      icon="solar:shield-warning-linear"
      title="فهرست شهرها بارگذاری نشد"
      class="rounded-3xl"
    >
      <template #description>
        {{ citiesError }}
      </template>
    </UAlert>

    <!--
      `UFormField` is the labelled wrapper with the inline message slot, so each
      message sits under the field it is about instead of in a block at the
      bottom of a form the reader has to scroll back through.
    -->
    <UFormField
      label="استان تولد"
      required
      :error="Boolean(errors.province)"
      :help="errors.province"
    >
      <!--
        A copy, not `IRAN_PROVINCES` itself: the source is `readonly string[]`
        and `USelect`'s `items` is a mutable array — so the array is spread once
        into a computed rather than cast, which keeps the read-only contract on
        the data file where it belongs.
      -->
      <USelect
        v-model="province"
        :items="provinces"
        placeholder="انتخاب استان"
        :ui="{ base: 'w-full rounded-2xl' }"
      />
    </UFormField>

    <UFormField
      label="شهر تولد"
      required
      :error="Boolean(errors.city)"
      :help="errors.city"
    >
      <!--
        The searchable listbox, per the note at the top of this file. `by` is
        left unset so reka compares the whole item: 6 of the 344 upstream names
        are duplicated, and comparing by `label` would mark two different rows as
        the same selection. `virtualize` keeps 344 rows out of the DOM.
      -->
      <UInputMenu
        v-if="!withoutCityList"
        v-model="city"
        :items="cities"
        :virtualize="true"
        :loading="citiesLoading"
        :disabled="citiesLoading"
        placeholder="جست‌وجوی شهر"
        class="w-full"
        :ui="{ base: 'w-full rounded-2xl' }"
      >
        <!--
          The "nothing found" line, in Persian. Nuxt UI's own is
          `inputMenu.noMatch` — and this app configures no `ui.locale`, so that
          string resolves to the **English** default («No matching data») on a
          Persian screen. Overriding the slot here is local to this one list; the
          alternative is a global locale change, which is a decision for the whole
          app and not this form's to make.
        -->
        <template #empty="{ searchTerm }">
          <p class="py-2 text-center text-xs text-x-text-subtitle">
            {{
              searchTerm
                ? `شهری با نام «${searchTerm}» پیدا نشد.`
                : "شهری برای انتخاب وجود ندارد."
            }}
          </p>
        </template>
      </UInputMenu>

      <!--
        The fallback, and the reason the alert above it says the form stays
        usable: the list is a third party's, so it can be unavailable on a day the
        rest of the app works fine. The reader types the name and the two
        coordinates instead, which is exactly what the request needs.
      -->
      <UInput
        v-else
        v-model="manualCity"
        placeholder="نام شهر"
        class="w-full"
        :ui="{ base: 'w-full rounded-2xl' }"
      />
    </UFormField>

    <div v-if="withoutCityList" class="grid grid-cols-2 gap-3">
      <UFormField
        label="عرض جغرافیایی"
        :error="Boolean(errors.lat)"
        :help="errors.lat"
      >
        <UInput
          v-model="manualLat"
          inputmode="decimal"
          dir="ltr"
          placeholder="35.6892"
          class="w-full"
          :ui="{ base: 'w-full rounded-2xl' }"
        />
      </UFormField>

      <UFormField
        label="طول جغرافیایی"
        :error="Boolean(errors.long)"
        :help="errors.long"
      >
        <UInput
          v-model="manualLong"
          inputmode="decimal"
          dir="ltr"
          placeholder="51.3890"
          class="w-full"
          :ui="{ base: 'w-full rounded-2xl' }"
        />
      </UFormField>
    </div>

    <!--
      Read-only, and it exists so the reader can SEE the coordinates their
      chart will be computed from. It is the one number on the screen a wrong
      pick of city silently propagates into a permanent record, so it is shown
      rather than trusted. `dir="ltr"` and `tabular-nums`: a decimal pair is not
      Persian text, and proportional digits make `51.3890` jitter as it changes.
    -->
    <p
      v-if="!withoutCityList"
      class="rounded-2xl bg-x-primary-100/60 px-3.5 py-2.5 text-xs text-x-primary-900"
    >
      <span class="font-bold">مختصات:</span>
      <span dir="ltr" class="ms-1 tabular-nums">
        {{ Number.isFinite(lat) && Number.isFinite(long)
          ? `${faNumber(Number(lat.toFixed(4)))}, ${faNumber(Number(long.toFixed(4)))}`
          : "—" }}
      </span>
    </p>

    <UFormField
      label="تاریخ تولد (شمسی)"
      required
      :error="Boolean(errors.solarDate)"
      :help="errors.solarDate ?? (gregorianDate ? `برابر با ${gregorianDate}` : undefined)"
    >
      <UInput
        :model-value="solarDate"
        inputmode="numeric"
        dir="ltr"
        placeholder="1370/05/15"
        maxlength="10"
        class="w-full"
        :ui="{ base: 'w-full rounded-2xl' }"
        @input="onDateInput"
      />
    </UFormField>

    <UFormField
      label="ساعت تولد"
      required
      :error="Boolean(errors.time)"
      :help="errors.time"
    >
      <!--
        `type="time"` rather than a `UInputTime`: it is the one control that opens
        the OS's own wheel picker on a phone, which is the only reason a reader
        knows their birth time to the minute at all. The value arrives as `HH:MM`,
        already zero-padded, and is padded to `HH:MM:SS` on submit.
      -->
      <UInput
        v-model="time"
        type="time"
        dir="ltr"
        class="w-full"
        :ui="{ base: 'w-full rounded-2xl' }"
      />
    </UFormField>

    <UFormField label="کشور">
      <UInput
        v-model="country"
        placeholder="ایران"
        class="w-full"
        :ui="{ base: 'w-full rounded-2xl' }"
      />
    </UFormField>

    <!--
      The permanence, in full, immediately above the button — and not as a line of
      grey text, because this is the one irreversible action in the app and a
      footnote is the weakest thing on a screen. It names all three consequences
      the reader cannot undo (no edit, no delete, no second try) so the confirmation
      dialog that follows is a confirmation of something already understood
      rather than the first mention of it.

      The confirm dialog is still the thing that gates the request; this is the
      thing that makes it a decision instead of a formality.
    -->
    <UAlert
      variant="soft"
      color="warning"
      icon="solar:shield-warning-linear"
      title="این اطلاعات پس از فعال‌سازی قابل تغییر نیست"
      class="rounded-3xl"
    >
      <template #description>
        <ul class="list-inside list-disc space-y-1 marker:text-warning-500">
          <li>امکان ویرایش یا حذف اطلاعات تولد وجود ندارد.</li>
          <li>امکان فعال‌سازی دوباره با اطلاعات دیگر وجود ندارد.</li>
          <li>سکهٔ لازم از موجودی شما کسر می‌شود.</li>
        </ul>
      </template>
    </UAlert>

    <!--
      The refusal of the LAST attempt, above the button that retries it.

      It is the store's own sentence and never `response.message` verbatim: for
      `ERR_VALIDATION` it is the first field error the backend named, and for a
      5xx with no `reason` it is a written Persian line instead of an English
      `TypeError` from our own backend (see `refusalMessage` in the store).

      Placed here, not at the top, because this is a message about pressing the
      button — the reader is looking at the button when it appears.

      `role="alert"` because nothing else announces it, and this is the moment a
      reader most needs to HEAR about: the request resolves long after the finger
      left the button, the confirmation dialog has been dismissed by then, and the
      hosting page fires no toast for a refusal on purpose because this alert is
      where it is read (see `confirmActivate`). Nuxt UI's `UAlert` renders a bare
      `Primitive` with no role and no live region of its own, so without this the
      sentence appears silently to a screen reader while the page scrolls them down
      to it. Same treatment as the goal ladder's own refusal, which is the other
      async error this app shows in place.
    -->
    <UAlert
      v-if="error"
      role="alert"
      variant="soft"
      color="error"
      icon="solar:close-circle-outline"
      title="فعال‌سازی انجام نشد"
      class="rounded-3xl"
    >
      <template #description>
        {{ error }}
      </template>
    </UAlert>

    <UButton
      type="submit"
      block
      variant="solid"
      color="x-primary"
      label="ادامه و تأیید اطلاعات"
      :loading="submitting"
      :disabled="submitting"
      class="transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
      :ui="{ base: 'h-12 rounded-full' }"
    />
  </form>
</template>
