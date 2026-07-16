<script lang="ts" setup>
definePageMeta({
    middleware: ['auth']
})

const notification = useNotification(),
    notifLimit = ref<number>(15),
    pagination = notification.state.notificationPagination,
    paginationHandler = async (action: 'next' | 'prev') => {
        if (action === 'next' && !pagination?.hasNext) return;
        if (action === 'prev' && !pagination?.hasPrev) return;

        await notification.get({
            limit: notifLimit.value,
            page: action === 'next' ? Number(pagination?.page) + 1 : Number(pagination?.page) - 1
        })
    }

onMounted(async () => {
    await notification.get()
    await notification.readAll()
})
</script>
<template>
    <!-- Head -->
    <UDashboardToolbar :ui="{ root: 'border-none py-2  ' }">
        <template #right>
            <UtilBackBtn />
        </template>
        <template #left>
            <strong class="text-x-text-title text-lg">
                اطلاع رسانی و اعلان
            </strong>
        </template>
    </UDashboardToolbar>
    <div class="h-full grid place-items-center"
        v-if="!notification.state.loading.get && notification.state.notifications.length <= 0">
        <div class="text-center space-y-3">
            <UIcon name="solar:notification-remove-linear" size="80" class="text-x-text-title" />
            <p class="font-bold text-center">اعلان یا اطلاع رسانی تا الان ثبت نشده</p>
        </div>
    </div>
    <div>
        <div v-if="notification.state.loading.get === false" class="rounded-4xl p-4 shadow-black/10 mt-4 grid gap-2">
            <NotificationItem :date="new Date(notif.createdAt as any).toLocaleString('fa-IR')"
                :to="notif.url ? notif.url : ''" v-if="notification.state.notifications.length > 0"
                v-for="notif of notification.state.notifications" :title="notif.title" :body="notif.body"
                :type="notif.type"
                :icon="notif.type === 'notification' ? 'solar:bell-linear' : 'solar:notification-unread-lines-broken'" />
        </div>
        <div v-if="notification.state.loading.get === true" class="rounded-4xl p-4 shadow-black/10 mt-4 grid gap-2">
            <NotificationItemSkeleton v-for="skeleton of 10" />
        </div>
        <div class="flex items-center justify-center" v-if="notification.state.notifications.length > notifLimit">

            <!-- Pagination -->
            <UButton v-if="pagination?.hasNext" variant="link" color="x-secondary" @click="paginationHandler('next')">
                <UIcon name="solar:arrow-right-linear" size="30" />
            </UButton>
            <span class="text-sm ltr"> {{ pagination?.page }} / {{ pagination?.totalPages }} </span>
            <!-- Pagination -->
            <UButton v-if="pagination?.hasPrev" variant="link" color="x-secondary" @click="paginationHandler('prev')">
                <UIcon name="solar:arrow-left-linear" size="30" />
            </UButton>
        </div>
    </div>
</template>