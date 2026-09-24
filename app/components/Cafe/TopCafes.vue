<script setup lang="ts">
    import { SwiperSlide, Swiper } from 'swiper/vue';
    import {FreeMode} from "swiper/modules"
    const props = withDefaults(defineProps<{
        top?: number;
        loading?: boolean;
        min?: number;
        items: {
            avatar: string;
            label: string;
            id: string
        }[]
    }>(), {
        top: 10,
        loading: true,
        min: 1
    })
</script>
<template>

    <div >
        <slot name="topbar"/>
        <Swiper :modules="[FreeMode]" :free-mode="true" :slides-per-view="3.8">
            <!-- <div class="py-3 swiper-skeleton" v-if="loading"> -->
                <SwiperSlide v-if="loading" v-for="item of 10" >
                    <div class="px-3 space-y-1.5">
                        <USkeleton class="mx-auto w-19 h-19 rounded-full bg-slate-100"/>
                        <USkeleton class="h-5.5 rounded-full bg-slate-100" />
                    </div>
                </SwiperSlide>
                <SwiperSlide v-if="!loading" v-for="item of items" >
                    <ULink :to="`/cafe/${item.id}/table`" class="px-3 space-y-1.5 grid place-items-center">
                        <UAvatar :src="item.avatar" :alt="item.label" class="mx-auto w-19 h-19 rounded-full bg-slate-100" />
                        <p class="text-x-text-body text-xs text-center">{{ item.label }}</p>
                    </ULink>
                </SwiperSlide>
            <!-- </div> -->
        </Swiper>
    </div>
</template>