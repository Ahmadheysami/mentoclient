# گزارش: «Memory leak» و کرش پروژه روی VPS

> این گزارش از روی خودِ کد و با بازتولید واقعی روی بیلد تولیدی (`.output`) نوشته شده است،
> نه از روی حدس. همه‌ی اعدادی که می‌بینید اندازه‌گیری شده‌اند.

---

## ۱. خلاصه (ریشه‌ی مشکل در یک پاراگراف)

مشکل «نشت حافظه»ای به معنی کلاسیک (نگه‌داشتن listener یا cache) نیست.
**`runtimeConfig.apiUrl` روی سرور خالی/`undefined` است**، و در نتیجه هر روت پروکسی زیر `server/api/**`
مسیر upstream را **نسبی** به `$fetch` می‌دهد. اما `$fetch` داخل Nitro به `localFetch` بسته شده است
(`.output/server/chunks/nitro/nitro.mjs`: `createFetch({ fetch: localFetch })`)، و `localFetch`
هر URL نسبی را **به همین اپلیکیشن** می‌فرستد. یعنی `api(event)('/plan/my-plans')` به‌جای رفتن به بک‌اند،
دوباره وارد همین سرور می‌شود، یک **رندر SSR جدید** بالا می‌آید، و در آن رندر
`app/plugins/plan.ts` دوباره `/api/plan/my-plans` را صدا می‌زند → همان حلقه، یک سطح عمیق‌تر.
این بازگشت بینهایت تا پر شدن heap ادامه دارد و پروسه با
`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` می‌میرد.

روی سیستم لوکال این اتفاق نمی‌افتد، چون فایل `.env` وجود دارد و مقدار `NUXT_API_BASE`
**در زمان بیلد داخل کد پخته می‌شود** (`http://localhost:3001/.api`). روی VPS/Docker آن مقدار
در زمان بیلد وجود ندارد و در زمان اجرا هم با نام اشتباه تزریق می‌شود (بخش ۴).

---

## ۲. بازتولید و اندازه‌گیری (شاهد)

بیلد تولیدی، Node، درخواست‌های واقعی با `curl`، مصرف حافظه با `ps -o rss`:

| سناریو | نتیجه |
|---|---|
| بیلد فعلی، `apiUrl` موجود → ۱۲۰۰ درخواست به `/auth` و `/plans` | RSS: ۱۰۴MB → ۳۵۸MB و سپس **ثابت** (یعنی SSR به‌خودی‌خود نشتی ندارد) |
| همان بیلد، `NUXT_API_URL=` خالی → **یک** درخواست `GET /auth` | پاسخ `503` بعد از ۵.۲ ثانیه و مرگ پروسه با `FATAL ERROR: Reached heap limit` |
| همان بیلد، `NUXT_API_URL=` خالی → `GET /api/settings` (بدون upstream) | `200` در ۱۳ms، بدون مشکل |
| همان بیلد، `NUXT_API_URL=` خالی → `GET /api/plan/my-plans` (یک پروکسی) | `503` در ۶.۱ ثانیه و **OOM** |
| بعد از اصلاح، `NUXT_API_URL=` خالی → ۲۰۰ درخواست متوالی | بدون کرش، RSS ~۲۴۶MB ثابت، پاسخ‌ها در ۳ms |

مقایسه‌ی دو ردیف وسط، عامل را دقیقاً جدا می‌کند:
**کرش از مسیرهای پروکسی می‌آید، نه از خودِ SSR.** یک مسیر پروکسی + `apiUrl` خالی = OOM.

لاگ واقعی کرش:

```text
<--- Last few GCs --->
[10110] 12320 ms: Mark-Compact 508.2 (515.0) -> 507.1 (520.0) MB ... allocation failure
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

`503` بودن پاسخ هم طبیعی است: پروسه وسط رندر مرده و Nitro نتوانسته پاسخ کامل بدهد.

---

## ۳. زنجیره‌ی دقیق حلقه (فایل به فایل)

```text
GET /auth
  └─ app/pages/auth/index.vue      → definePageMeta({ middleware: ['auth'] })
     └─ app/middleware/auth.ts:6   → auth.checkToken('access-token')
        └─ app/stores/auth.ts:68   → requestFetch('/api/auth/check-token')
           └─ server/api/auth/check-token.post.ts   (این یکی upstream ندارد)

