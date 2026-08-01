<script setup lang="ts"></script>

<template>
  <UApp>
    <ClientOnly>
      <NotificationHandler />
      <Toaster :dir="'rtl'" :class="'font-yekan-light! text-13 z-9999999'" :theme="'light'" :position="'top-center'" rich-colors :gap="10" />
    </ClientOnly>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
