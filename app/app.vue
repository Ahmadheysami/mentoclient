<script setup lang="ts">
// Hooks
const nuxtApp = useNuxtApp(),
  splashState = ref<boolean>(true),
  loadPageHandler = () => {
    setTimeout(() => {
      splashState.value = false;
    }, 2250);
  };
nuxtApp.hooks.hook("app:mounted", loadPageHandler);
nuxtApp.hooks.hook("page:loading:end", loadPageHandler);
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