و حلقه‌ی اصلی، روی هر رندر SSR:
  app/plugins/plan.ts  →  requestFetch('/api/plan/my-plans')   (پلاگین universal است، روی هر رندر اجرا می‌شود)
    └─ server/api/plan/my-plans.get.ts:5 → api(event, 'access-token')('/plan/my-plans')
       └─ server/utils/api.ts           → $fetch.create({ baseURL: config.apiUrl })   ← baseURL خالی!
          └─ Nitro localFetch('/plan/my-plans')   ← مسیر نسبی، به همین سرور
             └─ Nuxt SSR render برای /plan/my-plans
                └─ app/plugins/plan.ts دوباره …   ← حلقه، یک سطح عمیق‌تر، بی‌نهایت
```

نکته‌ی مهم: مسیرهای upstream در این پروژه هیچ‌کدام با `/api/` شروع نمی‌شوند
(`/plan/my-plans`، `/user/me`، `/cafe/...`، `/balance`، …)، پس با هیچ روت Nitro برخورد نمی‌کنند
و همه به fallback رندر Nuxt می‌رسند. همین باعث می‌شود هر پروکسی، پتانسیل شروع حلقه را داشته باشد.

---

## ۴. چرا لوکال سالم است و VPS نه (سه علت، هر سه واقعی)

**۱) `.env` لوکال، مقدار را زمان بیلد inline می‌کند.**
در `nuxt.config.ts` مقدار از `import.meta.env` خوانده می‌شد و Nuxt فایل `.env` را موقع بیلد
در دسترس می‌گذارد. داخل بیلد فعلی این خط پخته شده است:

```js
"apiUrl": "http://localhost:3001/.api"
```

**۲) `.dockerignore` فایل `.env` را حذف می‌کند.**
در `Dockerfile` دستور `COPY . .` اجرا می‌شود، اما `.dockerignore` شامل `.env` و `.env.*` است.
پس داخل ایمیج، `import.meta.env.NUXT_API_BASE` وجود ندارد → `apiUrl: undefined` → حلقه‌ی بخش ۳.

**۳) نام متغیر در زمان اجرا `NUXT_API_URL` است، نه `NUXT_API_BASE`.**
Nuxt مقدار runtime را از **نام کلید** می‌سازد؛ کلید `apiUrl` می‌شود `NUXT_API_URL`.
اگر در `docker-compose` بنویسید `NUXT_API_BASE: ...`، آن مقدار در زمان اجرا **هیچ کاری نمی‌کند**
(فقط در زمان بیلد، آن هم اگر به‌شکل ARG/ENV به مرحله‌ی build برسد، اثر دارد).
این تنها تله‌ای است که بیشتر آدم‌ها در آن می‌افتند و علامتش دقیقاً همین است:
«بیلد می‌گیرد، بالا می‌آید، اولین لینک که باز می‌کنم می‌افتد.»

> تأیید در ۳۰ ثانیه روی VPS خودتان:
>
> ```bash
> docker compose exec app printenv | grep -i nuxt          # باید NUXT_API_URL ببینید، نه فقط NUXT_API_BASE
> docker compose exec app sh -c 'grep -o "\"apiUrl\": \"[^\"]*\"" .output/server/chunks/nitro/nitro.mjs'
> ```
>
> اگر خروجی grep مقدار `""` یا `undefined` بود، همین مشکل است.

---

## ۵. راه‌حل

### ۵.۱ راه‌حل اصلی — پیکربندی استقرار (بدون نیاز به تغییر منطق برنامه)

مقدار را در **زمان اجرا** با نام درست بدهید:

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      args:
        # فقط برای اینکه بیلد هم مقدار داشته باشد (اختیاری ولی توصیه‌شده)
        NUXT_API_BASE: https://api.mentoya.ir/.api
    environment:
      # ⚠️ اسم درست در زمان اجرا: NUXT_API_URL (از کلید apiUrl)
      NUXT_API_URL: https://api.mentoya.ir/.api
      NUXT_API_KEY: ${NUXT_API_KEY}
      # آدرس سوکت‌ها از دید مرورگر کاربر (بخش ۵.۳ را ببینید)
      NUXT_PUBLIC_BASE: https://api.mentoya.ir
    ports:
      - "3000:3000"
```

```dockerfile
# Dockerfile — در مرحله‌ی builder، قبل از pnpm build
ARG NUXT_API_BASE
ENV NUXT_API_BASE=$NUXT_API_BASE
```

اگر بدون Docker اجرا می‌کنید (PM2 / systemd):

