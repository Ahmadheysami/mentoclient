<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * «مشاوره و کوچینگ» — the Consulting & Coaching feature: a locked preview
 * of the consultant directory this panel will offer.
 *
 * ## WHAT THIS PAGE PROMISES
 *
 * A future directory of organizational psychologists, management coaches
 * and career advisors available for one-on-one sessions. Today it is a
 * locked visual preview showing three fictional consultant profiles.
 *
 * ## EVERYTHING HERE IS FICTIONAL
 *
 * The consultant names, specialties, ratings and avatar initials are all
 * invented data hard-coded in this file. No API call is made and no real
 * user data is rendered. The page exists to show the reader what the feature
 * WILL look like when it ships. The lock is communicated three ways,
 * consistent with the rest of the employer panel:
 *
 *   1. A gold «به‌زودی» badge in the header (same token, same ring, same
 *      `font-yekan-bold font-normal` pairing as `ComingSoonCard.vue`).
 *   2. A `UButton` with `:disabled="true"` — visibly greyed, non-operational,
 *      but still a real `<button>` element in the DOM so a screen reader
 *      announces it as disabled rather than absent.
 *   3. A short paragraph stating plainly that the data is illustrative.
 *
 * ## THE SHADCN/UI-INSPIRED LIGHT THEME IS THE PAGE'S VISUAL IDENTITY
 *
 * The redesign moves this page to the employer panel's shadcn/ui-inspired
 * system: white cards, avatar circles tinted with the indigo accent at low
 * opacity, the star rating in amber (universal star convention), and
 * specialty chips in white with a hairline. The subject is people helping
 * people, and the page's design still says so — no sharp edges, no pipeline,
 * just faces and names and the things they are good at — but in the
 * shadcn/ui palette the rest of the panel speaks.
 *
 * ## AVATARS ARE INITIALS, NOT PHOTOS
 *
 * Every fictional consultant is represented by a coloured circle with
 * their initial in Persian. No `<img>`, no external URL, no real face. The
 * background colours cycle through the employer accent at two opacities
 * and the gray surface, so each avatar is visually distinct without
 * introducing a new hue family.
 *
 * ## RATINGS ARE SHOWN, NOT JUST STATED
 *
 * Each consultant carries a numeric rating beside a star glyph — «۴.۸» with
 * a `solar:star-bold` icon — because trust is the currency of a consulting
 * directory and a rating is the single most trust-bearing number on a
 * profile card. The star is amber (universal convention for ratings). The
 * ratings are fictional, like everything else here.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "مشاوره و کوچینگ",
});

useSeoMeta({
  title: "مشاوره و کوچینگ",
});

/**
 * One fictional consultant profile.
 *
 * `name` is the fictional full name. `initials` are one Persian character
 * for the avatar circle. `specialties` is an array of Persian specialty
 * labels. `rating` is the fictional rating, 1..5 with one decimal.
 * `color` indexes into the pastel avatar palette below.
 */
interface FictionalConsultant {
  name: string;
  initials: string;
  specialties: string[];
  rating: number;
  color: number;
}

/**
 * Three illustrative consultant profiles.
 *
 * The three cover different specializations — organizational psychology,
 * management coaching, career advisory — so the directory reads as varied
 * rather than as three copies of one person.
 *
 * ⚠️ ALL DATA IS FICTIONAL. These consultants do not exist.
 */
const consultants: FictionalConsultant[] = [
  {
    name: "دکتر زهرا اسماعیلی",
    initials: "ز",
    specialties: ["روانشناس سازمانی", "مدیریت استرس"],
    rating: 4.8,
    color: 0,
  },
  {
    name: "مهندس رضا قاسمی",
    initials: "ر",
    specialties: ["مربی مدیریت"],
    rating: 4.6,
    color: 1,
  },
  {
    name: "لیلا نوری",
    initials: "ل",
    specialties: ["مشاور شغلی", "توسعهٔ فردی"],
    rating: 4.9,
    color: 2,
  },
];

