<script setup lang="ts">
useSeoMeta({
    title: "کیف پول"
})
</script>

<template>
    <UPage>
        <!-- Head -->
        <UDashboardToolbar :ui="{ root: 'border-none py-2  ' }">
            <template #right>
                <UtilBackBtn />
            </template>
            <template #left>
                <strong class="text-x-text-title text-lg">
                    کیف پول و سکه
                </strong>
            </template>
        </UDashboardToolbar>

        <!-- Wallet Balance -->

        <div class="p-4">
            <!-- Display Wallet Balance -->
            <WalletBalance class="sticky top-5 z-9" />
            <!-- Wallet history -->
            <WalletReport />
        </div>
    </UPage>
</template>

<style scoped>
</style>