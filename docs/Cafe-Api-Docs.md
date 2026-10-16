---
title: "Cafe (Messenger) — راهنمای کامل پیاده‌سازی فرانت کاربر"
description: "سند فنی بخش کافه‌ها به نگاه یک پیام‌رسان، فقط برای کاربر نهایی؛ شامل REST APIها، پیام‌های Socket.IO، مدل‌های داده، ورودی/خروجی هر سرویس و نکات باگ سرور."
---

# Task 3 — Cafe / Messenger: راهنمای پیاده‌سازی Frontend (کاربر نهایی)

> **مخاطب:** Agent `frontend-developer`
> **استک فرانت:** Vue 3 + Nuxt 4 + Tailwind (طبق `docs/tasks/Task-1.md`)
> **بک‌اند:** Express + TypeScript + Mongoose + Socket.IO + BullMQ + Redis
> **محدوده:** endpointهای کاربر نهایی — شامل قابلیت‌های مدیریتی که **کاربران دارای دسترسی** (`cafe`/`table`) می‌توانند انجام دهند. endpointهای مخصوص پنل ادمین در این سند نیستند (فهرست حذف‌شده‌ها در بخش ۱۵).
> **Swagger:** `/.api/docs`

---

## ۰. نقشه راه (TL;DR)

بخش کافه در این بک‌اند **دقیقاً یک پیام‌رسان (Messenger)** است:

| مفهوم پیام‌رسان | معادل در این بک‌اند |
|---|---|
| Channel / گفتگو | `Cafe Table` (`cafe tables`) — هر میز = یک گفتگو |
| لیست گفتگوهای من | `GET /.api/cafe/table/subscribed` |
| پیام | `Cafe Message` (`cafe messages`) |
| ارسال پیام زنده | Socket: `cafe:table:send-message` |
| صفحه تاریخچه | `GET /.api/cafe/table/:tableId/messages?direction=old&cursor=N` |
| تیک «خوانده شد» | `POST /.api/cafe/table/messages/:tableId/seen` |
| پوشه گفتگو (join/leave) | Socket: `cafe:table:join-room` / `cafe:table:leave-room` |
| آنلاین/آفلاین | Socket connect/disconnect → `user datas.isOnline` / `lastSeen` |
| ریپلای | `reaplyToMessageId` (غلط املایی سرور: `reaplayTo`) |
| لایک پیام | `POST /.api/cafe/table/messages/:tableId/:messageId/like` |
| گزارش پیام | `POST /.api/cafe/table/create-report?report-for=message` |
| تایپ کردن (مثل تلگرام) | ⚠️ **در بک‌اند وجود ندارد** (پیشنهاد در بخش ۱۳) |
| اعلان پیام جدید | `cafe:table:receive-new-message` روی room `channels-page:{userId}` |

**فقط ۱۵ endpoint برای کاربر نهایی وجود دارد** (بخش ۶).

---

## ۱. قوانین پایه‌ی ارتباط با سرور

### ۱.۱ هدرهای اجباری

هر درخواست REST باید این دو هدر را داشته باشد:

```http
X-Api-Key: <ACCESS_API_KEY>
Authorization: Bearer <accessToken>
Content-Type: application/json
```

| هدر | مقدار | توضیح |
|---|---|---|
| `X-Api-Key` | `process.env.ACCESS_API_KEY` | کلید سطح اپلیکیشن. نبودن/غلط → `403 { reason: "ERR_ACCESS_API_KEY" }` |
| `Authorization` | `Bearer <accessToken>` | JWT با `payload.name === 'access-token'` |
| `Content-Type` | `application/json` | برای `POST`/`PUT` |

### ۱.۲ احراز هویت

```
1) POST /.api/auth/in-up?signType=user      body { mobile }        → { token }            // otp-token (۲ دقیقه)
2) POST /.api/auth/otp-verification  (Bearer otp-token)  body { otp } → { accessToken, refreshToken }  // access ۳۰ روز
3) GET  /.api/auth/refresh            (Bearer refresh-token)  → { accessToken, refreshToken }
4) GET  /.api/user/me                                                    → { success, user }
```

`GET /.api/user/me` پاسخ:

```jsonc
{
  "success": true,
  "user": {
    "userId": "...", "role": "user", "isActive": true, "mobile": "...", "disable": false,
    "createdAt": "...", "updatedAt": "...",
    "email": "...", "emailIsVerification": false, "isComplete": true,
    "lastSeen": 1730000000000,
    "personalDocuments": [], "age": 28, "fullName": "علی رضایی", "position": "برنامه‌نویس", "avatar": "https://..."
  }
}
```

> `userId` و `fullName` و `avatar` را در کل فرانت نگه دارید؛ در رویدادهای Socket و لیست اعضا استفاده می‌شوند.

### ۱.۳ ⚠️ فرمت پاسخ خطا — بسیار مهم

`expressErrorHandler` **همیشه با HTTP 200** پاسخ می‌دهد. یعنی `res.ok` همیشه `true` است!

```jsonc
{
  "message": "متن فارسی خطا",
  "statusCode": 400,
  "code": "ERROR",
  "data": { /* اختیاری */ },
  "success": false,
  "reason": "ERR_SOMETHING"   // ← کلید تشخیص نوع خطا
}
```

> **قانون طلایی:** هرگز `status === 200` را ملاک نگذارید. **همیشه `success === true` را چک کنید.**
> برای تشخیص نوع خطا از `reason` استفاده کنید.

### ۱.۴ ساختار پاسخ موفق

پاسخ موفق یکدست نیست (ad-hoc). معمولاً:

```jsonc
{ "success": true, "message": "پیام فارسی", "statusCode": 201, ...فیلدهای اختصاصی }
```

⚠️ یک استثنا: `GET /table/:tableId/messages` در حالت موفق **فیلد `success` ندارد** (بخش ۶.۳).

### ۱.۵ خطاهای احراز هویت

| `reason` | معنی | واکنش فرانت |
|---|---|---|
| `ERR_ACCESS_API_KEY` | `X-Api-Key` غلط/ندارد | خطای کانفیگ |
| `ERR_TOKEN_UNDEFINED` | توکن نیست | هدایت به لاگین |
| `ERR_TOKEN_INVALID` | توکن نامعتبر یا `otp-token`/`refresh-token` است | تلاش برای refresh |
| `ERR_LOGIN_USER_NOTFOUND` | کاربر حذف/غیرفعال | لاگین مجدد |
| `ERR_ACCESS_DENIED` | نقش کاربر اجازه این route را ندارد | مخفی کردن UI |

**ساختار خطای اعتبارسنجی (Zod):**

```jsonc
{
  "success": false,
  "reason": "ERR_VALIDATION",
  "statusCode": 400,
  "data": { "errors": [ { "code": "too_small", "message": "متن فارسی", "path": ["label"] } ] }
}
```

> `path` آرایه‌ای از کلیدهای فیلد است → مستقیم زیر اینپوت قابل نمایش است.

### ۱.۶ محدودیت‌ها

* **Rate limit:** `500` درخواست در دقیقه (global).
* **حجم body:** `10MB`.
* **CORS:** origin باید در `CORS_ORIGIN` (جداشده با کاما) باشد. پیش‌فرض: `localhost:3000,3001,3002`.
* آپلود فایل حتماً از طریق `POST /.api/upload` (بخش ۵).

---

## ۲. احراز هویت Socket.IO

```ts
import { io } from 'socket.io-client'

const socket = io(`${BASE_URL}/cafe`, {
  auth: { token: accessToken },     // ← همان accessToken
  transports: ['websocket', 'polling'],
  autoConnect: false
})
```

* Namespace: **`/cafe`** (و `/notification` جداگانه).
* Middleware سرور: `socketTranslator` (i18n) → `authSocket`.
* خطای احراز هویت به‌صورت **middleware error** می‌آید:

```jsonc
{ "message": "متن فارسی", "data": { "message": "...", "statusCode": 401, "reason": "ERR_AUTH_TOKEN_INVALID", "success": false } }
```

| `reason` | معنی |
|---|---|
| `ERR_AUTH_TOKEN_INVALID` | توکن بد یا `otp-token` |
| `ERR_AUTH_TOKEN_EXPIRED` | منقضی شده → refresh کنید |
| `ERR_LOGIN_USER_NOTFOUND` | کاربر نیست |

**حضور کاربر خودکار مدیریت می‌شود:**

* روی `connect`: `user datas.isOnline = true`
* روی `disconnect`: `isOnline = false`, `lastSeen = Date.now()`

پس لازم نیست چیزی بفرستید؛ فقط با باز/بسته شدن صفحه، آنلاین بودن خودکار است.

> 📘 راهنمای کامل «اتصال → اتاق‌ها → دریافت لحظه‌ای تغییرات» در **بخش‌های ۸.۸ تا ۸.۱۰** و composable کامل در **بخش ۱۴** است.

---

## ۳. مدل‌های داده (TypeScript Types)

### ۳.۱ `ICafe`

```ts
export interface ICafe {
  id: string              // uniqid — کلید اصلی کافه در همه APIها
  label: string           // الزامی — عنوان نمایشی
  title?: string | null
  body?: string | null
  description?: string | null
  profileImage: string | null
  tags?: string[]
  vip: boolean            // پیش‌فرض false
  isActive: boolean       // پیش‌فرض true
  enabled: boolean        // پیش‌فرض true
  ownerId: string
  status: 'public' | 'privite'      // ← غلط املایی: 'privite' نه 'private'
  priviteUsersId?: string[]
  view: number            // با هر GET single یکی زیاد می‌شود
  createdAt: string
  updatedAt: string
}
```

### ۳.۲ `ICafeTable` — «گفتگو»

```ts
export interface ICafeTable {
  id: string              // uniqid — این را در URL مسیرها و نام اتاق Socket استفاده کنید
  tableId: string         // شناسه عمومی: 'ch_' (space) | 'cv_' (club-voice) | 'tb_' (bot)
  cafeId: string
  nikname: string | null  // نام نمایشی گفتگو
  profileImage: string    // آواتار میز
  enabled: boolean        // پیش‌فرض true
  isActive: boolean       // پیش‌فرض false — تا false باشد میز غیرقابل استفاده است
  status: 'public' | 'privite'
  tableType: 'bot' | 'club-voice' | 'space'    // ⚠️ فقط 'space' چت متنی دارد
  messageSecunce: number  // ← غلط املایی! شمارنده‌ی کل پیام‌های میز
  messageSendingEnabled?: { enabled: boolean; startAt: number | null; endAt: number | null }
  secureChat?: { enabled: boolean; startAt: number | null; endAt: number | null } | null
  lastMessage?: { text: string; sender: string; type: MessageType }
  free: boolean
  amount: number | null
  star: number | null
  createdAt: string
  updatedAt: string
}
```

> ⚠️ `messageSendingEnabled.*` و `secureChat.*` **عدد (ms epoch)** هستند، نه رشته‌ی تاریخ.
> ⚠️ `tableType` برای چت متنی باید `'space'` باشد؛ اگر `'bot'` یا `'club-voice'` بود، ارسال پیام با 404 رد می‌شود.

### ۳.۳ `ICafeTableMessage` — «پیام»

```ts
export type MessageType = 'voice' | 'video' | 'image' | 'text' | 'challange' | 'file' | 'audio' | 'poll'

export interface ICafeTableMessage {
  id: string                 // uniqid پیام
  roomId: string             // === tableId گفتگو
  senderId: string           // userId فرستنده
  type: MessageType
  text: string
  sequence: number           // ★ شمارنده‌ی ترتیبی — مبنای cursor و seen
  status: 'active' | 'suspended' | 'submitted-for-review' | 'deleted'
  like: string[]             // ★ آرایه‌ی userId هایی که لایک کرده‌اند
  view: number
  createdAt: string
  updatedAt: string
  file?: { fileType: string | null; thubmnail: string | null; mainUrl: string | null }  // ← 'thubmnail' غلط است
  reaplayTo?: {              // ← 'reaplayTo' غلط است، نه 'replyTo'
    messageId: string; textType: MessageType; text: string; userId?: string
  } | null
  messageEdited: { editedAt: number; text: string }[]   // تاریخچه‌ی ویرایش
  poll?: {
    title: string; description?: string; body?: string; value: number
    options: { title: string; description: string }[]
  } | null
  processAt?: Date           // در خروجی REST حذف می‌شود
}
```

