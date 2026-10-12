<script setup lang="ts">
import { faNumber } from "~/utils/fa";

const props = withDefaults(
  defineProps<{
    /** Attempts this exam still has. */
    remaining: number;
    /** The asset id an attempt is made against. */
    assetId: string;
    /** Whether the start button is disabled (no attempts left / closed schedule). */
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const childPanel = useChildPanel();

const terms = [
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
];

const acceptTerms = ref(false);

async function start(): Promise<void> {
  if (!acceptTerms.value || props.disabled) return;

  await navigateTo(`/panels/child/exam?examId=${props.assetId}`);
}
</script>

<template>
  <section
    class="neu-raised-lg bg-white p-5"
    :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
  >
    <p class="text-xs font-yekan-bold" :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-700'">
      {{
        remaining > 0
          ? childPanel.variant === 'child'
            ? `${faNumber(remaining)} بار دیگر می‌تونی این آزمون رو انجام بدی`
            : `${faNumber(remaining)} بار دیگر می‌توانید این آزمون را انجام دهید`
          : childPanel.variant === 'child'
            ? 'دیگه باری نمونده'
            : 'باری باقی نمانده است'
      }}
    </p>

    <details class="neu-inset mt-4 rounded-2xl bg-white/60 p-3">
      <summary class="cursor-pointer py-2.5 text-xs font-yekan-bold text-x-text-subtitle">
        شرایط و نکات مهم پیش از آزمون
      </summary>
      <ol class="mt-2 list-decimal space-y-1.5 pe-4 text-[11px] leading-6 text-x-text-subtitle">
        <li v-for="term in terms" :key="term">{{ term }}</li>
      </ol>
    </details>

    <label class="mt-4 flex min-h-11 cursor-pointer items-center gap-2 text-xs text-x-text-body">
      <input
        v-model="acceptTerms"
        type="checkbox"
        class="size-4 accent-current"
        :class="childPanel.variant === 'child' ? 'text-x-kid-berry-700' : 'text-x-teen-violet-600'"
      >
      شرایط و نکات را خواندم و می‌پذیرم
    </label>

    <UButton
      :label="childPanel.variant === 'child' ? 'شروع آزمون' : 'شروع'"
      :disabled="!acceptTerms || disabled"
      class="mt-4 w-full grid place-items-center"
      :ui="{ base: childPanel.variant === 'child' ? 'h-14 rounded-2xl bg-x-kid-sun-500! text-x-kid-900! font-yekan-extra' : 'h-12 rounded-xl bg-x-teen-violet-600! text-white!' }"
      @click="start"
    />
  </section>
</template>
