<script setup lang="ts">
import comma from "comma-number"
import { DrawerContent, DrawerOverlay, DrawerPortal, DrawerRoot, DrawerTrigger } from 'vaul-vue'
import { toast } from "vue-sonner"
const walletOptions = [
    {
        label: 'شارژ',
        icon: "material-symbols:add-2-rounded",
        action: 'deposit',
        description: "شارژ کیف پول"
    },

    {
        label: 'خرید سکه',
        icon: "majesticons:coins-line",
        action: 'buy-coin',
        description: "خرید و اضافه کردن سکه"
    },
    {
        label: "کیف به سکه",
        icon: 'bitcoin-icons:flip-horizontal-filled',
        action: 'convert-wtoc',
        description: "تبدیل کیف پول به سکه"
    }
],
    wallet = useWallet(),
    sheetOpen = ref<boolean>(false),
    sheetAction = ref<string>(''),
    sheetSetAction = (open: boolean, action: string) => {
        sheetAction.value = action
        sheetOpen.value = open
    },
    formData = wallet.state.formData,
    onSheetOpen = (open: boolean) => {
        if (open === false) {
            sheetAction.value = ''
            sheetOpen.value = false

            formData.amount = formData.min
        }
    },
    reloadBalance = async () => {
        await wallet.getBalance()
        await wallet.getCoinBalance()
    },
    route = useRoute(),
    payState = ref<string | null>(null),
    checkPay = () => {
        if (route.query?.success) {
            const value = route.query?.success
            if (import.meta.client) {
                const isPayActive = localStorage.getItem("pay_active")
                if (isPayActive) {
                    payState.value = value as string
                    localStorage.removeItem("pay_active")
                } else {
                    payState.value = null
                }
            }
        }
    },
    endConvertHandler = () => {
        sheetAction.value = ''
        sheetOpen.value = false
    }

// fetch default data when onmpunt component
onMounted(async () => {
    checkPay()
    await wallet.getBalance()
    await wallet.getCoinBalance()
})
</script>
<template>

    <div class="rounded-3xl relative ">
        <UAlert variant="soft" :ui="{ title: 'font-bold text-[17px]', description: 'text-[15px]' }" size="xl"
            :close="true" @click="payState = null" color="x-primary" title="وضعیت پرداخت" v-if="payState !== null"
            class="mt-2 mb-4">
            <template #description>
                {{ payState === '0' ? 'پرداخت انجام نشد' : payState === '1' ? 'پرداخت با موفقیت انجام شد' : payState ===
                    '2' ? 'پرداخت قبلا انجام شده' : payState === '3' ? 'پاسخی از مرجع دریافت نشد' : '' }}
            </template>
        </UAlert>
        <div class="relative h-42 bg-linear-to-tr from-x-primary-400 grid place-items-center to-indigo-800 rounded-4xl">
            <!-- Leyer -->
            <div class="absolute inset-0 rounded-[16px] pattern opacity-30"></div>

            <!-- Refresh balance -->
            <button @click="reloadBalance" :class="{ 'animate-spin scale-90': wallet.state.loading.getBalance }"
                class="text-sm text-white absolute top-4 left-4">
                <UIcon name="solar:refresh-bold" size="30" />
            </button>

            <div class="absolute right-4 top-4 flex items-center gap-2">
                <span class="text-white font-bold mt-1">{{ wallet.state.coinsBalance || 0 }}</span>
                <UIcon name="duo-icons:coin-stack" size="29" class="text-yellow-400" />
            </div>

            <!-- Balance -->
            <span class="text-x-white text-5xl font-extrabold"
                :class="{ 'text-lg text-center': wallet.state.errors.balance }" v-if="!wallet.state.loading.getBalance">
                {{ !wallet.state.errors.balance ? comma(((wallet.state.wallet.spending?.balance as number)) || 0) :
                    wallet.state.errors.balance }}
                <p class="text-sm text-center" v-if="!wallet.state.errors.balance">ریال</p>
            </span>
            <!-- Skeleton -->
            <USkeleton class="h-10 w-44 bg-x-primary-500/30 rounded-xl" v-if="wallet.state.loading.getBalance" />
        </div>
        <!-- Features Item -->
        <div
            class="flex flex-row-reverse items-center justify-center bg-white -translate-y-8/12 rounded-3xl py-2 px-3 gap-5 place-items-center mt-4 absolute right-1/2 translate-x-1/2">
            <UTooltip v-for="item of walletOptions" :text="item.description" :delay-duration="0"
                @click="sheetSetAction(true, item.action)" class="cursor-pointer">
                <div class="grid gap-2 place-items-center w-15 group">
                    <UIcon :name="item.icon"
                        class="text-3xl group-hover:scale-90 transition-transform text-x-primary-500 scale-115" />
                    <p class="text-[12px] text-nowrap text-center text-x-text-subtitle group-hover:font-bold">{{
                        item.label }}</p>
                </div>
            </UTooltip>
        </div>
    </div>

    <!-- Bottom Sidebar -->
    <DrawerRoot :dismissible="!wallet.state.sheetDissmiable" v-model:open="sheetOpen" @update:open="onSheetOpen">
        <DrawerPortal>
            <DrawerOverlay class="fixed top-0 h-full left-1/2 -translate-x-1/2  bg-black/10 md:w-md w-full" />

            <DrawerContent class="fixed bottom-0 left-1/2 -translate-x-1/2 rounded-t-3xl bg-white p-6 md:w-md w-full">
                <!-- Hanlder -->
                <div class="absolute left-1/2 top-3 -translate-x-1/2 bg-slate-200 w-20 h-2 rounded-full"> </div>
                <p class="text-sm font-bold my-4">{{walletOptions.find((h) => sheetAction == h.action)?.description}}
                </p>

                <!-- Deposit -->
                <WalletDeposit v-if="sheetAction === 'deposit'" />

                <!-- Auto Convert wallet inventory to coins -->
                <WalletAutoConvertToCoin v-if="sheetAction === 'convert-wtoc'" @request-end="endConvertHandler" />

                <!-- Buy coin -->
                <WalletBuyToken v-if="sheetAction === 'buy-coin'" @request-end="endConvertHandler" />
            </DrawerContent>
        </DrawerPortal>
    </DrawerRoot>
