<script setup lang="ts">

const items = [
    {  icon: 'solar:home-2-linear', label: 'خانه', to: '/'  },
    {  icon: 'solar:wallet-linear', label: 'کیف پول و سکه', to: '/wallet'  },
    {  icon: 'solar:user-rounded-broken', label: 'حساب', to: '/me'  },
    {  icon: 'solar:settings-broken', label: 'تنظیمات', to: '/settings'  }
]
</script>

<template>
    <div class="absolute bottom-0 left-0 right-0 bg-linear-180 to-x-primary-content-100 from-transparent z-1060">
        <div class="flex items-center justify-center py-4 gap-4">
            <NuxtLink :to="item.to" v-for="item of items" class="grid place-items-center gap-2 first:scale-75 last:scale-75 transition-transform hover:-translate-y-4" >
                <div class="bg-white w-18 h-18 rounded-full grid place-items-center shadow-inner outline-6 outline-x-primary-content-200">
                    <UIcon :name="item.icon" size="38" class="text-x-primary-800" />
                </div>
                <p class="font-bold text-[16px]" :class="{'text-[13px]! text-center': item.label.length > 8}">{{ item.label }}</p>
            </NuxtLink>
        </div>
    </div>
</template>

<style lang="scss">
    .router-link-active.router-link-exact-active > div {
        background: var(--color-x-primary-500);
        outline: 9px solid var(--color-x-primary-100)
    }
    .router-link-active.router-link-exact-active span {
        color: var(--color-x-primary-content-50);
        font-weight: bold;
    }
</style>