**قواعد UI بر اساس `status`:**

| `status` | یعنی | رفتار UI |
|---|---|---|
| `active` | عادی | نمایش کامل |
| `submitted-for-review` | به‌خاطر کلمه بد، منتظر داوری | نمایش با هشدار «در انتظار تأیید» |
| `suspended` | توسط ادمین معلق شده | نمایش با هشدار |
| `deleted` | حذف نرم | نمایش «این پیام حذف شد» |

### ۳.۴ `ICafeTableParticipant` — «عضو گفتگو»

```ts
export interface ICafeTableParticipant {
  roomId: string            // === tableId
  cafeId?: string
  userId: string
  role: 'admin' | 'moderator' | 'member'
  status: 'active' | 'left' | 'banned' | 'mute'
  leftAt?: number
  muteUntil: boolean | number
  bannedUntil: boolean | number
  lastReadMessageId: string | null
  lastReadSequence: number | null
  lastReadAt: number | null
  createdAt: string
  updatedAt: string
}
```

### ۳.۵ خروجی لیست اعضای میز (`ITableUserView`)

```ts
export interface ITableUserView {
  _id: string
  userId: string
  mobile: string
  createdAt: string
  fullName: string          // ⚠️ رشته‌ی الحاقی first + ' ' + last
  age: number
  avatar: string
  email: string
  position: string
  gender: string
  personalityType: string
  isOnline: boolean
  lastSeen: number
}
```

### ۳.۶ مدل کلمه‌ی ممنوعه (فقط برای درک رفتار، endpoint ندارد)

```ts
export interface IBadWord {
  word: string
  category: 'sexual' | 'insult' | 'religious' | 'racial' | 'general' | 'swear' | 'profanity'
  severity: number         // ۱ تا ۱۰
  language: 'persian' | 'finglish' | 'english' | 'arabic' | 'mixed'
}
```

فیلتر کلمات ممنوعه **کاملاً خودکار و سمت سرور** است (بخش ۸.۳-۵) و کاربر نیازی به تماس با آن ندارد.

---

## ۴. سطوح دسترسی — چه کاری می‌توانم بکنم؟

> ⚠️ **مهم:** کاربری که مدیر برایش `access` ساخته، **کاربر نهایی** است و می‌تواند تنظیمات کافه و میز را تغییر دهد.
> جدول کامل «چه دکمه‌ای را نشان بدهم» در **بخش ۷.۶** و composable در همان بخش است.
> endpointهای این قابلیت‌ها در **بخش ۷.۵** مستند شده‌اند.

کاربر سطح دسترسی خود را از `GET /.api/cafe/me/my-ct` می‌گیرد.

| نوع دسترسی | یعنی | چه کاری می‌تواند |
|---|---|---|
| `cafe` | **مدیر کافه** | همه‌ی کارهای `table` + ساخت میز + ویرایش کافه + اعطای دسترسی `table` + بن/فعال/اخراج |
| `table` | **مدیر میز** | تنظیم بازه‌ی ارسال پیام و چت امن · ویرایش محدود میز · حذف نرم میز · بن کردن عضو · اعطای دسترسی `guest` |
| `guest` | مهمان | فقط پیام خودش را حذف/ویرایش کند؛ ارسال فقط در بازه‌ی `messageSendingEnabled` |
| ندارد | بیرونی | فقط دریافت |

**ساختار رکورد دسترسی (`GET /me/my-ct`):**

```ts
export interface ICafeAccess {
  id: string
  type: 'cafe' | 'table' | 'guest'
  targetId: string                   // cafe.id یا table.id بسته به type
  ownerId: string
  userId: string
  startAt?: number | null            // ms epoch
  endAt: number | null               // null = دائمی
  createdAt: string
  updatedAt: string
}
```

**⚠️ هشدار دو باگ سرور که روی این منطق اثر می‌گذارند:**

1. `hasAccess` فیلد `startAt` را **نادیده می‌گیرد** → دسترسی از قبل از موعد شروعش فعال است. سمت کلاینت خودتان `startAt` را هم چک کنید.
2. `editMseAndSecureChat` و `bannedUserParticipant` **دسترسی را واقعاً چک نمی‌کنند** → هر کاربر لاگین‌کرده‌ای می‌تواند آن‌ها را صدا بزند. حتماً دکمه‌ها را با منطق بخش ۷.۶ مخفی کنید.

---

## ۵. آپلود فایل (برای پیام صوتی/عکس/فایل)

```
POST /.api/upload/?action=images&collection=image&thumbnail=yes
Headers: X-Api-Key, Authorization
Content-Type: multipart/form-data
Body: file (File)
```

| query | مقادیر مجاز |
|---|---|
| `action` | `images` \| `video` \| `file` \| `audio` |
| `collection` | `image`, `avatar`, `avatar-thumb`, `document`, `video`, `audio`, `file`, `voice`, `carousel`, `story`, `profile` |
| `thumbnail` | `yes` (فقط تصویر/ویدیو) |

**پاسخ `201`:**

```jsonc
{ "success": true, "file": "https://cdn.../abc.webp", "thumbnail": "https://cdn.../abc_thumb.webp", "statusCode": 201 }
```

**محدودیت حجم:** تصویر ۵MB (png/jpeg/webp/heic/gif) · ویدیو ۱۰۰MB · صدا ۸MB · فایل ۵۰MB

**نگاشت پسوند → `type` پیام (سمت سرور، خودکار):**

| پسوند فایل | `type` پیام |
|---|---|
| `png`, `jpeg`, `webp` | `image` |
| `mp3` | `audio` |
| `ogg` | `voice` |
| بقیه | `file` |

> برای ویس: فایل `.ogg` با `action=audio&collection=voice` آپلود شود تا `type='voice'` شود.

---

## ۶. REST API های کاربر نهایی — ۲۳ endpoint

> همه با `/.api/cafe` شروع می‌شوند و هدرهای `X-Api-Key` + `Authorization` لازم دارند.
> ⚠️ **دسترسی‌محور:** بعضی از این endpointها فقط برای کاربری که مدیر به او `access` داده کار می‌کنند — بخش ۸.

### ۶.۱ گفتگو و پیام — همه‌ی کاربران

| # | Method | Path | کاربرد |
|---|---|---|---|
| 1 | GET | `/cafes/feet` | کافه‌های پیشنهادی |
| 2 | GET | `/:id/single` | جزئیات یک کافه |
| 3 | GET | `/table/:cafeId/tables` | میزهای یک کافه |
| 4 | GET | `/table/:cafeId/:tableId/single` | جزئیات یک میز |
| 5 | GET | `/table/q` | جست‌وجوی سریع میز |
| 6 | GET | `/me/my-ct` | دسترسی‌های من |
| 7 | POST | `/table/subscribe` | عضو شدن به گفتگو |
| 8 | GET | `/table/subscribed` | لیست گفتگوهای من ★★ |
| 9 | POST | `/table/:tableId/left` | ترک گفتگو |
| 10 | GET | `/table/:tableId/users` | اعضای گفتگو |
| 11 | GET | `/table/:tableId/messages` | تاریخچه‌ی پیام‌ها ★★★ |
| 12 | POST | `/table/messages/:tableId/seen` | علامت «خوانده شد» |
| 13 | POST | `/table/messages/:tableId/:messageId/like` | لایک / دیسلایک ★ |
| 14 | POST | `/table/create-report` | گزارش پیام یا میز |

### ۶.۲ مدیریت — فقط برای کاربران دارای دسترسی (بخش ۸)

| # | Method | Path | نیازمند |
|---|---|---|---|
| 15 | PUT | `/me/:id/update` | دسترسی `cafe` روی کافه |
| 16 | PUT | `/table/:tableId/update` | دسترسی `cafe` **یا** `table` روی میز |
| 17 | PUT | `/table/:tableId/mse-sc` | دسترسی `cafe` **یا** `table` ⚠️ (باگ: عملاً هر کاربری) |
| 18 | POST | `/table/:cafeId/new` | دسترسی `cafe` روی کافه |
| 19 | POST | `/table/:tableId/create-access` | دسترسی `cafe` (اعطای `table`) یا `table` (فقط `guest`) |
| 20 | POST | `/table/:tableId/banned/:userId` | دسترسی `cafe` یا `table` ⚠️ (باگ: عملاً هر کاربری) |
| 21 | DELETE | `/table/:cafeId/delete/:tableId` | دسترسی `cafe` یا `table` → حذف نرم |
| 22 | GET | `/access` | ⚠️ فهرست همه‌ی دسترسی‌ها (کنترل‌نشده) |
| 23 | GET | `/table/tables/list` | ⚠️ فهرست همه‌ی میزها (کنترل‌نشده) |

---

## ۷. جزئیات کامل هر endpoint

### ۷.۱ کافه‌ها (مرور و کشف)

---

#### ۱. `GET /.api/cafe/cafes/feet` — کافه‌های پیشنهادی

**Query**

| پارامتر | نوع | توضیح |
|---|---|---|
| `q` | `string` | جست‌وجوی متنی |
| `limit` | `number` | تعداد |
| `page` | `number` | صفحه |

**پاسخ `201`** (بله، ۲۰۱!)

```jsonc
{
  "success": true,
  "data": {
    "public":  [ /* ICafe[] — کافه‌های فعال و عمومی */ ],
    "privite": [ /* ICafe[] — کافه‌های فعال و خصوصی که userId من در priviteUsersId است */ ]
  }
}
```

> ⚠️ `privite` غلط املایی سرور است.

---

#### ۲. `GET /.api/cafe/:id/single` — یک کافه

**Params:** `id` (کافه) · **Query:** ندارد

**پاسخ `200`**

```jsonc
{ "success": true, "cafe": { /* ICafe — بدون _id و __v */ } }
```

> ⚠️ هر بار این endpoint صدا زده شود `cafe.view` یکی زیاد می‌شود (پس برای نمایش شمارنده، آخرین پاسخ را نگه دارید).
> ⚠️ اگر کافه پیدا نشود **۴۰۴ نمی‌دهد**؛ `cafe` خالی برمی‌گردد → خودتان چک کنید.
> فقط کافه‌های `isActive: true` برگردانده می‌شوند.

---

#### ۳. `GET /.api/cafe/table/:cafeId/tables` — میزهای یک کافه

**Params:** `cafeId`

**Query** (فیلترهای boolean مقدار `'yes'`/`'no'` می‌پذیرند):

| پارامتر | توضیح |
|---|---|
| `page` · `limit` | صفحه‌بندی |
| `status` | `'public' \| 'privite'` |
| `q` | جست‌وجوی متنی روی `nikname`/`tableId` |
| `sort` | `'asc' \| 'desc'` |
| `type` | `'bot' \| 'club-voice' \| 'space'` — برای فیلتر «فقط میزهای چت» |
| `isActive` · `enabled` · `free` | `'yes' \| 'no'` |

**پاسخ `200`:** `{ "success": true, "tables": [ /* ICafeTable[] */ ] }`

> این endpoint برای کاربر هم فیلترها را اعمال می‌کند (برخلاف نسخه‌ی مدیریتی).

---

#### ۴. `GET /.api/cafe/table/:cafeId/:tableId/single` — یک میز

**Params:** `cafeId` · `tableId` (همان `id` میز)

**پاسخ `200`**

```jsonc
{
  "success": true,
  "table": {
    /* ...فیلدهای ICafeTable... */,
    "isManager": true,
    "subscribe": [ { "userId": "...", "role": "member", "status": "active" } ]
  }
}
```

> ⚠️ مهم: خروجی به‌خاطر `$unwind` روی `subscribe` **به تعداد شرکت‌کننده تکرار می‌شود**؛ یعنی `table` یک **آرایه** است. سمت فرانت: `res.table[0]`.
> اگر کاربر دسترسی نداشته باشد → `subscribe` خالی است ولی `200` برمی‌گردد (خطا نمی‌دهد).

---

#### ۵. `GET /.api/cafe/table/q` — جست‌وجوی سریع میز

**Query:** `text` (الزامی) · `page` · `limit`

**پاسخ**

