<script setup lang="ts">
    definePageMeta({
        middleware: ['auth']
    })

    const user = useUser()
    
</script>

<template>
    <UPage>
        "WELCOME {{ user.state.user?.fullName.first }} TO INDEX PAGE"
    </UPage>
</template>