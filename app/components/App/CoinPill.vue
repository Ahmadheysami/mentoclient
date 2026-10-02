<script setup lang="ts">
import { formatCoins } from "~/utils/coin";

/**
 * The panel's coin balance, and the panel's ONLY reader of it.
 *
 * `state.coinsBalance` is a single shared number, so two components showing it
 * would both have to know when it is stale and both would have to re-fetch it.
 * One component, one fetch, one rendering of "not loaded yet".
 *
 * `formatCoins` is the only thing that turns the figure into text, for the
 * reason documented in `app/utils/coin.ts`: it FLOORS, so the number here and the
 * number in `Wallet/Balance.vue` can never disagree about a balance.
 */
const wallet = useWallet();

onMounted(async () => {
  /**
   * `onMounted`, never `setup()`.
   *
   * The store already owns the cookie-backed request, and `plugins/plan.ts`
   * establishes the same pattern for the gate: the answer belongs to the store,
   * and a component must not fire a second identical fetch during SSR, where a
   * bare `$fetch` would also arrive without the reader's cookie and leave the
   * pill showing an em-dash under a page the server had already rendered.
   *
   * So this is a REFRESH, not a load: it runs only when nothing has filled the
   * field, which on a first visit is the same request the store would have made
   * anyway. `onMounted` also keeps it off the server render entirely, so the
   * first painted frame is the em-dash and the real figure arrives as an update
   * — one deliberate client-side transition, rather than a layout shift between
   * two different server and client renders.
   */
  if (wallet.state.coinsBalance === null) {
    try {
      await wallet.getCoinBalance();
    } catch {
      /**
       * `getCoinBalance` has no `try/catch` of its own — it lets a transport
       * failure reject — and an `onMounted` that awaits a rejecting promise leaves
       * an unhandled rejection behind: nothing on screen changes and nothing in
       * the console says why. So the failure is caught HERE, where the pill's
       * state is known.
       *
       * `setCoinsFromRaw(null)` is the store's own way of saying "no figure", so
       * a refused read cannot leave a half-written balance standing. There is no
       * retry on purpose: this pill is a link to `/wallet`, and the balance is read
       * again the next time it mounts — a reader who wants it sooner has a button
       * one tap away that reloads the figure for them.
       */
      wallet.setCoinsFromRaw(null);
    }
  }
});
</script>

<template>
    <!--
        A link, not a label: the figure is the reader's money, and `/wallet` is
        where the top-up that spends it lives.

        The `aria-label` interpolates `formatCoins` rather than being a fixed
        «سکه‌های شما». An `aria-label` REPLACES the element's text for a screen
        reader, so a static one would announce a link called "your coins" and
        then say nothing at all about how many — the one number on the bar. The
        icon carries `aria-hidden` for the same reason: it is the reason the
        label is needed, not information in itself.

        `min-w-8` is the layout guard. The em-dash and a real figure are
        different widths, and without a floor the whole bar shifts sideways the
        moment the number lands. No spinner either: a spinner in a 56px bar is
        larger than the value it is waiting for, and it would move the row too.
    -->
    <NuxtLink
        to="/wallet"
        :aria-label="`سکه‌های شما: ${formatCoins(wallet.state.coinsBalance)}`"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-x-primary-100/60 px-3 transition duration-150 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none motion-reduce:active:scale-100">
        <UIcon name="duo-icons:coin-stack" size="18" class="shrink-0 text-x-primary-700" aria-hidden="true" />
        <span class="min-w-8 text-center text-xs font-bold text-x-primary-900 tabular-nums">
            {{ formatCoins(wallet.state.coinsBalance) }}
        </span>
    </NuxtLink>
</template>
