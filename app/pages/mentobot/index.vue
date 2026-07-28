<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
definePageMeta({
  middleware: ["auth"],
  layout: "blank",
});
const botStore = useBot(),
  chatOptionItems: DropdownMenuItem[] = [
    {
      label: "گزارش عملکرد دستیار",
      icon: "solar:pen-new-round-outline",
    },
    {
      label: "موضوعات تخصصی",
      icon: "humbleicons:prompt",
    },
    {
      label: "قوانین ومقررات",
      icon: "solar:document-linear",
    },
    {
      label: "بازگشت",
      icon: "solar:arrow-left-linear",
      async onSelect(e) {
        await navigateTo("/");
      },
    },
  ],
  messageContainer = ref<HTMLDivElement>();

// Scroll to end
function scrollChatToEnd() {
  if (messageContainer.value) {
    messageContainer.value.scrollTo({
      top: messageContainer.value?.scrollHeight || 0,
    });
  }
}

// Finish Message
function finishMessage(result: string) {
  scrollChatToEnd();
}

async function initialBot() {
  // get exists bots
  await botStore.getExistsBot();
  if (!botStore.state.botExists?.default) {
    await botStore.initialBotForNormalUser();
    await botStore.getExistsBot();
    botStore.state.botId = botStore.state.botExists?.default;
  } else {
    botStore.state.botId = botStore.state.botExists.default;
  }
}

onMounted(async () => {
  // // Fetch Messages
  // // Auto scroll to end
  await initialBot();
  await botStore.getChatHistory();

  if (botStore.state.chatHistory.length > 0) {
    scrollChatToEnd();
  }
});
</script>

<template>
  <div class="h-full">
    <!-- Loading -->
    <div
      v-if="botStore.state.loading.initialBot"
      class="fixed z-11 w-md max-sm:w-full h-dvh bg-x-primary-content-100 grid place-items-center"
    >
      <div class="text-center space-y-4">
        <AppLogo type="typo-colorize" size="lg" />
        <p class="font-bold">دستیار هوشمند منتویا</p>
      </div>
      <UIcon
        name="line-md:loading-loop"
        size="40"
        class="absolute bottom-7 left-1/2 -translate-x-1/2"
      />
    </div>

    <!--  -->
    <div class="grid h-dvh">
      <!-- Get started -->
      <div
        v-if="botStore.state.loading.getChatHistory"
        class="h-dvh grid place-items-center w-full"
      >
        <div>
          <div class="text-center space-y-4">
            <UIcon name="line-md:loading-loop" size="40" />
            <p class="font-bold text-sm">در حال بارگذاری گفتگو ...</p>
          </div>
        </div>
      </div>
      <!--  -->
      <div
        v-if="
          !botStore.state.loading.getChatHistory &&
          botStore.state.chatHistory.length <= 0
        "
        class="h-dvh grid place-items-center w-full"
      >
        <div>
          <div class="text-center space-y-4">
            <AppLogo type="typo-colorize" size="md" />
            <p class="font-bold">دستیار هوش مصنوعی منتویا</p>
            <p class="font-bold text-sm">همین حالا شروع کن</p>
          </div>
        </div>
      </div>
      <!-- Header -->
      <div
        class="fixed z-10 w-100 top-3 max-sm:w-11/12 left-1/2 -translate-x-1/2"
      >
        <div
          class="h-full px-4 py-4.5 w-full flex justify-between backdrop-blur-sm items-center rounded-full border border-slate-200 bg-white/60 shadow-inner"
        >
          <div class="flex items-center gap-3">
            <AppLogo type="medium" size="sm" />
            <div class="grid gap-2">
              <strong class="text-sm"
                >دستیار هوشمند منتویا
                <sup>
                  <UIcon
                    name="solar:verified-check-bold"
                    size="18"
                    class="text-x-primary-500"
                  />
                </sup>
              </strong>
            </div>
          </div>
          <UDropdownMenu
            :items="chatOptionItems"
            :ui="{
              content:
                'rtl rounded-2xl bg-white/70 shadow-inner shadow-none border-slate-100 p-1.5',
            }"
            size="sm"
          >
            <UButton variant="ghost" icon="solar:menu-dots-bold" size="lg" />
          </UDropdownMenu>
        </div>
      </div>
      <!-- Messages -->
      <div
        :class="{ 'pb-33 pt-22': botStore.state.chatHistory.length > 0 }"
        class="grid place-items-end overflow-y-auto"
        ref="messageContainer"
      >
        <div class="w-full space-y-4">
          <BotChatMessageGroup
            :error="message?.error"
            v-for="message of botStore.state.chatHistory"
            v-if="botStore.state.chatHistory.length > 0"
            :type="'text'"
            :messages="[
              { type: 'user', content: message.question.prompt },
              {
                type: 'assistant',
                content: message.result,
              },
            ]"
          />
        </div>
      </div>
    </div>
    <!-- User Prompt -->
    <div
      class="fixed z-10 w-100 bottom-2.5 max-sm:w-11/12 left-1/2 -translate-x-1/2"
    >
      <BotChatPrompt @finish="finishMessage" @start="scrollChatToEnd" :normal="true" />
    </div>
  </div>
</template>
