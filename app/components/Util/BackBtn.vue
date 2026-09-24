<script setup lang="ts">
const props = withDefaults(defineProps<{ arrow?: 'left' | 'right', to?: string }>(), {
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
    <UButton variant="link" :to="to" @click="!to ? goToBack : undefined">
        <UIcon :name="`solar:arrow-${props.arrow}-linear`" size="28" class="text-x-text-subtitle" />
    </UButton>
</template>