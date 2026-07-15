<script setup lang="ts">
const services: {
    slug: string,
    label: string,
    lock: boolean,
    chip: string | boolean,
    icon?: string,
    image?: string,
    to: string,
}[] = [
        {
            slug: "pro",
            label: "منتویا پرو",
            lock: false,
            chip: false,
            image: '/logo.png',
            to: '#pro'
        },
        {
            slug: "bot",
            label: "منتو بات",
            lock: false,
            chip: false,
            icon: "solar:star-bold-duotone",
            to: '/mentobot'
        },
        {
            slug: "test",
            label: "تست ها",
            lock: false,
            chip: false,
            icon: "solar:notes-minimalistic-bold-duotone",
            to: '/test'
        },
        {
            slug: "shop",
            label: "فروشگاه",
            lock: false,
            chip: 'به زودی',
            icon: "solar:shop-2-bold-duotone",
            to: '#'
        },
        {
            slug: "cafe",
            label: "کافه منتویا",
            lock: false,
            chip: false,
            icon: "solar:cup-hot-bold-duotone",
            to: '/cafe'
        },
        {
            slug: "academy",
            label: "آکادمی",
            lock: false,
            chip: 'به زودی',
            icon: "solar:square-academic-cap-2-bold-duotone",
            to: '#'
        },
        {
            slug: "studio",
            label: "استودیو",
            lock: true,
            chip: false,
            icon: "solar:headphones-square-bold-duotone",
            to: '#'
        },
        {
            slug: "este",
            label: "استخدام",
            lock: false,
            chip: 'به زودی',
            icon: "solar:user-speak-rounded-bold-duotone",
            to: '#'
        },
        {
            slug: "coach",
            label: "کوچ",
            lock: true,
            chip: 'به زودی',
            icon: "solar:user-hand-up-bold-duotone",
            to: '#'
        },
        {
            slug: "blog",
            label: "بلاگ",
            lock: false,
            chip: true,
            icon: "solar:pen-new-round-bold-duotone",
            to: '/blog'
        },
        {
            slug: "league",
            label: "منتولیگ",
            lock: true,
            chip: 'در حال توسعه ...',
            icon: "solar:cup-bold-duotone",
            to: '/league'
        }
    ]
</script>

<template>
    <div class="bg-white w-11/12 mx-auto my-5 pb-7 pt-9 rounded-3xl a ">
        <div class="grid grid-cols-4 gap-x-1 gap-y-10 place-items-center">
            <ULink :to="item.to" class="w-19 h-19 grid place-items-center gap-3 relative group" v-for="item of services"
                :key="item.slug">
                <div
                    class="absolute w-14 h-14 bg-blue-500/8 rounded-3xl group-hover:scale-0 group-hover:bg-purple-500/15 transition-all -top-2 left-1/2 -translate-x-1/2">
                </div>
                <UChip position="top-left" color="error" size="xl"
                    :ui="{ base: `-top-2 ${typeof item.chip == 'string' ? 'py-2 left-1/2  px-1 text-[11px]' : ''}` }"
                    :text="(typeof item.chip === 'string') ? item.chip : ''"
                    :show="typeof item.chip == 'string' || item.chip === true">
                    <UIcon v-if="item.icon" :name="item.icon" size="34"
                        class=" group-hover:scale-145 text-x-secondary-600 drop-shadow-2xl group-hover:-translate-y-1 transition-transform" />
                    <img v-if="item.image" :src="item.image" alt="icon image"
                        class="w-8.5 h-8.5 group-hover:scale-145 group-hover:-translate-y-1 transition-transform">
                </UChip>
                <p class="text-x-text-title font-yekan-bold text-[13px] flex items-center gap-1 font-bold text-center">
                    {{ item.label }}
                    <UIcon name="solar:lock-keyhole-minimalistic-linear" size="14" class="text-x-text-subtitle"
                        v-if="item.lock" />
                </p>
            </ULink>
        </div>
    </div>
</template>

<style scoped lang="scss">
.a {
background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' version='1.1' xmlns:xlink='http://www.w3.org/1999/xlink' xmlns:svgjs='http://svgjs.dev/svgjs' width='402' height='200' preserveAspectRatio='none' viewBox='0 0 402 200'%3e%3cg mask='url(%26quot%3b%23SvgjsMask1129%26quot%3b)' fill='none'%3e%3cpath d='M9 200L209 0L287 0L87 200z' fill='url(%26quot%3b%23SvgjsLinearGradient1130%26quot%3b)'%3e%3c/path%3e%3cpath d='M140.66 200L340.65999999999997 0L475.65999999999997 0L275.65999999999997 200z' fill='url(%26quot%3b%23SvgjsLinearGradient1130%26quot%3b)'%3e%3c/path%3e%3cpath d='M380 200L180 0L120 0L320 200z' fill='url(%26quot%3b%23SvgjsLinearGradient1131%26quot%3b)'%3e%3c/path%3e%3cpath d='M262.34000000000003 200L62.34000000000003 0L-12.659999999999968 0L187.34000000000003 200z' fill='url(%26quot%3b%23SvgjsLinearGradient1131%26quot%3b)'%3e%3c/path%3e%3cpath d='M275.3808015107564 200L402 73.38080151075637L402 200z' fill='url(%26quot%3b%23SvgjsLinearGradient1130%26quot%3b)'%3e%3c/path%3e%3cpath d='M0 200L126.61919848924363 200L 0 73.38080151075637z' fill='url(%26quot%3b%23SvgjsLinearGradient1131%26quot%3b)'%3e%3c/path%3e%3c/g%3e%3cdefs%3e%3cmask id='SvgjsMask1129'%3e%3crect width='402' height='200' fill='white'%3e%3c/rect%3e%3c/mask%3e%3clinearGradient x1='0%25' y1='100%25' x2='100%25' y2='0%25' id='SvgjsLinearGradient1130'%3e%3cstop stop-color='rgba(54%2c 108%2c 255%2c 0.06)' offset='0'%3e%3c/stop%3e%3cstop stop-opacity='0' stop-color='rgba(54%2c 108%2c 255%2c 0.06)' offset='0.66'%3e%3c/stop%3e%3c/linearGradient%3e%3clinearGradient x1='100%25' y1='100%25' x2='0%25' y2='0%25' id='SvgjsLinearGradient1131'%3e%3cstop stop-color='rgba(54%2c 108%2c 255%2c 0.06)' offset='0'%3e%3c/stop%3e%3cstop stop-opacity='0' stop-color='rgba(54%2c 108%2c 255%2c 0.06)' offset='0.66'%3e%3c/stop%3e%3c/linearGradient%3e%3c/defs%3e%3c/svg%3e");    background-size: cover;
    // background-repeat: no-repeat;
}

</style>