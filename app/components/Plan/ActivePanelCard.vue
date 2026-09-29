<script setup lang="ts">
import { faNumber } from "~/utils/fa";

const planStore = usePlan()
onMounted(async () => {
    // Non-forced: a no-op right after a purchase, which already refreshed it.
    await planStore.getMyPlans()
})
</script>

<template>

        <!--
            A second row, not a third column: the notification link already owns
            the end side and `max-w-md` is narrow. The translucent-pill language
            is lifted from AppBottomBar so the chrome reads as one system.
        -->
        <NuxtLink
            v-if="planStore.isPlanHolder"
            :to="planStore.panelRoute"
            class="reveal mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm ring-1 ring-x-primary-200 px-4 shadow-inner transition duration-150 ease-out active:scale-95 motion-reduce:active:scale-100">
            <UIcon name="solar:shield-check-linear" size="18" class="text-x-primary-700" aria-hidden="true" />
            <span class="text-xs font-bold text-x-primary-800">پنل {{ planStore.panelLabel }} فعال است</span>
            <span aria-hidden="true">·</span>
            <span class="text-xs text-x-text-subtitle">{{ faNumber(Number(planStore.activeSubscription?.remainingDays.toFixed()) ?? 0) }} روز باقی‌مانده</span>
        </NuxtLink>
</template>