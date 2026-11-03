<script setup lang="ts">
// Hooks
const nuxtApp = useNuxtApp(),
  splashState = ref<boolean>(true),
  /** The motion asset runs ~5.5s; the splash never leaves before it ends. */
  splashDurationElapsed = ref<boolean>(false),
  /** The initial page (or its first navigation) has finished loading. */
  pageLoaded = ref<boolean>(false);

let splashTimer: ReturnType<typeof setTimeout> | undefined;

/** Both conditions, and neither alone, dismiss the splash. */
const dismissSplashWhenReady = () => {
  if (splashDurationElapsed.value && pageLoaded.value) {
    splashState.value = false;
  }
};

const markPageLoaded = () => {
  pageLoaded.value = true;
  dismissSplashWhenReady();
};

onMounted(() => {
  splashTimer = setTimeout(() => {
    splashDurationElapsed.value = true;
    dismissSplashWhenReady();
  }, 5500);
});

onBeforeUnmount(() => {
  if (splashTimer) clearTimeout(splashTimer);
});

nuxtApp.hooks.hook("app:mounted", markPageLoaded);
nuxtApp.hooks.hook("page:loading:end", markPageLoaded);

/**
 * The reader's text size and motion preference, as attributes on `<html>`.
 *
 * Here, and not in the boot plugin, because this is the one file whose setup
 * unambiguously runs inside a component: a plugin would have to reach for
 * `runWithContext` to get the same effect, and there is no reason to make the
 * root of the app depend on that detail. Unhead MERGES `htmlAttrs` rather than
 * replacing them, so the `dir: "rtl"` from `nuxt.config.ts` survives
 * alongside these two.
 */
const settings = useSettings();

useHead(computed(() => ({ htmlAttrs: settings.htmlAttrs })));
</script>

<template>
  <UApp>
    <AppSplashScreen v-if="splashState" />
    <ClientOnly>
      <NotificationHandler />
      <Toaster
        :dir="'rtl'"
        :class="'font-yekan-light! text-13 z-9999999'"
        :theme="'light'"
        :position="'top-center'"
        rich-colors
        :gap="10"
      />
    </ClientOnly>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
