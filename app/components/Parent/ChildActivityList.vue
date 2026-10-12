<script setup lang="ts">
import { faRelative } from "~/utils/fa";
import type { ParentActivityItem } from "~/types/parent-panel";

/**
 * One child's account-event log — and the panel-wide log, when `showChild` is on.
 *
 * ## WHAT THESE ROWS ARE, AND WHAT THEY ARE NOT
 *
 * Every row here is a `performanceModel` document, and that document is written
 * for ACCOUNT events: a child being added, an access code created or revoked, a
 * child logging in. **A child taking a test writes nothing** — so this is not a
 * behavioural feed and must never be dressed as one. That is why the empty state
 * says what is actually recorded instead of promising «فعالیت‌های فرزند شما» in
 * general, and why there is no duration column: `performanceModel` carries no
 * duration field at all.
 *
 * ## `now` IS A PROP, AND THAT IS THE WHOLE RULE
 *
 * `faRelative` takes the clock as an argument instead of reading it, because a
 * relative time produced during SSR and a different one produced at hydration is
 * a text mismatch Vue reports — and the reader watches a row change its mind.
 * `undefined` until mount makes `faRelative` fall back to the deterministic
 * `faDate`, so the server render and the client's first paint agree and only a
 * mounted client may say «۳ دقیقه پیش». This is the rule already written on
 * `components/Settings/SessionPanel.vue`.
 *
 * ## WHY AN INLINE `UAlert` AND NOT `UiStateMessage`
 *
 * A refused activity read is one SECTION of a screen the parent is already
 * reading, and `Ui/StateMessage.vue` is `h-[55dvh]` — as an inline banner it
 * would push the rest of the page off-screen. The repo precedent for exactly
 * this is `components/Settings/SessionPanel.vue:82-93`. The EMPTY state, by
 * contrast, is the whole content of the list, so it is the page-level component.
 */
withDefaults(
  defineProps<{
    items: ParentActivityItem[];
    loading: boolean;
    error: string | null;
    now?: number;
    /** The panel-wide list names the child on every row; one child's own does not. */
    showChild?: boolean;
  }>(),
  { now: undefined, showChild: false },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div>
    <div v-if="loading" class="grid gap-2" aria-busy="true">
      <USkeleton
        v-for="row in 2"
        :key="row"
        class="h-16 rounded-3xl bg-white"
      />
    </div>

    <UAlert
      v-else-if="error"
      variant="soft"
      color="error"
      title="فعالیت‌ها خوانده نشد"
    >
      <template #description>{{ error }}</template>
      <template #actions>
        <UButton
          type="button"
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="emit('retry')"
        />
      </template>
    </UAlert>

    <UiStateMessage
      v-else-if="items.length === 0"
      icon="solar:pulse-2-linear"
      title="هنوز فعالیتی ثبت نشده"
      description="ورود فرزند شما به پنل، ساخت کد دسترسی و لغو آن اینجا ثبت می‌شود."
    />

    <ul v-else class="grid gap-2">
      <li
        v-for="item in items"
        :key="item.id"
        class="neu-raised flex items-center gap-3 rounded-3xl bg-white p-3"
      >
        <ParentActivityKindIcon :kind="item.kind" />

        <div class="min-w-0 flex-1">
          <!--
            `item.title`, never `item.description`: the raw field is an internal
            log string that carries `child-created:<userId>` — a userId is not
            something to print in front of a parent.
          -->
          <h3 class="truncate text-sm font-yekan-bold text-x-text-title">
            {{ item.title }}
          </h3>
          <p class="truncate text-xs text-x-text-subtitle">
            <template v-if="showChild && item.childName">{{ item.childName }} · </template>
            <time :datetime="item.when" class="tabular-nums">
              {{ faRelative(item.when, now) }}
            </time>
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
