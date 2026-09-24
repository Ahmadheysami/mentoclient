<script setup lang="ts">
defineProps<{
    name: string;
    description?: string;
    image?: string;
    to?: string
}>()
</script>
<template>
    <NuxtLink :to="to" class="flex items-center gap-2 hover:bg-white  bg-white/60 p-3 justify-between not-last:border-b border-slate-200">
        <div class="flex items-center gap-4 w-full">
            <UAvatar size="3xl" :src="'https://unavatar.io/github/AhmadHeysami'" :alt="name" class="w-17 rounded-full max-h-17 min-h-17 bg-slate-100" />
            <div class="space-y-1">
                <p class="font-bold line-clamp-1">{{ name }}</p>
                <p class="text-sm text-x-text-muted line-clamp-1">{{ description }}</p>
            </div>
        </div>
        <slot name="left" />
    </NuxtLink>
</template>