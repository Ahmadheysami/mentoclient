<script setup lang="ts">
const props = withDefaults(defineProps<{ testId: string }>(), {});
import comma from "comma-number";
import { toast } from "vue-sonner";
const testStore = useTest(),
  route = useRoute(),
  couponToggle = ref(false),
  couponCode = ref<string>(),
  testImageIsloaded = ref<boolean>(true),
  closeDrawer = async (isOpen: boolean) => {
    if (isOpen === false) {
      testStore.state.singleTest = null;
      testImageIsloaded.value = true;
      error.value = null;
      couponCode.value = "";
      couponToggle.value = false;
      useRouter().push("/test");
    }
  },
  loadTest = async (id: string) => {
    await testStore.getSingleTest(id);
    if (testStore.state.singleTest === null) {
      toast.error("صفحه مورد نظر پیدا نشد", {
        description: "صفحه ای که به دنبال آن هستید پیدا نشد",
      });
      return await navigateTo("/test");
    }
  },
  startPriceDiscount = computed(() => {
    if (testStore.state.singleTest) {
      const toStar =
        testStore.state.singleTest.starPrice / testStore.state.tokenBase;

      let final = toStar;
      if (testStore.state.singleTest.discount > 0) {
        final = final - toStar * (testStore.state.singleTest.discount / 100);
      } else {
        final = toStar;
      }
      return final.toFixed();
    }
  }),
  error = ref<string | null>(),
  t = useToast(),
  buyTest = async (testId: string, buyByStar: boolean = false) => {
    const response: any = await testStore.buyTest(
      testId,
      buyByStar,
      couponToggle.value ? couponCode.value : undefined,
    );

    if (!response?.success) {
      if (response?.reason === "ERR_VALIDATION") {
        error.value = response?.data.errors[0].message;
        return;
      }
      
      if (response?.reason === 'ERR_WALLET_BALANCE') {
        error.value = 'موجودی کیف پول کافی نیست'
        return;
      }

      error.value = response?.message;
      return;
    }

    couponToggle.value = false;
    couponCode.value = "";
    error.value = "";
    toast.success("خرید موفق", {
      description: response?.message,
    });
    await navigateTo("/test/active");
  };

watch(
  () => route.query?.s,
  async (newQuery) => {
    if (newQuery) {
      loadTest(newQuery as string);
    }
  },
  { immediate: true },
);
</script>

