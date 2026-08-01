<script setup lang="ts">
import comma from "comma-number"

const emit = defineEmits(['request-end'])
const wallet = useWallet(),
    {$toast} = useNuxtApp(),
    formData = wallet.state.buyCoinFormData,
    calculateToken = (val: number) => {
        setTimeout(async () => {
            await wallet.irrToCoins(val, 'token-to-irr')
        }, 1500)
    },
    buy = async () => {
        if (formData.coin < formData.min || formData.max > formData.max) return;

        const data: any = await wallet.buyCoin(formData.coin)

        if (!data?.success && data?.reason === 'ERR_VALIDATION') {
            $toast.error(data?.data.errors[0].message)
            return;
        }

        if (!data?.success) {
            $toast.error(data?.message)
            return;
        }

        wallet.state.loading.buy = true
        await Promise.all([
            wallet.getBalance(),
            wallet.getWalletLogs({}),
            wallet.getCoinBalance()
        ])
        emit("request-end")
        $toast.success('خرید سکه انجام شد با تشکر از اعتماد شما')
        wallet.state.loading.buy = false
    }

onMounted(async () => {
    await wallet.irrToCoins(formData.min, 'token-to-irr')
})

onBeforeMount(() => {
    formData.coin = formData.min
})
</script>

<template>
    <div>
        <UInputNumber class="w-full ltr" color="x-primary" locale="fa-IR" :min="formData.min" :max="formData.max"
            :size="'xl'" :ui="{ base: 'h-14 rounded-3xl border hover:bg-slate-50 border-slate-200 bg-white' }" :step="1"
            v-model="formData.coin" :default-value="formData.min" @update:model-value="calculateToken" variant="soft">
            <template #decrement>
                <UButton variant="solid" color="x-primary" class="h-10 w-10 grid place-items-center rounded-2xl">
                    <UIcon name="ic:round-minus" size="20" />
                </UButton>
            </template>
            <template #increment>
                <UButton variant="solid" color="x-primary" class="h-10 w-10 grid place-items-center rounded-2xl">
                    <UIcon name="material-symbols:add-2-rounded" size="20" />
                </UButton>
            </template>
        </UInputNumber>
        <div class="flex items-center justify-between font-bold my-3">
            <span>محاسبه به ریال</span>
            <span>{{ comma(wallet.state.coins?.toFixed() as any) || 0 }} {{ wallet.state.coins ? 'ریال' : '' }}</span>
        </div>

        <!-- Submit -->
        <UButton @click="buy" type="button" :loading="wallet.state.loading.buy" variant="solid" size="xl"
            color="x-primary" class="py-3 mt-3 font-bold" :ui="{ base: 'rounded-2xl' }" block>
            کسر از کیف پول
        </UButton>
    </div>
</template>