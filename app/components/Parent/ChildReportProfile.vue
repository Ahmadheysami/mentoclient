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
 * the account itself is off.
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

const birthDate = computed<string>(() =>
  faDate(props.general.birthDate ?? props.child.birthDate) || "ثبت نشده",
);

const memberSince = computed<string>(() =>
  faDate(props.general.createdAt ?? props.child.createdAt) || "ثبت نشده",
);

const lastLogin = computed<string>(() => {
  if (!props.general.lastLoginAt) return "ثبت نشده";

  return faRelative(props.general.lastLoginAt, props.now) || "ثبت نشده";
});

const presence = computed<{ label: string; tone: string }>(() => {
  if (props.general.isOnline) {
    return { label: "آنلاین", tone: "bg-emerald-500" };
  }

  const lastSeen = props.general.lastSeen;

  if (lastSeen !== null && Number.isFinite(lastSeen) && lastSeen > 0) {
    return {
      label: `آخرین حضور ${faRelative(lastSeen, props.now)}`,
      tone: "bg-x-parent-300",
    };
  }

  return { label: "وضعیت حضور نامشخص", tone: "bg-x-text-subtitle" };
});

const accountStatus = computed<{ label: string; tone: string }>(() =>
  props.general.disable
    ? { label: "غیرفعال", tone: "bg-red-50 text-red-600" }
    : { label: "فعال", tone: "bg-emerald-50 text-emerald-700" },
);

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
  <section
    id="report-profile"
    aria-labelledby="report-profile-title"
    class="scroll-mt-20"
  >
    <div class="flex items-start justify-between gap-3">
      <h2 id="report-profile-title" class="min-w-0 text-sm font-yekan-bold text-x-text-title">
        اطلاعات و دسترسی
      </h2>
      <NuxtLink
        :to="accessHref"
        class="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-xs text-x-parent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        مدیریت دسترسی
      </NuxtLink>
    </div>

    <div class="neu-raised-lg mt-2 rounded-3xl bg-white p-4">
      <dl class="divide-y divide-x-parent-warm-100">
        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
          <dt class="text-xs leading-5 text-x-text-subtitle">جنسیت</dt>
          <dd class="min-w-0 break-words text-xs font-yekan-bold leading-5 text-x-text-title">
            {{ genderLabel(general.gender) }}
          </dd>
        </div>

        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
          <dt class="text-xs leading-5 text-x-text-subtitle">تاریخ تولد</dt>
          <dd class="min-w-0 break-words text-xs font-yekan-bold leading-5 text-x-text-title tabular-nums">
            {{ birthDate }}
          </dd>
        </div>

        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
          <dt class="text-xs leading-5 text-x-text-subtitle">عضو از</dt>
          <dd class="min-w-0 break-words text-xs font-yekan-bold leading-5 text-x-text-title tabular-nums">
            {{ memberSince }}
          </dd>
        </div>

        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
          <dt class="text-xs leading-5 text-x-text-subtitle">آخرین ورود</dt>
          <dd class="min-w-0 break-words text-xs font-yekan-bold leading-5 text-x-text-title tabular-nums">
            {{ lastLogin }}
          </dd>
        </div>

        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
          <dt class="text-xs leading-5 text-x-text-subtitle">وضعیت حضور</dt>
          <dd class="flex min-w-0 items-center gap-1.5 text-xs font-yekan-bold leading-5 text-x-text-title">
            <span
              aria-hidden="true"
              class="size-2 shrink-0 rounded-full"
              :class="presence.tone"
            />
            <span class="break-words">{{ presence.label }}</span>
          </dd>
        </div>

        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
          <dt class="text-xs leading-5 text-x-text-subtitle">کد دسترسی</dt>
          <dd class="min-w-0 break-words text-xs font-yekan-bold leading-5 text-x-text-title">
            {{ general.hasAccessCode ? "کد دسترسی فعال" : "بدون کد دسترسی" }}
          </dd>
        </div>

        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5 last:pb-0">
          <dt class="text-xs leading-5 text-x-text-subtitle">وضعیت حساب</dt>
          <dd class="min-w-0">
            <span
              class="inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[11px] font-yekan-bold"
              :class="accountStatus.tone"
            >
              {{ accountStatus.label }}
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <div class="neu-raised-lg mt-2 rounded-3xl bg-white p-4">
      <h3 class="text-xs font-yekan-bold text-x-text-title">برنامهٔ دسترسی</h3>

      <template v-if="accessWindows.length > 0">
        <ul class="mt-2 flex flex-wrap gap-1.5">
          <li
            v-for="window in accessWindows"
            :key="window.key"
            class="rounded-full bg-x-parent-50 px-2.5 py-1 text-[11px] leading-5 text-x-parent-700"
          >
            <bdi>{{ window.from }}</bdi>
            <span aria-hidden="true"> تا </span>
            <span class="sr-only">تا</span>
            <bdi>{{ window.to }}</bdi>
          </li>
        </ul>
        <p class="mt-2 text-[11px] leading-6 text-x-text-subtitle">
          خارج از این بازه‌ها ورود فرزند محدود می‌شود.
        </p>
      </template>

      <template v-else>
        <p class="mt-2 text-xs font-yekan-bold leading-6 text-x-text-title">
          بدون محدودیت زمانی
        </p>
        <p class="mt-1 text-[11px] leading-6 text-x-text-subtitle">
          ورود در همه ساعت‌ها آزاد است.
        </p>
      </template>
    </div>
  </section>
</template>