```jsonc
{ "success": true, "result": [ /* نتایج */ ] }     // اگر text داده شده باشد
{ "success": true, "result": null }                // اگر text نباشد
```

---

#### ۶. `GET /.api/cafe/me/my-ct` — دسترسی‌های من

**Query:** `type` (`'cafe'\|'table'\|'guest'`) · `page`

فقط رکوردهایی که `endAt === null` یا `endAt >= now` هستند برگردانده می‌شوند.

**پاسخ `200`**

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "...", "type": "table", "targetId": "...", "userId": "...", "startAt": null, "endAt": null,
      "cafe":  { "id": "...", "label": "...", "nikname": "..." },   // بسته به type پر می‌شود
      "table": { "id": "...", "nikname": "...", "tableId": "ch_xxx" }
    }
  ]
}
```

> ⚠️ باگ: `page` به‌جای `limit` استفاده شده (تعداد نتایج را تعیین می‌کند). برای فهرست کامل، `page` را بزرگ بفرستید.

---

### ۷.۲ عضویت در گفتگو

---

#### ۷. `POST /.api/cafe/table/subscribe` — عضو شدن

**Body:** `{ "tableId": string }` · **Query:** ندارد

**شرایط موفقیت:** میز باید `status === 'public' && isActive === true && enabled === true` باشد.

**پاسخ `201`:** `{ "success": true, "message": "به میز عضو شدید" }`

**خطاها**

| `reason` | معنی | رفتار UI |
|---|---|---|
| `ERR_TABLE_SUBSCRIPTION_ID` | میز نامعتبر/غیرفعال/خصوصی | «این گفتگو در دسترس نیست» |
| `ERR_USER_SUBSCRIBED` | قبلاً عضو فعال است | به گفتگو هدایت شو |
| `ERR_TABLE_BANNED` | کاربر بن شده | «شما از این گفتگو محروم شده‌اید» |

**عوارض موفقیت:** ساخت رکورد عضویت + `redis.sAdd('channel:{tableId}:members', userId)` → از این پس اعلان `cafe:table:receive-new-message` می‌گیرید.

**اگر قبلاً `left` کرده بودید:** دوباره `active` می‌شود و عضویت برقرار می‌شود.

---

#### ۸. `GET /.api/cafe/table/subscribed` — لیست گفتگوهای من ★★

این endpoint **ستون فقرات صفحه‌ی لیست گفتگوهای پیام‌رسان** است.

**Query:** `page` · `limit` · `sort` (`'asc'|'desc'`, پیش‌فرض `desc`)

**پاسخ `200`**

```jsonc
{
  "success": true,
  "channels": [
    {
      /* فیلدهای ICafeTable */,
      "unreadMessages": 12,                    // ★ تعداد خوانده‌نشده
      "cafe": { "id": "...", "label": "...", "profileImage": "...", "isActive": true },
      "lastMessage": { "text": "سلام", "sender": "u123", "type": "text" }
    }
  ]
}
```

> ⚠️ باگ سرور: `$limit` قبل از `$skip` اعمال می‌شود و `$skip` مقدار «شماره صفحه» را می‌گیرد نه offset. یعنی صفحه‌بندی درست کار نمی‌کند.
> **راهکار:** `limit` را بزرگ (مثلاً `100`) بگیرید و سمت کلاینت paginate کنید.
> فقط گفتگوهایی که میز و کافه‌شان `isActive` است برگردانده می‌شوند.

---

#### ۹. `POST /.api/cafe/table/:tableId/left` — ترک گفتگو

**Params:** `tableId` · **Query:** ندارد · **Body:** ندارد

**پاسخ `201`:** `{ "success": true, "message": "از میز خارج شدید" }`
**خطا:** 404 `ERR_TABLE_NOT_FOUND` (عضو فعال نبوده‌اید)

**عوارض:** `status='left'`، `leftAt`، و `redis.sRem('channel:{tableId}:members', userId)` → دیگر اعلان نمی‌گیرید.

---

#### ۱۰. `GET /.api/cafe/table/:tableId/users` — اعضای گفتگو

**Params:** `tableId` · **Query:** `page`

**پاسخ `200`**

```jsonc
{ "success": true, "users": [ /* ITableUserView[] — شامل isOnline و lastSeen */ ] }
```

اگر دسترسی نداشته باشید → `{ "success": true, "users": [] }` (خطا نمی‌دهد).

> اگر گفتگو را ترک کرده باشید، لیست خالی می‌گیرید → اول `subscribe` کنید.

---

### ۷.۳ پیام‌ها ★★★

---

#### ۱۱. `GET /.api/cafe/table/:tableId/messages` — تاریخچه‌ی پیام‌ها

**Params:** `tableId` · **Query:** `direction` · `cursor` · `loadAll`

| پارامتر | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `direction` | `'old' \| 'new'` | `'new'` | `old` = پیام‌های قدیمی‌تر (اسکرول به بالا) · `new` = پیام‌های جدیدتر |
| `cursor` | `number` | — | ★ **`sequence` عددی**، نه timestamp و نه offset |
| `loadAll` | `any` | — | اگر truthy باشد تا **۵۰۰** پیام، به‌جای ۱۵ |

**منطق سرور:**

* اگر `cursor` ندهید → از `participant.lastReadMessageId` استفاده می‌کند و `sequence` آن پیام مبنا قرار می‌گیرد.
* `direction='old'` → `sequence < cursor`، مرتب‌سازی نزولی، سپس **معکوس** → خروجی همیشه **صعودی (قدیمی به جدید)**.
* `direction='new'` → `sequence > cursor`، مرتب‌سازی صعودی → خروجی صعودی.
* محدودیت: `15` پیام در هر صفحه (یا `500` با `loadAll`).

**پاسخ `200`:**

```jsonc
{
  "messages": [ /* ICafeTableMessage[] — بدون _id، __v، processAt */ ],
  "hasMore": true,
  "nextCursor": 152
}
```

**پاسخ وقتی میز یا کافه پیدا نشود (`201`):**

```jsonc
{ "messages": [], "success": true, "reason": "INFO_TABLE_NOT_FOUND" }
```

> ⚠️⚠️ **باگ جدی سرور:** در `$lookup` نام کلکسیون کافه `"caves"` نوشته شده (به‌جای `"cafes"`) و `$unwind` بدون `preserveNullAndEmptyArrays` است → در عمل این endpoint اغلب `INFO_TABLE_NOT_FOUND` برمی‌گرداند.
> **حتماً** این حالت را هندل کنید: پیام «میز در دسترس نیست» + دکمه‌ی تلاش مجدد (نه چرخش بی‌نهایت).
> ⚠️ این endpoint در حالت موفق **فیلد `success` ندارد**؛ ملاک تشخیص، وجود `messages` است.

**الگوی صفحه‌بندی بی‌نهایت:**

```
بار اول:                GET ?direction=new                 → ۱۵ پیام جدید از آخرین خوانده
اسکرول به بالا:        GET ?direction=old&cursor={nextCursor} → ۱۵ پیام قبلی (prepend کن)
تکرار تا messages.length === 0 یا nextCursor === null
```

---

#### ۱۲. `POST /.api/cafe/table/messages/:tableId/seen` — علامت «خوانده شد»

**Params:** `tableId` · **Query:** ندارد · **Body:** `{ "seen": number }`

| فیلد | نوع | توضیح |
|---|---|---|
| `seen` | `number` | **بزرگ‌ترین `sequence` که کاربر دیده است** |

سرور آن را با `table.messageSecunce` کلمپ می‌کند و `$max lastReadSequence` می‌زند (یعنی هیچ‌وقت عقب نمی‌رود) و `lastReadAt` را به‌روز می‌کند.

**پاسخ `201`:** `{ "success": true, "statusCode": 201 }`

> ⚠️ سرور `lastReadMessageId` را به‌روز نمی‌کند، فقط `lastReadSequence`.
> **فرمول badge خوانده‌نشده:** `unreadMessages = table.messageSecunce - participant.lastReadSequence`

---

#### ۱۳. `POST /.api/cafe/table/messages/:tableId/:messageId/like` — لایک / دیسلایک ★

جزئیات کامل در **بخش ۹**.

---

### ۷.۴ گزارش محتوا

---

#### ۱۴. `POST /.api/cafe/table/create-report` — گزارش پیام یا میز

**Query:** `report-for` = `'message' \| 'table'` (الزامی)

| `report-for` | معنی | `id` در body | `contentType` ثبت‌شده |
|---|---|---|---|
| `message` | گزارش یک پیام | `message.id` | `message` |
| `table` | گزارش کل گفتگو | `table.id` | `chat` |

**Body:** `{ "id": string, "metadata"?: any }`

* `id` — شناسه‌ی پیام یا میز
* `metadata` — دلخواه (مثلاً `{ reason: "توهین" }`)

**پاسخ `201`:** `{ "success": true, "message": "گزارش ثبت شد و در سریع ترین زمان ممکن رسیدگی میشود", "result": { /* گزارش */ } }`

**خطاها:** 400 `ERR_VALIDATION` (اگر `report-for` یا `id` نامعتبر باشد) · 404 `ERR_PROFANITY_REPORT_NOT_FOUND`

> کاربر از این مسیر هیچ چیزی درباره‌ی وضعیت گزارش‌ها نمی‌بیند (پنل داوری، بخش ۱۵).

---

### ۷.۵ مدیریت کافه و میز (فقط برای کاربران دارای دسترسی) ★

> **این بخش مهم است:** کاربری که مدیر (یا مدیر کافه) به او `access` داده، می‌تواند تنظیمات کافه و میز را تغییر دهد.
> این‌ها endpointهای «کاربر نهایی» هستند، نه پنل ادمین.

**⚠️ نکته‌ی کلیدی درباره‌ی منطق سرور (`checkByRoleAccess`):**

سرور برای نقش `user` به‌ترتیب این‌ها را بررسی می‌کند: `cafe` روی کافه → `table` روی میز → در نهایت `partialAccess(null)`.
بیشتر توابع مدیریتی داخل `partialAccess` یک شرط `access?.type === 'cafe' || access?.type === 'table'` دارند؛ **پس مدیر کافه (`cafe`) و مدیر میز (`table`) می‌توانند، ولی `guest` و بدون دسترسی نمی‌توانند.**
دو استثنای باگ‌دار که در ادامه علامت زده شده.

---

#### ۱۵. `PUT /.api/cafe/me/:id/update` — تنظیمات کافه (توسط کاربر) ★

**پیش‌نیاز:** کاربر باید در `GET /me/my-ct` یک رکورد با `type === 'cafe'` و `targetId === id` داشته باشد.

**Params:** `id` (کافه) · **Query:** ندارد · **Body:**

| فیلد | نوع | الزامی | توضیح |
|---|---|---|---|
| `enabled` | `boolean` | ✅ | نمایش/عدم نمایش کافه در لیست‌های عمومی |
| `vip` | `boolean` | ✅ | برچسب VIP |

فقط همین دو فیلد ذخیره می‌شوند (`$set` روی همین دو).

**پاسخ `200`:** `{ "success": true, "message": "کافه بروزرسانی شد" }`

**خطاها:** 404 `ERR_CAFE_NOT_FOUND` · 404 `ERR_CAFE_ACCESS_NOT_FOUND` (دسترسی `cafe` نداری)

> برای کاربر عادی، **تنها راه ویرایش کافه همین endpoint است** (ویرایش کامل `PUT /:id` مالک را عوض می‌کند و برای فرانت ناامن است — بخش ۱۲).

---

#### ۱۶. `PUT /.api/cafe/table/:tableId/update` — تنظیمات میز ★

**پیش‌نیاز:** دسترسی `cafe` **یا** `table` روی همین میز.

**Params:** `tableId` · **Query:** ندارد · **Body (بدون Zod — خودتان اعتبارسنجی کنید):**

| فیلد | نوع | `cafe`/`table` manager | ادمین |
|---|---|---|---|
| `username` | `string` | ✅ | ✅ → فیلد `tableId` |
| `nikname` | `string` | ✅ | ✅ |
| `avatar` | `string` (URL) | ✅ → فیلد `profileImage` | ✅ |
| `enabled` | `boolean` | ✅ | ✅ |
| `isActive` | `boolean` | ❌ | ✅ |
| `free` | `boolean` | ❌ | ✅ |
| `amount` | `number` | ❌ | ✅ → `star` هم محاسبه می‌شود |
| `tableStatus` | `'public'\|'privite'` | ❌ | ✅ |
| `type` | `'club-voice'\|'space'` | ❌ | ✅ → `tableType` |

**پاسخ `200`:** `{ "success": true, "message": "میز بروزرسانی شد", "table": { /* فیلدهای ذخیره‌شده */ } }`

**خطاها**

| `reason` | شرط |
|---|---|
| `ERR_TABLE_NOT_FOUND` | میز وجود ندارد یا `isActive:false` |
| `ERR_TABLE_DUPLICATE_USERNAME` | `username` تکراری است (سراسری) |
| `ERR_TABLE_UPDATE` | سطح دسترسی کافی نبوده (مثلاً `guest`) |
| `ERR_TABLE_NOT_CREATED` | نقش کاربر مجاز نیست |

> ⚠️ سرور `nikname`, `avatar`, `username`, `enabled` را حتی اگر نفرستید `undefined` می‌نویسد (به‌خاطر نبود Zod) → همیشه همه‌ی فیلدهای `sharedData` را بفرستید.

---

#### ۱۷. `PUT /.api/cafe/table/:tableId/mse-sc` — بازه‌ی ارسال پیام / چت امن ★★

**پیش‌نیاز:** دسترسی `cafe` **یا** `table`.
> ⚠️ **باگ سرور:** در عمل **هر کاربر لاگین‌کرده‌ای** (حتی بدون دسترسی) می‌تواند این کار را انجام دهد، چون `partialAccess` بدون چک دسترسی `edit()` را صدا می‌زند. پس UI را با منطق دسترسی خودتان کنترل کنید.

**Query:** `action` = `'mse' \| 'secure-chat'` (پیش‌فرض `mse`)

**Body** (بسته به `action`):

```jsonc
// action=mse  → تنظیم بازه‌ی ارسال پیام
{ "messageSendingStatus": { "enabled": true, "start": 1730000000000, "end": 1730086400000 } }

