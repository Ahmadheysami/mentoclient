<script setup lang="ts">
    definePageMeta({
        middleware: ['auth']
    })
    const auth = useAuth()
    
</script>

<template>
    <div class="relative min-h-dvh bg-x-primary-content-100 bg-cover bg-center bg-no-repeat">
        <!-- <div class="bg-x-primary-content-200 h-20"></div> -->
        <div class="absolute z-0 inset-0 bg-[url(/Users/ahmad/Downloads/Meteor.svg)] bg-cover bg-center  "></div>
        <div class="absolute z-10 bottom-8 left-1/2 -translate-x-1/2 w-11/12">
            <!-- Mentoya Brand -->
             <AppLogo  type="typo-medium" size="xl" class="animate__animated animate__bounceInDown"/>
            <br><br>
            <div class=" bg-x-primary-content-200 border border-slate-100 shadow-inner rounded-3xl backdrop-blur-sm px-5 pt-9 pb-5 ">
                <AuthLogin v-if="auth.state.currentPage === 'login'"/>
                <AuthVerify v-if="auth.state.currentPage === 'verify'"/>
            </div>
        </div>
    </div>
</template>