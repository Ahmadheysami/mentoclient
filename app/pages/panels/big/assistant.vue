<script setup lang="ts">
/**
 * The adult panel's assistant — a route, and nothing else.
 *
 * Everything about this feature lives in `Bot/ProChatView.vue` and
 * `stores/pro-bot.ts`; what is left for a panel page is to say WHICH panel it is
 * and to name the screen. That is why this file has no `onMounted`, no fetch and
 * no state: the next Pro panel ships by copying these twenty lines and changing
 * `panel`, `panelTitle`, `title` and `subtitle` — which is the reuse the feature
 * was asked for, made literal.
 *
 * The full `definePageMeta` is repeated here even though `panels/big.vue` already
 * declares the `layout`, for the reason written on that file and on
 * `panels/big/index.vue`: seven panel pages written at different times must each
 * carry the whole decision, so that forgetting one key means the gate is visibly
 * absent on review rather than silently absent in production.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "دستیار هوش مصنوعی",
});

useSeoMeta({
  title: "دستیار هوش مصنوعی",
});
</script>

<template>
  <BotProChatView
    panel="big"
    title="دستیار هوش مصنوعی منتویا"
    subtitle="هر موضوعی که ذهنتان را مشغول کرده، همین‌جا بنویسید."
  />
</template>
