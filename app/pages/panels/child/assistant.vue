<script setup lang="ts">
/**
 * The child's assistant screen.
 *
 * This feature lives HERE and in `stores/childBot.ts`: the page wires the
 * store to a bubble list, a typing state, an opener empty-state and a fatal
 * start error. Unlike the adult panels there is no server history — the
 * transcript is this tab's memory, which is why «شروع گفتگوی جدید» simply
 * forgets and rebuilds it.
 *
 * The layout work mirrors `Bot/ProChatView.vue`'s recorded decision: the
 * panel layout's `<main>` is the only scroller, so this screen is a `h-full`
 * flex column whose transcript does its own `min-h-0` scrolling and whose
 * composer is `shrink-0` — nothing escapes the frame with `position: fixed`.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "چت‌بات" });

const store = useChildBot();
const childPanel = useChildPanel();

import { renderAiMarkdown } from "~/utils/markdown";

const draft = ref("");
const transcript = ref<HTMLElement>();

const isKid = computed(() => childPanel.variant === "child");

onMounted(async () => {
  if (store.state.chatId === null) await store.start();
});

function scrollToEnd(): void {
  const el = transcript.value;

  if (el) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
}

const hasChat = computed(() => store.state.chatId !== null);
const showEmpty = computed(
  () => hasChat.value && store.state.messages.length === 0,
);

/** The typing indicator shows while a turn is in flight. */
const showTyping = computed(() => store.state.pending && store.state.messages.length > 0);

/** The whole screen only when creation failed and no chat exists yet. */
const fatalError = computed(() =>
  store.state.chatId === null && store.state.error !== null
    ? store.state.error
    : null,
);

const pendingCreate = computed(
  () => store.state.pending && store.state.chatId === null,
);

async function submit(): Promise<void> {
  const text = draft.value.trim();

  if (!text || store.state.pending) return;

  draft.value = "";
  await nextTick();
  scrollToEnd();
  await store.send(text);
  await nextTick();
  scrollToEnd();
}

async function restart(): Promise<void> {
  store.reset();
  await store.start();
}
</script>

<template>
  <div class="mx-auto flex h-full w-11/12 flex-col pb-4 pt-4">
    <!-- Fatal: the conversation could not even be created. -->
    <UAlert
      v-if="fatalError"
      variant="soft"
      color="error"
      icon="solar:link-broken-linear"
      :title="fatalError"
    >
      <template #actions>
        <UButton
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="restart"
        />
      </template>
    </UAlert>

    <template v-else>
      <!-- Greeting header -->
      <div class="flex items-start gap-3 pb-2">
        <span
          class="grid size-11 shrink-0 place-items-center text-xl"
          :class="isKid ? 'rounded-2xl bg-x-kid-sun-100' : 'rounded-xl bg-x-teen-100'"
          aria-hidden="true"
        >
          <UIcon name="solar:chat-round-dots-bold" size="24" :class="isKid ? 'text-x-kid-berry-500' : 'text-x-teen-violet-600'" />
        </span>
        <div class="min-w-0 grid gap-0.5 pt-1">
          <p class="font-yekan-bold text-x-text-title">
            {{ isKid ? 'دوست چت‌باتی' : 'دستیار منتویا' }}
          </p>
          <p class="text-xs leading-6 text-x-text-subtitle">
            {{ isKid ? 'هر چیزی تو دلت هست، این‌جا بگو.' : 'هر موضوعی که ذهنت رو مشغول کرده، بنویس.' }}
          </p>
        </div>
      </div>

      <!-- Transcript -->
      <div
        ref="transcript"
        role="region"
        aria-label="گفتگو با دستیار"
        class="custom-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <!-- Creating state -->
        <div v-if="pendingCreate" class="grid place-items-center py-16" aria-busy="true">
          <div class="grid place-items-center gap-3 text-center">
            <UIcon name="line-md:loading-loop" size="32" :class="isKid ? 'text-x-kid-500' : 'text-x-teen-violet-600'" />
            <p class="text-sm text-x-text-subtitle">دارم گفتگو را آماده می‌کنم ...</p>
          </div>
        </div>

        <!-- Empty state: an opener, not an apology -->
        <div v-else-if="showEmpty" class="grid place-items-center gap-3 py-14 text-center">
          <span
            class="grid size-16 place-items-center"
            :class="isKid ? 'rounded-3xl bg-x-kid-sun-100' : 'rounded-2xl bg-x-teen-100'"
            aria-hidden="true"
          >
            <UIcon name="solar:chat-round-dots-bold" size="32" :class="isKid ? 'text-x-kid-berry-500' : 'text-x-teen-violet-600'" />
          </span>
          <p class="animate__animated animate__fadeInUp max-w-64 text-sm leading-7 text-x-text-subtitle">
            {{ isKid ? 'سلام! این‌جا می‌تونی هر چیزی رو که تو دلت هست بپرسی. امروز چه خبر؟' : 'سلام! هر موضوعی که ذهنت رو مشغول کرده این‌جا بنویس.' }}
          </p>
        </div>

        <!-- Bubbles -->
        <template v-else>
          <div
            v-for="message in store.state.messages"
            :key="message.id"
            class="animate__animated animate__fadeInUp p-1.5"
          >
            <!-- User: start side of this RTL screen -->
            <div v-if="message.role === 'user'" class="flex justify-start">
              <p
                class="max-w-10/12 p-4 text-sm"
                :class="isKid ? 'rounded-3xl bg-x-kid-sun-100 text-x-kid-900' : 'rounded-2xl bg-x-teen-violet-300/45 text-x-teen-900'"
              >
                {{ message.text }}
              </p>
            </div>
            <!-- Bot: end side -->
            <div v-else class="flex justify-end">
              <div
                class="ai-markdown max-w-10/12 border bg-white px-4 text-sm text-x-text-body"
                :class="message.error ? 'border-red-300 text-red-500' : isKid ? 'border-x-kid-300 rounded-3xl' : 'border-x-teen-200 rounded-2xl'"
                v-html="renderAiMarkdown(message.text)"
              />
            </div>
          </div>

          <!-- Typing indicator: three dots while the whole answer is on the wire -->
          <div v-if="showTyping" class="flex justify-end p-1.5">
            <div
              class="grid place-items-center border bg-white px-4 py-3"
              :class="isKid ? 'rounded-3xl border-x-kid-300' : 'rounded-2xl border-x-teen-200'"
              aria-hidden="true"
            >
              <UIcon name="eos-icons:three-dots-loading" size="28" />
            </div>
          </div>
        </template>
      </div>

      <!-- Composer -->
      <div class="shrink-0 pt-2">
        <div class="flex items-center gap-2">
          <input
            v-model="draft"
            type="text"
            class="neu-inset min-w-0 flex-1 bg-white/70 px-4 py-3 text-sm text-x-text-title placeholder:text-x-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            :class="isKid ? 'rounded-3xl' : 'rounded-xl'"
            :placeholder="isKid ? 'پیامت را بنویس ...' : 'پیامت را بنویس ...'"
            :disabled="store.state.pending || !hasChat"
            @keydown.enter="submit"
          />
          <UButton
            :disabled="store.state.pending || !hasChat || !draft.trim()"
            size="lg"
            icon="solar:plain-2-bold"
            aria-label="ارسال پیام"
            :class="isKid ? 'rounded-3xl' : 'rounded-xl'"
            :ui="{ base: isKid ? 'bg-x-kid-sun-500! text-x-kid-900!' : 'bg-x-teen-violet-600! text-white!' }"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </div>
</template>
