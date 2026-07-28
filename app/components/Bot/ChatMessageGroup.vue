<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";

const props = withDefaults(
  defineProps<{
    type?: "image" | "text";
    messages: {
      type: "user" | "assistant";
      content: string | null;
    }[];
    error?: boolean;
  }>(),
  {
    type: "text",
    error: false,
  }
);

const toast = useToast();

const user = computed(() => {
  return (
    props.messages.find((item) => item.type === "user")?.content ?? ""
  );
});

const assistant = computed(() => {
  return (
    props.messages.find((item) => item.type === "assistant")?.content ?? null
  );
});

const assistantHtml = computed(() => {
  if (!assistant.value) return "";

  return marked.parse(assistant.value) as string;
});

async function copyText(text: string) {
  try {
    if (import.meta.client && navigator.clipboard) {
      await navigator.clipboard.writeText(text);

      toast.add({
        color: "x-primary",
        title: "کپی شد",
        type: "foreground",
      });
    }
  } catch {
    toast.add({
      title: "کپی نشد",
      color: "x-secondary",
    });
  }
}

async function shareAssistantResult(text: string) {
  if (import.meta.client && "share" in navigator) {
    await navigator.share({
      title: "دستیار هوش مصنوعی منتویا",
      text,
    });
  }
}
</script>

<template>
  <div class="p-3 animate__animated animate__fadeInUp">
    <div class="wrapper grid">
      <!-- User -->
      <div class="flex justify-start">
        <span
          class="bg-white/60 shadow-inner p-4 mb-3 rounded-3xl text-sm max-w-10/12"
          :class="{
            'border border-red-500 bg-red-50! text-red-500': error,
          }"
        >
          {{ user }}
        </span>
      </div>

      <!-- Assistant -->
      <div>
        <div
          class="flex justify-end"
          v-if="!error"
        >
          <p
            v-if="assistant !== null && assistant.length"
            class="bg-white border ai-markdown border-slate-200/90 text-sm p-4 max-w-10/12 text-x-text-body rounded-3xl"
            v-html="assistantHtml"
          />

          <UIcon
            v-else
            name="eos-icons:three-dots-loading"
            size="35"
          />
        </div>

        <!-- Utils -->
        <div
          v-if="!error && assistant !== null && assistant.length"
          class="flex justify-end"
        >
          <div class="flex items-center gap-2">
            <UButton
              variant="ghost"
              size="sm"
              icon="solar:copy-linear"
              @click="copyText(assistant)"
            />

            <UButton
              variant="ghost"
              size="sm"
              icon="solar:share-linear"
              @click="shareAssistantResult(assistant)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>