/**
 * The avatar background classes.
 *
 * Three shadcn/ui-inspired tints cycling so each consultant has a distinct
 * avatar colour: indigo at 10%, indigo at 20%, and the gray surface —
 * each with the panel's own ink so the initial clears it.
 */
const AVATAR_TINTS = [
  "bg-indigo-50 text-indigo-600",
  "bg-indigo-100 text-indigo-700",
  "bg-gray-50 text-gray-600 border border-gray-200",
];
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      One card for the whole page, matching the radar and recruitment pages'
      structure so the four feature pages read as a set. `rounded-xl
      bg-white p-4 shadow-sm border border-gray-200` is the employer panel's
      shadcn/ui-inspired standard card surface.
    -->
    <section
      aria-labelledby="employer-consulting-heading"
      class="rounded-xl bg-white p-4 shadow-sm border border-gray-200"
    >
      <!-- ===== Header: icon chip + title + «به‌زودی» badge ===== -->
      <div class="flex items-start gap-3">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
          aria-hidden="true"
        >
          <UIcon name="solar:users-group-rounded-linear" size="18" />
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-2">
            <h2
              id="employer-consulting-heading"
              class="min-w-0 flex-1 font-yekan-bold text-sm leading-6 text-gray-900"
            >
              مشاوره و کوچینگ
            </h2>

            <!--
              The gold «به‌زودی» badge — identical pattern to
              ComingSoonCard.vue. See the file header for why the
              `font-yekan-bold font-normal` pairing is required.
            -->
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

          <p class="mt-1 text-xs leading-5 text-gray-500">
            دسترسی به مشاوران و مربیان تخصصی برای جلسات مشاورهٔ یک‌به‌یک.
          </p>
        </div>
      </div>

      <!-- ===== Fictional consultant cards ===== -->
      <!--
        Three consultant cards in a vertical stack. Each card is `aria-hidden`
        because the profiles are illustrative previews — the card's heading
        and description already explain the feature, and a screen reader
        does not need to hear a fictional person's name and rating.

        The cards are `bg-gray-50` with a hairline — one step
        off the white card they sit in, the same layering the radar
        and recruitment pages use — and the avatar's `ring-2` is white,
        so the circle reads as a framed portrait on the light ground.
      -->
      <div class="mt-4 flex flex-col gap-3" aria-hidden="true">
        <div
          v-for="consultant in consultants"
          :key="consultant.name"
          class="flex items-start gap-3 rounded-lg bg-gray-50 p-3 border border-gray-200"
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
            <p class="truncate font-yekan-bold text-sm leading-6 text-gray-900">
              {{ consultant.name }}
            </p>

            <!-- Rating: star glyph + numeric value -->
            <div class="mt-0.5 flex items-center gap-1">
              <UIcon
                name="solar:star-bold"
                size="14"
                class="shrink-0 text-amber-400"
              />
              <span class="text-[11px] leading-5 text-gray-500">
                {{ faNumber(consultant.rating) }}
              </span>
            </div>

            <!-- Specialty labels -->
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span
                v-for="specialty in consultant.specialties"
                :key="specialty"
                class="rounded-full bg-white px-2.5 py-0.5 text-[11px] leading-5 text-gray-600 border border-gray-200"
              >
                {{ specialty }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Explanation ===== -->
      <p class="mt-4 text-xs leading-5 text-gray-500">
        این صفحه پیش‌نمایشی از قابلیت مشاوره و کوچینگ است. مشاوران، تخصص‌ها و
        امتیازها کاملاً فرضی و برای نمایش شکل ابزار در نظر گرفته شده‌اند.
      </p>

      <!-- ===== CTA — disabled, clearly locked ===== -->
      <!--
        The locked CTA is the employer accent with white-on-indigo ink — the
        panel's primary-action pairing. The `:ui` override is the same
        technique `Test/ActiveCard.vue` uses for its own button.
      -->
      <UButton
        block
        color="x-primary"
        size="lg"
        class="mt-4"
        disabled
        :ui="{ base: 'bg-indigo-600! text-white! hover:bg-indigo-700!' }"
      >
        رزرو جلسهٔ مشاوره
      </UButton>
    </section>
  </div>
</template>
