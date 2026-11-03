<script setup lang="ts">
/**
 * The one confirmation in the conversation, and it is for exactly one action:
 * deleting a message.
 *
 * ## WHY A MODAL AND NOT A SHEET
 *
 * `CafeMessageMenu`, `CafeTableMenu` and `CafeReportSheet` are bottom sheets
 * because they are *pickers* — lists a thumb scrolls through, in a surface the
 * thumb already is at. A confirmation is a question with two answers about
 * something the reader did not choose to open, so it is centred: `UModal` puts
 * it in the middle of the column, where it is unmistakably modal, and reka gives
 * us `role="dialog"` + `aria-modal` + focus trap + Escape-to-cancel for free.
 *
 * ## WHY IT IS NOT `Settings/ConfirmModal` + `Ui/Alert`
 *
 * That composition exists and is right for a *settings* row, where the danger
 * is mild and «تایید» is honest. Here the body of the message is replaced for
 * everyone in the room, so both buttons are named for what they do — «حذف پیام»
 * and «انصراف» — and the destructive one is red. «تایید» next to «انصراف» on a
 * red affordance asks the reader to approve something whose name they never saw.
 *
 * ## ⚠️ IT SAYS WHAT ACTUALLY HAPPENS
 *
 * §13's delete is **soft**: the backend flips `status` to `"deleted"` and the
 * document stays, so the copy does not promise a permanent removal and does not
 * hide that it is visible to the whole table. «این پیام برای همه اعضای این میز
 * حذف می‌شود» is the fact.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    /** The delete is in the air. Both buttons reflect it. */
    loading?: boolean;
    /** Overrides the default Persian sentence, for a message that has none. */
    description?: string;
  }>(),
  { loading: false, description: undefined },
);

const emit = defineEmits<{
  "update:open": [boolean];
  confirm: [];
}>();

const DEFAULT_DESCRIPTION = "این پیام برای همه اعضای این میز حذف می‌شود.";

const text = computed(() => props.description ?? DEFAULT_DESCRIPTION);

/**
 * ⚠️ A CONFIRM IN FLIGHT CANNOT BE CANCELLED.
 *
 * The request has left; reversing it is not something this component may invent
 * (re-posting a deleted message is the server's business), so a reader who taps
 * «انصراف» while the delete is in the air would be told it was cancelled when it
 * was not. Disabling cancel is the honest answer, and the button says why
 * through its own loading state.
 */
function cancel(): void {
  if (props.loading) return;

  emit("update:open", false);
}

function confirm(): void {
  if (props.loading) return;

  emit("confirm");
}
</script>

<template>
  <UModal
    :open="open"
    title="حذف پیام"
    :ui="{ content: 'w-96 max-md:w-85 rounded-3xl', title: 'text-base font-bold text-x-text-title' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm leading-7 text-x-text-body">
          {{ text }}
        </p>

        <div class="flex items-center gap-2">
          <UButton
            type="button"
            variant="soft"
            color="x-primary"
            label="انصراف"
            :disabled="loading"
            class="min-h-11 flex-1"
            :ui="{ base: 'min-h-11 rounded-full text-sm font-bold' }"
            @click="cancel"
          />

          <UButton
            type="button"
            color="error"
            variant="solid"
            label="حذف پیام"
            :loading="loading"
            :disabled="loading"
            class="min-h-11 flex-1"
            :ui="{ base: 'min-h-11 rounded-full text-sm font-bold' }"
            @click="confirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
