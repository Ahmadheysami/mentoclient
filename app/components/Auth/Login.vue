<script setup lang="ts">
import { toast } from "vue-sonner"

const mobile = ref<string>(''),
    mobileIsValid = ref<boolean>(true);
const auth = useAuth(),
    mobileValidation = (mobile: string): boolean => {
        const validate = mobile.match(/^(\+98|0)?9\d{9}$/g)

        if (!validate) {
            mobileIsValid.value = false
            return false
        }

        mobileIsValid.value = true
        return true
    },
    login = async () => {
        const validate = mobileValidation(mobile.value)

        if (!mobile.value || mobile.value.length <= 0) {
            mobileIsValid.value = false
            toast.error('لطفا شماره موبایل خود را وارد کنید')
            return;
        }

        if (!validate) {
            mobileIsValid.value = false
            toast.error('شماره تلفن وارد شده صحیح نیست')
            return;
        }

        mobileIsValid.value = true

        const response = await auth.login(mobile.value)

        if (!response?.success) {
            if (response.reason === 'ERR_VALIDATION') {
                (response?.data.errors as any[])?.forEach(err => toast.error(err.message))
                return;
            }

            toast.error(response?.message)
            return;
        }

        toast.success(response?.message)
        auth.state.currentPage = 'verify'
    }
watch(mobile, () => {
    mobile.value = mobile.value.replaceAll(/\D/g, '')
    mobileValidation(mobile.value)
})
</script>

<template>
    <div class="animate__animated animate__bounceInUp">
        <div class="space-y-3">
            <h1 class="text-2xl font-liana">ورود به حساب کاربری </h1>
            <p class="font-yekan-light">به منتویا خوش آمدید برای ورود به حساب کاربری شماره تماس خودتون رو وارد
                کنید
            </p>
        </div>

        <!-- Login Form -->
        <form class="space-y-3 pt-7 pb-4 px-2" @submit.prevent="login">
            <!-- Mobile Number -->
            <UFormField label="شماره موبایل" name="mobile" :ui="{ label: 'px-2 mb-1' }">
                <UInput maxlength="11" autocomplete="off" v-model:model-value="mobile" class="w-full" type="tel"
                    placeholder="0921 000 0000"
                    :ui="{ base: `h-14 rounded-2xl placeholder:text-lg ps-10 ${!mobileIsValid ? 'border-2 border-red-500 outline-none!' : ''}` }"
                    trailing-icon="solar:smartphone-broken" />
            </UFormField>

            <UButton :loading="auth.state.loading" :disabled="!mobileIsValid" block type="submit" label="دریافت کد ورود"
                :ui="{ base: 'rounded-2xl h-13' }" color="x-primary" size="xl" />
        </form>
    </div>
</template>