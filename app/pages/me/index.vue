<script setup lang="ts">
import { DrawerContent, DrawerOverlay, DrawerPortal, DrawerRoot, DrawerTrigger } from 'vaul-vue'

useSeoMeta({
    title: "حساب کاربری "
})
definePageMeta({
    middleware: ['auth']
})

const user = useUser(),
    auth = useAuth(),
    {$toast} = useNuxtApp(),
    me = user.state.user,
    sidebarOpen = ref<boolean>(false),
    sidebarAction = ref<string | null>(''),
    sidebarToggleAction = (open: boolean, action: string | null) => {
        if (action === null || !action) return;
        sidebarAction.value = action
        sidebarOpen.value = open
    },
    actionsData: Record<string, Record<string, any>> = {
        'edit-avatar': {
            title: "ویرایش عکس پروفایل"
        },
        'edit-fullName': {
            title: "ویرایش نام "
        },
        'edit-position': {
            title: "ویرایش موقعیت شغلی"
        },
        'edit-age': {
            title: "ویرایش سن"
        },
        'edit-email': {
            title: "ثبت ایمیل"
        },
        'edit-verify': {
            title: "تایید ایمیل"
        },
    },
    sidebarUpdateOpen = (open: any) => {
        if (open === false) {
            for (let item in user.state.errors) {
                ((user.state.errors as any)[item]) = ''
            }
            sidebarOpen.value = false
            sidebarAction.value = null
            emailFormData.email = ''
            emailFormData.otp = []
        }
    },
    // info list
    userInfos = reactive<{
        icon: string;
        title: string;
        description: any,
        action: string | null
    }[]>([
        {
            icon: 'solar:user-broken',
            title: 'نام و نام خانوادگی',
            description: `${me?.fullName.first || 'بدون'} ${me?.fullName.last || 'نام'}`,
            action: 'edit-fullName'
        },
        {
            icon: 'solar:phone-rounded-linear',
            title: 'شماره موبایل',
            description: me?.mobile,
            action: null
        },
        {
            icon: 'solar:check-read-broken',
            title: 'وضعیت',
            description: `${me?.isActive ? 'فعال' : 'غیر فعال'}`,
            action: null
        },
        {
            icon: 'material-symbols:alternate-email',
            title: 'ایمیل',
            description: me?.email || 'وارد نشده',
            action: me?.emailIsVerification ? null : 'edit-email'
        },
        {
            icon: 'solar:buildings-outline',
            title: 'موقعیت شغلی',
            description: me?.position || 'وارد نشده',
            action: 'edit-position'
        },
        {
            icon: 'solar:user-plus-rounded-linear',
            title: 'سن',
            description: me?.age || 'وارد نشده',
            action: 'edit-age'
        }
    ]),
    formData = reactive({
        fullName: {
            first: me?.fullName.first,
            last: me?.fullName.last
        },
        position: me?.position,
        age: me?.age || +''
    }),
    avatar = ref<File | null>(null),
    avatarPreview = ref<string | undefined>(''),
    changeFileInput = (event: any) => {
        avatar.value = event.currentTarget?.files[0]

        const reader = new FileReader()
        reader.onload = function (e) {
            avatarPreview.value = e.target?.result as any
        }

        reader.readAsDataURL(avatar.value as any)
    },
    setAvatar = async () => {
        if (avatar.value === null) {
            user.state.errors.avatar = "لطفا عکس پروفایل  خود را انتخاب کن"
            return;
        }
        const fd = new FormData()
        fd.append("image", avatar.value)

        const response: any = await user.setUserAvatar(fd)

        if (!response?.success) {
            user.state.errors.avatar = (response?.message as string)
            return;
        }

        if (user.state.user) {
            user.state.user.avatar = avatarPreview.value as string
        }
        sidebarOpen.value = false
        sidebarAction.value = null
        clearInputFile()

        $toast.success(response?.message)
    },
    clearInputFile = () => {
        avatarPreview.value = ''
        avatar.value = null
    },
    editFormIsValid = computed(() => {
        switch (sidebarAction.value) {
            case "edit-fullName":
                return !!formData.fullName.first && !!formData.fullName.last
            case 'edit-age':
                return !!formData.age && !isNaN(formData.age)

            case 'edit-position':
                return !!formData.position
            case 'edit-email':
                return !!emailFormData.email && emailFormData.email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g)
            case 'edit-verify':
                return !!(emailFormData.otp.length > 0)
            default:
                return false
        }
    }),
    updateUser = async () => {
        if (!editFormIsValid.value) return;

        const response: any = await user.updateUser({
            age: +formData.age,
            name: formData.fullName.first as string,
            family: formData.fullName.last as string,
            position: formData.position || ''
        })

        if (!response?.success) {
            if (response?.statusCode === 400) {
                (response?.data.errors as []).forEach((item: any) => $toast.error(item.message))
                return
            }

            $toast.error(response.message)
            return;
        }
        if (user.state.user) {
            // update user
            user.state.user.fullName.first = formData.fullName.first as string
            user.state.user.fullName.last = formData.fullName.last as string
            user.state.user.age = +formData.age
            user.state.user.position = formData.position as string

            // update user info
            const index = userInfos.findIndex(i => i.action === sidebarAction.value)
            if (index !== -1) {
                if (userInfos[index]) {
                    if (sidebarAction.value === 'edit-fullName') {
                        userInfos[index].description = `${formData.fullName.first} ${formData.fullName.last}`
                    } else if (sidebarAction.value === 'edit-age')
                        userInfos[index].description = formData.age
                    else if (sidebarAction.value === 'edit-position')
                        userInfos[index].description = formData.position
                }
            }
        }

        sidebarOpen.value = false
        sidebarAction.value = ''
        $toast.success(response?.message)
    },
    // Email Verification and registration
    emailFormData = reactive({
        email: '',
        otp: []
    }),
    getMailVerificationOtp = async () => {
        if (!editFormIsValid.value) return

        const res: any = await user.getMailVerificationOtp(emailFormData.email)

        console.log(res);

        if (res?.reason && res.reason === "ERR_VALIDATION") {
            $toast.error(res?.data.errors[0]?.message)
            return;
        }

        if (!res?.success) {
            $toast.error(res?.message)
            return;
        }


        sidebarToggleAction(true, 'edit-verify')
        $toast.success('کد تایید به ایمیل شما ارسال شد')
    },
    returnToEmailSidebar = () => {
        sidebarToggleAction(true, 'edit-email')
        emailFormData.otp = []
    },
    verifyEmail = async () => {
        const code = emailFormData.otp.toString().split(",").map(str => str.trim()).join(""),
            res = await user.mailVerification(code);

        if (!res?.success) {
            emailFormData.otp = []
            $toast.error(res?.message)
            return
        }
        sidebarAction.value = ''
        sidebarOpen.value = false
        emailFormData.email = ''
        emailFormData.otp = []

        if (user.state.user) {
            user.state.user.email = emailFormData.email

            const index = userInfos.findIndex(i => i.action === 'edit-email')
            if (index !== -1) {
                if (userInfos[index]) {
                    userInfos[index].description = emailFormData.email
                    userInfos[index].action = null
                }
            }
        }

        setTimeout(() => {
            $toast.success(res?.message)
        }, 500)
    }

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
                    حساب کاربری
                </strong>
            </template>
        </UDashboardToolbar>

        <!-- Profile -->
        <div class="grid place-items-center my-3">
            <!-- Avatar -->
            <UAvatar :src="me?.avatar" :ui="{ root: 'w-40 h-40' }" size="xl" alt="User Profile Avatar"
                crossorigin="anonymous" />
            <UButton variant="link" color="x-primary" size="xl" class="font-bold mt-3" block
                @click="sidebarToggleAction(!sidebarOpen, 'edit-avatar')">
                ویرایش
            </UButton>
        </div>

        <!-- Information -->
        <div class="w-full">
            <div class="px-7 py-4 hover:bg-slate-200 transition flex justify-between items-center group cursor-pointer"
                v-for="info of userInfos" @click="sidebarToggleAction(true, info.action)">
                <div class="flex items-center gap-3">
                    <UIcon :name="info.icon" size="32" class="text-x-text-body" />
                    <div class="space-y-2">
                        <strong class="font-bold text-[15px]">{{ info.title }}</strong>
                        <p class="text-x-text-subtitle">{{ info.description }}</p>
                    </div>
                </div>

                <span class="text-x-primary-500 font-bold text-sm group-hover:visible invisible"
                    v-if="info.action !== null">ویرایش</span>
            </div>
        </div>
        
        <!-- Bottom Sidebar -->
        <DrawerRoot :dismissible="!user.state.loading" v-model:open="sidebarOpen" @update:open="sidebarUpdateOpen">
            <DrawerPortal>
                <DrawerOverlay class="fixed top-0 h-full left-1/2 -translate-x-1/2  bg-black/10 md:w-md w-full" />

                <DrawerContent
                    class="fixed bottom-0 left-1/2 -translate-x-1/2 rounded-t-3xl bg-white p-6 md:w-md w-full">
                    <!-- Hanlder -->
                    <div class="absolute left-1/2 top-3 -translate-x-1/2 bg-slate-200 w-20 h-2 rounded-full"> </div>
                    <strong class="mt-2 mb-6 inline-block text-x-text-title ">{{ actionsData[sidebarAction as
                        string]?.title
                        }}</strong>

                    <!--  -->
                    <!-- Edit Avatar -->
                    <div v-if="sidebarAction === 'edit-avatar'" class=" grid place-items-center">
                        <div class="relative w-40 h-40 rounded-full ">
                            <UAvatar :src="avatarPreview || me?.avatar" loading="lazy" :ui="{ root: 'w-40 h-40' }"
                                size="xl" alt="User Profile Avatar" crossorigin="anonymous" />
                            <!-- Preview -->
                            <span v-if="avatarPreview" @click="clearInputFile"
                                class="absolute -top-2 -right-2 w-9 h-9 grid place-items-center bg-blue-500 rounded-full ">
                                <UIcon name="solar:close-circle-bold" class="text-white" size="30" />
                            </span>
                            <!-- FIle Input -->
                            <div class="absolute inset-0 bg-black/60 rounded-full grid place-items-center group"
                                :class="{ 'invisible opacity-0 transition hover:visible! hover:opacity-100': !!avatarPreview }">
                                <UIcon name="solar:upload-minimalistic-outline" size="50"
                                    class="text-x-white group-hover:sclae-80 transition-transform" />
                                <UInput title="" @change="changeFileInput($event)" type="file"
                                    accept=".png,.jpeg,.jpg,.webp" class="absolute inset-0 opacity-0" />
                            </div>
                        </div>

                        <p class="my-3 text-red-500">{{ user.state.errors.avatar }}</p>

                        <UButton variant="solid" @click="(setAvatar as any)" :loading="user.state.loading" size="xl"
                            color="x-primary" class="text-lg py-3 mt-3 font-bold" :ui="{ base: 'rounded-2xl' }" block>
                            ویرایش پروفایل
                        </UButton>
                    </div>

                    <!-- Edit form -->
                    <div v-if="!['edit-avatar', 'edit-email', 'edit-verify'].includes(sidebarAction as string)"
                        class="w-full">
                        <UForm @submit.prevent="updateUser">
                            <div class="flex gap-3">
                                <UFormField :error="!formData.fullName.first" label="نام" size="xl"
                                    v-if="sidebarAction === 'edit-fullName'">
                                    <UInput v-model="formData.fullName.first" class="w-full"
                                        :ui="{ base: 'rounded-2xl h-13' }" />
                                </UFormField>
                                <UFormField :error="!formData.fullName.last" size="xl" label="نام خانوادگی"
                                    v-if="sidebarAction === 'edit-fullName'">
                                    <UInput v-model="formData.fullName.last" class="w-full"
                                        :ui="{ base: 'rounded-2xl h-13' }" />
                                </UFormField>
                            </div>

                            <UFormField :error="!formData.age" help="سن خود را دقیق وارد کنید" size="xl"
                                v-if="sidebarAction === 'edit-age'">
                                <UInput v-model="formData.age" type="tel" maxlength="3" class="w-full"
                                    :ui="{ base: 'rounded-2xl h-13' }" />
                            </UFormField>

                            <UFormField :error="!formData.position" help="موقعیت شغلی فعلی را وارد کنید" size="xl"
                                v-if="sidebarAction === 'edit-position'">
                                <UInput v-model="formData.position" type="text" class="w-full"
                                    :ui="{ base: 'rounded-2xl h-13' }" />
                            </UFormField>

                            <UButton type="submit" :loading="user.state.loading"
                                :disabled="!editFormIsValid || user.state.loading" variant="solid" size="xl"
                                color="x-primary" class="text-lg py-3 mt-3 font-bold" :ui="{ base: 'rounded-2xl' }"
                                block>
                                ویرایش
                            </UButton>
                        </UForm>
                    </div>

                    <!-- Email Verification= -->
                    <div v-if="sidebarAction === 'edit-email'">
                        <UFormField dir="ltr" :ui="{ help: 'rtl' }" :error="!editFormIsValid || !emailFormData.email"
                            help="در وارد کردن ایمیل دقت کنید" size="xl">
                            <UInput icon="material-symbols:alternate-email" size="xl" dir="ltr"
                                v-model="emailFormData.email" type="email" class="w-full"
                                :ui="{ base: 'rounded-2xl h-13' }" />
                        </UFormField>

                        <UButton @click="getMailVerificationOtp" type="button" :loading="user.state.loading"
                            :disabled="!editFormIsValid || user.state.loading" variant="solid" size="xl"
                            color="x-primary" class="text-lg py-3 mt-3 font-bold" :ui="{ base: 'rounded-2xl' }" block>
                            ارسال کد تایید
                        </UButton>
                    </div>

                    <!-- Verify OTP code= -->
                    <div v-if="sidebarAction === 'edit-verify'">

                        <UPinInput @complete="verifyEmail" v-model="emailFormData.otp" :length="6" type="number"
                            :fixed="true" :ui="{ base: 'w-full h-15 rounded-2xl font-yekan-light' }"
                            color="x-primary" />
                        <UButton @click="returnToEmailSidebar" variant="link" color="x-primary" block
                            class="font-bold mt-2">
                            ایمیل
                            اشتباهه !</UButton>
                    </div>
                </DrawerContent>
            </DrawerPortal>
        </DrawerRoot>
    </UPage>
</template>

<style lang="scss">
.ba-bs-sheet {
    max-width: 448px;
    border-radius: 28px 28px 0 0;
    outline: 4px solid #ffffffce;
}
</style>