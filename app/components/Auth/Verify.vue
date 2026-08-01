<script setup lang="ts">
const auth = useAuth(),
    {$toast} = useNuxtApp(),
    otp = ref<number[]>([]),
    second = 100,
    resendOtp = reactive({
        active: false,
        seconds: second
    }),
    verified = ref<'yes' | 'no' | 'suspend'>('suspend'),
    otpDisabled = ref(false),
    goToLoginPage = async () => {
        await auth.removeCookie('otp-token')
        auth.state.currentPage = 'login'
    },
    otpVerification = async () => {
        otpDisabled.value = true
        let loading$toast = $toast.loading('در حال تایید کد ورود', {})
        const code = otp.value.toString().split(",").map(str => str.trim()).join(""),
            verify: any = await auth.verifyOtp(code)

        $toast.dismiss(loading$toast)
        
        if (verify?.success) {
            $toast.success(verify?.message)
            verified.value = 'yes'
            await auth.removeCookie('otp-token')
            await navigateTo('/', {external: true})
        } else {
            $toast.error(verify?.message)
            verified.value = 'no'
            otp.value = []
            otpDisabled.value = false
            return;
        }
    },
    resendOtpTimer = () => {
        let interval = setInterval(() => {
            resendOtp.seconds --
            
            if (resendOtp.seconds <= 0) {
                resendOtp.active = true
                clearInterval(interval)
            }
        }, 1000)
    },
    resendOtpHandler = async () => {
        if (!resendOtp.active) {
            $toast.error("بعد از پایان زمان صبر کنید", {
                description: ` زمان باقی مانده‌ : ${resendOtp.seconds} ثانیه`
            })
            return;
        }

        // get new otp code
        const newOtpCode: any = await auth.resendOtp()
        if (!newOtpCode?.success) {
            $toast.error(newOtpCode?.message)
            return;
        }

        $toast.success(newOtpCode?.message)
        resendOtp.active = false
        resendOtp.seconds = second
        resendOtpTimer()
    }

onBeforeRouteLeave(async () => {
    await goToLoginPage()
})

onMounted(() => {
    resendOtpTimer()
})

</script>

<template>
    <div class="animate__animated animate__bounceInUp">
        <div class="space-y-3">
            <h1 class="text-2xl font-liana!">تایید کد ورود</h1>
            <p class="font-yekan-light">
                برای ورود به منتویا کد ورود ارسال شده را به صورت صحیح ارسال کنید
            </p>
        </div>

        <!-- ٰVerify Form -->
        <form class="space-y-3 pt-7 pb-4 px-2">
            <!-- OTP Inputs -->
            <div class="grid place-items-center">
                <UPinInput size="xl" :disabled="otpDisabled" :length="4" :otp="true" type="number" v-model:model-value="otp"
                    @complete="otpVerification" :ui="{ base: `w-17 h-17 rounded-2xl font-liana! text-lg outline ${verified === 'yes' ? 'outline-green-500' : verified === 'no' ? 'outline-red-500' : ''}`}" />
            </div>
            
            <div class="mt-4">
                <UButton :loading="auth.state.loading" @click="resendOtpHandler" block :disabled="!resendOtp.active" class="cursor-pointer" color="x-secondary" variant="subtle" :ui="{base: 'py-3 font-bold rounded-3xl grid place-items-center flex gap-3'}" >کدی دریافت نکردم!
                    <span v-if="resendOtp.seconds > 0">
                        {{ resendOtp.seconds }} ثانیه
                    </span>
                </UButton>
            </div>
        </form>

        <UButton block @click="goToLoginPage" variant="link" class="text-x-text-subtitle text-12">شماره موبایل رو صحیح وارد نکردی! <span
                dir="ltr" class="font-bold border-b text-x-primary-500"></span></UButton>
    </div>
</template>