<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        to?: string;
        title?: string;
        body?: string;
        icon?: string;
        date?: string;
        type?: 'request' | 'notification'
    }>(),
    {
        icon: 'solar:bell-linear',
        type: "notification"
    }
)
</script>

<template>
    <NuxtLink :to="props.to">
        <div class="flex items-start gap-2 py-3 hover:bg-slate-200 px-2 rounded-2xl transition-all hover:scale-95">
            <UChip position="top-left"
                :ui="{ base: `text-xs py-2 px-1 -top-3 text-white ${props.type == 'notification' ? 'bg-x-secondary-500' : 'bg-x-primary-500'}` }"
                :text="props.type === 'notification' ? 'اعلان' : 'درخواست'">
                <UIcon :class="` ${props.type == 'notification' ? 'text-x-secondary-500' : 'text-x-primary-500'}`"
                    :name="props.icon" size="32" />
            </UChip>
            <div>
                <p class="text-xs text-muted" v-if="props.date">{{ props.date }}</p>
                <div class="space-y-1">
                    <p class="text-md font-bold">{{ props.title }}</p>
                    <p class="text-sm text-x-text-body">{{ props.body }}</p>
                </div>
            </div>
        </div>
    </NuxtLink>
</template>