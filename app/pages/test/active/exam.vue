<script lang="ts" setup>
import { motion } from "motion-v";
definePageMeta({
  middleware: ["auth"],
  layout: "blank",
});

const acceptTerms = ref<boolean>(false),
  route = useRoute(),
  { $toast } = useNuxtApp(),
  testStore = useTest(),
  terms = [
    "این آزمون صرفاً برای اهداف اطلاع‌رسانی و خودشناسی طراحی شده است و نتایج آن جایگزین تشخیص و درمان تخصصی روانشناسی یا روانپزشکی نمی‌باشد.",
    "شرکت‌کننده با پذیرش شرایط، مسئولیت کامل استفاده از نتایج آزمون را بر عهده می‌گیرد و هرگونه تصمیم‌گیری بر اساس نتایج، تحت مسئولیت شخصی کاربر خواهد بود.",
    "نتایج این آزمون بر اساس پاسخ‌های ارائه‌شده توسط کاربر محاسبه می‌شود و هیچ‌گونه تضمینی درباره صحت مطلق یا جامعیت نتایج وجود ندارد.",
    "برخی سوالات ممکن است شامل محتوای احساسی یا حساس باشند. شرکت‌کننده با پذیرش شرایط، آمادگی خود را برای مواجهه با این گونه سوالات اعلام می‌دارد.",
    "برای دستیابی به نتایج دقیق‌تر، توصیه می‌شود آزمون در محیطی آرام و بدون مزاحمت و با تمرکز کامل انجام شود. مجموعه مسئولیتی در قبال شرایط محیطی کاربر ندارد.",
    "دقت نتایج کاملاً وابسته به صداقت و دقت کاربر در پاسخ‌دهی است. هرگونه پاسخ نادرست یا غیرواقعی می‌تواند نتایج را تحت تأثیر قرار دهد.",
    "نتایج این آزمون صرفاً جنبه راهنمایی دارد و نباید به‌عنوان مبنای تصمیم‌گیری‌های مهم زندگی، شغلی، تحصیلی یا درمانی استفاده شود.",
    "در صورت احساس ناراحتی، استرس یا هرگونه واکنش منفی حین آزمون، شرکت‌کننده موظف است بلافاصله آزمون را متوقف کرده و در صورت نیاز به روانشناس یا مشاور مراجعه نماید.",
    "اطلاعات و پاسخ‌های شما محرمانه باقی می‌ماند و صرفاً برای تحلیل آماری استفاده می‌شود. مجموعه هیچ‌گونه مسئولیتی در قبال افشای اطلاعات توسط کاربر یا اشخاص ثالث ندارد.",
    "استفاده از این آزمون به معنای پذیرش کامل کلیه قوانین و مقررات فوق است. مجموعه حق تغییر یا به‌روزرسانی شرایط را بدون اطلاع قبلی محفوظ می‌دارد.",
  ],
  acceptTermsHandler = () => {
    acceptTerms.value = true;
  },
  
  // نگهداری پاسخ آزمون‌های عادی
  selectedItem = reactive<{ qId: string; oId: string; subOptionId?: string }>({
    qId: "",
    oId: "",
  }),

  // نگهداری اختصاصی پاسخ‌های Most و Least برای آزمون DISC در سوال جاری
  discSelections = reactive<{
    most: { qId: string; oId: string; subOptionId: string } | null;
    least: { qId: string; oId: string; subOptionId: string } | null;
  }>({
    most: null,
    least: null,
  }),

  questions = ref<QuestionsData["questions"]>(),
  questionCount = ref<number>(),
  currentQuestion = ref<number>(0),
  answerKeys = ref<{ qId: string; oId: string; subOptionId?: string }[]>([]),
  resultModal = ref<boolean>(false),
  resultData = reactive({
    code: "",
    title: "",
    body: "",
  }),

  // انتخاب پاسخ برای آزمون‌های غیر DISC
  selectAnswer = (questionId: string, optionId: string) => {
    selectedItem.qId = questionId;
    selectedItem.oId = optionId;
  },

  // انتخاب پاسخ برای آزمون DISC با جلوگیری از انتخاب یکسان برای Most و Least
  selectDiscAnswer = (
    questionId: string,
    optionId: string,
    subOptionId: string,
    type: 'most' | 'least'
  ) => {
    if (type === 'most') {
      // اگر همین optionId قبلا به عنوان least انتخاب شده بود، انتخاب least را پاک کن
      if (discSelections.least?.oId === optionId) {
        discSelections.least = null;
      }
      discSelections.most = { qId: questionId, oId: optionId, subOptionId };
    } else {
      // اگر همین optionId قبلا به عنوان most انتخاب شده بود، انتخاب most را پاک کن
      if (discSelections.most?.oId === optionId) {
        discSelections.most = null;
      }
      discSelections.least = { qId: questionId, oId: optionId, subOptionId };
    }
  },

  // اعتبارسنجی پاسخ سوال جاری و اضافه کردن به لیست کلی پاسخ‌ها
  validateAndSaveCurrentQuestion = (): boolean => {
    const isDisc = testStore.state.questions?.type === 'DISC';

    if (isDisc) {
      if (!discSelections.most || !discSelections.least) {
        $toast.info("لطفاً برای این سوال هم «بیشترین» (Most) و هم «کمترین» (Least) را انتخاب کنید");
        return false;
      }

      // چک نهایی برای جلوگیری از یکسان بودن گزینه انتخاب شده
      if (discSelections.most.oId === discSelections.least.oId) {
        $toast.error("یک گزینه نمی‌تواند همزمان هم «بیشترین» و هم «کمترین» باشد");
        return false;
      }

      // افزودن هر دو پاسخ DISC به لیست final
      answerKeys.value.push({ ...discSelections.most });
      answerKeys.value.push({ ...discSelections.least });

      // ریست کردن انتخاب‌های DISC برای سوال بعدی
      discSelections.most = null;
      discSelections.least = null;
    } else {
      if (!selectedItem.qId || !selectedItem.oId) {
        $toast.info("لطفا به سوال آزمون پاسخ مناسب دهید");
        return false;
      }
      answerKeys.value.push({
        qId: selectedItem.qId,
        oId: selectedItem.oId,
        ...(selectedItem.subOptionId && { subOptionId: selectedItem.subOptionId }),
      });

      // ریست کردن انتخاب عادی
      selectedItem.qId = "";
      selectedItem.oId = "";
    }

    return true;
  },

  nextQuestion = () => {
    if (currentQuestion.value >= Number(questionCount.value) - 1) return;

    if (!validateAndSaveCurrentQuestion()) return;

    currentQuestion.value++;
  },

  sendAnswers = async () => {
    const res = await testStore.sendAnswer(
      answerKeys.value,
      (route.query?.examId as string) || "",
    );

    if (!res?.success) {
      if (res?.reason === "ERR_VALIDATION") {
        $toast.error(res?.data?.errors[0].message);
        return;
      }

      $toast.error(res?.message);
      return;
    }

    resultModal.value = true;
    resultData.code = res?.response?.code;
    resultData.title = res?.response?.title;
    resultData.body = res?.response?.body;
    return true;
  },

  sendResultAndScoring = async () => {
    if (!validateAndSaveCurrentQuestion()) return;

    await sendAnswers();
  };

