<script setup lang="ts">

const items = [
    {  icon: 'solar:home-2-linear', label: 'خانه', to: '/'  },
    {  icon: 'solar:wallet-linear', label: 'کیف پول و سکه', to: '/wallet'  },
    {  icon: 'solar:user-rounded-broken', label: 'حساب', to: '/me'  },
    {  icon: 'solar:settings-broken', label: 'تنظیمات', to: '/settings'  }
]
</script>

<template>
    <div class="absolute bottom-3.5 cont bg-linear-90 border border-slate-200 to-slate-200 from-white/70 backdrop-blur-sm  px-5 rounded-full left-1/2 -translate-x-1/2 z-1060">
        <div class="flex items-center justify-center py-4 gap-5">
            <NuxtLink :to="item.to" v-for="item of items" class="grid place-items-center gap-2  transition-transform " >
                <div class="bg-white w-16.5 h-16.5 hover:-translate-y-2 transition rounded-full grid place-items-center shadow-inner outline-6 outline-x-primary-content-200">
                    <UIcon :name="item.icon" size="32" class="text-x-primary-800" />
                </div>
                <!-- <p class="font-bold text-[16px]" :class="{'text-[13px]! text-center': item.label.length > 8}">{{ item.label }}</p> -->
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
    .cont {
        -webkit-backdrop-filter: 8px;
        -moz-backdrop-filter: 8px;
        -o-backdrop-filter: 8px;
        -ms-backdrop-filter: 8px;
    }
</style>