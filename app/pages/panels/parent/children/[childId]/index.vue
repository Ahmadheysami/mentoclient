<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import { stageOfAge } from "~/types/parent-panel";

/**
 * One child's screen: who they are, what their counters say, what is on their log,
 * and the two things a parent can decide about them.
 *
 * ## WHY A MISSING CHILD IS NOT AN ERROR STATE UNDER A SPINNER
 *
 * `loadChild` writes `detail[userId]` ONLY when the profile read succeeded, so
 * «no entry» is exactly one thing — the server would not describe this child — and
 * it is the state «این فرزند پیدا نشد» is written for. No reason code is invented
 * to tell it apart from loading: `loading.detail[childId]` is a separate flag, and
 * while it is set none of this renders at all.
 *
 * ## WHY THE TWO DECISIONS ARE LINKS AND NOT BUTTONS HERE
 *
 * «آزمون‌های فرزند» and «دسترسی» each own a screen with their own loading, their
 * own states and their own back navigation, and both are reachable by URL — which
 * is what makes them linkable and revisitable rather than only reachable from this
 * one row.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "فرزند",
});

useSeoMeta({ title: "پروفایل فرزند" });

const route = useRoute();
const parentPanel = useParentPanel();

/** The route param as a plain id — `String`, because a param may arrive repeated. */
const childId = computed<string>(() => String(route.params.childId ?? ""));

/**
 * The page's ONE clock reading, for the relative times on the log below.
 *
 * `undefined` until mount, so the server render and the client's first paint both
 * produce the deterministic absolute date, and only a mounted client says
 * «۳ دقیقه پیش». A `Date.now()` inside a render computed would be a different
 * string on the two sides, which Vue reports as a hydration mismatch.
 */
const now = ref<number>();

onMounted(() => {
  now.value = Date.now();
  void parentPanel.loadChild(childId.value);
});

const isLoading = computed<boolean>(
  () => parentPanel.state.loading.detail[childId.value] === true,
);

/** This child's entry, or `null` before it has been written. */
const detail = computed(() => parentPanel.state.detail[childId.value] ?? null);

const profile = computed(() => detail.value?.profile ?? null);

const name = computed<string>(() => profile.value?.fullName?.first ?? "");

/**
 * The age band, resolved by the ONE `stageOfAge` the whole panel shares.
 *
 * It reads the age the server STORED at creation, so this is byte-identical on the
 * server render and at hydration — which is exactly what a chip that repaints a
 * second after the page appears would be.
 */
const stage = computed(() => stageOfAge(profile.value?.age));

/**
 * The illustration for a child with no avatar — and there is no way to set one
 * from this repository, so this branch is what always renders. `src` is declared
 * statically because it must not be an `<img>` without a source.
 */
const fallbackAvatar = computed<string>(() =>
  stage.value === "child" ? "/images/panels/child-avatar.svg" : "/images/panels/teen-avatar.svg",
);

/**
 * One sentence for this child's screen.
 *
 * A detail page runs THREE reads and can only say one thing; the store records the
 * first refusal in the order the three matter in, so a refused profile outranks a
 * refused activity feed. When the profile DID come through, this is a partial
 * failure — the counters may be absent — and the screen is otherwise whole.
 */
const error = computed<string | null>(() => parentPanel.state.error.detail[childId.value] ?? null);

