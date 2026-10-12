<script setup lang="ts">
/**
 * «مشاوره و کوچینگ» — the Consulting & Coaching locked demo.
 *
 * ## WHAT THIS CARD PROMISES
 *
 * A future directory of organizational psychologists, management coaches
 * and career advisors available for one-on-one sessions. Today it is a
 * locked visual preview showing three fictional consultant profiles.
 *
 * ## CONSULTANT CARDS ARE FICTIONAL
 *
 * Three invented profiles with colored avatar circles (initials, not
 * photos), fictional names, and specialty labels. No real consultant data
 * is shown. The cards are `aria-hidden` because they are purely visual —
 * the card's heading and description already explain the feature.
 *
 * ## SPECIALTY LABELS
 *
 * Each consultant has one or two specialty tags (e.g. "روانشناس سازمانی").
 * These are small rounded pills with a subtle tint, arranged in a flex-wrap
 * row. The labels are Persian and describe real consulting specializations,
 * but the people they are attached to are fictional.
 *
 * ## LOCK INDICATOR
 *
 * Same gold «به‌زودی» badge pattern. The CTA is a disabled `UButton`.
 */

/**
 * One fictional consultant profile.
 *
 * `name` is the fictional full name. `initials` are one or two Persian
 * characters for the avatar circle. `specialties` is an array of
 * Persian specialty labels. `color` indexes into the pastel avatar palette.
 */
interface FictionalConsultant {
  name: string;
  initials: string;
  specialties: string[];
  color: number;
}

/**
 * Three illustrative consultant profiles.
 *
 * ⚠️ ALL DATA IS FICTIONAL. These consultants do not exist.
 */
const consultants: FictionalConsultant[] = [
  {
    name: "دکتر زهرا اسماعیلی",
    initials: "ز",
    specialties: ["روانشناس سازمانی", "مدیریت استرس"],
    color: 0,
  },
  {
    name: "مهندس رضا قاسمی",
    initials: "ر",
    specialties: ["مربی مدیریت"],
    color: 1,
  },
  {
    name: "خانم لیلا نوری",
    initials: "ل",
    specialties: ["مشاور شغلی", "توسعهٔ فردی"],
    color: 2,
  },
];

/**
 * The pastel avatar background classes.
 *
 * Three tints cycling so each consultant has a distinct avatar colour.
 * Same palette family as the radar avatars and job cards.
 */
const AVATAR_TINTS = [
  "bg-x-sky-100 text-x-sky-700",
  "bg-x-lime-100 text-x-text-title",
  "bg-x-mist-200 text-x-text-subtitle",
];
</script>

<template>
  <section
    aria-labelledby="employee-consulting-heading"
    class="rounded-4xl bg-white p-4 ring-1 ring-x-sky-300"
  >
    <!-- ===== Header ===== -->
    <div class="flex items-start gap-3">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-2xl bg-x-sky-100 text-x-text-title"
        aria-hidden="true"
      >
        <UIcon name="solar:users-group-rounded-linear" size="20" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <h3
            id="employee-consulting-heading"
            class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-x-text-title"
          >
            مشاوره و کوچینگ
          </h3>

          <UBadge
            color="warning"
            class="shrink-0"
            :ui="{
              base: 'gap-1.5 rounded-full bg-x-gold-200 px-2.5 py-0.5 text-[11px] leading-5 font-yekan-bold font-normal text-x-gold-700 ring-1 ring-x-gold-500/40',
            }"
          >
            <span
              class="size-1.5 shrink-0 rounded-full bg-x-gold-700"
              aria-hidden="true"
            />
            به‌زودی
          </UBadge>
        </div>

        <p class="mt-1.5 text-xs leading-6 text-x-text-subtitle">
          دسترسی به مشاوران و مربیان تخصصی برای جلسات مشاورهٔ یک‌به‌یک.
        </p>
      </div>
    </div>

    <!-- ===== Fictional consultant cards ===== -->
    <div
      class="mt-4 flex flex-col gap-3"
      aria-hidden="true"
    >
      <div
        v-for="consultant in consultants"
        :key="consultant.name"
        class="flex items-start gap-3 rounded-2xl bg-x-mist-50 p-3 ring-1 ring-x-sky-200"
      >
        <!-- Avatar circle with initials -->
        <span
          class="grid size-10 shrink-0 place-items-center rounded-full font-yekan-bold text-sm ring-2 ring-white"
          :class="AVATAR_TINTS[consultant.color % AVATAR_TINTS.length]"
        >
          {{ consultant.initials }}
        </span>

        <div class="min-w-0 flex-1">
          <!-- Name -->
          <p class="truncate font-yekan-bold text-sm leading-6 text-x-text-title">
            {{ consultant.name }}
          </p>

          <!-- Specialty labels -->
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <span
              v-for="specialty in consultant.specialties"
              :key="specialty"
              class="rounded-full bg-white px-2.5 py-0.5 text-[11px] leading-5 text-x-text-subtitle ring-1 ring-x-sky-200"
            >
              {{ specialty }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== CTA ===== -->
    <UButton
      block
      color="x-primary"
      size="lg"
      class="mt-4"
      disabled
    >
      مشاهدهٔ مشاوران
    </UButton>
  </section>
</template>
