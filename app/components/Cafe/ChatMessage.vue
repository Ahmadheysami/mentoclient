<script setup lang="ts">
withDefaults(
  defineProps<{
    type: "user" | "any" | "provider";
    text?: string;
  }>(),
  {
    type: "provider",
    text: "",
  },
);
</script>
<template>
  <div class="p-1.5 animate__animated animate__fadeInUp">
    <div class="wrapper">
      <div
        class="flex items-center"
        :class="{ 'justify-end': type === 'provider' }"
      >
        <div
          :class="{ 'bg-x-primary-500! text-white!': type === 'user' }"
          class="relative bg-white group text-x-text-body max-w-11/12 inline-block rounded-2xl p-2.5 px-3.5"
        >
          {{ text }}
        </div>
      </div>
    </div>
  </div>
</template>
