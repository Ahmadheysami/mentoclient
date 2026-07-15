<script setup lang="ts">
const props = withDefaults(defineProps<{ arrow?: 'left' | 'right' }>(), {
    arrow: 'left'
}),
    router = useRouter(),
    route = useRoute(),
    goToBack = async () => {
        if (import.meta.client) {
            if (!window.history?.back )
                router.back()
            else {
                router.push("/")
            }
        }
    }
</script>

<template>
    <UButton variant="link" @click="goToBack">
        <UIcon :name="`solar:arrow-${props.arrow}-linear`" size="35" class="text-x-text-subtitle" />
    </UButton>
</template>