</template>

<style lang="scss">
.pattern {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' version='1.1' xmlns:xlink='http://www.w3.org/1999/xlink' xmlns:svgjs='http://svgjs.dev/svgjs' width='400' height='170' preserveAspectRatio='none' viewBox='0 0 400 170'%3e%3cg mask='url(%26quot%3b%23SvgjsMask1105%26quot%3b)' fill='none'%3e%3cpath d='M21 170L191 0L237.5 0L67.5 170z' fill='url(%26quot%3b%23SvgjsLinearGradient1106%26quot%3b)'%3e%3c/path%3e%3cpath d='M156 170L326 0L401 0L231 170z' fill='url(%26quot%3b%23SvgjsLinearGradient1106%26quot%3b)'%3e%3c/path%3e%3cpath d='M395 170L225 0L111 0L281 170z' fill='url(%26quot%3b%23SvgjsLinearGradient1107%26quot%3b)'%3e%3c/path%3e%3cpath d='M251 170L81 0L-21 0L149 170z' fill='url(%26quot%3b%23SvgjsLinearGradient1107%26quot%3b)'%3e%3c/path%3e%3cpath d='M244.0968583743578 170L400 14.096858374357794L400 170z' fill='url(%26quot%3b%23SvgjsLinearGradient1106%26quot%3b)'%3e%3c/path%3e%3cpath d='M0 170L155.9031416256422 170L 0 14.096858374357794z' fill='url(%26quot%3b%23SvgjsLinearGradient1107%26quot%3b)'%3e%3c/path%3e%3c/g%3e%3cdefs%3e%3cmask id='SvgjsMask1105'%3e%3crect width='400' height='170' fill='white'%3e%3c/rect%3e%3c/mask%3e%3clinearGradient x1='0%25' y1='100%25' x2='100%25' y2='0%25' id='SvgjsLinearGradient1106'%3e%3cstop stop-color='rgba(117%2c 172%2c 255%2c 0.41)' offset='0'%3e%3c/stop%3e%3cstop stop-opacity='0' stop-color='rgba(117%2c 172%2c 255%2c 0.41)' offset='0.66'%3e%3c/stop%3e%3c/linearGradient%3e%3clinearGradient x1='100%25' y1='100%25' x2='0%25' y2='0%25' id='SvgjsLinearGradient1107'%3e%3cstop stop-color='rgba(117%2c 172%2c 255%2c 0.41)' offset='0'%3e%3c/stop%3e%3cstop stop-opacity='0' stop-color='rgba(117%2c 172%2c 255%2c 0.41)' offset='0.66'%3e%3c/stop%3e%3c/linearGradient%3e%3c/defs%3e%3c/svg%3e");
    background-size: cover;
}
</style>