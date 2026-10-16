<script setup lang="ts">
/**
 * `/cafe/settings` — the café slice's settings, laid out the way Telegram and
 * iOS lay theirs out: a profile header, then grouped cards, then one red row
 * that is not in a card at all.
 *
 * ## WHY THE PROFILE BLOCK IS BUILT FROM `useUser()` AND NOT FROM A CAFÉ ENDPOINT
 *
 * The obvious alternative is `GET /me/my-ct`, which is already read on the café's
 * table list for management grants — but it is a list of **permissions**, and it
 * carries neither a name, nor a mobile number, nor an avatar. The signed-in
 * account is what this screen is a header FOR, and the auth middleware has
 * already resolved it before this page runs, so `useUser().state.user` is the
 * one source in the app that states it: a real reader's real name rather than a
 * real reader's real permission grant.
 *
 * ## WHY EVERY SWITCH IS A LOCAL `ref` AND NOTHING PERSISTS
 *
 * No store, no `localStorage`, no cookie, no server round-trip. A switch that
 * looked like it saved and did not would be the worst possible lie on a screen
 * whose whole job is telling the reader what is set — and there is no endpoint in
 * `docs/Cafe-Api-Docs.md` for any of the five. They are laid out, labelled and
 * operable; what backs them is a later wave, and the comment above each group
 * says which endpoint that is.
 *
 * ## THE SAME RULE, ONE ROW FURTHER DOWN
 *
 * The sign-out row at the bottom is the row where that rule bites hardest: it
 * is drawn, labelled and NOT operable, because there is no `POST /auth/logout`
 * in this repo to call. See the `exit` section below — the screen must never
 * claim an outcome the server has not agreed to.
 */

definePageMeta({
  layout: "cafe",
  middleware: ["auth"],
});

useSeoMeta({
  title: "تنظیمات کافه",
});

const user = useUser();

/**
 * ## THE PROFILE
 *
 * `state.user` is `null` until `/api/user/me` answers, and `middleware/auth.ts`
 * sends the reader to `/auth` when it has not — so by the time this renders, on
 * either the server or the client, it holds the account. The `?.` chain below is
 * about the fields *inside* it rather than the record itself: `emailIsVerification`
 * and friends are the backend's own nullable columns, and a settings header that
 * throws because `avatar` is missing is a blank page rather than a settings
 * screen.
 */
const me = computed(() => user.state.user);

/**
 * `fullName` is two fields, `{ first, last }`, and either may be empty — the
 * reader can register with a phone number and never fill them in. Joined and
 * filtered rather than concatenated, because « » between two empties renders as
 * a title that is visibly nothing. Same expression
 * `App/UserPlanInfoCard.vue` uses for the same two fields, so the app does not
 * have two rules for turning a name into a line.
 */
const displayName = computed<string>(() => {
  const first = user.state.user?.fullName?.first?.trim();
  const last = user.state.user?.fullName?.last?.trim();

  return [first, last].filter(Boolean).join(" ") || "کاربر منتویا";
});

/**
 * The handle under the name.
 *
 * The backend gives no public handle on the user, so the only stable identifier
 * there is `userId` — a 24-character ObjectId. It is shortened rather than
 * printed whole: at full width across a 448px column it pushes the «ویرایش
 * پروفایل» chevron off the edge, and the full value stays reachable in the DOM
 * as the `title` of the same element.
 *
 * `slice` on a string that turned out to be shorter than 12 characters yields
 * both halves of the same text rather than throwing, which is why there is no
 * length guard here.
 */
const handle = computed(() => {
  const id = me.value?.userId ?? "";

  return `${id.slice(0, 6)}…${id.slice(-4)}`;
});

/** The avatar column, for the same reason `CafeCard` casts it: `null` is a valid «no picture». */
const avatar = computed(() => me.value?.avatar || undefined);

/**
 * The phone row's value.
 *
 * `mobile` is the number the reader authenticated with, and the backend may hold
 * it empty — so the honest drawing is «ثبت نشده» rather than a masked number: a
 * plausible-looking «••• ••• ۴۸۲۱» on a settings screen is a claim about the
 * reader's account that nothing in the app can back up.
 */
const mobile = computed(() => me.value?.mobile?.trim() || "ثبت نشده");

/**
 * The version row's value.
 *
 * There is no version string anywhere in the repo — no `runtimeConfig` entry,
 * no `app.config.ts` key, and `package.json` has no `version` field — so there
 * is nothing truthful to print. `import.meta.dev` is a build-time constant that
 * Vite inlines, so it is the same boolean on the server and on the client and
 * the row cannot disagree with itself at hydration. The integration seam is one
 * `runtimeConfig` key.
 */