// action=secure-chat  → تنظیم بازه‌ی چت امن
{ "secureChat": { "enabled": true, "start": 1730000000000, "end": 1730086400000 } }
```

| فیلد | نوع | توضیح |
|---|---|---|
| `enabled` | `boolean` | روشن/خاموش کردن |
| `start` | `number` (ms epoch) | شروع بازه |
| `end` | `number` (ms epoch) | پایان بازه |

**اعتبارسنجی سرور (فقط وقتی `enabled===true`):**

| شرط | `reason` |
|---|---|
| `Date.now() < start` (شروع در آینده) | 400 `ERR_VALIDATION` (`table_edit-mse-startTime` / `table_edit-sc-startTime`) |
| `end < start` | 400 `ERR_VALIDATION` (`table_edit-mse-endTime` / `table_edit-sc-endTime`) |

**پاسخ `201`**

```jsonc
{
  "success": true,
  "message": "چت فعال شد",     // یا "چت غیر فعال شد"
  "result": { "messageSendingEnabled": { /* ... */ }, "secureChat": { /* ... */ } }
}
```

**⚡ رویدادهای Socket که همزمان پخش می‌شوند (به `table_{tableId}_room`):**

| رویداد | payload |
|---|---|
| `cafe:table:message-sending-status` | `"enabled"` یا `"disabled"` |
| `cafe:table:secure-chat-status` | `"enabled"` یا `"disabled"` |

**خطای 404:** `ERR_TABLE_NOT_FOUND` (میز وجود ندارد یا `isActive:false`)

---

#### ۱۸. `POST /.api/cafe/table/:cafeId/new` — ساخت میز جدید (توسط مدیر کافه)

**پیش‌نیاز:** دسترسی `cafe` روی کافه (فقط `cafe` — دسترسی `table` کافی نیست).

**Params:** `cafeId` · **Body:** همان `createTableSchema` (بخش ۱۷ پیش‌نویس):

| فیلد | نوع | الزامی | توضیح |
|---|---|---|---|
| `nikname` | `string` | ✅ | نام میز (سراسری یکتا) |
| `avatar` | `string` (URL معتبر) | ✅ | تصویر میز |
| `username` | `string` | ❌ | شناسه‌ی عمومی |
| `type` | `'club-voice' \| 'space'` | ✅ | برای چت متنی `space` |

**فیلدهایی که مدیر کافه (کاربر) نمی‌تواند تعیین کند (سرور تحمیل می‌کند):** `isActive: true` · `status: 'public'` · `tableType: body.type`

**پاسخ `200`:** `{ "success": true, "message": "...", "table": { /* ICafeTable */ } }`

**خطاها**

| `reason` | شرط |
|---|---|
| `ERR_CAFE_NOT_FOUND` | کافه وجود ندارد |
| `ERR_CREATE_TABLE_CAFE_DISABLED` | کافه `isActive` یا `enabled` ندارد |
| `ERR_TABLE_DUPLICATE_NIKNAME` | نام تکراری |
| `ERR_CAFE_ACCESS_NOT_FOUND` | دسترسی `cafe` نداری (پاسخ `success:false`, HTTP 200) |

---

#### ۱۹. `POST /.api/cafe/table/:tableId/create-access` — اعطای دسترسی به کاربر دیگر (توسط مدیر)

**پیش‌نیاز:** دسترسی `cafe` یا `table`.

**Params:** `tableId` · **Body:** `{ "userId": string, "accessTo": 'table'|'guest', "startAt"?: number, "endAt"?: number }`

**قواعد سطح دسترسی اعطاشده:**

| سطح من | `accessTo` قابل اعطا |
|---|---|
| `cafe` | `table` یا `guest` |
| `table` | فقط `guest` (سرور مقدار را تحمیل می‌کند) |

> ⚠️ Zod این route وصل نیست → اعتبارسنجی سمت سرور انجام نمی‌شود.
> نمی‌توانید خودتان را اضافه کنید → 400 `ERR_TABLE_USER_ERR`.
> دسترسی تکراری → 400 `ERR_CAFE_USER_ACCESS_DUPLICATE`.

**پاسخ `200`:** `{ "success": true, "message": "...", "body": { /* ... */ } }`

---

#### ۲۰. `POST /.api/cafe/table/:tableId/banned/:userId` — مسدودسازی / اخراج کاربر ★

**پیش‌نیاز:** دسترسی `cafe` یا `table`.
> ⚠️ **باگ سرور:** در عمل **هر کاربر لاگین‌کرده‌ای** می‌تواند این کار را انجام دهد (سرور در `partialAccess` بدون چک دسترسی، بن می‌کند).

**Params:** `tableId` · `userId` · **Body:** `{ "status": 'banned'|'active'|'left' }` (اختیاری)

**قواعد نقش:**

| سطح من | رفتار |
|---|---|
| ادمین (`owner`/`cafe`) | `status` می‌تواند هر سه مقدار باشد |
| کاربر با دسترسی `cafe`/`table` | سرور **فقط `banned`** اعمال می‌کند؛ `status` نادیده گرفته می‌شود |

**پاسخ `200`:** `{ "success": true, "message": "کاربر متخلف مسدود شد" }`

**خطاها:** 404 `ERR_TABLE_NOT_FOUND` (عضو پیدا نشد) · 400 `ERR_VALIDATION_STATUS` (مقدار نامعتبر)

**عوارض Redis:** `active` → `sAdd` به اعلان · `banned`/`left` → `sRem`

---

#### ۲۱. `DELETE /.api/cafe/table/:cafeId/delete/:tableId` — حذف میز

**پیش‌نیاز:** دسترسی `cafe` یا `table`.

**پاسخ `200`**

```jsonc
{ "success": true, "message": "...", "access": "user_cafe" }   // → فقط isActive=false (soft delete)
{ "success": true, "message": "...", "access": "user_table" }   // → فقط isActive=false
{ "success": true, "message": "...", "access": "admin" }        // → حذف کامل (پیام‌ها + دسترسی‌ها)
```

**خطا:** 400 `ERR_CAFE_TABLE_NOT_FOUND` (کافه یا میز وجود ندارد) · 400 `ERR_CAFE_TABLE_UNEXPECTED` (نقش نامعتبر)

> کاربر عادی فقط `isActive` را `false` می‌کند (حذف نرم).

---

#### ۲۲–۲۳. دو endpoint کنترل‌نشده

| Path | توضیح |
|---|---|
| `GET /.api/cafe/access` | همه‌ی رکوردهای دسترسی سیستم (populate کاربر/کافه/میز). ⚠️ فقط نقش `user` دارد (بدون چک ادمین) → داده‌های زیادی لو می‌دهد؛ در فرانت استفاده نکنید. |
| `GET /.api/cafe/table/tables/list` | همه‌ی میزها بدون فیلتر کافه. ⚠️ فقط نقش `user` → برای UI عمومی استفاده نکنید. |

---

### ۷.۶ تصمیم‌گیری سریع: چه چیزی را نشان بدهم؟

```ts
// composables/useCafePermissions.ts
import type { ICafeAccess, ICafeTable } from '@/types/cafe'