const decisions = computed(() => [
  {
    to: `/panels/parent/children/${childId.value}/tests`,
    icon: "solar:clipboard-list-linear",
    title: "آزمون‌های فرزند",
    description: "آزمونی که خریداری کرده‌اید به او بدهید",
  },
  {
    to: `/panels/parent/children/${childId.value}/access`,
    icon: "solar:clock-circle-linear",
    title: "دسترسی",
    description: "ساعت‌های ورود و کد دسترسی",
  },
  {
    to: `/panels/parent/children/${childId.value}/goals`,
    icon: "solar:flag-linear",
    title: "هدف‌گذاری",
    description: "هدف‌های فرزندتان و جایزهٔ هر مرحله",
  },
]);
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <div v-if="isLoading" class="grid gap-3" aria-busy="true">
      <USkeleton class="h-20 rounded-3xl bg-white" />
      <USkeleton class="h-20 rounded-3xl bg-white" />
      <USkeleton class="h-40 rounded-3xl bg-white" />
    </div>

    <UiStateMessage
      v-else-if="!profile && error"
      icon="solar:link-broken-linear"
      :title="error"
      action-label="تلاش دوباره"
      @action="parentPanel.loadChild(childId, true)"
    />

    <UiStateMessage
      v-else-if="!profile"
      icon="solar:user-block-linear"
      title="این فرزند پیدا نشد"
      description="ممکن است حذف شده باشد یا دسترسی شما به آن تغییر کرده باشد."
      action-label="بازگشت به فرزندان"
      action-to="/panels/parent/children"
    />

    <template v-else>
      <section class="flex items-center gap-3">
        <img
          v-if="profile.avatar"
          :src="profile.avatar"
          :alt="`تصویر ${name}`"
          class="size-14 shrink-0 rounded-2xl bg-x-parent-50 object-cover"
          width="56"
          height="56"
        >
        <img
          v-else
          :src="fallbackAvatar"
          alt=""
          aria-hidden="true"
          class="size-14 shrink-0 rounded-2xl bg-x-parent-50"
          width="56"
          height="56"
        >

        <div class="min-w-0 flex-1">
          <h2 class="truncate font-yekan-extra text-lg text-x-text-title">{{ name }}</h2>
          <p class="truncate text-xs text-x-text-subtitle">
            <template v-if="profile.age !== undefined">{{ faNumber(profile.age) }} ساله · </template>
            {{ profile.hasAccessCode ? "کد دسترسی فعال" : "بدون کد دسترسی" }}
          </p>
        </div>

        <span
          class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-yekan-bold"
          :class="
            stage === 'child'
              ? 'bg-x-kid-sun-100 text-x-kid-900'
              : 'bg-x-teen-100 text-x-teen-700'
          "
        >
          {{ stage === "child" ? "کودک" : "نوجوان" }}
        </span>
      </section>

      <ParentChildDetailStats class="mt-5" :counters="detail?.counters ?? null" />

      <!--
        A partial failure, so inline and quiet about which read it was. The screen
        is otherwise whole, and `UiStateMessage`'s `h-[55dvh]` would push the log
        and both decisions off-screen for one refused read.
      -->
      <UAlert
        v-if="error"
        variant="soft"
        color="error"
        title="بخشی از اطلاعات خوانده نشد"
        class="mt-5 rounded-3xl"
      >
        <template #description>{{ error }}</template>
      </UAlert>

      <nav :aria-label="`تصمیم‌های مربوط به ${name}`" class="mt-5 grid gap-3">
        <NuxtLink
          v-for="item in decisions"
          :key="item.to"
          :to="item.to"
          class="neu-raised flex min-h-16 items-center gap-3 rounded-3xl bg-white p-4 transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
            aria-hidden="true"
          >
            <UIcon :name="item.icon" size="20" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-yekan-bold text-x-text-title">{{ item.title }}</span>
            <span class="block truncate text-xs text-x-text-subtitle">{{ item.description }}</span>
          </span>
          <UIcon
            name="solar:alt-arrow-left-linear"
            size="18"
            class="shrink-0 text-x-parent-300"
            aria-hidden="true"
          />
        </NuxtLink>
      </nav>

      <section aria-labelledby="parent-child-activity" class="mt-8">
        <h2 id="parent-child-activity" class="text-sm font-yekan-bold text-x-text-title">
          فعالیت‌های {{ name }}
        </h2>

        <div class="mt-3">
          <ParentChildActivityList
            :items="detail?.activities ?? []"
            :loading="parentPanel.state.loading.activities[childId] !== false"
            :error="parentPanel.state.error.activities"
            :now="now"
            @retry="parentPanel.loadChild(childId, true)"
          />
        </div>
      </section>
    </template>
  </div>
</template>
