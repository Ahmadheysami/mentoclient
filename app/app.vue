<script setup lang="ts">
import {Toaster} from "vue-sonner"

</script>

<template>
  <UApp>
    <Toaster :dir="'rtl'" :class="'font-yekan-light! text-13 z-9999999'" :theme="'light'" :position="'top-center'" rich-colors :gap="10" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
