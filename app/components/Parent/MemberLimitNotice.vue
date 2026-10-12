<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * The capacity gate: this plan allows *N* children and the family already has
 * them.
 *
 * ## WHY THE BUTTON IS DISABLED AND NOT HIDDEN
 *
 * A control that appears and disappears changes the layout underneath it, teaches
 * nothing about why, and leaves the reader hunting for the thing that is missing.
 * So «افزودن فرزند» stays on screen, pressed-in and carrying its reason in a
 * `title`, and this notice sits under it saying the reason in words.
 *
 * ## WHY THE LIMIT IS EVER SHOWN AT ALL, GIVEN THE SERVER REFUSES ANYWAY
 *
 * Because an affordance that appears only once it has already failed is not an
 * affordance. `ERR_LIMIT_CREATE_USER` is the enforcement — this is the warning,
 * and it is deliberately built from a figure that can only ever OVER-estimate
 * (`Math.max` over the parent plans in the catalogue, §3.4), so the notice can
 * under-promise but never tell a parent with room left that they have none.
 *
 * When `limit` is `null` the capacity is simply not known yet — the catalogue has
 * not loaded — and the gate fails open rather than refusing a write the server
 * would have allowed.
 */
defineProps<{ limit: number | null }>();
</script>

<template>
  <UiStateMessage
    icon="solar:crown-linear"
    title="ظرفیت پلن شما پر است"
    :description="
      limit === null
        ? 'برای دیدن ظرفیت پلن خود، بخش پلن‌ها را باز کنید.'
        : `با پلن فعلی می‌توانید ${faNumber(limit)} فرزند داشته باشید. برای افزودن فرزند بیشتر پلن را ارتقا دهید؛ اعتبار باقی‌مانده‌تان از بین نمی‌رود.`
    "
    action-label="دیدن پلن‌ها"
    action-to="/plans"
  />
</template>
