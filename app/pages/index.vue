<script setup lang="ts">
    definePageMeta({
        middleware: ['auth']
    })

    const route = useRoute()
    
</script>

<template>
    <UPage>
        <div>
            <!-- Top Bar Component -->
            <AppTopBar />
            <!-- Story Component -->
            <FeaturesStory />
            <!-- Home Services Component -->
             <HomeServices />
             
             <!-- Ads Carousel -->
              <FeaturesCarousel :size="'xl'" key="fd" />
            <!-- Popups -->
             <PopupPro v-if="route.hash === '#pro'" />
        </div>
    </UPage>
</template>