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
            <!-- Active plan status -->
            <div class="grid place-items-center mb-3">
                <PlanActivePanelCard />
            </div>
            <!-- Home Services Component -->
            <HomeServices />
             
             <!-- Ads Carousel -->
              <FeaturesCarousel :size="'xl'" key="fd" />
            <!-- Popups -->
             <PopupPro v-if="route.hash === '#pro'" />
        </div>
    </UPage>
</template>