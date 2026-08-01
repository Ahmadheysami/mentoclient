<script lang="ts" setup>
const props = defineProps<{ normal: boolean }>();
const emit = defineEmits(["finish", "start"]);
const botStore = useBot(),
  {$toast} = useNuxtApp(),
  prompt = ref("");

async function sendMessage() {
  emit("start");
  botStore.state.chatHistory.push({
    question: {
      prompt: prompt.value,
    },
    result: null,
  });

  // request to api
  const response = await botStore.chatWithAi(
    { text: prompt.value },
    botStore.state.botId as string,
    !!props.normal,
  );

  if (!response?.success) {
      // update last object in chatHistory
      botStore.state.chatHistory[botStore.state.chatHistory.length - 1] = {
        question: {prompt: prompt.value},
        result: null,
        error: true,
      } as any;
    $toast.error(response?.message);
    return;
  }
  // update last object in chatHistory
  botStore.state.chatHistory[botStore.state.chatHistory.length - 1] = {
    question: {prompt: prompt.value},
    result: response?.result,
    error: false,
  } as any;
  prompt.value = "";
  emit("finish");
}
</script>

<template>
  <UChatPrompt
    @submit.prevent="sendMessage"
    v-model:model-value="prompt"
    :disabled="botStore.state.loading.chatWithAi"
    :autofocus="false"
    placeholder="هر چه از دستیار میخواهید بنویسید"
    :ui="{
      root: 'rounded-3xl bg-white/60 backdrop-[2px]',
      body: 'bg-transparent',
    }"
    :maxrows="3"
  >
    <template #footer>
      <div class="flex justify-end w-full">
        <div class="flex items-center">
          <UButton
            :disabled="botStore.state.loading.chatWithAi"
            :loading="botStore.state.loading.chatWithAi"
            type="submit"
            size="xl"
            color="x-primary"
            :ui="{ base: 'rounded-full' }"
          >
            <UIcon name="solar:arrow-up-linear" size="18" />
          </UButton>
        </div>
      </div>
    </template>
  </UChatPrompt>
</template>
