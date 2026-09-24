<script setup lang="ts">
// Import Swiper Vue.js components
import { Swiper, SwiperSlide } from 'swiper/vue';

// Import Swiper styles
import 'swiper/css';

import 'swiper/css/free-mode';

// import required modules
import { FreeMode } from 'swiper/modules';

const modules = [FreeMode]
</script>

<template>
  <swiper :slidesPerView="3.3" :freeMode="true" :pagination="{
    clickable: true,
  }" :modules="modules" class="mySwiper">
    <swiper-slide v-for="item of 10" class="max-w-30">
      <div class="min-h-38 p-1.5">
        <div class="bg-orange-500 rounded-2xl min-h-38 relative overflow-hidden transition">
          <div
            class="backdrop-grayscale-50 backdrop-blur-[3px] inset-0 absolute z-8 rounded-2xl hover:backdrop-grayscale-0 flex items-end justify-center">
            <p class="text-center text-white text-[12px] pb-2 font-bold">تخفیفات امروز</p>
          </div>
          <UAvatar src="https://www.karlancer.com/f/avatar/2626/1782551747-O7yw.png" alt="story"
            class="absolute top-2 left-2 border-2 border-x-primary-content-100 z-10" :ui="{ root: 'w-13 h-13' }" />
          <NuxtImg
            src="/images/bg/bb.webp"
            class="w-full h-38 object-cover" />
        </div>
      </div>
    </swiper-slide>
  </swiper>
</template>