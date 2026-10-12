<script setup lang="ts">
/**
 * The employer panel's assistant — a route, and nothing else.
 *
 * Everything about this feature lives in `Bot/ProChatView.vue` and
 * `stores/pro-bot.ts`; what is left for a panel page is to say WHICH panel it is
 * and to name the screen. That is why this file has no `onMounted`, no fetch and
 * no state.
 *
 * `panel="employer"` is the one key that matters and it is load-bearing twice over:
 * it is the id the `panel-plan` gate is satisfied by, AND the key this conversation
 * is stored under inside `stores/pro-bot.ts` — so an employer and an adult signed in
 * on one device get two separate chats rather than one shared transcript. The
 * `big` panel's own file says the same thing in its header, for the same two
 * reasons.
 *
 * The full `definePageMeta` is repeated here even though `panels/employer.vue`
 * already declares the `layout`, for the reason written on that file: panel pages
 * written at different times must each carry the whole decision, so that forgetting
 * one key means the gate is visibly absent on review rather than silently absent in
 * production.
 *
 * ## THE DARK FINTECH REDESIGN IS THE SCOPE'S, AND THIS PAGE ADDS NOTHING
 *
 * `Bot/ProChatView.vue` is shared with the light big panel, so it is not
 * painted with employer classes. On this route the `.employer-panel` scope
 * does the work: the page ground and the composer's
 * `bg-x-primary-content-100/95` bar go dark, the `bg-white` surfaces (the
 * header chip, both chat bubbles, the prompt root) become `#262626` through
 * the `--color-white` re-point, and the assistant's rich-text answer —
 * which `Bot/ChatMessageGroup.vue` renders through the `.ai-markdown`
 * classes — is re-inked by the `.employer-panel .ai-markdown` block in
 * `app/assets/css/main.css`, because those styles are written as light
 * literals that would otherwise vanish on the dark bubbles.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "دستیار هوش مصنوعی",
  hideBottomBar: true,
});

useSeoMeta({
  title: "دستیار هوش مصنوعی",
});
</script>

<template>
  <BotProChatView
    panel="employer"
    title="دستیار هوش مصنوعی منتویا"
    subtitle="هر موضوعی که ذهنتان را مشغول کرده، همین‌جا بنویسید."
  />
</template>
