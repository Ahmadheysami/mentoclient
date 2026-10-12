<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import type { ParentChildCardVm } from "~/types/parent-panel";

/**
 * One child, on one screen: who they are, which experience they use, and — when
 * `/child/stats` has answered — the two counters it reports.
 *
 * The whole card is the LINK to that child's page, which is what changed from
 * the prototype: it used to be an `<article>` with nothing behind it, so a card
 * that looked pressable but opened nothing was worse than one that was visibly a
 * summary. `nuxt-link` realises it as an `<a>`, so it is reachable, activatable
 * and announced by the platform with no `role`, no `tabindex` and no key handler.
 *
 * ## WHAT IS GONE, AND WHY IT MUST NOT COME BACK
 *
 * `weekProgress` + its bar, `streakDays`, `mood` and `lastActive` had NO backend
 * source — not a hidden endpoint, not a field this repo stopped reading: the
 * server never sends them. A `neu-inset` groove with a hand-written percentage
 * in it is the most convincing lie on this screen, because it looks measured, so
 * all four are deleted rather than filled with a plausible number.
 *
 * What replaced them is `counters`, and it is `null` until `/child/stats` has
 * answered — so the rows are omitted in that window instead of printing `۰`. A
 * counter that has not been read is not zero, and a family that sees «۰ آزمون»
 * before the first load is being told something untrue.
 *
 * Depth: Level 1 raised, on the panel's warm ivory ground — one shadow per card,
 * which is the right trade for a panel whose whole brief is calm.
 */
const props = defineProps<{ child: ParentChildCardVm }>();

/**
 * The local illustration a child with no avatar falls back to.
 *
 * Chosen by STAGE, not by gender: upstream stores `'male' | 'female' | 'other'`
 * and the two assets here are the two age registers this panel already owns.
 * `age` is the figure the server STORED at creation, so this branch reads no
 * clock and is byte-identical on the server render and at hydration.
 */
const fallbackAvatar = computed<string>(() =>
  props.child.stage === "child"
    ? "/images/panels/child-avatar.svg"
    : "/images/panels/teen-avatar.svg",
);
</script>

<template>
  <NuxtLink
    :to="`/panels/parent/children/${child.userId}`"
    class="neu-raised block rounded-3xl bg-white p-4 transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
  >
    <div class="flex items-center gap-3">
      <!--
        `alt=""` on the local illustration and not on a real avatar: the name is
        printed right beside the picture, so announcing it again is noise, and the
        artwork carries no information the text does not.
      -->
      <img
        v-if="child.avatar"
        :src="child.avatar"
        :alt="`تصویر ${child.name}`"
        class="size-12 shrink-0 rounded-2xl bg-x-parent-50 object-cover"
        width="48"
        height="48"
      >
      <img
        v-else
        :src="fallbackAvatar"
        alt=""
        aria-hidden="true"
        class="size-12 shrink-0 rounded-2xl bg-x-parent-50"
        width="48"
        height="48"
      >

      <div class="min-w-0 flex-1">
        <h3 class="truncate font-yekan-bold text-x-text-title">
          {{ child.name }}
          <span
            v-if="child.age !== null"
            class="text-sm font-yekan-regular text-x-text-subtitle"
          >· {{ faNumber(child.age) }} ساله</span>
        </h3>
        <!--
          A member-limit gate the reader can act on, not a warning about a child:
          `disable` is the ACCOUNT flag, never the accessibility one, so this says
          «حساب» explicitly and never calls it «دسترسی» (§0.2).
        -->
        <p
          v-if="child.disable"
          class="mt-0.5 truncate text-xs text-x-text-subtitle"
        >
          حساب این فرزند غیرفعال است
        </p>
        <p v-else-if="child.hasAccessCode" class="mt-0.5 truncate text-xs text-x-text-subtitle">
          کد دسترسی فعال
        </p>
      </div>

      <span
        class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-yekan-bold"
        :class="
          child.stage === 'child'
            ? 'bg-x-kid-sun-100 text-x-kid-900'
            : 'bg-x-teen-100 text-x-teen-700'
        "
      >
        {{ child.stage === "child" ? "کودک" : "نوجوان" }}
      </span>
    </div>

    <!--
      OMITTED, not zeroed, while `/child/stats` is unanswered — see the note at the
      top of this file. `v-if` on the wrapper rather than on each figure, because a
      half-printed row («۰ آزمون ·» with no second figure) is worse than no row.
    -->
    <dl
      v-if="child.counters !== null"
      class="mt-3 flex items-center gap-4 text-xs text-x-text-subtitle"
    >
      <div class="flex min-w-0 items-center gap-1.5">
        <UIcon
          name="solar:clipboard-list-linear"
          size="14"
          class="shrink-0 text-x-parent-500"
          aria-hidden="true"
        />
        <dt class="sr-only">آزمون‌ها</dt>
        <dd class="truncate">{{ faNumber(child.counters.testResults) }} آزمون</dd>
      </div>

      <div class="flex min-w-0 items-center gap-1.5">
        <UIcon
          name="solar:pulse-2-linear"
          size="14"
          class="shrink-0 text-x-parent-500"
          aria-hidden="true"
        />
        <dt class="sr-only">فعالیت‌ها</dt>
        <dd class="truncate">{{ faNumber(child.counters.activities) }} فعالیت</dd>
      </div>

      <UIcon
        name="solar:alt-arrow-left-linear"
        size="16"
        class="ms-auto shrink-0 text-x-parent-300"
        aria-hidden="true"
      />
    </dl>
  </NuxtLink>
</template>
