<script setup lang="ts">
import { faTomanText } from "~/utils/fa"

const wallet = useWallet(),
    {$toast} = useNuxtApp(),
    formData = wallet.state.formData,
    // Suggested chips are quoted in ریال (the wire unit) and only converted
    // at display — clicking one still writes a ریال figure into `formData`.
    suggestedAmounts = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 12_000_000, 15_000_000],
    /**
     * The one تومان → ریال bridge in the app: the reader types and sees
     * **تومان** (this app's money base), while `formData` — and therefore
     * `POST /api/wallet/deposit` — keeps the server's **ریال** unit.
     */
    amountToman = computed({
        get: () => Math.round(((formData.amount as number) || 0) / 10),
        set: (value: number | null) => {
            formData.amount = Math.round((value ?? 0) * 10)
        }
    }),
    isValid = computed(() => {
        return !(formData.amount < formData.min) &&
            !(formData.amount > formData.max)
    }),
    deposit = async () => {
        try {
            if (!isValid) return
            wallet.state.sheetDissmiable = true
            // ریال on the wire: the UI holds تومان, the gateway charges ریال.
            const res: any = await wallet.deposit(formData.amount)
            if (!res.success && res.reason === 'ERR_VALIDATION') {
                res.data?.errors.forEach((err: { message: string }) => $toast.error(err.message))
                return;
            }

            // check response failed
            if (!res?.success) {
                $toast.error(res?.message)
                return;
            }

            $toast.success("به درگاه پرداخت هدایت میشوید ...")
            if (import.meta.client) {
                localStorage.setItem("pay_active", '1')
            }
            await navigateTo(res?.payment, { external: true })
        } finally {
            wallet.state.sheetDissmiable = false
        }
    }
</script>

<template>
    <div>
        <UInputNumber class="w-full ltr" color="x-primary" locale="fa-IR" :max="formData.max / 10"
            :min="formData.min / 10" :size="'xl'"
            :ui="{ base: 'h-14 rounded-3xl border hover:bg-slate-50 border-slate-200 bg-white' }" :step="1_000"
            v-model="amountToman" variant="soft">
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
        <!-- Suggested Amounts -->
        <div class="mt-4">
            <div class="flex flex-wrap gap-3">
                <span
                    :class="{ 'scale-90 bg-x-secondary-600 hover:bg-x-secondary-700 text-x-white': formData.amount === item }"
                    class="p-2.5 bg-x-secondary-500/20 text-x-secondary-600 hover:bg-x-secondary-500/40 transition-all text-xs rounded-2xl font-bold"
                    @click="formData.amount = item" v-for="item of suggestedAmounts">{{ faTomanText(item) }}
                </span>
            </div>
        </div>

        <p class="mt-5 mb-2 text-sm font-bold flex justify-between items-center"><span>مبلغ قابل پرداخت</span> <span>{{
            faTomanText(formData.amount) }}</span></p>

        <!-- Submit -->
        <UButton @click="deposit" :disabled="!isValid || wallet.state.loading.deposit"
            :loading="wallet.state.loading.deposit" type="submit" variant="solid" size="xl" color="x-primary"
            class="py-3 mt-3 font-bold" :ui="{ base: 'rounded-2xl' }" block>
            انتقال به درگاه پرداخت
        </UButton>
    </div>
</template>