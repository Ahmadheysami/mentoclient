<script setup lang="ts">
const user = useUser(),
    notification = useNotification(),
    fullName = `${user.state.user?.fullName?.first || 'کاربر'} ${user.state.user?.fullName?.last || 'عادی'}`

onMounted(async () => {
    await notification.get({public: '1'})
})
</script>

<template>
    <div class="py-4 px-4">
        <div class="flex items-center justify-between">
            <div class="flex gap-3 items-center">
                <UAvatar :src="user.state.user?.avatar" crossorigin="anonymous"
                    :ui="{ root: 'w-15 h-15 shadow-inner bg-white' }" width="60" height="60" :alt="fullName" />
                <div>
                    <p class="font-bold text-11">
                        {{ fullName }}
                    </p>
                    <p class="text-sm"> سلام دوست من 👋 </p>
                </div>
            </div>
            <ULink
                to="/notifications"
                class="bg-white w-13 hover:bg-white/90 h-13 shadow-inner shadow-x-primary-400 grid place-items-center rounded-full">
                <UChip :show="Number(notification.state.notificationStats?.unread) > 0" :ui="{ base: 'bg-red-500' }" size="xs" position="top-left">
                    <UIcon name="solar:bell-outline" size="26" />
                </UChip>
            </ULink>
        </div>
    </div>
</template>