```bash
# systemd
Environment=NUXT_API_URL=https://api.mentoya.ir/.api
Environment=NUXT_API_KEY=...
# PM2 ecosystem
env: { NUXT_API_URL: "https://api.mentoya.ir/.api", NUXT_API_KEY: "..." }
```

بعد از استقرار، این باید `200` بدهد (نه `503` و نه قطع شدن پروسه):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain/api/settings
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain/api/plan/my-plans
```

### ۵.۲ اصلاحاتی که در کد اعمال شد

**`nuxt.config.ts`** — خواندن `process.env` قبل از `import.meta.env`، تا مقدار از ARG/ENV بیلد هم برسد،
و `public.base` هم env-محور شود:

```ts
runtimeConfig: {
  apiKey: process.env.NUXT_API_KEY || import.meta.env.NUXT_API_KEY,
  apiUrl: process.env.NUXT_API_BASE || import.meta.env.NUXT_API_BASE,
  public: {
    base:
      process.env.NUXT_PUBLIC_BASE ||
      import.meta.env.NUXT_PUBLIC_BASE ||
      'http://localhost:3001'
  }
}
```

**`server/utils/api.ts`** — گارد روی `baseURL` خالی. این تغییر جلوی خودِ حلقه را می‌گیرد،
حتی اگر روزی کسی دوباره env را جا بیندازد: به‌جای رندر بی‌نهایت، یک خطای ۵۰۰ صریح برمی‌گردد
(همه‌ی روت‌های پروکسی همین throw را می‌گیرند و `connectionResponseError()` را جواب می‌دهند):

```ts
const baseURL = typeof config.apiUrl === "string" ? config.apiUrl.trim() : "";

if (!baseURL) {
  throw createError({
    statusCode: 500,
    statusMessage: "Upstream is not configured",
    message:
      "NUXT_API_URL is not set, so upstream calls have no base URL. A relative URL would be sent back into this app and recurse.",
  });
}

return $fetch.create({ baseURL, headers: { ... } }) as unknown as UpstreamFetcher;
```

**تأیید شده:** با این دو تغییر، بیلد گرفته شد و همان سناریوی مرگ‌آور (`NUXT_API_URL` خالی)
حالا `{"success":false,"statusCode":500,"reason":"ERR_NET_CONNECTION"}` در ۳ms برمی‌گرداند،
۲۰۰ درخواست متوالی هیچ رشدی در حافظه ندارد، و `stderr` خالی می‌ماند.

### ۵.۳ مشکلات جانبی که در همین بررسی دیده شد (و سهمشان در «روی VPS خراب است»)

**الف) `public.base` هاردکد روی `http://localhost:3001`.** این مقدار آدرس سوکت‌های
`app/plugins/cafe-socket.client.ts` و `app/plugins/notification-socket.client.ts` است و از
**مرورگر کاربر** استفاده می‌شود. روی VPS یعنی مرورگر بازدیدکننده تلاش می‌کند به `localhost`
خودش وصل شود → سوکت هرگز وصل نمی‌شود و socket.io بی‌نهایت retry می‌کند؛ روی HTTPS هم
`http://` توسط مرورگر به‌عنوان mixed content بلاک می‌شود. الان با `NUXT_PUBLIC_BASE` قابل تنظیم شد؛
روی VPS آن را روی همان دامنه‌ی https بک‌اند بگذارید.

**ب) سقف heap در بیلد و در اجرا.**

```json
"build": "NODE_OPTIONS='--max-old-space-size=4096' nuxt build"
```

روی ماشینی که ۳GB رم آزاد دارد، اجازه‌دادن به V8 برای رشد تا ۴GB یعنی **kernel OOM-killer**
به‌جای خطای قابل‌فهم. برای بیلد روی چنین ماشینی `--max-old-space-size=2048` منطقی‌تر است.
در زمان اجرا هم هیچ سقفی ست نشده؛ برای ماشین ۳GB:

```bash
node --max-old-space-size=1024 .output/server/index.mjs
```

(یا در Dockerfile: `CMD ["node", "--max-old-space-size=1024", ".output/server/index.mjs"]`)

**ج) نبود timeout روی `$fetch` به upstream.** در `server/utils/api.ts` هیچ `timeout`ی ست نشده.
اگر upstream وصل شود ولی جواب ندهد (فایروال/VPS کند)، هر درخواست SSR یک رندر کامل را
تا پیش‌فرض undici (۳۰۰ ثانیه) زنده نگه می‌دارد؛ با کمی ترافیک این خودش به فشار حافظه و کرش می‌رسد
(به‌خصوص روی ۳GB). پیشنهاد: یک `timeout` سخاوتمندانه (مثلاً ۶۰ ثانیه) — فقط دقت کنید
مسیرهای AI (`chat-with-chatbot`, `result-with-ai`) طولانی‌تر هستند و نباید قطع شوند.