export function useCafePermissions(accesses: Ref<ICafeAccess[]>) {
  const isCafeManager = (cafeId: string) =>
    accesses.value.some(a => a.type === 'cafe' && a.targetId === cafeId)

  const isTableManager = (tableId: string) =>
    accesses.value.some(a => a.type === 'table' && a.targetId === tableId)

  const levelForTable = (table: ICafeTable): 'cafe' | 'table' | 'guest' | 'none' => {
    if (isCafeManager(table.cafeId)) return 'cafe'
    if (isTableManager(table.id)) return 'table'
    if (accesses.value.some(a => a.type === 'guest' && a.targetId === table.id)) return 'guest'
    return 'none'
  }

  return {
    isCafeManager,
    isTableManager,
    levelForTable,
    canEditAnyMessage: (t: ICafeTable) => ['cafe', 'table'].includes(levelForTable(t)),
    canEditMessageWindow: (t: ICafeTable) => ['cafe', 'table'].includes(levelForTable(t)),
    canBanMembers: (t: ICafeTable) => ['cafe', 'table'].includes(levelForTable(t)),
    canCreateTable: (cafeId: string) => isCafeManager(cafeId),
    canDeleteTable: (t: ICafeTable) => ['cafe', 'table'].includes(levelForTable(t)),
    canCreateAccess: (t: ICafeTable) => ['cafe', 'table'].includes(levelForTable(t)),
    canEditCafe: (cafeId: string) => isCafeManager(cafeId)
  }
}
```

**جدول تصمیم برای نمایش دکمه‌ها در صفحه‌ی گفتگو:**

| دکمه | `none` | `guest` | `table` | `cafe` |
|---|---|---|---|---|
| ارسال پیام (در بازه‌ی مجاز) | ❌ | ✅ | ✅ | ✅ |
| حذف/ویرایش پیام **خودی** | ❌ | ✅ | ✅ | ✅ |
| حذف/ویرایش پیام **دیگران** | ❌ | ❌ | ✅ | ✅ |
| لایک پیام | ✅ | ✅ | ✅ | ✅ |
| تنظیم بازه‌ی ارسال پیام (`mse`) | ❌ | ❌ | ✅ | ✅ |
| تنظیم چت امن | ❌ | ❌ | ✅ | ✅ |
| ویرایش تنظیمات میز | ❌ | ❌ | ✅ (محدود) | ✅ (کامل) |
| مسدود/اخراج عضو | ❌ | ❌ | ✅ (فقط بن) | ✅ (بن/فعال/اخراج) |
| ساخت میز | ❌ | ❌ | ❌ | ✅ |
| ویرایش کافه (`enabled`/`vip`) | ❌ | ❌ | ❌ | ✅ |
| اعطای دسترسی به دیگران | ❌ | ❌ | ✅ (فقط `guest`) | ✅ (`table`/`guest`) |

---

## ۸. Socket.IO — مرجع کامل

### ۸.۱ اتصال

```ts
const socket = io(`${BASE}/cafe`, { auth: { token: accessToken } })
```

### ۸.۲ اتاق‌ها (Rooms)

| نام اتاق | برای چه | چه کسی داخل می‌شود |
|---|---|---|
| `table_{tableId}_room` | پیام‌های گفتگو | `cafe:table:join-room` |
| `cafe_{roomId}_room` | اتاق عمومی کافه | `cafe:join-room` |
| `channels-page:{userId}` | اعلان «پیام جدید» برای صفحه‌ی لیست گفتگوها | `cafe:join-channels-page` |

> `tableId` در نام اتاق = **`table.id`** (همان چیزی که در `roomId` پیام‌ها ذخیره می‌شود). با `table.tableId` اشتباه نشود.

### ۸.۳ رویدادهای Client → Server

---

#### ۱. `cafe:table:join-room` — ورود به اتاق گفتگو ★

```ts
socket.emit('cafe:table:join-room', { roomId: tableId }, (ok: boolean) => { /* ... */ })
```

* **ورودی:** `{ roomId: string }`
* **پاسخ:** کال‌بک ack با `true` (سرور از callback استفاده می‌کند، نه رویداد جدا)
* **پخش به کل اتاق:** رویداد `cafe:table:join-new-user`:

```jsonc
{ "fullName": "علی رضایی", "userId": "u123", "isOnline": true, "lastSeen": 1730000000000, "role": "member" }
```

> ⚠️ **این رویداد به خود فرستنده هم می‌رسد** — پس باید `userId === myId` را نادیده بگیرید تا خودتان را دوباره اضافه نکنید.

---

#### ۲. `cafe:table:leave-room` — خروج از اتاق گفتگو

```ts
socket.emit('cafe:table:leave-room')
```

* **ورودی:** ندارد
* **پخش به کل اتاق:** `cafe:table:leave-new-user` با همان payload بالا

---

#### ۳. `cafe:table:send-message` — ارسال پیام ★★★

```ts
socket.emit('cafe:table:send-message', {
  tableId: 'ch_65f1...',
  text: 'سلام، حال شما خوبه؟',
  file: undefined,
  poll: undefined,
  reaplyToMessageId: undefined
})
```

**ورودی (`sendMessageSchema`)**

| فیلد | نوع | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|---|
| `tableId` | `string` (min 1) | ✅ | — | `table.id` |
| `text` | `string` | ❌ | `""` | متن پیام |
| `file` | `{ mainFile: string; thumbnailFile?: string }` | ❌ | — | از `POST /.api/upload` |
| `poll` | `object` | ❌ | — | نظرسنجی |
| `reaplyToMessageId` | `string` | ❌ | — | ⚠️ غلط املایی — همین را بفرستید |

**شرایط ارسال موفق:**

* میز باید `isActive: true`, `enabled: true`, `tableType: 'space'` داشته باشد
* کاربر مسدود نباشد
* سطح دسترسی اجازه دهد (جدول زیر)

**ماتریس دسترسی ارسال:**

| سطح کاربر | می‌تواند بفرستد؟ |
|---|---|
| مدیر کافه / ادمین | همیشه ✅ |
| دسترسی `cafe` یا `table` | همیشه ✅ |
| دسترسی `guest` | فقط اگر `messageSendingEnabled.enabled === true` و `endAt > now` |
| بدون دسترسی | فقط اگر چت غیرفعال/منقضی باشد ⚠️ (احتمالاً باگ — فرض کنید **نمی‌تواند** بفرستد) |

**خروجی — رویداد `cafe:table:send-message:recieve` به کل اتاق:**

```jsonc
{
  "id": "msg_65f1...",
  "roomId": "ch_65f1...",
  "text": "سلام، حال شما خوبه؟",
  "type": "text",                       // text | image | voice | audio | file | poll
  "status": "active",                   // یا submitted-for-review
  "poll": null,
  "reaplayTo": null,                    // یا { messageId, textType, text, userId }
  "file": { "fileType": "image", "thumbnail": "...", "mainUrl": "..." }
}
```

> ⚠️⚠️ **مهم‌ترین نکته‌ی این سند:** payload زنده **نه `senderId` دارد، نه `sequence`، نه `createdAt`**.
> این‌ها فقط بعداً توسط صف BullMQ (`save-message`) در دیتابیس ذخیره و در **تاریخچه** برگردانده می‌شوند.
> **راه‌حل عملی:**
> 1. فرستنده را خودتان در state نگه دارید (با یک `clientMessageId` موقتی).
> 2. برای `sequence` حدس بزنید: `table.messageSecunce + 1`.
> 3. برای پایداری نهایی، بعد از ارسال یک بار `GET ?direction=new` بزنید تا پیام‌های واقعی با `senderId`/`sequence`/`id` نهایی بیایند و جایگزین شوند.

**تشخیص `type` — خودکار، از روی پسوند فایل:**

| پسوند | `type` |
|---|---|
| `png` / `jpeg` / `webp` | `image` |
| `mp3` | `audio` |
| `ogg` | `voice` |
| هر چیز دیگر | `file` |
| اگر `poll` باشد | `poll` |
| در غیر این صورت | `text` |

**فیلتر کلمات ممنوعه (خودکار در سرور):**

| دسته کلمه | رفتار |
|---|---|
| `sexual` \| `swear` \| `profanity` | **ارسال بلاک** → `app:error` با 400 `ERR_MESSAGE_INSULT` |
| بقیه دسته‌ها | پیام ارسال می‌شود؛ اگر میانگین `severity >= 6` باشد `status='submitted-for-review'` وگرنه `'active'` |

**عوارض موفق در بک‌اند:**
* `sequence = redis.incr('channel:{tableId}:chat')`
* enqueue: `save-message`, `set-last-message`, `new-message-notification`, `message-sequence-count`

---

#### ۴. `cafe:table:delete-message` — حذف پیام

```ts
socket.emit('cafe:table:delete-message', { tableId: 'ch_65f1...', messageId: 'msg_65f1...' })
```

**ورودی:** `{ tableId: string, messageId: string }`

**قواعد:**

* پیام باید `status` در `['active','suspended','submitted-for-review']` باشد، وگرنه 404 `ERR_DELETED_MESSAGE_NOT_FOUND`
* حذف **نرم** است (`status = 'deleted'`) — از دیتابیس پاک نمی‌شود.
* **دسترسی:** مدیر کافه/میز و دارای دسترسی `cafe`/`table` → هر پیامی. `guest`/بدون دسترسی → فقط پیام خودش، وگرنه 403 `ERR_DELETE_MESSAGE_ERR_ACCESS`.

**خروجی — رویداد `cafe:table:delete-message:response` به کل اتاق:**

```jsonc
{ "tableId": "ch_65f1...", "messageId": "msg_65f1..." }
```

> پیام جدیدی برنمی‌گردد؛ فقط وضعیت پیام را در state خودتان `deleted` کنید.

---

#### ۵. `cafe:table:edit-message` — ویرایش پیام

```ts
socket.emit('cafe:table:edit-message', { tableId: 'ch_65f1...', messageId: 'msg_65f1...', text: 'متن جدید' })
```

**ورودی:** `{ tableId: string, messageId: string, text: string }`

**قواعد:**

* پیام باید `status === 'active'` باشد، وگرنه 404 `ERR_EDIT_MESSAGE_NOT_FOUND`
* نسخه‌ی جدید به آرایه‌ی `messageEdited` **اضافه** می‌شود: `{ text, editedAt }` → UI باید «ویرایش‌شده» را نشان دهد و امکان دیدن تاریخچه باشد.
* فیلتر کلمات بد مثل ارسال است.
* دسترسی مثل حذف است.

**خروجی — رویداد `cafe:table:edit-message:response` به کل اتاق:**

```jsonc
{ "tableId": "ch_65f1...", "messageId": "msg_65f1...", "text": "متن جدید" }
```

---

#### ۶. `cafe:table:check-repetitive-username` — بررسی تکراری بودن نام کاربری

```ts
socket.emit('cafe:table:check-repetitive-username', 'my_username', (taken: boolean) => {
  if (taken) showError('این نام کاربری تکراری است')
})
```

**ورودی:** رشته‌ی `username`
**خروجی:** کال‌بک با `boolean` — `true` یعنی **تکراری است**.

---

#### ۷. `cafe:join-room` / `cafe:leave-room` — اتاق عمومی کافه

```ts
socket.emit('cafe:join-room', { roomId: cafeId }, (ok) => {})
socket.emit('cafe:leave-room')
```

**ورودی:** `{ roomId: string }` · **خروجی:** کال‌بک با `true`

---

#### ۸/۹. اتاق صفحه‌ی لیست گفتگوها

```ts
socket.emit('cafe:join-channels-page')    // ورود به channels-page:{userId}
socket.emit('cafe:leave-chennels-page')   // ⚠️ 'chennels' با دو 'n' — غلط املایی سرور
```

> این دو را **حتماً** هنگام mount/unmount صفحه‌ی لیست گفتگوها بفرستید، وگرنه badgeهای «پیام جدید» به‌روز نمی‌شوند.

---

### ۸.۴ رویدادهای Server → Client (دریافتی)

| رویداد | payload | کِی می‌آید |
|---|---|---|
| `cafe:table:receive-new-message` | `tableId` (رشته) | پیام جدید در گفتگویی که عضو آن هستید |
| `cafe:table:send-message:recieve` | آبجکت پیام (بخش ۸.۳-۳) | بعد از ارسال موفق |
| `cafe:table:like-message` | `{ tableId, messageId, liked, likeCount, likes, userId }` | لایک/دیسلایک |
| `cafe:table:delete-message:response` | `{ tableId, messageId }` | حذف پیام |
| `cafe:table:edit-message:response` | `{ tableId, messageId, text }` | ویرایش پیام |
| `cafe:table:join-new-user` | `{ fullName, userId, isOnline, lastSeen, role }` | کسی وارد گفتگو شد |
| `cafe:table:leave-new-user` | `{ fullName, userId, isOnline, lastSeen, role }` | کسی گفتگو را ترک کرد |
| `cafe:table:message-sending-status` | `"enabled"` \| `"disabled"` | باز/بسته شدن ارسال پیام میز |
| `cafe:table:secure-chat-status` | `"enabled"` \| `"disabled"` | فعال/غیرفعال شدن چت امن |
| `cafe:table:delete-message:bulk:response` | `string[]` (آرایه‌ی `messageId`) | حذف گروهی پیام‌های بازه‌ی امن |
| `cafe:table:change-message-status` | آبجکت کامل پیام | داوری ادمین → `status` پیام تغییر کرد |
| `cafe:table:check-repetitive-username:response` | `boolean` | پاسخ بررسی نام کاربری |
| `cafe:join-room:response` | `true` | تأیید ورود به اتاق کافه |
| `cafe:table:join-room:response` | `true` | تأیید ورود به اتاق گفتگو |
| **`app:error`** | `{ statusCode, message, data, for, reason, code }` | **همه‌ی خطاها** |

### ۸.۵ رویداد خطای Socket — `app:error`

```jsonc
{
  "statusCode": 400,
  "message": "متن فارسی",
  "code": "ERROR",
  "reason": "ERR_MESSAGE_INSULT",
  "for": "send-message",      // ← کدام عملیات شکست خورد
  "data": { /* اختیاری — مثلاً errors اعتبارسنجی */ }
}
```

**مقادیر `for`:**

| `for` | عملیات |
|---|---|
| `send-message` | ارسال پیام |
| `delete-message` | حذف پیام |
| `edit-message` | ویرایش پیام |
| `update-message` | به‌روزرسانی پیام |
| نام مسیر validation | در خطاهای اعتبارسنجی Zod |

**هندلر پیشنهادی:**

```ts
socket.on('app:error', (err) => {
  switch (err.for) {
    case 'send-message':
      removeOptimisticMessage()
      showToast('error', err.message)
      break
    case 'delete-message':
    case 'edit-message':
      showToast('error', err.message)
      break
    default:
      if (err.reason === 'ERR_VALIDATION') { /* نمایش خطاهای فرم */ }
  }
})
```

### ۸.۶ خطاهای اعتبارسنجی Socket

```jsonc
{
  "statusCode": 400,
  "reason": "ERR_VALIDATION",
  "for": "<مسیر>",
  "data": { "error": [ { "code": "invalid_type", "message": "متن فارسی", "path": ["tableId"] } ] }
}
```

> ⚠️ در Socket کلید `data.error` **تکی** است، ولی در REST `data.errors` **آرایه**.

### ۸.۷ جدول `reason` های پرکاربرد

| `reason` | معنی |
|---|---|
| `ERR_SEND_MESSAGE_TABLE_NOT_FOUND` | میز پیدا نشد / غیرفعال / `tableType !== 'space'` |
| `ERR_USER_BLOCK` | کاربر مسدود شده |
| `ERR_MESSAGE_INSULT` | کلمه‌ی ممنوعه → ارسال بلاک شد |
| `ERR_MESSAGE_SEND_LIMIT` | اجازه‌ی ارسال نداری (یا چت غیرفعال است) |
| `ERR_DELETED_MESSAGE_NOT_FOUND` | پیام قابل حذف نیست (قبلاً حذف/با وضعیت نامعتبر) |
| `ERR_DELETE_MESSAGE_ERR_ACCESS` | فقط صاحب پیام می‌تواند حذف کند |
| `ERR_DELETE_MESSAGE` | پیام پیدا نشد |
| `ERR_EDIT_MESSAGE_NOT_FOUND` | پیام قابل ویرایش نیست (وضعیت `active` ندارد) |

---

### ۸.۸ چرخه‌ی عمر اتصال — گام‌به‌گام

```
۱) ساخت اتصال (autoConnect: false)
۲) socket.connect()
۳) سرور: socketTranslator (i18n) → authSocket (توکن از socket.handshake.auth.token)
     ├─ موفق    → رویداد 'connect' در کلاینت
     └─ ناموفق  → رویداد 'connect_error' (خطای middleware)
