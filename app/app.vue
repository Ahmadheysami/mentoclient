<script setup lang="ts">
import {Toaster} from "vue-sonner"

</script>

<template>
  <UApp>
    <Toaster :dir="'rtl'" :class="'font-yekan-regular! text-13'" :theme="'light'" :position="'top-center'" rich-colors :gap="10" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
