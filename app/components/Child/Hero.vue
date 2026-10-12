<script setup lang="ts">
import { gsap } from "gsap";
import { faNumber } from "~/utils/fa";

const childPanel = useChildPanel();

const greetingKidEl = ref<HTMLElement | null>(null);
const greetingTeenEl = ref<HTMLElement | null>(null);
let heroCtx: gsap.Context | undefined;

onMounted(() => {
  const el = greetingKidEl.value ?? greetingTeenEl.value;

  // Reduced motion: skip the tween entirely — the markup already
  // renders the final state, so there is nothing to "set".
  if (
    !el ||
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  heroCtx = gsap.context(() => {
    gsap.fromTo(
      el.children,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.08,
        ease: childPanel.variant === "child" ? "back.out(1.4)" : "power2.out",
      },
    );
  });
});

onUnmounted(() => {
  heroCtx?.revert();
});

const profile = computed(() => childPanel.state.profile);

const firstName = computed(() => profile.value?.fullName?.first ?? "");

/**
 * Which of the two hand-made 3D kids the hero shows.
 *
 * Upstream stores `'male' | 'female' | 'other'`. The narrowing is the point:
 * `'other'` or an absent gender resolves to `null`, and the hero then renders
 * the child's AVATAR (falling back to the stage illustration) — it never
 * guesses at artwork for a child whose gender it does not know.
 */
const kidArt = computed(() => {
  const gender = profile.value?.gender;

  if (gender === "female")
    return { src: "/images/panels/kid-3d-girl.svg", label: "دختر" };

  if (gender === "male")
    return { src: "/images/panels/kid-3d-boy.svg", label: "پسر" };

  return null;
});

const avatarSrc = computed(
  () =>
    profile.value?.avatar ??
    (childPanel.variant === "child"
      ? "/images/panels/child-avatar.svg"
      : "/images/panels/teen-avatar.svg"),
);

/** The hero's one derived sentence: how many startable exams are waiting. */
const readyLine = computed(
  () => `${faNumber(childPanel.availableTests.length)} آزمون برایت آماده است`,
);

const remaining = computed(() => childPanel.remainingAttempts);
const completed = computed(() => childPanel.completedCount);

/**
 * The remaining attempts as a share of the whole budget.
 *
 * The bar is the child's remaining budget: what they may still spend across
 * every assigned exam. `state.available` carries the budget (expired or
 * used-up included — an expired exam the child can no longer spend is still
 * budget the parent bought), and the level bar from the prototype becomes
 * exactly this bar. When nothing is assigned the bar is empty, never `NaN`.
 */
const totalAttempts = computed(() =>
  childPanel.state.available.reduce(
    (sum, asset) =>
      sum + (Number.isFinite(asset.usageLimit) ? Math.max(0, asset.usageLimit) : 0),
    0,
  ),
);

const remainingPct = computed(() =>
  totalAttempts.value > 0
    ? Math.min(100, Math.round((remaining.value / totalAttempts.value) * 100))
    : 0,
);
</script>