۴) در 'connect': listenerها را ثبت کن، سپس اتاق‌های لازم را join کن
۵) در 'disconnect': UI را «قطع» نشان بده (socket.io خودش تلاش می‌کند دوباره وصل شود)
۶) در 'connect_error' با ERR_AUTH_TOKEN_EXPIRED: توکن را refresh کن و دوباره وصل شو
```

```ts
socket.on('connect', () => {
  // همه‌ی listenerها را همین‌جا ثبت کن (نه در جای متعدد، که چندباره ثبت نشوند)
  if (page === 'channels') socket.emit('cafe:join-channels-page')
  if (activeTableId) socket.emit('cafe:table:join-room', { roomId: activeTableId })
})

socket.on('disconnect', (reason) => {
  // مثلاً) اگر reason === 'io server disconnect' کاربر را logout کن
})

socket.on('connect_error', async (err: any) => {
  const reason = err?.data?.reason          // ← خطای authSocket این‌جا می‌آید
  if (reason === 'ERR_AUTH_TOKEN_EXPIRED') {
    const res = await $fetch('/.api/auth/refresh', {
      headers: { Authorization: `Bearer ${refreshToken}` }
    })
    socket.auth = { token: res.accessToken }
    socket.connect()
  }
})
```

> ⚠️⚠️ **مهم‌ترین نکته‌ی اتصال:** اتاق‌ها **به ازای هر اتصال** هستند و با قطع‌شدن از بین می‌روند. وقتی socket.io دوباره وصل می‌شود، رویداد **`connect` باز هم صادر می‌شود** ولی شما **از قبل در هیچ اتاقی نیستید**. پس حتماً داخل هندلر `connect` (یا با یک `rejoin` مرکزی) اتاق‌های فعال را دوباره join کنید — وگرنه پیام‌ها/لایک‌ها/اعلان‌های لحظه‌ای پس از یک قطعی اینترنت، بی‌صدا از کار می‌افتند.

### ۸.۹ ترتیب ورود/خروج از اتاق‌ها به ازای هر صفحه

| صفحه‌ی UI | اتاق لازم | کِی join | کِی leave |
|---|---|---|---|
| لیست گفتگوها | `channels-page:{userId}` | `onMounted` / `onActivated` | `onUnmounted` |
| یک گفتگوی باز | `table_{tableId}_room` | بعد از `subscribe` و دریافت پیام‌ها | هنگام خروج از گفتگو |
| صفحه‌ی یک کافه | `cafe_{roomId}_room` | `onMounted` | `onUnmounted` |

قواعد مهم:

* می‌توانی **هم‌زمان در چند اتاق** باشی (مثلاً هم `channels-page` و هم `table_...`)، تا badge «پیام جدید» و لیست پیام هم به‌طور هم‌زمان به‌روز شوند.
* هنگام رفتن از لیست گفتگوها به یک گفتگو، `leave-chennels-page` را نزن (یا دوباره join کن) — وگرنه badgeها قطع می‌شوند.
* `cafe:table:join-room` رویداد `cafe:table:join-new-user` را به **کل اتاق از جمله خودت** می‌فرستد؛ پس در هندلر، `userId === myId` را نادیده بگیر.
* اتاق `table_{tableId}_room` با **`table.id`** ساخته می‌شود، نه `table.tableId`.

### ۸.۱۰ نقشه‌ی دریافت لحظه‌ای تغییرات (رویداد → تغییر State)

| رویداد دریافتی | چه چیزی را در state به‌روز کن |
|---|---|
| `cafe:table:receive-new-message` (`tableId`) | badge «خوانده‌نشده»ی همان گفتگو `++`؛ اگر گفتگو باز است، پیام‌ها را refresh کن |
| `cafe:table:send-message:recieve` (پیام) | پیام را به لیست اضافه کن؛ «فرستنده» را از state محلی بچسبان (payload `senderId` ندارد) |
| `cafe:table:like-message` | روی همان `messageId`: `likeCount` / `likes` / وضعیت قلب را آپدیت کن |
| `cafe:table:delete-message:response` | `status = 'deleted'` برای آن پیام |
| `cafe:table:edit-message:response` | `text` را عوض کن و پرچم «ویرایش‌شده» را بگذار |
| `cafe:table:delete-message:bulk:response` (`string[]`) | برای همه‌ی `messageId`ها `status = 'deleted'` |
| `cafe:table:change-message-status` | `status` آن پیام را از آبجکت کامل جایگزین کن |
| `cafe:table:join-new-user` | کاربر را به لیست اعضا اضافه / آنلاین کن (خودت را رد کن) |
| `cafe:table:leave-new-user` | آن کاربر را «آفلاین» کن |
| `cafe:table:message-sending-status` | باز/بسته کردن composer (`enabled` یا `disabled`) |
| `cafe:table:secure-chat-status` | نمایش/حذف بنر «چت امن» |
| `app:error` | optimistic rollback + toast با `err.message` (بر اساس `err.for`) |

> برای «پیام جدید» دو کانال داری:
> 1. `cafe:table:receive-new-message` — فقط `tableId` می‌دهد؛ برای **صفحه‌ی لیست گفتگوها** (badge).
> 2. `cafe:table:send-message:recieve` — بدنه‌ی کامل پیام؛ فقط داخل **اتاق گفتگوی باز**.

> 📘 نمونه‌ی کامل و آماده‌ی چسباندن (شامل reconnection، rejoin و همه‌ی listenerها) در **بخش ۱۴** است.

---

## ۹. API لایک / دیسلایک پیام ★

> این سرویس **toggle** است: یک بار بزن → لایک، بار دوم → دیسلایک.

### ۹.۱ مدل داده

در `Cafe Message` یک فیلد آرایه‌ای وجود دارد:

```ts
// src/models/cafe-table-message.model.ts
like: {
  type: [String],
  default: []
}
// آرایه‌ی userId هایی که لایک کرده‌اند (بدون تکرار — با $addToSet)
```

نمایه‌ای روی `like` وجود ندارد که برای حجم فعلی مشکلی ندارد.

### ۹.۲ endpoint

```
POST /.api/cafe/table/messages/:tableId/:messageId/like
```

| | |
|---|---|
| **Headers** | `X-Api-Key`, `Authorization: Bearer <accessToken>` |
| **Query** | ❌ ندارد |
| **Body** | ❌ ندارد (پیام خالی) |
| **Params** | `tableId` (string، الزامی) · `messageId` (string، الزامی) |

> `tableId` در واقع همان `table.id` است و `roomId` پیام باید با آن برابر باشد.

**نمونه:**

```http
POST /.api/cafe/table/messages/ch_65f1a2b3c4d5e6/like HTTP/1.1
X-Api-Key: xxxxx
Authorization: Bearer eyJhbGciOi...
```

### ۹.۳ پاسخ موفق `200`

```jsonc
{
  "success": true,
  "liked": true,               // وضعیت نهایی بعد از عملیات
  "likeCount": 3,              // تعداد لایک‌های نهایی
  "likes": ["u1", "u2", "u3"], // ★ آرایه‌ی userId هایی که لایک کرده‌اند
  "messageId": "msg_65f1...",
  "message": "پیام لایک شد"    // متن فارسی برای toast
}
```

**حالت دیسلایک:** `liked: false` و `message: "لایک پیام برداشته شد"`

### ۹.۴ خطاها

| `statusCode` | `reason` | معنی |
|---|---|---|
| `400` | `ERR_TABLE_SUBSCRIPTION_ID` | `tableId` یا `messageId` ناقص |
| `404` | `ERR_MESSAGE_NOT_FOUND` | پیامی با این `id` در این `roomId` نیست |
| `404` | `ERR_DELETED_MESSAGE_NOT_FOUND` | پیام قبلاً حذف شده (`status='deleted'`) |
| `403` | `ERR_ACCESS_DENIED` | نقش کاربر اجازه این route را ندارد |

> همه با `success: false` و **HTTP 200** برمی‌گردند.

### ۹.۵ رویداد Socket همزمان

```
event: cafe:table:like-message
payload: {
  "tableId":    "ch_65f1a2b3c4d5e6",
  "messageId":  "msg_65f1...",
  "liked":      true,
  "likeCount":  3,
  "likes":      ["u1","u2","u3"],
  "userId":     "u3"          // ← چه کسی لایک کرد
}
```

> **همه‌ی کاربران آن گفتگو این رویداد را می‌گیرند** — از جمله خودِ کاربری که درخواست داده. پس استوری را **idempotent** بنویسید: هم درخواست HTTP و هم رویداد socket باید state را آپدیت کنند و نتیجه‌ی یکسان بدهند.

### ۹.۶ نمونه پیاده‌سازی (Vue 3 / Nuxt)

```ts
// composables/useMessageLike.ts
export function useMessageLike() {
  const pending = ref(new Set<string>())

  async function toggleLike(tableId: string, messageId: string) {
    if (pending.value.has(messageId)) return           // جلوگیری از double-click
    pending.value = new Set(pending.value).add(messageId)

    try {
      const res = await $fetch<{
        success: boolean
        liked: boolean
        likeCount: number
        likes: string[]
        message?: string
      }>(`/.api/cafe/table/messages/${tableId}/${messageId}/like`, { method: 'POST' })

      if (!res.success) throw new Error('FAIL')
      return res
    } finally {
      const next = new Set(pending.value)
      next.delete(messageId)
      pending.value = next
    }
  }

  return { toggleLike, pending }
}
```

**نمایش وضعیت لایک:**

```ts
const isLiked   = (msg: ICafeTableMessage, myUserId: string) => msg.like?.includes(myUserId) ?? false
const likeCount = (msg: ICafeTableMessage) => msg.like?.length ?? 0
```

**به‌روزرسانی خوش‌بینانه (Optimistic UI) با rollback:**

```ts
async function onLikeClick(message: ICafeTableMessage) {
  // ۱) بلافاصله UI را عوض کن
  const wasLiked = message.like.includes(myId)
  message.like = wasLiked
    ? message.like.filter(u => u !== myId)
    : [...message.like, myId]

  // ۲) بعد سرور
  const res = await toggleLike(message.roomId, message.id)

  // ۳) همگام‌سازی نهایی یا rollback
  if (res) {
    message.like = res.likes
  } else {
    message.like = wasLiked
      ? [...message.like, myId]
      : message.like.filter(u => u !== myId)
  }
}
```

**هندلر Socket (idempotent):**

```ts
socket.on('cafe:table:like-message', (payload: SocketLikePayload) => {
  const msg = messages.value.find(m => m.id === payload.messageId)
  if (!msg) return
  msg.like = payload.likes
  if (payload.userId === myId && isNewlyApplied(payload.liked)) {
    triggerHeartAnimation(payload.messageId)
  }
})
```

---

## ۱۰. جریان کامل کاربر (User Flows) — نگاه یک پیام‌رسان

### ۱۰.۱ صفحه‌ی لیست گفتگوها

```
۱) mount
     socket.emit('cafe:join-channels-page')
     GET /.api/cafe/table/subscribed?limit=100&sort=desc
     └─ render کارت هر گفتگو:
          ├─ cafe.profileImage / nikname
          ├─ lastMessage.{text, type}
          └─ unreadMessages → badge قرمز

