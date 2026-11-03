<script setup lang="ts">
import { faDate, faRelative } from "~/utils/fa";
import { clockLabel, genderLabel } from "~/utils/parent-report";
import type {
  ChildOverviewGeneralDto,
  ChildProfileDto,
} from "~/types/parent-panel";

/**
 * Identity, account state and the access schedule.
 *
 * The account flag and the accessibility schedule are separate facts and are
 * labelled separately: `general.disable` is described as «حساب غیرفعال», never
 * as a time restriction, so a parent does not go looking for a schedule when
 * the account itself is off. Presence is not repeated here — the identity block
 * at the top of the report already says it, and one fact lives in one place.
 *
 * ## WHY KEY/VALUE ROWS
 *
 * Every line is a label and a single value. A row is 48px, the label is grey at
 * 12px on the start side and the value is ink at 14px on the end side, so a
 * parent scans the values down one edge instead of hunting them inside prose.
 * The only colour is «غیرفعال» in red: a closed account is the one line here
 * that needs a decision.
 */
const props = defineProps<{
  general: ChildOverviewGeneralDto;
  child: ChildProfileDto;
  /** The page's one clock reading. `undefined` keeps every relative time absolute. */
  now?: number;
}>();

const accessHref = computed<string>(() =>
  `/panels/parent/children/${props.child.userId}/access`,
);

const rows = computed(() => [
  {
    key: "gender",
    label: "جنسیت",
    value: genderLabel(props.general.gender),
    tone: "text-x-text-title",
  },
  {
    key: "birthDate",
    label: "تاریخ تولد",
    value: faDate(props.general.birthDate ?? props.child.birthDate) || "ثبت نشده",
    tone: "text-x-text-title",
  },
  {
    key: "memberSince",
    label: "عضو از",
    value: faDate(props.general.createdAt ?? props.child.createdAt) || "ثبت نشده",
    tone: "text-x-text-title",
  },
  {
    key: "lastLogin",
    label: "آخرین ورود",
    value: props.general.lastLoginAt
      ? faRelative(props.general.lastLoginAt, props.now) || "ثبت نشده"
      : "ثبت نشده",
    tone: "text-x-text-title",
  },
  {
    key: "accessCode",
    label: "کد دسترسی",
    value: props.general.hasAccessCode ? "کد دسترسی فعال" : "بدون کد دسترسی",
    tone: "text-x-text-title",
  },
  {
    key: "account",
    label: "وضعیت حساب",
    value: props.general.disable ? "غیرفعال" : "فعال",
    tone: props.general.disable ? "text-red-600" : "text-x-text-title",
  },
]);

const accessWindows = computed(() =>
  (Array.isArray(props.general.accessibility)
    ? props.general.accessibility
    : []
  )
    .filter(
      (slot) =>
        typeof slot === "object" &&
        slot !== null &&
        typeof slot.from === "string" &&
        typeof slot.to === "string" &&
        slot.from.trim().length > 0 &&
        slot.to.trim().length > 0,
    )
    .map((slot, index) => ({
      key: `${slot.from}-${slot.to}-${index}`,
      from: clockLabel(slot.from),
      to: clockLabel(slot.to),
    })),
);
</script>

<template>
  <section id="report-profile" aria-labelledby="report-profile-title" class="scroll-mt-20">
    <div class="flex items-baseline justify-between gap-3 px-1">
      <h2 id="report-profile-title" class="min-w-0 font-yekan-bold text-sm text-x-text-title">
        مشخصات و دسترسی
      </h2>

      <NuxtLink
        :to="accessHref"
        class="inline-flex min-h-11 shrink-0 items-center text-xs text-x-parent-700 underline decoration-x-parent-200 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        مدیریت دسترسی
      </NuxtLink>
    </div>

    <dl
      class="mt-2 divide-y divide-x-parent-warm-100 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white"
    >
      <div
        v-for="row in rows"
        :key="row.key"
        class="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5"
      >
        <dt class="shrink-0 text-xs leading-5 text-x-text-subtitle">
          {{ row.label }}
        </dt>
        <dd
          class="min-w-0 break-words text-end font-yekan-bold text-sm leading-6 tabular-nums"
          :class="row.tone"
        >
          {{ row.value }}
        </dd>
      </div>
    </dl>

    <div class="mt-3 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white">
      <h3 class="px-4 pb-2 pt-4 font-yekan-bold text-sm text-x-text-title">
        ساعت‌های دسترسی
      </h3>

      <dl
        v-if="accessWindows.length > 0"
        class="divide-y divide-x-parent-warm-100 border-t border-x-parent-warm-100"
      >
        <div
          v-for="window in accessWindows"
          :key="window.key"
          class="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5"
        >
          <dt class="text-xs leading-5 text-x-text-subtitle">بازهٔ مجاز</dt>
          <dd class="font-yekan-bold text-sm leading-6 text-x-text-title tabular-nums">
            <bdi>{{ window.from }}</bdi>
            <span class="font-yekan-regular text-x-text-subtitle"> تا </span>
            <bdi>{{ window.to }}</bdi>
          </dd>
        </div>
      </dl>

      <div v-else class="border-t border-x-parent-warm-100 px-4 py-3">
        <p class="font-yekan-bold text-sm leading-6 text-x-text-title">
          بدون محدودیت زمانی
        </p>
        <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
          ورود در همه ساعت‌ها آزاد است.
        </p>
      </div>

      <p
        v-if="accessWindows.length > 0"
        class="border-t border-x-parent-warm-100 px-4 py-3 text-xs leading-6 text-x-text-subtitle"
      >
        خارج از این بازه‌ها ورود فرزند محدود می‌شود.
      </p>
    </div>
  </section>
</template>
