<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    loading?: boolean;
    action?: boolean;
    type?: "error" | "warning" | "info";
  }>(),
  {
    type: "info",
    loading: false,
    action: true
  },
);

defineEmits(["accept", "cancel"]);

const status = {
  warning: {
    icon: "solar:shield-warning-linear",
    style: "text-warning-500 bg-warning-50",
  },
  error: {
    icon: "solar:close-circle-outline",
    style: "text-red-500 bg-red-50",
  },
  info: {
    icon: "solar:info-circle-outline",
    style: "text-blue-500 bg-blue-50",
  },
};
</script>

<template>
  <div class="space-y-3 grid place-items-center">
    <div :class="`w-18 h-18 rounded-2xl ${status[type].style}`">
        <UIcon :name="status[type].icon" size="50" :class="`${status[type].style}`"/>
    </div>
    <strong class="text-lg font-liana!">{{ title }}</strong>
    <p v-if="description" class="text-sm">{{ description }}</p>
    <div class="flex gap-2" v-if="action">
        <UButton size="lg" @click="() => $emit('cancel')" label="انصراف" variant="solid" :ui="{base: 'rounded-xl'}" class="bg-red-50 text-red-500 hover:bg-red-200 "/>
        <UButton :loading="loading" :disabled="loading" size="lg" @click="() => $emit('accept')" label="تایید" variant="solid" :ui="{base: 'rounded-xl'}" color="x-primary"/>
    </div>
  </div>
</template>