<template>
  <UModal
    :ui="{
      content: 'md:w-md mx-auto',
      header: 'bg-linear-0 to-x-primary-content-100 border-none',
      body: 'border-none',
      footer: 'relative bg-transparent border-none',
    }"
    v-if="useRoute().query?.s"
    @update:open="closeDrawer"
    :fullscreen="true"
    close-icon="solar:arrow-left-linear"
    :default-open="true"
  >
    <template #header> </template>
    <template #body>
      <p @click="error = null" v-if="error && error.length > 0 && error !== null" class="text-sm text-red-500 font-bold text-center">{{ error }}</p>
      <div
        class="w-full h-[80dvh] grid place-items-center"
        v-if="testStore.state.loading.getSingleTest"
      >
        <UIcon name="line-md:loading-twotone-loop" size="40" />
      </div>
      <div
        class="w-full relative pb-3 h-full overflow-y-auto"
        v-else="!testStore.state.loading.getSingleTest"
      >
        <!-- Content -->
        <div class="py-5">
          <div class="grid gap-4">
            <NuxtImg
              v-if="testImageIsloaded"
              :src="testStore.state.singleTest?.image"
              class="bg-slate-50 h-44 w-full object-cover rounded-3xl"
              :alt="testStore.state.singleTest?.title"
            />
            <div class="tags grid grid-cols-3 gap-2 overflow-hidden">
              <span
                v-if="testStore.state.singleTest?.isFeatured"
                class="text-xs py-2 bg-x-secondary-50 rounded-xl text-x-secondary-500 p-1.5 text-center"
                >پیشنهادی</span
              >
              <span
                class="text-xs py-2 bg-yellow-50 rounded-xl text-yellow-600 p-1.5 text-center"
              >
                از
                {{ testStore.state.singleTest?.targetAudience.minAge }}
                تا
                {{ testStore.state.singleTest?.targetAudience.maxAge }}
                سال
              </span>
              <span
                v-if="true"
                class="text-xs bg-emerald-50 py-2 rounded-xl text-emerald-600 p-1.5 text-center"
                >{{ testStore.state.singleTest?.questionCount }} سوال</span
              >
            </div>
            <div
              class="relative overflow-hidden rounded-3xl bg-linear-60 from-x-secondary-400 to-x-secondary-800 p-6 text-white shadow-lg"
            >
              <!-- Badges -->
              <div class="absolute top-3 right-3 flex gap-2">
                <span
                  v-if="
                    parseInt(testStore.state.singleTest?.discount as any) > 0
                  "
                  class="rounded-full bg-red-500 px-3 py-1 text-xs font-bold"
                >
                  {{ testStore.state.singleTest?.discount }} % تخفیف
                </span>

                <span
                  v-if="
                    testStore.state.singleTest?.isFeatured &&
                    parseInt(testStore.state.singleTest?.discount as any) > 0
                  "
                  class="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-x-text-title"
                >
                  پیشنهاد ویژه
                </span>
              </div>

              <div class="mt-6 grid grid-cols-2 gap-5">
                <!-- تومان -->
                <div class="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <p class="mb-1 text-xs opacity-70">پرداخت نقدی</p>

                  <p
                    class="text-sm line-through opacity-60"
                    v-if="(testStore.state.singleTest?.discount as number) > 0"
                  >
                    {{ comma(testStore.state.singleTest?.price as number) }}
                  </p>

                  <br
                    v-if="(testStore.state.singleTest?.discount as number) <= 0"
                  />
                  <div class="grid place-items-center gap-2">
                    <span class="text-xl font-black">
                      {{
                        comma(
                          (testStore.state.singleTest?.price as number) -
                            ((testStore.state.singleTest?.price as number) *
                              (testStore.state.singleTest
                                ?.discount as number)) /
                              100,
                        )
                      }}
                    </span>

                    <span class="mb-1 text-sm"> تومان </span>
                  </div>
                </div>

                <!-- سکه -->
                <div class="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <p class="mb-1 text-xs opacity-70">پرداخت با سکه</p>
                  <p
                    class="text-sm line-through opacity-60"
                    v-if="(testStore.state.singleTest?.discount as number) > 0"
                  >
                    {{
                      comma(
                        (
                          Number(testStore.state.singleTest?.starPrice) /
                          Number(testStore.state.tokenBase)
                        ).toFixed(0),
                      )
                    }}
                    سکه
                  </p>
                  <br
                    v-if="(testStore.state.singleTest?.discount as number) <= 0"
                  />
                  <div class="grid place-items-center gap-2">
                    <span class="text-3xl font-black">
                      {{ comma(startPriceDiscount as any) }}
                    </span>

                    <span class="mb-1 text-sm"> سکه </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <hr class="border-slate-200 my-6" />
          <div class="text-sm">
            <p class="font-bold mb-3 text-x-text-title text-xl">
              {{ testStore.state.singleTest?.title }}
            </p>
            <strong>توضیحات</strong>
            <p class="mt-4">
              {{ testStore.state.singleTest?.description }}
            </p>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div
        class="absolute grid place-items-center inset-0 bg-white"
        v-if="testStore.state.loading.buyTest"
      >
        <UIcon name="line-md:loading-twotone-loop" size="40" />
      </div>
      <div
        class="flex items-center justify-between w-full"
        v-if="!testStore.state.loading.getSingleTest"
      >
        <div></div>
        <div class="flex gap-2">
          <UPopover :content="{ side: 'top' }" :ui="{ content: 'rounded-3xl' }">
            <UButton
              variant="solid"
              color="x-primary"
              size="sm"
              :disabled="testStore.state.loading.buyTest"
              :ui="{ base: 'h-12 rounded-full' }"
              >کسر از کیف پول</UButton
            >
            <template #content>
              <div class="p-4 w-56 text-center space-y-4">
                <UIcon
                  name="solar:info-circle-linear"
                  size="90"
                  class="bg-x-primary-500 text-white p-3 rounded-3xl"
                />
                <p class="text-sm">
                  جهت نهایی کردن خرید خود با مشخصات زیر روی دکمه تایید کلیک کنید
                </p>
                <p class="text-xs font-bold">
                  خرید آزمون {{ testStore.state.singleTest?.title }}
                </p>
                <div>
                  <div class="flex justify-between items-center">
                    <p class="text-xs">کد تخفیف دارم!</p>
                    <USwitch
                      v-model="couponToggle"
                      size="sm"
                      color="x-primary"
                    />
                  </div>

                  <UInput
                    v-if="couponToggle"
                    placeholder="کد تخفیف را وارد کنید"
                    size="md"
                    v-model="couponCode"
                    class="w-full mt-3"
                    :ui="{ base: 'w-full placeholder:text-xs' }"
                  />
                </div>
                <UButton
                  type="button"
                  variant="solid"
                  color="x-primary"
                  size="sm"
                  :disabled="testStore.state.loading.buyTest"
                  :loading="testStore.state.loading.buyTest"
                  @click="buyTest(testStore.state.singleTest?.testId as string)"
                  :ui="{ base: 'rounded-full' }"
                  block
                  label="تایید و کسر از کیف پول"
                />
              </div>
            </template>
          </UPopover>
          <UPopover
            :content="{ side: 'right' }"
            :ui="{ content: 'rounded-3xl' }"
          >
            <UButton
              variant="subtle"
              color="x-primary"
              size="sm"
              :disabled="testStore.state.loading.buyTest"
              :ui="{ base: 'h-12 rounded-full' }"
              >کسر سکه</UButton
            >
            <template #content>
              <div class="p-4 w-56 text-center space-y-4">
                <UIcon
                  name="solar:info-circle-linear"
                  size="90"
                  class="bg-x-primary-500 text-white p-3 rounded-3xl"
                />
                <p class="text-sm">
                  جهت نهایی کردن خرید خود با مشخصات زیر روی دکمه تایید کلیک کنید
                </p>
                <p class="text-xs font-bold">
                  خرید آزمون {{ testStore.state.singleTest?.title }}
                </p>
                <div>
                  <div class="flex justify-between items-center">
                    <p class="text-xs">کد تخفیف دارم!</p>
                    <USwitch
                      v-model="couponToggle"
                      size="sm"
                      color="x-primary"
                    />
                  </div>

                  <UInput
                    v-if="couponToggle"
                    placeholder="کد تخفیف را وارد کنید"
                    size="md"
                    v-model="couponCode"
                    class="w-full mt-3"
                    :ui="{ base: 'w-full placeholder:text-xs' }"
                  />
                </div>
                <UButton
                  type="button"
                  variant="solid"
                  color="x-primary"
                  :disabled="testStore.state.loading.buyTest"
                  size="sm"
                  @click="
                    buyTest(testStore.state.singleTest?.testId as string, true)
                  "
                  :loading="testStore.state.loading.buyTest"
                  :ui="{ base: 'rounded-full' }"
                  block
                  label="کسر از سکه ها"
                />
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </template>
  </UModal>
</template>
