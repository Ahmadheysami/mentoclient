<script setup lang="ts">
/**
 * The shareable form of the access code: `/panels/child/<11 digits>`.
 *
 * The parent hands this link over instead of reading digits out loud. Landing
 * here POSTs the code once (same call as the manual form) and drops the child
 * into the hub; a wrong or expired code bounces to that form, exactly as if
 * they had typed it and been refused.
 */
definePageMeta({
  layout: "child",
});

useSeoMeta({ title: "ورود به پنل" });

const route = useRoute();
const childPanel = useChildPanel();
const failed = ref(false);

onMounted(async () => {
  const raw = route.params.code;
  const code =
    typeof raw === "string" ? raw.replace(/\D/g, "").slice(0, 11) : "";

  if (code.length !== 11) {
    await navigateTo("/panels/child/enter", { replace: true });
    return;
  }

  const result = await childPanel.enterWithCode(code);

  if (result.ok) {
    await navigateTo("/panels/child", { replace: true });
    return;
  }

  failed.value = true;
  await navigateTo("/panels/child/enter", { replace: true });
});
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-10 text-center text-sm text-x-text-subtitle">
    <p v-if="!failed">در حال ورود…</p>
  </div>
</template>