<template>
  <!--
    Two full compositions, switched by the DERIVED variant — not a recolored one.
    Kid: sunny greeting, a 3D character, sticker dots, chunky level bar.
    Teen: editorial headline, quiet avatar, thin progress, no stickers.
    Both heroes sit at Level 3 (`.neu-raised-lg`); only the data changed:
    `level/xp/xpToNext` and a fake summary became a remaining-attempts bar and
    two real counters, and the derived one-liner replaces the deleted tagline.
  -->

  <section v-if="childPanel.variant === 'child'" class="neu-raised-lg relative overflow-hidden rounded-[2rem] bg-x-kid-100 p-5">
    <img
      src="/images/panels/kid-blob.svg"
      alt=""
      aria-hidden="true"
      class="absolute -top-6 start-[-1.5rem] size-28 opacity-90"
      width="112"
      height="112"
    >
    <img
      src="/images/panels/kid-3d-mascot.svg"
      alt=""
      aria-hidden="true"
      class="neu-float motion-reduce:animation-none absolute top-12 start-[-0.75rem] size-12"
      width="48"
      height="48"
    >

    <div class="relative flex items-end gap-3">
      <img
        v-if="kidArt"
        :src="kidArt.src"
        :alt="`تصویر سه‌بعدی ${kidArt.label} — ${firstName}`"
        class="kid-hero-art motion-reduce:animation-none size-28 shrink-0"
        width="112"
        height="112"
      >
      <img
        v-else
        :src="avatarSrc"
        alt=""
        aria-hidden="true"
        class="kid-hero-art motion-reduce:animation-none size-28 shrink-0 rounded-3xl object-cover"
        width="112"
        height="112"
      >

      <div ref="greetingKidEl" class="kid-hero-copy motion-reduce:animation-none">
        <p class="text-sm font-yekan-bold text-x-kid-900">سلام {{ firstName }}!</p>
        <h2 class="mt-0.5 font-yekan-extra text-xl text-x-text-title">
          {{ readyLine }}
        </h2>
      </div>
    </div>

    <div class="neu-inset relative mt-4 rounded-2xl bg-white/60 p-3">
      <div class="flex items-center justify-between text-xs font-yekan-bold text-x-kid-900">
        <span>آزمون باقی‌مانده</span>
        <span>{{ faNumber(remaining) }} از {{ faNumber(totalAttempts) }}</span>
      </div>
      <div
        class="mt-2 h-4 overflow-hidden rounded-full bg-x-kid-sun-100"
        role="progressbar"
        :aria-valuenow="remaining"
        aria-valuemin="0"
        :aria-valuemax="Math.max(totalAttempts, 1)"
        aria-label="آزمون باقی‌مانده"
      >
        <div
          class="h-full rounded-full bg-x-kid-sun-700 transition-[width] duration-500 ease-soft motion-reduce:transition-none"
          :style="{ width: `${remainingPct}%` }"
        />
      </div>
    </div>

    <dl class="relative mt-4 grid grid-cols-2 gap-2">
      <div class="neu-inset min-w-0 rounded-2xl bg-white/60 p-3 text-center">
        <dt class="text-[11px] text-x-text-subtitle">آزمون باقی‌مانده</dt>
        <dd class="mt-0.5 truncate font-yekan-extra text-base text-x-kid-900">
          {{ faNumber(remaining) }}
        </dd>
      </div>
      <div class="neu-inset min-w-0 rounded-2xl bg-white/60 p-3 text-center">
        <dt class="text-[11px] text-x-text-subtitle">آزمون انجام‌شده</dt>
        <dd class="mt-0.5 truncate font-yekan-extra text-base text-x-kid-900">
          {{ faNumber(completed) }}
        </dd>
      </div>
    </dl>
  </section>

  <section
    v-else
    class="neu-raised-lg relative overflow-hidden rounded-2xl bg-linear-to-br from-x-teen-violet-300/45 via-x-teen-100 to-x-teen-teal-300/60 p-5"
  >
    <img
      src="/images/panels/teen-blob.svg"
      alt=""
      aria-hidden="true"
      class="absolute -top-4 start-[-1rem] size-24 opacity-50"
      width="96"
      height="96"
    >
    <div class="relative flex items-center gap-4">
      <img
        :src="avatarSrc"
        :alt="`تصویر ${firstName}`"
        class="size-14 rounded-full ring-2 ring-x-teen-violet-300"
        width="56"
        height="56"
      >
      <div ref="greetingTeenEl" class="min-w-0">
        <p class="inline-flex rounded-full bg-x-teen-violet-300/55 px-2 py-0.5 text-[11px] font-yekan-bold text-x-teen-800">
          سطوح رشدت
        </p>
        <h2 class="truncate mt-1 font-yekan-bold text-lg text-x-text-title">
          {{ firstName }} · {{ readyLine }}
        </h2>
      </div>
    </div>

    <div class="relative mt-4">
      <div class="flex items-center justify-between text-[11px] font-yekan-bold text-x-text-subtitle">
        <span>آزمون باقی‌مانده</span>
        <span>{{ faNumber(remaining) }} / {{ faNumber(totalAttempts) }}</span>
      </div>
      <div
        class="neu-inset mt-2 h-2 overflow-hidden rounded-full bg-x-teen-200/60"
        role="progressbar"
        :aria-valuenow="remaining"
        aria-valuemin="0"
        :aria-valuemax="Math.max(totalAttempts, 1)"
        aria-label="آزمون باقی‌مانده"
      >
        <div
          class="h-full rounded-full bg-x-teen-mint-700 transition-[width] duration-500 ease-soft motion-reduce:transition-none"
          :style="{ width: `${remainingPct}%` }"
        />
      </div>
    </div>

    <dl class="relative mt-4 grid grid-cols-2 gap-2">
      <div class="neu-inset min-w-0 rounded-xl bg-white/70 p-3 text-center">
        <dt class="text-[11px] text-x-text-subtitle">آزمون باقی‌مانده</dt>
        <dd class="mt-0.5 truncate font-yekan-extra text-base text-x-teen-800">
          {{ faNumber(remaining) }}
        </dd>
      </div>
      <div class="neu-inset min-w-0 rounded-xl bg-white/70 p-3 text-center">
        <dt class="text-[11px] text-x-text-subtitle">آزمون انجام‌شده</dt>
        <dd class="mt-0.5 truncate font-yekan-extra text-base text-x-teen-800">
          {{ faNumber(completed) }}
        </dd>
      </div>
    </dl>
  </section>
</template>