const version = computed(() => (import.meta.dev ? "نسخهٔ توسعه" : "نسخهٔ انتشار"));

/* ------------------------------------------------------------------ toggles -- */

/**
 * ## EVERY SWITCH BELOW IS LOCAL, AND HERE IS THE LIST OF WHY ONCE
 *
 * Three notification toggles, two display toggles. None of them is written
 * anywhere: no `useSettings()`, no `useLocalStorage`, no cookie, no request.
 * The grouping below is chosen so the endpoints slot in one at a time —
 * `PATCH /user/settings` for the first group, the socket's own
 * `cafe:table:message-sending-status` for anything per-table — and each `ref`
 * is named after the setting it will become, so that swap is a rename and not
 * a rewrite.
 */
const notifyMessage = ref(true);
const notifySound = ref(true);
const notifyJoinedOnly = ref(false);
const hideUserList = ref(false);
const reduceMotion = ref(false);

/** `«فارسی»` is the app's only shipped language — `nuxt.config.ts` hard-codes `dir="rtl"`. */
const language = "فارسی";

/* -------------------------------------------------------------------- exit -- */

/**
 * ## THE SIGN-OUT ROW IS DRAWN, AND IT DOES NOTHING — ON PURPOSE
 *
 * ⚠️ **THERE IS NO LOGOUT IN THIS APP.** `POST /auth/logout` is not called from
 * anywhere in this repo, and nothing clears the `access-token` cookie: it is
 * `httpOnly` with a 30-day `maxAge`, so it survives this screen, this tab and
 * this page's own navigation. A reader on a shared phone who sees
 * «از حساب خود خارج شدید» believes the next person to pick up the device is
 * locked out. They are not, and a screen that says otherwise is the worst lie
 * this feature could tell.
 *
 * So the row states what it is — «خروج از حساب — به‌زودی» — and is drawn as a
 * **non-actionable** row (`type="link"` with no `to`, which `SettingRow` renders
 * as a plain `div`: no chevron, no hover, no tab stop, no `aria-label`), exactly
 * like the «ویرایش پروفایل» row above it and exactly like the thread's disabled
 * composer: **shown, labelled, and saying why it cannot be used.** A red
 * `<button>` that answered a confirm dialog by flipping a local `ref` is the
 * shape that was removed, not the shape that was kept.
 *
 * There is deliberately no `confirmingExit` / `signOut()` / `signedOut` left in
 * this file. A confirm dialog for an action with no endpoint is one more place
 * that can be re-wired to lie the moment someone adds the handler, and adding
 * the call is one line when the auth wave ships it — belonging to the auth wave,
 * not to the café screens.
 */
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <CafeScreenHeader
      variant="compact"
      back="/cafe"
      title="تنظیمات کافه"
    />

    <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-32">
      <!--
        The profile header. No card and no ring: it is the screen's identity
        block, and the groups below it are the ones that are card-shaped.
      -->
      <section
        class="flex items-center gap-3 pb-1"
        aria-label="حساب کاربری"
      >
        <CafeAvatar :src="avatar" :name="displayName" size="xl" />

        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-bold text-x-text-title">
            {{ displayName }}
          </p>
          <p :title="me?.userId" class="truncate text-xs text-x-text-subtitle">
            {{ handle }}
          </p>
        </div>

        <UButton
          type="button"
          disabled
          label="ویرایش پروفایل — به‌زودی"
          :ui="{ base: 'min-h-11 shrink-0 rounded-full px-4 text-xs' }"
        />
      </section>

      <!--
        ## WHY EVERY GROUP IS A HAND-WRITTEN WRAPPER
        `CafeSettingRow` draws ONE row and owns its own `not-last:border-b`.
        So the wrapper is what supplies the rounding, the ring and the
        clipping — and it must NOT also draw a divider, or every row carries
        two hairlines a pixel apart. `divide-y` would do exactly that, so it is
        deliberately absent here; the single `not-last:border-b` inside the row
        is the only rule in the group, which is the contract `SettingRow`'s
        own header describes.
      -->
      <section aria-labelledby="cafe-settings-account">
        <h2
          id="cafe-settings-account"
          class="mb-2 px-1 text-xs font-bold text-x-text-subtitle"
        >
          حساب کاربری
        </h2>

        <div class="overflow-hidden rounded-2xl bg-x-primary-content-50 ring-1 ring-slate-200/70">
          <CafeSettingRow
            icon="solar:user-circle-linear"
            label="نام نمایشی"
            :value="displayName"
            type="value"
          />
          <CafeSettingRow
            icon="solar:phone-linear"
            label="شمارهٔ تماس"
            :value="mobile"
            type="value"
          />
          <!--
            `type="link"` with **no `to`**. `SettingRow` renders that as a
            plain `div` — no chevron, no hover, no tab stop, and no
            `aria-label`, because it has no action — and the `value` is how it
            says so out loud. A row that looked tappable and did nothing would
            be the one thing this screen must not do.
          -->
          <CafeSettingRow
            icon="solar:user-id-linear"
            label="ویرایش پروفایل"
            description="نام نمایشی و تصویر پروفایل"
            value="به‌زودی"
            type="link"
          />
        </div>
      </section>

      <section aria-labelledby="cafe-settings-notifications">
        <h2
          id="cafe-settings-notifications"
          class="mb-2 px-1 text-xs font-bold text-x-text-subtitle"
        >
          اعلان‌ها
        </h2>

        <div class="overflow-hidden rounded-2xl bg-x-primary-content-50 ring-1 ring-slate-200/70">
          <CafeSettingRow
            v-model="notifyMessage"
            icon="solar:bell-linear"
            label="پیام تازه"
            type="switch"
          />
          <CafeSettingRow
            v-model="notifySound"
            icon="solar:volume-loud-linear"
            label="صدای پیام"
            type="switch"
          />
          <CafeSettingRow
            v-model="notifyJoinedOnly"
            icon="solar:users-group-rounded-linear"
            label="فقط میزهای پیوسته"
            description="پیام میزهایی که در آن‌ها عضو نیستید نادیده گرفته می‌شود"
            type="switch"
          />
        </div>
      </section>

      <section aria-labelledby="cafe-settings-display">
        <h2
          id="cafe-settings-display"
          class="mb-2 px-1 text-xs font-bold text-x-text-subtitle"
        >
          نمایش
        </h2>

        <div class="overflow-hidden rounded-2xl bg-x-primary-content-50 ring-1 ring-slate-200/70">
          <CafeSettingRow
            v-model="hideUserList"
            icon="solar:eye-closed-linear"
            label="بلوک فهرست کاربران"
            description="فهرست اعضای میز را برای دیگران پنهان می‌کند"
            type="switch"
          />
          <CafeSettingRow
            v-model="reduceMotion"
            icon="solar:walking-linear"
            label="کاهش حرکت"
            description="انیمیشن‌ها و جابه‌جایی‌های خودکار حذف می‌شوند"
            type="switch"
          />
          <CafeSettingRow
            icon="solar:global-linear"
            label="زبان"
            :value="language"
            type="value"
          />
        </div>
      </section>

      <section aria-labelledby="cafe-settings-about">
        <h2
          id="cafe-settings-about"
          class="mb-2 px-1 text-xs font-bold text-x-text-subtitle"
        >
          دربارهٔ برنامه
        </h2>

        <div class="overflow-hidden rounded-2xl bg-x-primary-content-50 ring-1 ring-slate-200/70">
          <CafeSettingRow
            icon="solar:shield-check-linear"
            label="نسخه"
            :value="version"
            type="value"
          />
          <CafeSettingRow
            icon="solar:document-text-linear"
            label="شرایط استفاده"
            value="به‌زودی"
            type="link"
          />
          <CafeSettingRow
            icon="solar:lock-keyhole-minimalistic-linear"
            label="حریم خصوصی"
            value="به‌زودی"
            type="link"
          />
        </div>
      </section>

      <!--
        ## THE DANGER ZONE IS **NOT** IN A CARD
        `SettingRow`'s own header makes this the rule: a grouped look would
        dress a sign-out as one more preference. The lone red row, separated by
        `mt-1` and the section above by the page's `gap-5`, is the whole
        affordance — a red tile, a red label, a hairline under nothing.
      -->
      <section aria-labelledby="cafe-settings-account-actions" class="mt-1">
        <h2
          id="cafe-settings-account-actions"
          class="mb-2 px-1 text-xs font-bold text-x-text-subtitle"
        >
          حساب
        </h2>

        <div class="overflow-hidden rounded-2xl bg-x-primary-content-50 ring-1 ring-slate-200/70">
          <!--
            ⚠️ `type="link"` with **no `to`** — `SettingRow` renders that as a
            plain `div`: no chevron, no hover, no tab stop, no `aria-label`. It is
            the «ویرایش پروفایل» row's own idiom, and the thread's disabled leave
            button's reason: `POST /auth/logout` does not exist in this app, so
            this row must not be something a thumb can press. The label says so,
            rather than a confirm dialog claiming the session ended.
          -->
          <CafeSettingRow
            icon="solar:logout-2-linear"
            label="خروج از حساب — به‌زودی"
            description="در این نسخه هیچ نشستی پاک نمی‌شود؛ ورود دوباره با همان شماره کافی است."
            tone="danger"
            type="link"
          />
        </div>
      </section>
    </div>
  </div>
</template>