**د) `devtools: { enabled: true }` در `nuxt.config.ts`.** در پروداکشن لازم نیست؛ خاموشش کنید.

**ه) پکیج‌های بی‌استفاده.** `@nuxt/content`، `@vite-pwa/nuxt` و `better-sqlite3` در `dependencies`
هستند اما نه در `modules` ثبت شده‌اند، نه در کد استفاده می‌شوند (هیچ پوشه‌ی `content/` یا
`queryContent` وجود ندارد). `better-sqlite3` همان چیزی است که `Dockerfile` را مجبور کرده
`python3/g++/make` نصب کند. حذفشان بیلد و ایمیج را سبک‌تر می‌کند.
(برخلاف این‌ها، `daisyui` واقعاً استفاده می‌شود: `@plugin "daisyui"` در `app/assets/css/main.css` — دست نزنید.)

**و) هشدار معماری `sharp`.** در بیلد این پیام آمده است:

```text
[@nuxt/image] sharp binaries have been included in your build for darwin-x64.
Make sure you deploy to the same architecture.
```

اگر `.output` را از مک روی سرور لینوکسی کپی کنید، بهینه‌سازی تصویر (`/_ipx/**`) می‌شکند.
بیلد باید روی همان معماری اجرا انجام شود (Dockerfile فعلی این را درست انجام می‌دهد).

**ز) امنیت.** `NUXT_API_KEY` یک secret سرور است؛ آن را فقط در `runtimeConfig` (نه `public`) نگه دارید
و هرگز در باندل کلاینت نگذارید. `.env` هم به‌درستی در `.gitignore` است.

---

## ۶. چک‌لیست بعد از استقرار

```bash
# ۱) نام‌های درست env
docker compose exec app printenv | grep -i nuxt     # NUXT_API_URL باید باشد

# ۲) مقدار پخته‌شده در بیلد
docker compose exec app sh -c 'grep -o "\"apiUrl\": \"[^\"]*\"" .output/server/chunks/nitro/nitro.mjs'

# ۳) مسیرهای پروکسی
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain/api/plan/my-plans
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain/auth

# ۴) مصرف حافظه زیر بار
docker stats --no-stream

# ۵) اگر باز هم پروسه مرد
dmesg | tail -20 | grep -i "killed process"      # یعنی kernel OOM-killer (سقف heap را کم کنید)
docker logs --tail 100 app | grep -i "heap"      # یعنی V8 OOM (همین گزارش، بخش ۳)
```

---

## ۷. جمع‌بندی: چه چیزی چه سهمی داشت

| # | مورد | شدت | وضعیت |
|---|---|---|---|
| ۱ | `apiUrl` خالی → بازگشت بینهایت `$fetch` نسبی → OOM با یک درخواست | 🔴 علت اصلی | گارد در `server/utils/api.ts` + `NUXT_API_URL` در استقرار |
| ۲ | نام اشتباه env در زمان اجرا (`NUXT_API_BASE` به‌جای `NUXT_API_URL`) | 🔴 علت اصلی | مستند شد + `process.env` در `nuxt.config.ts` |
| ۳ | `public.base` هاردکد `localhost:3001` → سوکت‌های کلاینت در پروداکشن | 🟠 بالا | env-محور شد (`NUXT_PUBLIC_BASE`) |
| ۴ | سقف heap ۴GB روی ماشین ۳GB (بیلد و اجرا) | 🟠 بالا | توصیه‌ی مقدار در بخش ۵.۳ |
| ۵ | نبود timeout روی فراخوانی upstream | 🟡 متوسط | پیشنهاد در بخش ۵.۳ |
| ۶ | `devtools: true`، پکیج‌های بی‌استفاده، هشدار معماری `sharp` | 🟢 کم | توصیه شد |

نکته‌ی آخر: خودِ رندر SSR این پروژه **نشتی ندارد** — با ۱۲۰۰ درخواست، حافظه روی ~۳۵۸MB
ثابت ماند. هر بار که روی VPS «نشت حافظه» دیدید، اول `apiUrl`/`NUXT_API_URL` را چک کنید؛
اگر خالی باشد، دقیقاً همین حلقه در جریان است.
