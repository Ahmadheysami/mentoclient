<script setup lang="ts">
import { toast } from 'vue-sonner'

const emit = defineEmits(['request-end'])
const wallet = useWallet()
onBeforeMount(async () => {
    await wallet.irrToCoins((wallet.state.wallet.spending.balance as number) || 0)
})

const convert = async () => {
    const response: any = await wallet.autoConvertToCoin()

    if (!response?.success) {
        toast.error(response?.message, {duration: 10000})
        emit('request-end')
        return;
    }
    
    if (response?.success) {
        await wallet.getBalance()
        await wallet.getWalletLogs({})
        await wallet.getCoinBalance()
        emit('request-end')
        toast.success(response?.message)
    }
}
</script>

<template>
    <div class="">
        <UAlert
            v-if="wallet.state.coins && (wallet.state.wallet.spending.balance as number) > wallet.state.formData.min"
            variant="soft" color="x-primary" class="my-3" size="xl" :ui="{ root: 'rounded-3xl' }"
            title="توجه داشته باشید که">
            <template #description>
                <p>
                    با تایید شما, تمام موجودی کیف پول به سکه تبدیل میشود و امکان بازگشت آن به کیف پول وجود ندارد
                </p>
                <strong class="mt-2 text-center block">با اطمینان کامل اقدام کنید</strong>
            </template>
        </UAlert>

        <UAlert v-if="!wallet.state.coins" variant="solid" color="x-secondary" class="my-3" size="xl"
            :ui="{ root: 'rounded-3xl' }" title="هشدار">
            <template #description>
                <p>
                    در حال حاضر به دلیل کمبود موجودی امکان تبدیل خودکار موجودی کیف پول به سکه وجود ندارد
                </p>
            </template>
        </UAlert>

        <!-- Submit -->
        <UButton @click="convert"
            v-if="wallet.state.coins && (wallet.state.wallet.spending.balance as number) > wallet.state.formData.min"
            type="button" :loading="wallet.state.loading.convert" variant="solid" size="xl" color="x-primary" class="py-3 mt-3 font-bold"
            :ui="{ base: 'rounded-2xl' }" block>
            تبدیل موجودی به {{ wallet.state.coins }} سکه
        </UButton>
    </div>
</template>