onBeforeMount(async () => {
  const getQuestions = await testStore.getTestQuestions(
    route.query?.examId as string,
  );
  if (!getQuestions?.success) {
    testStore.state.loading.getQuestions = true;
    $toast.error("خطای اعتبار سنجی", {
      description: getQuestions?.message,
    });
    await navigateTo("/test/active");
  }
  questions.value = testStore.state.questions?.questions;  
  questionCount.value = testStore.state.questions?.questionCount as any;
});
</script>

<template>
  <!-- Introduction -->
  <div
    class="grid place-items-center z-12 absolute inset-0 bg-x-primary-content-100"
    v-if="testStore.state.loading.getQuestions"
  >
    <div class="text-center space-y-3">
      <UIcon name="line-md:loading-twotone-loop" size="50" />
      <p class="text-sm">در حال اعتبار سنجی و ورود به آزمون</p>
    </div>
  </div>
  <div
    class="absolute inset-0 z-10 bg-x-primary-content-100"
    v-if="!acceptTerms"
  >
    <div class="w-full py-3 sticky top-0 bg-x-primary-content-100 z-10">
      <div class="flex items-center justify-between p-3">
        <p class="text-sm">
          {{ testStore.state.questions?.questionCount }} سوال
        </p>
        <p class="text-center font-liana! text-2xl">شروع آزمون</p>
        <UButton size="sm" to="/test/active" variant="subtle" label="انصراف" />
      </div>
      <p class="text-center text-sm">{{ testStore.state.questions?.title }}</p>
    </div>

    <div class="flex-1 relative h-11/12 grid place-items-center pb-20">
      <div class="w-10/12 p-5">
        <strong class="text-sm">قوانین و مقررات</strong>
        <br />
        <br />
        <p v-for="p of terms" :key="p" class="text-sm font-bold not-last:mb-3">
          {{ p }}
        </p>
      </div>
      <div class="pb-7">
        <UButton
          @click="acceptTermsHandler"
          block
          :ui="{ base: 'rounded-full px-3 h-12' }"
          label="پذیرش قوانین و شروع آزمون"
          color="x-primary"
        />
      </div>
    </div>
  </div>

  <!-- Exam Slides and form -->
  <div
    v-if="acceptTerms && testStore.state.questions !== null"
    class="h-dvh relative"
  >
    <div
      class="w-69 h-69 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-radial from-x-primary-500 to-x-secondary-200 blur-3xl"
    ></div>
    <br />
    <div class="px-5 relative z-6">
      <p
        class="mb-3 pb-2 font-bold text-sm border-b-2 border-slate-200 text-center sticky top-0 bg-x-primary-content-100"
      >
        {{ testStore.state.questions?.title }}
      </p>

      <br />
      <div
        class="p-6 text-3xl grid place-items-center mx-auto text-white font-extrabold bg-linear-60 from-x-primary-500 to-x-secondary-500 flower-shape"
      >
        <p class="flex items-end ltr">
          <span class="mb-2 ps-2">{{ currentQuestion + 1 }}</span>
          <sub
            class="bg-slate-200 rounded-full border-2 border-white p-1.5 text-sm text-x-text-body"
          >
            {{ testStore.state.questions?.questionCount }}</sub
          >
        </p>
      </div>

      <div class="mt-12 pb-28">
        <strong>
          {{ questions?.at(currentQuestion)?.text }}
        </strong>

        <div
          :class="{
            'mt-18':
              (questions?.at(currentQuestion)?.options.length as number) <= 2,
          }"
          class="grid mt-9 rounded-3xl overflow-hidden gap-y-2"
        >
          <div
            :key="index"
            v-for="(op, index) of questions?.at(currentQuestion)?.options"
            @click="
              testStore.state.questions.type !== 'DISC'
                ? selectAnswer(
                    questions?.at(currentQuestion)?.questionId as string,
                    op.optionId,
                  )
                : undefined
            "
            :class="{
              'bg-x-primary-500/50 hover:bg-x-primary-500/70 text-white font-bold rounded-3xl':
                testStore.state.questions.type !== 'DISC' && selectedItem.oId === op.optionId,
            }"
            class="px-3 py-3.5 text-right cursor-pointer border-b-slate-300 transition-all min-h-18 hover:bg-slate-200/70 bg-white/60 backdrop-blur-md border-x-primary-100 rounded-2xl"
          >
            <div class="flex items-center gap-x-2">
              <span
                class="w-5 h-5 text-white grid place-items-center rounded-2xl bg-x-primary-300 outline-2 outline-x-primary-100 shrink-0"
                >{{ index + 1 }}</span
              >
              <p class="text-sm">
                {{ op.text }}
              </p>
            </div>

            <!-- For DISC Test Options -->
            <div
              class="text-xs grid grid-cols-2 gap-2 mt-3"
              v-if="testStore.state.questions?.type === 'DISC'"
            >
              <!-- دکمه کمترین (Least) -->
              <button
                type="button"
                :class="{
                  'bg-red-500! text-white! font-bold shadow-md':
                    discSelections.least?.oId === op.optionId,
                  'bg-white/60 hover:bg-white text-x-text-title':
                    discSelections.least?.oId !== op.optionId,
                  'opacity-40 pointer-events-none':
                    discSelections.most?.oId === op.optionId
                }"
                class="relative flex items-center transition justify-center h-11 border border-neutral-500/10 rounded-2xl cursor-pointer"
                @click.stop="
                  selectDiscAnswer(
                    questions?.at(currentQuestion)?.questionId as string,
                    op.optionId,
                    op?.score?.least?.id,
                    'least'
                  )
                "
              >
                {{ op?.score?.least?.label || 'کمترین' }}
              </button>

              <!-- دکمه بیشترین (Most) -->
              <button
                type="button"
                :class="{
                  'bg-emerald-600! text-white! font-bold shadow-md':
                    discSelections.most?.oId === op.optionId,
                  'bg-white/60 hover:bg-white text-x-text-title':
                    discSelections.most?.oId !== op.optionId,
                  'opacity-40 pointer-events-none':
                    discSelections.least?.oId === op.optionId
                }"
                class="relative flex items-center transition justify-center h-11 border border-neutral-500/10 rounded-2xl cursor-pointer"
                @click.stop="
                  selectDiscAnswer(
                    questions?.at(currentQuestion)?.questionId as string,
                    op.optionId,
                    op?.score?.most?.id,
                    'most'
                  )
                "
              >
                {{ op?.score?.most?.label || 'بیشترین' }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-center fixed bottom-10 left-0 right-0 px-5 z-20">
          <UButton
            color="x-primary"
            label="سوال بعدی"
            @click="nextQuestion"
            :ui="{ base: 'rounded-full px-8 h-13' }"
            v-if="currentQuestion < Number(questionCount) - 1"
          />
          <UButton
            color="x-secondary"
            block
            @click="sendResultAndScoring"
            label="دریافت نتیجه آزمون"
            :disabled="testStore.state.loading.sendAnswer"
            :loading="testStore.state.loading.sendAnswer"
            v-if="currentQuestion >= Number(questionCount) - 1"
            :ui="{ base: 'rounded-full px-5 h-13' }"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Result modal -->
  <UModal
    :ui="{
      content: 'w-85 rounded-3xl shadow-none',
      overlay: 'backdrop-blur-md',
      header: 'hidden',
    }"
    v-model:open="resultModal"
    :dismissible="false"
  >
    <template #content>
      <div class="grid place-items-center px-3 w-full">
        <div class="grid place-items-center w-full pb-7">
          <NuxtImg
            src="/images/icons/check-icon.png"
            class="drop-shadow-2xl drop-shadow-green-400"
            width="160px"
            height="160px"
            quality="60"
          />
          <p
            class="text-center font-bold mb-4 inline-block rounded-2xl text-x-text-subtitle"
          >
            نتیجه آزمون {{ testStore.state.questions?.title }}
          </p>
          <br />
          <strong class="block">
            {{ resultData.title }}
          </strong>
          <p class="text-sm mt-4">
            {{ resultData.body }}
          </p>
          <div class="flex gap-3 mt-3">
            <UButton
              variant="solid"
              color="x-primary"
              block
              label="دانلود نتیجه کامل"
              class="mt-3"
              icon="solar:cloud-download-linear"
              download="test-result.pdf"
              size="sm"
              :ui="{ base: 'h-10 rounded-full' }"
            />
            <UButton
              variant="solid"
              color="x-secondary"
              size="sm"
              block
              to="/test/done"
              label="بازگشت به صفحه نتایج"
              class="mt-3"
              :ui="{ base: 'h-10 rounded-full' }"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped lang="scss">
.flower-shape {
  width: 100px;
  aspect-ratio: 1;
  --g: /20.56% 20.56% radial-gradient(#000 calc(71% - 1px), #0000 71%) no-repeat;
  mask:
    100% 50% var(--g),
    93.301% 75% var(--g),
    75% 93.301% var(--g),
    50% 100% var(--g),
    25% 93.301% var(--g),
    6.699% 75% var(--g),
    0% 50% var(--g),
    6.699% 25% var(--g),
    25% 6.699% var(--g),
    50% 0% var(--g),
    75% 6.699% var(--g),
    93.301% 25% var(--g),
    radial-gradient(100% 100%, #000 38.366%, #0000 calc(38.366% + 1px));
}
</style>