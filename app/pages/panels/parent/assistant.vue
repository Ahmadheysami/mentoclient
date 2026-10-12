<script setup lang="ts">
/**
 * The parent panel's assistant — a route, and nothing else.
 *
 * Everything about this feature lives in `Bot/ProChatView.vue` and
 * `stores/pro-bot.ts`; what is left for a panel page is to say WHICH panel it is
 * and to name the screen. That is why this file has no `onMounted`, no fetch and
 * no state.
 *
 * `panel="parent"` is the one key that matters and it is load-bearing twice over:
 * it is the id the `panel-plan` gate is satisfied by, AND the key this
 * conversation is stored under inside `stores/pro-bot.ts` — so a parent and an
 * adult reader signed in on one device get two separate chats rather than one
 * shared transcript. The big panel's own file says the same thing in its header.
 *
 * The full `definePageMeta` is repeated here even though `panels/parent.vue`
 * already declares the `layout`, for the reason written on that file: panel pages
 * written at different times must each carry the whole decision, so that forgetting
 * one key means the gate is visibly absent on review rather than silently absent in
 * production.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "دستیار هوش مصنوعی",
});

useSeoMeta({
  title: "دستیار هوش مصنوعی",
});
</script>

<template>
  <BotProChatView
    panel="parent"
    title="دستیار هوش مصنوعی منتویا"
    subtitle="هر موضوعی که ذهنتان را مشغول کرده، همین‌جا بنویسید."
  />
</template>