۲) socket.on('cafe:table:receive-new-message', (tableId) => {
     const ch = channels.find(c => c.id === tableId)
     if (ch) ch.unreadMessages++
     else refreshList()                 // گفتگوی جدید
   })

۳) unmount
     socket.emit('cafe:leave-chennels-page')
```

### ۱۰.۲ باز کردن یک گفتگو

```
۱) کلیک روی گفتگو

۲) اگر عضو نیستی:
     POST /.api/cafe/table/subscribe   { tableId }
     ├─ 201                              → ادامه
     ├─ 400 ERR_USER_SUBSCRIBED          → ادامه (از قبل عضوی)
     └─ 400 ERR_TABLE_BANNED             → «شما از این گفتگو محروم شده‌اید»

۳) GET /.api/cafe/table/:cafeId/:tableId/single
     └─ data.table[0]  → نام، آواتار، isManager

۴) GET /.api/cafe/me/my-ct?type=table   → سطح دسترسی من در این میز

۵) socket.emit('cafe:table:join-room', { roomId: tableId }, cb)

۶) GET /.api/cafe/table/:tableId/messages?direction=new
     ├─ { messages, hasMore, nextCursor }  → render
     └─ messages.length === 0 && reason === 'INFO_TABLE_NOT_FOUND'
        → «میز در دسترس نیست» + دکمه تلاش مجدد

۷) GET /.api/cafe/table/:tableId/users  → لیست اعضا + آنلاین/آخرین بازدید

۸) اسکرول به بالا: GET ?direction=old&cursor={nextCursor} → prepend
     (تکرار تا messages.length === 0)

۹) POST /.api/cafe/table/messages/:tableId/seen  { seen: lastSequence }
```

### ۱۰.۳ ارسال پیام

```
اگر فایل دارد:
  ۱) POST /.api/upload/?action=...&collection=...   → { file, thumbnail }

socket.emit('cafe:table:send-message', {
  tableId,
  text,
  file: file ? { mainFile: res.file, thumbnailFile: res.thumbnail } : undefined,
  reaplyToMessageId: replyingTo?.id
})

socket.on('app:error', e => { if (e.for === 'send-message') rollbackOptimistic() })

socket.on('cafe:table:send-message:recieve', (msg) => {
  // ⚠️ senderId ندارد → فرستنده را از state محلی خودتان attach کنید
  attachLocalSender(msg)
  pushToList(msg)
})
```

### ۱۰.۴ لایک / دیسلایک

```
کلیک روی آیکون قلب
  → onLikeClick(message)                    [بخش ۹.۶ — optimistic + rollback]
  → سرور: cafe:table:like-message را به کل اتاق می‌فرستد
  → شما هم آن را دریافت می‌کنید → آپدیت نهایی + انیمیشن
```

### ۱۰.۵ ویرایش / حذف پیام

```
ویرایش:  socket.emit('cafe:table:edit-message', { tableId, messageId, text })
         → cafe:table:edit-message:response → { tableId, messageId, text }
         → نمایش «ویرایش‌شده» + تاریخچه‌ی messageEdited

حذف:    socket.emit('cafe:table:delete-message', { tableId, messageId })
         → cafe:table:delete-message:response → { tableId, messageId }
         → نمایش «این پیام حذف شد»
```

### ۱۰.۶ گزارش پیام

```
مودال گزارش
  → POST /.api/cafe/table/create-report?report-for=message
     body: { id: message.id, metadata: { reason: 'توهین' } }
  → ۲۰۱ + toast موفقیت
```

### ۱۰.۷ ترک گفتگو

```
مودال تأیید → POST /.api/cafe/table/:tableId/left
→ ۲۰۱ → socket.emit('cafe:table:leave-room') → برگشت به لیست → refresh
```

### ۱۰.۸ کشف کافه و میز جدید

```
GET /.api/cafe/cafes/feet?q=...                 → لیست کارت‌های کافه
GET /.api/cafe/:id/single                       → صفحه‌ی کافه
GET /.api/cafe/table/:cafeId/tables?type=space  → میزهای چت
GET /.api/cafe/table/:cafeId/:tableId/single    → صفحه‌ی میز
POST /.api/cafe/table/subscribe                 → «ورود به گفتگو»
```

---

## ۱۱. نگاشت وضعیت‌ها به UI

| وضعیت | متن فارسی پیشنهادی | نمایش |
|---|---|---|
| `table.isActive === false` | «میز غیرفعال است» | خاکستری / غیرقابل ورود |
| `table.enabled === false` | «میز تعلیق شده» | زرد |
| `table.tableType !== 'space'` | «چت متنی در این میز فعال نیست» | بدون input |
| `messageSendingEnabled.enabled === false` | «ارسال پیام غیرفعال است» | قفل input |
| `messageSendingEnabled.enabled && now > endAt` | «زمان ارسال پیام تمام شد» | قفل input |
| `message.status === 'submitted-for-review'` | «در انتظار تأیید» | زرد |
| `message.status === 'suspended'` | «پیام تعلیق شده» | قرمز |
| `message.status === 'deleted'` | «این پیام حذف شد» | خاکستری |
| `reason === 'INFO_TABLE_NOT_FOUND'` | «میز در دسترس نیست» | empty state + تلاش مجدد |
| `ERR_TABLE_BANNED` | «شما از این گفتگو محروم شده‌اید» | قرمز + غیرقابل ورود |
| `unreadMessages > 0` | نشانگر خوانده‌نشده | قرمز |
| `isOnline === true` | نقطه‌ی سبز | سبز |

---

## ۱۲. باگ‌های سرور که کد فرانت باید هندل کند

> این‌ها رفتار فعلی بک‌اند هستند، نه اشتباه شما.

| # | مشکل | تأثیر روی UI | راهکار فرانت |
|---|---|---|---|
| 1 | `GET /table/:tableId/messages` نام کلکسیون کافه را `"caves"` نوشته (به‌جای `"cafes"`) و `$unwind` بدون `preserveNull` → اغلب `INFO_TABLE_NOT_FOUND` | تاریخچه خالی | `reason === 'INFO_TABLE_NOT_FOUND'` → پیام «میز در دسترس نیست» + تلاش مجدد |
| 2 | پاسخ موفق `GET messages` فیلد `success` ندارد | تشخیص خطا سخت | وجود `messages` را ملاک بگیرید |
| 3 | `cafe:table:send-message:recieve` نه `senderId` دارد نه `sequence` نه `createdAt` | نمایش «من» ممکن نیست | فرستنده را سمت کلاینت نگه دارید؛ بعداً با `GET messages` همگام کنید |
| 4 | پیام‌ها با BullMQ ذخیره می‌شوند → تأخیر چند صد میلی‌ثانیه | پیام بلافاصله در تاریخچه نیست | نمایش optimistic + همگام‌سازی بعدی |
| 5 | `GET /table/subscribed`: `$limit` قبل از `$skip` و `$skip` بر پایه‌ی شماره صفحه | صفحه‌بندی خراب | `limit=100` بگیرید، سمت کلاینت paginate کنید |
| 6 | `GET /me/my-ct`: `page` به‌جای `limit` | تعداد نتایج غیرقابل کنترل | `page` را بزرگ بفرستید |
| 7 | `GET /table/:cafeId/:tableId/single` خروجی تکراری می‌دهد | `table` آبجکت نیست، آرایه است | `res.table[0]` |
| 8 | `GET /table/:tableId/users` اگر دسترسی نداشته باشید خطا نمی‌دهد | لیست خالی مبهم | اول `subscribe` کنید، بعد لیست را بخوانید |
| 9 | `GET /:id/single` کافه ۴۰۴ نمی‌دهد | نمی‌فهمید کافه وجود ندارد | `if (!res.cafe) showNotFound()` |
| 10 | منطق ارسال پیام برای کاربر «بدون دسترسی» معکوس است | رفتار غیرمنتظره | فرض کنید کاربر بدون دسترسی **نمی‌تواند** بفرستد |
| 11 | ⚠️ **امنیتی:** `editMseAndSecureChat` دسترسی را چک نمی‌کند (`partialAccess` بدون شرط `edit()` را صدا می‌زند) → **هر کاربر لاگین‌کرده‌ای** می‌تواند بازه‌ی ارسال پیام هر میزی را تغییر دهد | امکان سوءاستفاده | دکمه را فقط برای `cafe`/`table` نمایش بده (بخش ۷.۶) |
| 12 | ⚠️ **امنیتی:** `bannedUserParticipant` هم دسترسی را چک نمی‌کند → **هر کاربر لاگین‌کرده‌ای** می‌تواند هر عضوی را از هر میزی بن کند | امکان سوءاستفاده | دکمه را فقط برای `cafe`/`table` نمایش بده |
| 13 | ⚠️ **امنیتی:** `editCafe` (`PUT /:id`) **هیچ چک دسترسی ندارد** و `ownerId` را عوض می‌کند → هر کاربری می‌تواند هر کافه‌ای را ویرایش و مالک آن شود | از دست رفتن مالکیت | هرگز این endpoint را از فرانت صدا نزنید؛ فقط `PUT /me/:id/update` |
| 14 | ⚠️ **افشای داده:** `GET /access` و `GET /table/tables/list` فقط `roles: ['user']` دارند و چک ادمین نمی‌شوند → هر کاربر می‌تواند کل دسترسی‌ها/میزهای سیستم را بخواند | نشت داده | در فرانت استفاده نکنید |
| 15 | `hasAccess` سرور، `startAt` را نادیده می‌گیرد | دسترسی زودتر از موعد فعال است | سمت کلاینت `startAt` را هم چک کنید |
| 16 | `PUT /table/:tableId/update` بدون Zod → فیلدهای ارسال‌نشده `undefined` نوشته می‌شوند | پاک شدن ناخواسته‌ی داده | همه‌ی فیلدها را همیشه بفرستید |
| 17 | غلط‌های املایی مدل: `messageSecunce`, `reaplayTo`, `reaplyToMessageId`, `thubmnail`, `privite`, `chennels-page`, enum اشتباه `guast` | ناهماهنگی نام فیلد | دقیقاً همین‌ها را استفاده کنید؛ برای `accessTo` مقدار `guest` بفرستید |
| 18 | دو مدل Participant با کلکسیون‌های متفاوت (`Cafe Table Participants` vs `Cafe Table Participant`) | ممکن است عضویت در joinها گم شود | وضعیت اعضا را از رویدادهای socket نگه دارید، نه از دیتابیس |
| 19 | `cafe:table:join-new-user` به خود فرستنده هم می‌رسد | خودتان دوباره اضافه می‌شوید | `if (userId === myId) return` |
| 20 | `GET /table/:cafeId/:tableId/single` خروجی تکراری می‌دهد | `table` آبجکت نیست، آرایه است | `res.table[0]` |
| 21 | `GET /table/:tableId/users` بدون دسترسی، خطا نمی‌دهد و لیست خالی می‌دهد | لیست خالی مبهم | اول `subscribe` کنید |

---

## ۱۳. TypeScript‌های آماده

```ts
// types/cafe.d.ts — منطبق با سرور
export type MessageType = 'voice' | 'video' | 'image' | 'text' | 'challange' | 'file' | 'audio' | 'poll'
export type TableType = 'bot' | 'club-voice' | 'space'
export type AccessType = 'cafe' | 'table' | 'guest'
export type MessageStatus = 'active' | 'suspended' | 'submitted-for-review' | 'deleted'
export type ParticipantStatus = 'active' | 'left' | 'banned' | 'mute'

export interface ICafe { /* ... */ }
export interface ICafeTable { /* ... */ }
export interface ICafeTableMessage { /* ... */ }
export interface ICafeTableParticipant { /* ... */ }
export interface ICafeAccess { /* ... */ }
export interface ITableUserView { /* ... */ }

