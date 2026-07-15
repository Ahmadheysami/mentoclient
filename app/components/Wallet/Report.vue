<script setup lang="ts">
import comma from "comma-number"

const wallet = useWallet(),
    limit = ref(10),
    nextPage = async () => {
        if ((wallet.state.logsStat.currentPage as number) >= Number(wallet.state.logsStat.pagesCount)) return;
        await wallet.getWalletLogs({ page: (wallet.state.logsStat.currentPage as number) + 1, limit: limit.value })
    },
    prevPage = async () => {
        if ((wallet.state.logsStat.currentPage as number) <= 1) return;
        await wallet.getWalletLogs({ page: (wallet.state.logsStat.currentPage as number) - 1, limit: limit.value })
    }

onMounted(async () => {
    await wallet.getWalletLogs({ limit: limit.value })
})

</script>
<template>
    <div>
        <!-- Filters -->
        <p class="mt-19 font-bold">گزارش های کیف پول</p>
        <!-- <div class="flex items-center flex-wrap gap-3 my-4" v-if="wallet.state.loading.logs">
            <USkeleton class="w-16 h-7 bg-x-primary-500/10" v-for="item of 6" />
        </div>

        <div class="flex items-center flex-wrap gap-3 my-4" v-if="!wallet.state.loading.logs">
            <UButton variant="soft" color="x-primary" class="rounded-xl" label="همه"
                :class="{ 'bg-x-primary-500 text-white': route.hash === '#all' || !route.hash }" />
            <UButton variant="soft" color="x-primary" class="rounded-xl" label="برداشت ها" />
            <UButton variant="soft" color="x-primary" class="rounded-xl" label="واریز ها" />
            <UButton variant="soft" color="x-primary" class="rounded-xl" label="موفق" />
            <UButton variant="soft" color="x-primary" class="rounded-xl" label="ناموفق" />
        </div> -->

        <!-- List -->
        <div class="grid gap-y-3 mt-7">
            <!-- Skeleton -->
            <div v-for="item of 5" class="bg-white/70 p-4 border border-dashed border-slate-200 rounded-4xl"
                v-if="wallet.state.loading.logs">
                <!-- Skeleton -->
                <div class="flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            <USkeleton class="w-10 h-5" />
                            <USkeleton class="w-7 h-5" />
                            <USkeleton class="w-18 h-5" />
                        </div>
                    </div>

                    <div>
                        <USkeleton class="w-12 h-5" />
                    </div>

                </div>
                <!-- Body -->
                <div class="gap-3 mt-3 flex text-xs">
                    <div class="flex w-full items-center justify-between text-x-text-title font-bold ">
                        <USkeleton class="w-10 h-5" />
                        <USkeleton class="w-15 h-5" />
                    </div>
                </div>
            </div>

            <!-- Main Items -->
            <div v-if="!wallet.state.loading.logs" v-for="log of wallet.state.logs"
                class="bg-white p-4 border border-dashed border-slate-200 rounded-4xl">
                <!-- Head -->
                <div class="flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs px-2 py-1 bg-olive-700 text-slate-100 rounded-lg font-bold">
                                {{ log.type == 'deposit' ? 'واریز' : 'برداشت' }}
                            </span>
                            <span
                                :class="`text-xs px-2 py-1 ${log.status === 'success' ? 'bg-green-600' : 'bg-red-500'} text-slate-100 rounded-lg font-bold`">
                                {{ log.status == 'success' ? 'موفق' : 'ناموفق' }}
                            </span>
                            <span class="text-xs px-2 py-1 bg-x-secondary-500 text-slate-100 rounded-lg font-bold">
                                {{ log.from == 'payment-gateway' ? 'درگاه پرداخت' : 'کیف پول' }}
                            </span>
                        </div>
                    </div>

                    <div>
                        <span class="text-xs font-bold ">
                            {{ comma(log.amount) }} ریــــال
                        </span>
                    </div>

                </div>
                <!-- Body -->
                <div class="gap-3 mt-3 grid text-xs">
                    <div class="flex w-full items-center justify-between text-x-text-title font-bold ">
                        <span>شماره پیگیری</span>
                        <span>{{ log.referenceId || 'بدون شماره' }}</span>
                    </div>
                    <div class="flex w-full items-center justify-between text-x-text-title font-bold ">
                        <span>زمان</span>
                        <span>{{ new Date(log.updatedAt).toLocaleString("fa-IR") }}</span>
                    </div>
                    <div class="flex w-full items-center justify-between text-x-text-title font-bold ">
                        <span>توضیحات</span>
                        <span>{{ log.description }}</span>
                    </div>
                </div>
            </div>

            <div class="my-18 text-center" v-if="wallet.state.logs.length <= 0" >
                <UIcon name="solar:card-transfer-linear" class="text-x-text-body" size="80" />
                <p>تا این لحظه تراکنشی انجام نشده</p>
            </div>
            <!-- Pagination -->
            <div class="w-full flex items-center justify-between my-2" v-if="(wallet.state.logs.length > 10)">
                <UButton @click="nextPage"
                    :disabled="((wallet.state.logsStat.currentPage as number) >= (wallet.state.logsStat.pagesCount as number))"
                    label="بعدی" variant="solid" color="x-secondary" size="md" />
                <span class="text-sm ltr">
                    {{ wallet.state.logsStat.currentPage }} /
                    {{ wallet.state.logsStat.pagesCount }}
                </span>
                <UButton @click="prevPage" :disabled="!((wallet.state.logsStat.currentPage as number) > 1)" label="قبلی"
                    variant="solid" color="x-secondary" size="md" />
            </div>
        </div>
    </div>
</template>