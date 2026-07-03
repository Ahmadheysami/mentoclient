<script setup lang="ts">
definePageMeta({
    middleware: ['auth']
})
useSeoMeta({
    title: "منتویا - خوش آمد گویی",
    description: ""
})
</script>

<template>
    <UPage>
        <div class="min-h-dvh relative bg-x-primary-content-200 p-3">

            <div class="text-center animate__animated animate__flash">
                <p class="font-[Liana] text-8xl text-x-text-title mt-8 mb-3 ">منتویا</p>
                <p class="font-yekan-regular text-lg text-x-text-subtitle my-2">دوست همه شما</p>
            </div>

            <div class="grid place-items-center">

                <div class="relative">
                    <img src="/images/char/mentoya-welcome.png"
                        class="drop-shadow-2xl animate__animated animate__fadeInUp -mt-7 relative z-10 max-h-150"
                        alt="Welcome image">

                    <div
                        class="absolute top-1/2 left-1/2 bg-radial from-x-primary-500 to-transparent blur-3xl w-62.5 h-62.5 rounded-full -translate-x-1/2 -translate-y-1/2">
                    </div>
                </div>

                <div
                    class="absolute z-20 rounded-t-3xl left-0 right-0 text-center bottom-0 animate__animated animate__fadeInUp bg-x-primary-500/95 px-4 pt-11 pb-8 outline-8 outline-blue-200 text-x-white shadow-inner ">
                    <h1 class="font-[Liana] text-4xl">یه منتویا خوش آمدی</h1>
                    <p class="my-2">همین الان شروع کن</p>
                    <ULink to="/auth" class="btn btn-block btn-xl bg-x-white rounded-full mt-5 text-x-text-title">شروع
                        کن
                    </ULink>
                </div>
            </div>
        </div>
    </UPage>
</template>