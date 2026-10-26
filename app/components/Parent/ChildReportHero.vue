<script setup lang="ts">
import { faNumber, faRelative } from "~/utils/fa";
import { stageOfAge, type ChildOverviewDto } from "~/types/parent-panel";

/**
 * The report's identity card: who the report is about, which experience they
 * use, and the three facts a parent checks before reading any number below.
 *
 * `disable` is the ACCOUNT flag, never the accessibility switch, so its warning
 * says «حساب» explicitly and its link goes to the screen that owns the account
 * and schedule controls.
 */
const props = defineProps<{
  report: ChildOverviewDto;
  /** The page's one clock reading. `undefined` keeps every relative time absolute. */
  now?: number;
}>();

const child = computed(() => props.report.child);
const general = computed(() => props.report.general);

const name = computed<string>(() => {
  const first = child.value.fullName?.first;

  return typeof first === "string" && first.trim().length > 0
    ? first.trim()
    : "فرزند شما";
});

/** The age the server stored — the report's own copy first, the profile second. */
const age = computed<number | null>(() => {
  const value = general.value.age ?? child.value.age;

  return typeof value === "number" && Number.isFinite(value) ? value : null;
});

const stage = computed(() => stageOfAge(age.value));

const avatar = computed<string | null>(() => {
  const value = general.value.avatar || child.value.avatar;

  return typeof value === "string" && value.trim().length > 0 ? value : null;
});

const fallbackAvatar = computed<string>(() =>
  stage.value === "child"
    ? "/images/panels/child-avatar.svg"
    : "/images/panels/teen-avatar.svg",
);

const stageLabel = computed<string>(() =>
  stage.value === "child" ? "کودک" : "نوجوان",
);

const stageTone = computed<string>(() =>
  stage.value === "child"
    ? "bg-x-kid-sun-100 text-x-kid-900"
    : "bg-x-teen-100 text-x-teen-700",
);

const status = computed<{ label: string; icon: string; tone: string }>(() => {
  if (general.value.disable) {
    return {
      label: "حساب غیرفعال",
      icon: "solar:danger-triangle-linear",
      tone: "bg-red-50 text-red-600",
    };
  }

  if (general.value.isOnline) {
    return {
      label: "آنلاین",
      icon: "solar:record-circle-linear",
      tone: "bg-emerald-50 text-emerald-700",
    };
  }

  const lastSeen = general.value.lastSeen;

  if (lastSeen !== null && Number.isFinite(lastSeen) && lastSeen > 0) {
    return {
      label: `آخرین حضور ${faRelative(lastSeen, props.now)}`,
      icon: "solar:clock-circle-linear",
      tone: "bg-x-parent-warm-100 text-x-text-subtitle",
    };
  }

  return {
    label: "وضعیت حضور نامشخص",
    icon: "solar:info-circle-linear",
    tone: "bg-x-parent-warm-100 text-x-text-subtitle",
  };
});

const accessLabel = computed<string>(() =>
  general.value.hasAccessCode ? "کد دسترسی فعال" : "بدون کد دسترسی",
);

const accessHref = computed<string>(() =>
  `/panels/parent/children/${child.value.userId}/access`,
);
</script>

<template>
  <section
    aria-labelledby="report-hero-name"
    class="neu-raised-lg relative overflow-hidden rounded-[2rem] bg-white p-5 text-start"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-10 -end-10 size-36 rounded-full bg-x-parent-100/60 blur-2xl"
    />

    <div class="relative flex items-start gap-3">
      <img
        v-if="avatar"
        :src="avatar"
        :alt="`تصویر ${name}`"
        class="size-16 shrink-0 rounded-2xl bg-x-parent-50 object-cover"
        width="64"
        height="64"
      >
      <img
        v-else
        :src="fallbackAvatar"
        alt=""
        aria-hidden="true"
        class="size-16 shrink-0 rounded-2xl bg-x-parent-50"
        width="64"
        height="64"
      >

      <div class="min-w-0 flex-1">
        <h2
          id="report-hero-name"
          class="break-words font-yekan-extra text-lg leading-7 text-x-text-title"
        >
          {{ name }}
        </h2>
        <p class="mt-1 text-xs leading-5 text-x-text-subtitle">
          <template v-if="age !== null">{{ faNumber(age) }} ساله</template>
          <template v-else>سن ثبت نشده</template>
        </p>
      </div>
    </div>

    <div class="relative mt-4 flex flex-wrap items-center gap-2">
      <span
        class="inline-flex min-h-8 items-center rounded-full px-2.5 py-1 text-[11px] font-yekan-bold"
        :class="stageTone"
      >
        {{ stageLabel }}
      </span>

      <span
        class="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-yekan-bold"
        :class="status.tone"
      >
        <UIcon :name="status.icon" size="14" aria-hidden="true" />
        <span class="break-words">{{ status.label }}</span>
      </span>

      <span
        class="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-yekan-bold"
        :class="
          general.hasAccessCode
            ? 'bg-x-parent-50 text-x-parent-700'
            : 'bg-x-parent-warm-100 text-x-text-subtitle'
        "
      >
        <UIcon name="solar:key-minimalistic-linear" size="14" aria-hidden="true" />
        {{ accessLabel }}
      </span>
    </div>

    <div
      v-if="general.disable"
      class="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-600"
    >
      <UIcon
        name="solar:danger-triangle-linear"
        size="14"
        class="shrink-0"
        aria-hidden="true"
      />
      <span>حساب این فرزند غیرفعال است.</span>
      <NuxtLink
        :to="accessHref"
        class="inline-flex min-h-11 items-center font-yekan-bold underline decoration-red-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        مدیریت دسترسی
      </NuxtLink>
    </div>
  </section>
</template>
