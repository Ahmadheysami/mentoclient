<script setup lang="ts">
const props = defineProps<{
    type: 'colorize' | 'medium' | 'typo-colorize' | 'typo-medium',
    to?: string | null,
    size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
}>()

const sizes: Record<typeof props.size, { textSize: number, size: number }> = {
    sm: {
        textSize: 2.6 * (40 / 95), 
        size: 40
    },
    md: {
        textSize: 2.6 * (55 / 95), 
        size: 55
    },
    lg: {
        textSize: 2.6 * (75 / 95), 
        size: 75
    },
    xl: {
        textSize: 2.6,
        size: 95
    },
    '2xl': {
        textSize: 2.6 * (110 / 95),
        size: 110
    },
    '3xl': {
        textSize: 2.6 * (125 / 95),
        size: 125
    }
}

</script>

<template>
    <div :to="(props.to as string)" dir="ltr">
        <!-- Colorize -->
        
         <div class="flex items-end justify-center gap-1" v-if="props.type === 'colorize' || props.type === 'typo-colorize'">
            <NuxtImg src="/logo.png" :width="sizes[props.size].size + 'px'" :height="sizes[props.size].size + 'px'" alt="mentoya logo" />
            <p :style="{fontSize: `${sizes[props.size].textSize}rem`}" v-if="props.type !== 'colorize'">mentoya</p>
         </div>
         <!-- Medium -->
         <div class="flex items-end justify-center gap-1" v-if="props.type === 'medium' || props.type === 'typo-medium'">
            <NuxtImg src="/logo.png" :width="sizes[props.size].size + 'px'" :height="sizes[props.size].size + 'px'" alt="mentoya logo" />
            <p :style="{fontSize: `${sizes[props.size].textSize}rem`}" v-if="props.type !== 'medium'">mentoya</p>
         </div>
        </div>
</template>