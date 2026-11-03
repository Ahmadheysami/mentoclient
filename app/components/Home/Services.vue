<script setup lang="ts">
/**
 * Home services grid + the Mentoya Pro banner above it.
 *
 * ## THE FIRST FOUR ARE THE ACTIVE FOUR
 *
 * The client asked for the four live services — Mentou AI, Cafés, Blog and
 * Tests — to share the **first row**. The active grid is `grid-cols-2` and DOM
 * order is reading order in RTL, so the order of `services` IS the layout: the
 * first four entries fill the 2×2 block, everything after them drops into the
 * locked box. Re-sorting this array changes the layout, so add new ACTIVE
 * services here.
 *
 * ## EACH ACTIVE SERVICE OWNS A TINT
 *
 * `tone` keys into `tones` below, which holds the full class strings (Tailwind
 * only sees the literals, so these cannot be built by interpolation). The tint
 * makes four sibling tiles readable at a glance instead of four identical grey
 * squares, and it matches the service's mood: warm for the café, calm green for
 * the tests, the quiz pink for the blog.
 *
 * ## INACTIVE CARDS ARE NOT LINKS
 *
 * A locked service renders as a `<div>` with no `to`, no tab stop and
 * `aria-disabled`: it used to be a `ULink` to `#`, which looked and behaved like
 * navigation. It sits in a separate, quieter box under a lock caption and shows
 * the client's short English label (`AC`, `MA`, `ES`, `EM`, `LE`, `C&M`, `ML`,
 * `SIM`) instead of its full Persian title. `SIM` is provisional — the client
 * gave no abbreviation for the simulator and the project defines none.
 */

/** Active-card tints. Full class strings: Tailwind cannot see interpolation. */
const tones = {
  indigo: {
    card: "from-x-secondary-50 ring-x-secondary-100 hover:ring-x-secondary-300 hover:shadow-x-secondary-500/10",
    icon: "bg-x-secondary-100/80 text-x-secondary-600",
  },
  orange: {
    card: "from-orange-50 ring-orange-100 hover:ring-orange-300 hover:shadow-orange-500/10",
    icon: "bg-orange-100 text-orange-600",
  },
  rose: {
    card: "from-rose-50 ring-rose-100 hover:ring-rose-300 hover:shadow-rose-500/10",
    icon: "bg-rose-100 text-rose-500",
  },
  emerald: {
    card: "from-emerald-50 ring-emerald-100 hover:ring-emerald-300 hover:shadow-emerald-500/10",
    icon: "bg-emerald-100 text-emerald-600",
  },
};

interface HomeService {
  slug: string;
  label: string;
  icon: string;
  /** Live services navigate; locked ones are inert and rendered greyed. */
  active: boolean;
  /** Only for an active service. */
  to?: string;
  /** One-line description, active services only. */
  hint?: string;
  /** Small "new" dot, for an active service that wants one. */
  dot?: boolean;
  /** Key into `tones`; active services only. */
  tone?: keyof typeof tones;
}

const services: HomeService[] = [
  // ① The 2×2 block: all four active services, in the client's order.
  {
    slug: "bot",
    label: "منتو بات",
    icon: "solar:star-bold-duotone",
    active: true,
    to: "/mentobot",
    hint: "چت‌بات هوشمند",
    tone: "indigo",
  },
  {
    slug: "cafe",
    label: "کافه منتویا",
    icon: "solar:cup-hot-bold-duotone",
    active: true,
    to: "/cafe",
    hint: "گفت‌وگوی زنده",
    tone: "orange",
  },
  {
    slug: "blog",
    label: "بلاگ",
    icon: "solar:pen-new-round-bold-duotone",
    active: true,
    to: "/blog",
    hint: "مقاله و محتوا",
    dot: true,
    tone: "rose",
  },
  {
    slug: "test",
    label: "تست ها",
    icon: "solar:notes-minimalistic-bold-duotone",
    active: true,
    to: "/test",
    hint: "آزمون روان‌شناسی",
    tone: "emerald",
  },

  // ② Locked services. Short English labels, deliberately not the Persian
  //    titles: `EMP`-style rows must never read as available features.
  {
    slug: "shop",
    label: "MA",
    icon: "solar:shop-2-bold-duotone",
    active: false,
  },
  {
    slug: "academy",
    label: "AC",
    icon: "solar:square-academic-cap-2-bold-duotone",
    active: false,
  },
  {
    slug: "studio",
    label: "ES",
    icon: "solar:headphones-square-bold-duotone",
    active: false,
  },
  {
    slug: "este",
    label: "EM",
    icon: "solar:user-speak-rounded-bold-duotone",
    active: false,
  },
  {
    slug: "league",
    label: "LE",
    icon: "solar:cup-bold-duotone",
    active: false,
  },
  {
    slug: "coach",
    label: "C&M",
    icon: "solar:user-hand-up-bold-duotone",
    active: false,
  },
  {
    slug: "microlearning",
    label: "ML",
    icon: "solar:clapperboard-open-play-outline",
    active: false,
  },
  {
    slug: "simulator",
    label: "SIM",
    icon: "solar:glasses-bold-duotone",
    active: false,
  },
];

const activeServices = computed(() => services.filter((item) => item.active));
const lockedServices = computed(() => services.filter((item) => !item.active));
</script>

