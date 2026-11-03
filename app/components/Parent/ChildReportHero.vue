<script setup lang="ts">
import { faNumber, faRelative } from "~/utils/fa";
import { stageOfAge, type ChildOverviewDto } from "~/types/parent-panel";

/**
 * The report's identity: who the report is about, which stage they are in and
 * whether they are in the app right now.
 *
 * ## WHY THIS IS NOT A CARD
 *
 * The child's name is the screen's subject, not one item among cards. It sits
 * directly on the ivory ground so the first thing read on the page is a name at
 * title size, and every white surface below it belongs to a section rather than
 * competing with the identity.
 *
 * ## WHY THE STAGE IS A WORD AND NOT A COLOURED CHIP
 *
 * «کودک» / «نوجوان» is a fact about an age the server stored, not a state that
 * changes something. A coloured pill here would be decoration on the one line a
 * parent reads first, and the panel's kid/teen accents belong to the children's
 * own panels.
 *
 * `disable` is the ACCOUNT flag, never the accessibility switch, so its warning
 * says «حساب» explicitly and links to the screen that owns the account and the
 * schedule.
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

/**
 * Presence as one quiet line: a 6px dot and words.
 *
 * The dot is the only colour and it is never the only signal — «آنلاین» and the
 * minutes «۳ دقیقه پیش» are in the text, so the state survives a reader who
 * cannot tell green from grey.
 */
const presence = computed<{ dot: string; label: string }>(() => {
  if (general.value.isOnline) {
    return { dot: "bg-emerald-500", label: "همین حالا آنلاین است" };
  }

  const lastSeen = general.value.lastSeen;

  if (lastSeen !== null && Number.isFinite(lastSeen) && lastSeen > 0) {
    return {
      dot: "bg-x-parent-300",
      label: `آخرین حضور ${faRelative(lastSeen, props.now)}`,
    };
  }

  return { dot: "bg-x-parent-300", label: "وضعیت حضور نامشخص" };
});

const accessHref = computed<string>(() =>
  `/panels/parent/children/${child.value.userId}/access`,
);
</script>

<template>
  <section aria-labelledby="report-identity-name" class="px-1">
    <div class="flex items-center gap-3.5">
      <img
        v-if="avatar"
        :src="avatar"
        :alt="`تصویر ${name}`"
        class="size-16 shrink-0 rounded-full bg-x-parent-50 object-cover"
        width="64"
        height="64"
      >
      <img
        v-else
        :src="fallbackAvatar"
        alt=""
        aria-hidden="true"
        class="size-16 shrink-0 rounded-full bg-x-parent-50"
        width="64"
        height="64"
      >

      <div class="min-w-0 flex-1">
        <h2
          id="report-identity-name"
          class="break-words font-yekan-extra text-xl leading-7 text-x-text-title"
        >
          {{ name }}
        </h2>

        <p class="mt-1 text-xs leading-5 text-x-text-subtitle">
          <template v-if="age !== null">
            {{ faNumber(age) }} ساله
          </template>
          <template v-else>
            سن ثبت نشده
          </template>
          <span aria-hidden="true"> · </span>
          {{ stageLabel }}
        </p>

        <p class="mt-1 flex items-center gap-1.5 text-xs leading-5 text-x-text-subtitle">
          <span
            aria-hidden="true"
            class="size-1.5 shrink-0 rounded-full"
            :class="presence.dot"
          />
          <span class="truncate">{{ presence.label }}</span>
        </p>
      </div>
    </div>

    <div
      v-if="general.disable"
      class="mt-3 rounded-2xl bg-red-50 px-3.5 py-3 text-xs leading-6 text-red-700"
    >
      حساب این فرزند غیرفعال است.
      <NuxtLink
        :to="accessHref"
        class="ms-1 inline-flex min-h-11 items-center font-yekan-bold underline decoration-red-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        مدیریت دسترسی
      </NuxtLink>
    </div>
  </section>
</template>
