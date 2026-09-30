<script setup lang="ts">
/**
 * The account at the top of the page, in the hero idiom `Plan/MyStatus` already
 * established: the dark brand gradient, one soft lit blob behind the content,
 * and everything else set in the content tints.
 *
 * The whole card is one link to `/me`, which already owns every edit — avatar,
 * name, position, age, email. Editing is deliberately NOT duplicated here; a
 * settings screen with a second, slightly different copy of an editor is how
 * two versions of the truth end up disagreeing.
 */
const props = withDefaults(
  defineProps<{
    /**
     * The user shape is TAKEN from the store rather than re-declared:
     * `stores/user` types its own state inline and owns it, so deriving the
     * type here means this card cannot drift from the object it is handed.
     */
    user: NonNullable<ReturnType<typeof useUser>["state"]["user"]> | null;
    loading: boolean;
  }>(),
  { loading: false },
);

/** A reader with no name is still a reader, not an error state. */
const fullName = computed<string>(() => {
  const name = `${props.user?.fullName?.first ?? ""} ${props.user?.fullName?.last ?? ""}`.trim();

  return name || "کاربر";
});

const memberSince = computed<string>(() => faDate(props.user?.createdAt));
</script>

<template>
  <!--
    Loading gets the SAME dark frame as the loaded card, filled with
    skeletons — not a light card, and never a dark card with an empty name on
    it. Swapping the surface as well as the content is what turns a one-frame
    fetch into a flash.
  -->
  <div
    v-if="loading || !user"
    class="relative overflow-hidden rounded-4xl bg-linear-to-br from-x-primary-900 to-x-primary-800 p-5"
    :aria-busy="loading"
  >
    <span
      class="pointer-events-none absolute -top-8 -start-4 size-44 rounded-full bg-x-secondary-400/25 blur-3xl"
      aria-hidden="true"
    />

    <div v-if="loading" class="relative grid gap-4" aria-busy="true">
      <div class="flex items-center gap-3">
        <USkeleton class="size-16 shrink-0 rounded-full bg-white/15" />
        <div class="grid flex-1 gap-2">
          <USkeleton class="h-5 w-32 rounded-lg bg-white/15" />
          <USkeleton class="h-4 w-24 rounded-lg bg-white/10" />
        </div>
      </div>
      <div class="grid gap-2">
        <USkeleton class="h-3.5 w-full rounded-lg bg-white/10" />
        <USkeleton class="h-3.5 w-2/3 rounded-lg bg-white/10" />
      </div>
    </div>

    <!--
      An inline line, NOT `UiStateMessage`: that component is `h-[55dvh]`, a
      full-screen treatment meant to own a page by itself. Dropped at the top
      of a settings screen it would push every control below the fold, for a
      condition that only a failed account fetch can produce.
    -->
    <p v-else class="relative text-sm leading-7 text-x-primary-content-200">
      اطلاعات حساب در دسترس نیست. صفحه را دوباره بارگذاری کنید.
    </p>
  </div>

  <NuxtLink
    v-else
    to="/me"
    class="relative block overflow-hidden rounded-4xl bg-linear-to-br from-x-primary-900 to-x-primary-800 p-5 text-white transition-transform duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
  >
    <!-- Lit, not decorated: the same static blob `PlanMyStatus` uses. -->
    <span
      class="pointer-events-none absolute -top-8 -start-4 size-44 rounded-full bg-x-secondary-400/25 blur-3xl"
      aria-hidden="true"
    />

    <div class="relative grid gap-4">
      <div class="flex items-center gap-3">
        <!--
          `alt` is always passed: on an image error `UAvatar` falls back to
          initials derived from it, and the full name is exactly the right thing
          to see in place of a missing picture.
        -->
        <UAvatar
          :src="user.avatar"
          :alt="fullName"
          size="3xl"
          :ui="{ root: 'ring-2 ring-white/25' }"
          class="shrink-0"
          crossorigin="anonymous"
        />

        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-bold text-white">{{ fullName }}</p>
          <!--
            `dir="ltr"`: a mobile number is read left to right, and inside an
            RTL paragraph the bidi algorithm would otherwise pull the country
            code away from the digits.
          -->
          <p
            v-if="user.mobile"
            class="mt-0.5 truncate text-xs text-x-primary-content-300"
            dir="ltr"
          >
            {{ user.mobile }}
          </p>
        </div>
      </div>

      <div class="grid gap-1.5 text-xs">
        <p
          v-if="user.email"
          class="flex items-center gap-2 text-x-primary-content-200"
        >
          <span class="min-w-0 truncate" dir="ltr">{{ user.email }}</span>

          <!--
            The chip says the same thing in a colour AND in a word, because
            "verified" is exactly the kind of state colour alone may not carry.
          -->
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            :class="
              user.emailIsVerification
                ? 'bg-green-500/20 text-green-200'
                : 'bg-white/10 text-x-primary-content-300'
            "
          >
            <UIcon
              :name="
                user.emailIsVerification
                  ? 'solar:verified-check-linear'
                  : 'solar:eye-linear'
              "
              size="12"
              aria-hidden="true"
            />
            {{ user.emailIsVerification ? "تاییدشده" : "تاییدنشده" }}
          </span>
        </p>

        <p
          class="flex flex-wrap items-center gap-x-2 gap-y-1 text-x-primary-content-300"
        >
          <span v-if="user.position">{{ user.position }}</span>
          <span v-if="user.position && user.age" aria-hidden="true">·</span>
          <span v-if="user.age">سن {{ faNumber(user.age) }}</span>
          <span aria-hidden="true">·</span>
          <span :class="user.isActive ? 'text-green-300' : 'text-x-primary-content-400'">
            {{ user.isActive ? "فعال" : "غیرفعال" }}
          </span>
        </p>

        <p v-if="memberSince" class="text-x-primary-content-400">
          عضو منتویا از {{ memberSince }}
        </p>
      </div>

      <p
        class="flex items-center gap-1 text-xs font-bold text-x-primary-200"
      >
        ویرایش پروفایل
        <UIcon name="solar:alt-arrow-left-linear" size="16" aria-hidden="true" />
      </p>
    </div>
  </NuxtLink>
</template>