<template>
  <!--
    Mentoya Pro banner.

    A full card rather than the old pill, so the offer has somewhere to breathe:
    deep indigo-to-blue ground, two blurred colour orbs at opposite corners, a
    faint dot texture and a slow sheen that crosses the card. The copy is short
    and the CTA is one round arrow, so the treatment carries the weight.

    All motion is the sheen and the arrow nudge on hover; both reduced-motion
    switches this app supports turn them off. `mx-4` (no `max-w-sm`) makes the
    banner as wide as the page column, so it lines up with the carousel and the
    service grid instead of sitting inset from all three.
  -->
  <NuxtLink
    to="/plans"
    class="group relative mx-4 my-3 block overflow-hidden rounded-3xl bg-linear-135 from-x-secondary-800 via-x-secondary-700 to-x-primary-700 p-4 text-white shadow-xl shadow-x-secondary-900/25 ring-1 ring-white/10 transition-shadow duration-300 outline-none hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-x-primary-600"
  >
    <!-- Colour orbs: the depth the flat gradient was missing. -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute -start-10 -top-12 size-36 rounded-full bg-x-primary-400/40 blur-2xl"
    />
    <span
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-14 -end-8 size-40 rounded-full bg-x-quiz-accent/25 blur-2xl"
    />
    <!-- Dot texture + travelling sheen, both purely decorative. -->
    <span aria-hidden="true" class="pro-dots absolute inset-0" />
    <span aria-hidden="true" class="pro-sheen absolute inset-0" />

    <div class="relative flex items-start justify-between gap-3">
      <div class="min-w-0">
        <span
          class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white/90 backdrop-blur-sm"
        >
          <UIcon
            name="solar:crown-star-bold-duotone"
            size="14"
            aria-hidden="true"
          />
          منتویا پرو
        </span>

        <strong class="mt-2 block font-liana! text-xl leading-6 text-white">
          پنل‌های منتویا پرو
        </strong>
      </div>

      <span
        class="grid size-10 shrink-0 place-items-center rounded-full bg-white text-x-secondary-700 shadow-lg shadow-x-secondary-900/30 transition-transform duration-200 group-hover:-translate-x-0.5"
      >
        <UIcon name="solar:arrow-left-linear" size="20" aria-hidden="true" />
      </span>
    </div>
  </NuxtLink>

  <section data-scroll-reveal class="mb-5 mt-3 px-8">
    <div class="mb-2.5 flex items-end justify-between px-0.5">
      <div>
        <h2 class="text-sm font-bold text-x-text-title">سرویس‌های منتویا</h2>
        <p class="mt-0.5 text-xs text-slate-400">
          دسترسی سریع به بخش‌های اصلی
        </p>
      </div>
      <span
        class="rounded-full bg-x-secondary-50 px-2 py-1 text-xs font-bold text-x-secondary-600"
      >
        {{ activeServices.length }} سرویس فعال
      </span>
    </div>

    <!-- Four live services, 2×2, each with its own tint and one-line hint. -->
    <div class="grid grid-cols-2 gap-2.5">
      <ULink
        v-for="item of activeServices"
        :key="item.slug"
        :to="item.to"
        class="group flex items-center gap-2.5 rounded-2xl bg-linear-180 to-white p-2.5 shadow-xs ring-1 transition duration-200 outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-600 active:translate-y-0"
        :class="tones[item.tone ?? 'indigo'].card"
      >
        <span
          class="grid size-11 shrink-0 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
          :class="tones[item.tone ?? 'indigo'].icon"
        >
          <UChip
            v-if="item.dot"
            position="top-left"
            size="sm"
            :ui="{ base: 'bg-x-quiz-accent' }"
          >
            <UIcon :name="item.icon" size="24" />
          </UChip>
          <UIcon v-else :name="item.icon" size="24" />
        </span>

        <span class="min-w-0 flex-1">
          <span
            class="block truncate text-sm font-bold leading-5 text-x-text-title"
          >
            {{ item.label }}
          </span>
          <span class="block truncate text-xs leading-4 text-slate-500">
            {{ item.hint }}
          </span>
        </span>
      </ULink>
    </div>

    <!-- Locked services: a quiet, self-contained box so the row reads as
         "not yet" rather than as more launcher tiles. -->
    <div class="mt-3 rounded-2xl bg-slate-50/80 p-2 ring-1 ring-slate-100">
      <div class="mb-1.5 flex items-center gap-1.5 px-1">
        <UIcon
          name="solar:lock-keyhole-minimalistic-linear"
          size="13"
          class="text-slate-400"
        />
        <span class="text-xs font-bold text-slate-500">سرویس‌های آینده</span>
      </div>

      <div class="grid grid-cols-4 gap-1.5">
        <div
          v-for="item of lockedServices"
          :key="item.slug"
          aria-disabled="true"
          class="flex cursor-default items-center justify-center gap-1 rounded-xl bg-white px-1 py-2 ring-1 ring-slate-200/70"
        >
          <UIcon
            :name="item.icon"
            size="14"
            class="shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <span
            class="truncate text-xs font-semibold leading-4 text-slate-500"
            dir="ltr"
          >
            {{ item.label }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
/* Faint dot texture — a highlight on the gradient, not a pattern to read. */
.pro-dots {
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.4) 1px,
    transparent 1px
  );
  background-size: 14px 14px;
  opacity: 0.22;
  -webkit-mask-image: linear-gradient(to bottom, #000 10%, transparent 85%);
  mask-image: linear-gradient(to bottom, #000 10%, transparent 85%);
}

/* A slow diagonal sheen. 9s and low opacity keep it from pulsing like a CTA. */
.pro-sheen {
  background-image: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 255, 255, 0.22) 48%,
    transparent 62%
  );
  background-size: 250% 100%;
  animation: pro-sheen-pass 9s ease-in-out infinite;
}

@keyframes pro-sheen-pass {
  0%,
  100% {
    background-position: 130% 0;
  }
  55%,
  90% {
    background-position: -30% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pro-sheen {
    animation: none;
    background-image: none;
  }
}

html[data-motion="reduced"] .pro-sheen {
  animation: none;
  background-image: none;
}
</style>
