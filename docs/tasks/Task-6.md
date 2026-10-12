# تسک 6 - اتصال بخش استوری به Api

## [Task Overview]

بخش ui/ux story ها کامل طراحی شده است و الان نیاز به اتصال این ui به api داریم که در قالب چند api میتوانیم این بخش را تکمیل کنیم

- دریافت تمام رشته استوری ها =>‌ /.api/ui/story
  - Response
  ```json
  {
    "success": true,
    "threads": {
      "threads": [
        {
          "_id": "6ac35f6b2d73c6b2c9e66035",
          "id": "sto.14p4s8ks3zzmuuzl8wd.ry",
          "description": "fsgsg",
          "title": "ادم شناسی در رفتار ها",
          "status": "active",
          "thumbnail": "http://localhost:3001/stories/f.14p4s8ks3zzmuuzl8me.f.png",
          "createdAt": "2026-10-05T08:27:23.350Z",
          "updatedAt": "2026-10-05T08:30:28.008Z"
        },
        ...
      ]
    }
  }
  ```
- بعد از دریافت لیست بر اساس id حالا ایتم های درون که عکس ها میباشند را دریافت میکنیم =>‌ /.api/ui/story/{id}
  - Response
  ```json
      {
      "story": {
          "id": "sto.14p4s8ks3zzmuuzl8wd.ry",
          "description": "fsgsg",
          "title": "ادم شناسی در رفتار ها",
          "status": "active",
          "thumbnail": "http://localhost:3001/stories/f.14p4s8ks3zzmuuzl8me.f.png",
          "lang": "fa",
          "items": [
              {
                  "position": 1,
                  "description": "gsgsg",
                  "title": "sgsg",
                  "src": "http://localhost:3001/stories/f.14p4s8ks3zzmuuzmi9l.f.png",
                  "status": "active",
                  "link": {
                  "type": "colored",
                  "_id": "6ac35fa72d73c6b2c9e6603b",
                  "label": "مشاهده تخفیفات",
                  "to": "https://google.com"
                  },
                  "_id": "6ac35fa72d73c6b2c9e6603c",
                  "createdAt": "2026-10-05T08:28:23.469Z",
                  "updatedAt": "2026-10-05T08:28:23.469Z"
              },
              ...
          ],
          "createdAt": "2026-10-05T08:27:23.350Z",
          "updatedAt": "2026-10-05T08:30:28.008Z",
      }
  }
  ```

---

- ​​**Important Note: All API calls must be made via the Nuxt server; this means calling the Nuxt server endpoint first, which in turn invokes the API logic defined within the Nuxt.js server.**
- **Use Pinia for state management, consistent with the other stores.**
- **Examine the existing store and `@/server/api` first, and base your work on them.**

---

### اشکال فعلی در ui
دکمه ها وقتی hover. میشوند انگار که دکمه ها وسط چین نیستند لطفا این اشکال را رفع کن
## [Limited]
- بر اساس طراحی فعلی طراحی را انجام بده 
- چیزی فراتر از طراحی فعلی پیش نرو

## [Output]
در خروجی مانند instagram اول رشته استوری ها را دریافت میکنی
و سپس به ازای هر id در رشته استوری داده ها را دریافت میکنی و زیر رشته را دریافت میکنی

### نکته مهم
تا لود کامل api زیر رشته ها انیمیشنی برای هر رشته استوری مانند اینستاگرام قرار بده 