// پاسخ‌های API
export interface ApiError {
  success: false
  statusCode: number
  code: string
  reason: string
  message: string
  data?: { errors?: Array<{ code: string; message: string; path: string[] }> }
}

export interface CafesFeetResponse {
  success: true
  data: { public: ICafe[]; privite: ICafe[] }
}

export interface TablesUnderCafeResponse { success: true; tables: ICafeTable[] }

export interface SingleTableResponse {
  success: true
  table: Array<ICafeTable & { isManager: boolean; subscribe: ICafeTableParticipant[] }>
}

export interface MyAccessResponse { success: true; data: ICafeAccess[] }

export interface ChannelsListResponse {
  success: true
  channels: Array<ICafeTable & {
    unreadMessages: number
    cafe: Pick<ICafe, 'id' | 'label' | 'profileImage' | 'isActive'>
  }>
}

export interface MessagesResponse {
  messages: ICafeTableMessage[]
  hasMore: boolean
  nextCursor: number | null
}

export interface LikeResponse {
  success: true
  liked: boolean
  likeCount: number
  likes: string[]
  messageId: string
  message: string
}

// رویدادهای Socket
export interface SocketUserPresence {
  fullName: string; userId: string; isOnline: boolean; lastSeen: number; role: string
}
export interface SocketMessagePayload {
  id: string; roomId: string; text: string; type: MessageType
  status: MessageStatus; poll: any; reaplayTo: any; file: any
}
export interface SocketLikePayload {
  tableId: string; messageId: string; liked: boolean
  likeCount: number; likes: string[]; userId: string
}
export interface SocketError {
  statusCode: number; message: string; code: string; reason: string; for: string; data?: any
}
```

---

## ۱۴. Composable پیشنهادی — مدیریت کامل Socket

> این composable چرخه‌ی کامل را پوشش می‌دهد: اتصال، **rejoin خودکار اتاق‌ها پس از reconnect**، refresh توکن منقضی، و join/leave اتاق‌ها. شرح مفهومی در بخش‌های ۸.۸ تا ۸.۱۰.

```ts
// composables/useCafeSocket.ts
import { io, type Socket } from 'socket.io-client'

type Room =
  | { type: 'channels' }                 // channels-page:{userId}
  | { type: 'table'; tableId: string }   // table_{tableId}_room
  | { type: 'cafe'; roomId: string }     // cafe_{roomId}_room

let socket: Socket | null = null
const joined = new Set<string>()         // اتاق‌های فعال، برای rejoin بعد از reconnect

function keyOf(r: Room) {
  return r.type === 'channels' ? 'channels'
    : r.type === 'table' ? `table:${r.tableId}`
    : `cafe:${r.roomId}`
}

export function useCafeSocket() {
  const config = useRuntimeConfig()
  const accessToken = useCookie<string | null>('accessToken')
  const refreshToken = useCookie<string | null>('refreshToken')

  function join(r: Room) {
    joined.add(keyOf(r))
    rejoin(keyOf(r))
  }

  function leave(r: Room) {
    const key = keyOf(r)
    joined.delete(key)
    if (!socket?.connected) return
    if (r.type === 'channels') socket.emit('cafe:leave-chennels-page')
    if (r.type === 'table') socket.emit('cafe:table:leave-room')
    if (r.type === 'cafe') socket.emit('cafe:leave-room')
  }

  function rejoin(key: string) {
    if (!socket?.connected) return
    if (key === 'channels') socket.emit('cafe:join-channels-page')
    else if (key.startsWith('table:')) socket.emit('cafe:table:join-room', { roomId: key.slice(6) })
    else if (key.startsWith('cafe:')) socket.emit('cafe:join-room', { roomId: key.slice(5) })
  }

  function connect(): Socket {
    if (socket?.connected) return socket
    socket = io(`${config.public.apiBase}/cafe`, {
      auth: { token: accessToken.value },
      transports: ['websocket', 'polling'],
      autoConnect: false
    })

    // (re)connect: اتاق‌ها با reconnect از بین می‌روند → دوباره join کن
    socket.on('connect', () => joined.forEach(rejoin))

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') socket?.connect()
    })

    socket.on('connect_error', async (err: any) => {
      if (err?.data?.reason === 'ERR_AUTH_TOKEN_EXPIRED') {
        const res = await $fetch<any>('/.api/auth/refresh', {
          headers: { Authorization: `Bearer ${refreshToken.value}` }
        })
        accessToken.value = res.accessToken
        if (socket) { socket.auth = { token: res.accessToken }; socket.connect() }
      }
    })

    socket.connect()
    return socket
  }

  function disconnect() {
    socket?.disconnect()
    socket = null
    joined.clear()
  }

  return { connect, disconnect, join, leave, get socket() { return socket } }
}
```

**نمونه‌ی استفاده — صفحه‌ی لیست گفتگوها:**

```ts
const { connect, join, leave, socket } = useCafeSocket()

onMounted(() => {
  const s = connect()
  join({ type: 'channels' })                 // ← اعلان پیام جدید
  s.on('cafe:table:receive-new-message', (tableId: string) => {
    const ch = channels.value.find(c => c.id === tableId)
    if (ch) ch.unreadMessages++
    else refreshList()
  })
})

onUnmounted(() => leave({ type: 'channels' }))
```

**نمونه‌ی استفاده — گفتگوی باز:**

```ts
const { connect, join, leave, socket } = useCafeSocket()

onMounted(async () => {
  const s = connect()
  join({ type: 'table', tableId })           // ← اتاق گفتگو را دنبال می‌کند (rejoin خودکار)

  s.on('cafe:table:send-message:recieve', (msg) => pushMessage(attachLocalSender(msg)))
  s.on('cafe:table:like-message', ({ messageId, liked, likeCount, likes }) =>
    updateLike(messageId, { liked, likeCount, likes }))
  s.on('cafe:table:delete-message:response', ({ messageId }) => markDeleted(messageId))
  s.on('cafe:table:edit-message:response', ({ messageId, text }) => applyEdit(messageId, text))
  s.on('cafe:table:join-new-user', (u) => { if (u.userId !== myId) setPresence(u.userId, true) })
  s.on('cafe:table:leave-new-user', (u) => setPresence(u.userId, false))
  s.on('cafe:table:message-sending-status', (st) => canSend.value = st === 'enabled')
  s.on('app:error', (err: any) => {
    if (err.for === 'send-message') rollbackOptimistic()
    showToast('error', err.message)
  })
})

onUnmounted(() => leave({ type: 'table', tableId }))
```

> ✅ با این ساختار، هر بار اتصال دوباره برقرار شود (قطعی اینترنت، sleep تب، بیدار شدن موبایل)، اتاق‌های فعال به‌طور خودکار دوباره join می‌شوند و جریان لحظه‌ای از سر گرفته می‌شود.

---

## ۱۵. فهرست endpointهای حذف‌شده از این سند

این مسیرها **برای فرانت کاربر نهایی نیستند** و عمداً مستند نشده‌اند. اگر بعداً پنل مدیریت ساخته شد، باید جداگانه بررسی شوند:

**مدیریت کافه (فقط ادمین — کاربر از `PUT /me/:id/update` استفاده کند)**
`POST /new` · `PUT /:id` · `DELETE /:id` · `GET /cafes/all` · `GET /stats`

**داوری محتوا (فقط ادمین)**
`GET /table/profanity-report` · `POST /table/message/:id/review-and-assignment`

**کلمات ممنوعه (فقط ادمین)**
`POST /bad-word/init` · `POST /bad-word/new` · `GET /bad-word/words` · `DELETE /bad-word/:id/delete`

> ⚠️ چند مسیر که قبلاً «ادمین‌محور» به نظر می‌رسیدند، **برای کاربران دارای دسترسی هم فعال‌اند** و در **بخش ۷.۵** مستند شده‌اند:
> `PUT /me/:id/update` · `PUT /table/:tableId/update` · `PUT /table/:tableId/mse-sc` · `POST /table/:cafeId/new` · `POST /table/:tableId/create-access` · `POST /table/:tableId/banned/:userId` · `DELETE /table/:cafeId/delete/:tableId`

---

## ۱۶. چک‌لیست پیاده‌سازی

**پایه**
- [ ] افزودن `X-Api-Key` به همه‌ی درخواست‌ها (axios instance / `$fetch` interceptor)
- [ ] هندلر مرکزی خطا بر اساس `success` و `reason`
- [ ] اتصال Socket با `auth.token` و هندلر `connect_error`
- [ ] گرفتن لیست دسترسی‌ها با `GET /me/my-ct` در Pinia/store

**گفتگو و پیام**
- [ ] صفحه‌ی لیست گفتگوها + `join-channels-page` + badge خوانده‌نشده
- [ ] صفحه‌ی گفتگو: `join-room`، تاریخچه، صفحه‌بندی بی‌نهایت با `sequence`
- [ ] ارسال پیام (متن / فایل / ویس / ریپلای) + optimistic + هندل `app:error`
- [ ] ویرایش و حذف پیام + وضعیت‌های `deleted` / `submitted-for-review` / `suspended`
- [ ] لایک/دیسلایک (REST + رویداد `cafe:table:like-message`)
- [ ] علامت «خوانده شد» با `POST .../seen`
- [ ] نمایش اعضا با `isOnline` / `lastSeen`
- [ ] مودال گزارش محتوا
- [ ] جریان «عضو شدن» با هندل `ERR_USER_SUBSCRIBED` / `ERR_TABLE_BANNED`

**صفحه‌ی کشف**
- [ ] صفحات کافه: کشف کافه‌ها (`/cafes/feet`)، جزئیات کافه، لیست و جزئیات میز

**دسترسی‌محور (کاربران `cafe`/`table`)**
- [ ] پیاده‌سازی `useCafePermissions` (بخش ۷.۶) و اعمال آن روی همه‌ی دکمه‌ها
- [ ] پنل «تنظیم بازه‌ی ارسال پیام» (`mse-sc?action=mse`) + تایمر محلی `endAt`
- [ ] پنل «چت امن» (`mse-sc?action=secure-chat`) + هندل `delete-message:bulk:response`
- [ ] فرم ویرایش میز (`PUT /table/:tableId/update`) با محدودیت فیلدها بر اساس سطح
- [ ] فرم ویرایش کافه (`PUT /me/:id/update` → فقط `enabled`, `vip`)
- [ ] فرم ساخت میز (`POST /table/:cafeId/new`) — فقط مدیر کافه
- [ ] مودال افزودن مدیر/مهمان (`POST /table/:tableId/create-access`)
- [ ] اکشن بن/فعال/اخراج عضو (`POST /table/:tableId/banned/:userId`)
- [ ] اکشن حذف میز با تشخیص حذف نرم (`access: user_*`) در برابر حذف کامل (`admin`)

---

## ۱۷. پیشنهادهایی که در بک‌اند نیست

| قابلیت | وضعیت | پیشنهاد |
|---|---|---|
| تایپ کردن (Typing indicator) | ❌ نیست | رویداد `cafe:table:typing` با payload `{ tableId, userId }` |
| اعلان push موبایل | سمت سرور هست | از `cafe:table:receive-new-message` برای نمایش داخل اپ استفاده کنید |
| تعداد لایک روی پیام | ✅ هست (`likeCount`) | — |
| پیام اصلاح‌شده (Edit) به‌صورت زنده | ✅ هست | از `cafe:table:edit-message:response` استفاده کنید |
| Pin پیام | ❌ نیست | endpoint جدید لازم است |
| پیش‌نویس پیام | ❌ نیست | سمت کلاینت (localStorage) |
| واکنش‌های ایموجی (غیر از لایک) | ❌ نیست | مدل `reaction` جدا لازم است |

---

## ۱۸. نکته‌ی پایانی

اگر در حین پیاده‌سازی به رفتاری برخوردید که در این سند نیست:

1. اول بخش ۱۲ (باگ‌ها) را بخوانید.
2. سپس `response.success === false` را لاگ کنید تا `reason` را ببینید.
3. اگر `reason` ناشناخته بود، به `src/locales/fa.json` → کلید `cafe.error.*` یا `cafe.validation.*` نگاه کنید تا متن فارسی خطا را ببینید.
4. در صورت نیاز به تغییر سمت سرور، درخواست را به agent `backend-developer` بدهید و **شماره‌ی بند** این سند را ارجاع دهید.