<script setup lang="ts">
</script>

<template>
    <NuxtLink >
        <div class="flex items-start gap-2 py-3 px-2 rounded-2xl transition-all hover:scale-95">
            <USkeleton class="bg-slate-200 w-12 h-12 rounded-xl"/>
            <div class="space-y-2">
                <USkeleton class="bg-slate-200 w-20 h-4" />
                <USkeleton class="bg-slate-200 w-41 h-4" />
            </div>
        </div>
    </NuxtLink>
</template>