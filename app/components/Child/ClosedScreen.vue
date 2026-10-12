<script setup lang="ts">
/**
 * Full-screen takeover shown when the child is outside their allowed hours
 * (`ERR_ACCESS_CLOSED`). Replaces the old inline strip: the panel is unusable,
 * so it should look like a deliberate rest state, not a half-rendered app.
 *
 * Retry re-runs the probe; a successful probe clears `sessionEnded` (done in
 * `loadProfile`), which swaps this screen for the panel automatically.
 */
const childPanel = useChildPanel();

const retrying = ref(false);

async function retry(): Promise<void> {
  if (retrying.value) return;

  retrying.value = true;

  try {
    await childPanel.loadProfile(true);
  } finally {
    retrying.value = false;
  }
}

async function exitPanel(): Promise<void> {
  await childPanel.signOut();
  await navigateTo("/panels/child/enter");
}
</script>

<template>
  <div
    class="flex h-full flex-col items-center justify-center gap-5 px-6 text-center"
    dir="rtl"
  >
    <div
      class="grid place-items-center rounded-[2.5rem] p-6"
      :class="
        childPanel.variant === 'child'
          ? 'bg-x-kid-100'
          : 'bg-x-teen-100'
      "
    >
      <img
        v-if="childPanel.variant === 'child'"
        src="/images/panels/kid-3d-mascot.svg"
        alt=""
        width="96"
        height="96"
        class="size-24"
      >
      <img
        v-else
        src="/images/panels/teen-blob.svg"
        alt=""
        width="96"
        height="96"
        class="size-24"
      >
    </div>

    <h2
      class="font-yekan-extra text-xl"
      :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-900'"
    >
      {{ childPanel.variant === 'child' ? 'الان نوبت بازی نیست' : 'الان نمیتونی وارد پنل بشی' }}
    </h2>

    <p class="max-w-64 text-sm leading-6 text-x-text-subtitle">
      {{
        childPanel.variant === 'child'
          ? 'کودک عزیز، این ساعت‌ها زمان استراحت توئه. وقتی ساعت دسترسی‌ات شروع بشه، دوباره می‌تونی بیای.'
          : 'فعلا پنل بسته است و نمیتونی وارد بشی'
      }}
    </p>

    <UButton
      size="lg"
      color="x-primary"
      :label="retrying ? 'در حال بررسی…' : 'تلاش دوباره'"
      :loading="retrying"
      class="min-w-40 justify-center"
      @click="retry"
    />

    <button
      type="button"
      class="text-xs text-x-text-subtitle"
      @click="exitPanel"
    >
      خروج از پنل
    </button>
  </div>
</template>
