<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination } from 'swiper/modules';
import "swiper/css"
import "swiper/css/pagination"

type Sizes = 'sm' | 'lg' | 'xl'
const props = defineProps<{ size: Sizes, key: string }>()

let sizes: Record<Sizes, number> = {
    'sm': 100,
    'lg': 155,
    'xl': 210
}

const length = ref<number>(2)
</script>

<template>
    <div>
        <Swiper :modules="[Pagination]" :slides-per-view="length > 1 ? 1.2 : 1">
            <SwiperSlide v-for="item of length">
                <div class="px-3">
                    <img src="/images/banner/mentoya-1.png" :style="{ height: `${sizes[props.size as Sizes]}px` }"
                        class="w-full rounded-3xl aspect-3/4 border border-x-primary-content-400 " alt="sss">
                </div>
            </SwiperSlide>
        </Swiper>
    </div>
</template>

<style lang="scss"></style>