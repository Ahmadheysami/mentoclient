<script setup lang="ts">
import { faNumber } from "~/utils/fa";

const planStore = usePlan();
onMounted(async () => {
  // Non-forced: a no-op right after a purchase, which already refreshed it.
  await planStore.getMyPlans();
});
</script>

<template>
  <!--
            A second row, not a third column: the notification link already owns
            the end side and `max-w-md` is narrow. The translucent-pill language
            is lifted from AppBottomBar so the chrome reads as one system.
        -->
  <!-- <NuxtLink
            v-if="planStore.isPlanHolder"
            :to="planStore.panelRoute"
            class="reveal mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm ring-1 ring-x-primary-200 px-4 shadow-inner transition duration-150 ease-out active:scale-95 motion-reduce:active:scale-100">
            <UIcon name="solar:shield-check-linear" size="18" class="text-x-primary-700" aria-hidden="true" />
            <span class="text-xs font-bold text-x-primary-800">پنل {{ planStore.panelLabel }} فعال است</span>
            <span aria-hidden="true">·</span>
            <span class="text-xs text-x-text-subtitle">{{ faNumber(Number(planStore.activeSubscription?.remainingDays.toFixed()) ?? 0) }} روز باقی‌مانده</span>
        </NuxtLink> -->
  <UChip :show="planStore.isPlanHolder" :ui="{base: 'px-2 h-4 font-bold bg-x-gold-500 text-x-gold-700'}" :text="`پنل ${planStore.panelLabel}` " size="2xl">
    <NuxtLink v-if="planStore.isPlanHolder" :to="planStore.panelRoute" class="">
      <div
        class="bg-x-gold-500 w-13 grid place-items-center wavy-circle hover:bg-x-gold-500/90 h-13 rounded-full"
      >
        <UIcon
          name="fluent:premium-12-filled"
          size="24"
          class="text-x-gold-700"
        />
      </div>
    </NuxtLink>
  </UChip>
</template>

<style lang="css" scoped>
.wavy-circle {
  --s: 50px; /* adjust to control the size */

  width: var(--s);
  aspect-ratio: 1;
  --g: /calc(var(--s) * 0.201) calc(var(--s) * 0.201)
    radial-gradient(50% 50%, #000 99%, #0000 101%) no-repeat;
  mask:
    calc(50% + var(--s) * 0.369) calc(50% + var(--s) * 0) var(--g),
    calc(50% + var(--s) * 0.261) calc(50% + var(--s) * 0.261) var(--g),
    calc(50% + var(--s) * 0) calc(50% + var(--s) * 0.369) var(--g),
    calc(50% + var(--s) * -0.261) calc(50% + var(--s) * 0.261) var(--g),
    calc(50% + var(--s) * -0.369) calc(50% + var(--s) * 0) var(--g),
    calc(50% + var(--s) * -0.261) calc(50% + var(--s) * -0.261) var(--g),
    calc(50% + var(--s) * 0) calc(50% + var(--s) * -0.369) var(--g),
    calc(50% + var(--s) * 0.261) calc(50% + var(--s) * -0.261) var(--g),
    radial-gradient(calc(var(--s) * 0.418), #000 99%, #0000 101%) subtract,
    calc(50% + var(--s) * 0.447) calc(50% + var(--s) * 0.185) var(--g),
    calc(50% + var(--s) * 0.185) calc(50% + var(--s) * 0.447) var(--g),
    calc(50% + var(--s) * -0.185) calc(50% + var(--s) * 0.447) var(--g),
    calc(50% + var(--s) * -0.447) calc(50% + var(--s) * 0.185) var(--g),
    calc(50% + var(--s) * -0.447) calc(50% + var(--s) * -0.185) var(--g),
    calc(50% + var(--s) * -0.185) calc(50% + var(--s) * -0.447) var(--g),
    calc(50% + var(--s) * 0.185) calc(50% + var(--s) * -0.447) var(--g),
    calc(50% + var(--s) * 0.447) calc(50% + var(--s) * -0.185) var(--g);
}
</style>
