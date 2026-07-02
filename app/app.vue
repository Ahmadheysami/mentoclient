<script setup lang="ts">
  // const loading = ref(true),
  //   {hooks} = useNuxtApp()

  // hooks.hook("app:mounted", () => {
  //   loading.value = false
  // })
</script>

<template>
  <UApp>
    <!-- <AppSplashScreen v-if="loading" /> -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
