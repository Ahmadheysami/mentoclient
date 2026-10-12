<script setup lang="ts">
/**
 * Floating assistant CTA on the child pages. It joins the hero's «با من حرف
 * بزن» as the second way into the chat: kid gets a chunky labelled pill, teen
 * a quiet refined circle. It is its own shortcut, never a nav tab.
 *
 * Hidden exactly where it would point at itself (/assistant) or where the
 * strip has no session yet (/enter).
 */
const route = useRoute();
const childPanel = useChildPanel();

const isHidden = computed(
  () =>
    route.path.startsWith("/panels/child/assistant") ||
    route.path.startsWith("/panels/child/enter") ||
    route.path.startsWith("/panels/child/exam"),
);
</script>

<template>
  <div
    v-if="!isHidden"
    class="pointer-events-none fixed inset-x-0 bottom-24 z-10 mx-auto flex w-full max-w-md justify-end px-4"
  >
    <NuxtLink
      to="/panels/child/assistant"
      class="pointer-events-auto inline-flex items-center gap-2 font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        childPanel.variant === 'child'
          ? 'neu-raised h-14 rounded-full bg-x-kid-sun-500 px-5 text-sm text-x-kid-900 focus-visible:outline-x-kid-berry-700'
          : 'neu-raised size-12 justify-center rounded-full bg-x-teen-violet-500 text-white focus-visible:outline-x-teen-violet-600'
      "
      aria-label="باز کردن دستیار گفت‌وگو"
    >
      <UIcon
        name="solar:chat-round-dots-bold"
        :size="childPanel.variant === 'child' ? 24 : 22"
        aria-hidden="true"
      />
      <span v-if="childPanel.variant === 'child'">با من حرف بزن</span>
    </NuxtLink>
  </div>
</template>
