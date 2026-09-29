---
title: "Creating the Plans Page at the /plans Route"
description: "Developing a plans page featuring detailed information and a modern design (Apple-style)"
---

# Task 1

## [Rules]
- RTL - Persian
- Framework => [Nuxt.js 4.x, Vue 3.x, Tailwind 4, Pinia.js, Nuxt Server API, ...]

## [Summary]

There are various subscription plans available for purchase; once purchased, the corresponding features (to be developed later) are activated for the user.

### How do the plans work?

- On the `/plans` page, the list of plans—created via the admin panel—is fetched from the server.
- Users can select a plan to initiate the purchase process.
- Upon selecting a plan, the user navigates to that plan's specific page to view details and complete the purchase using their wallet balance.
- Once a plan is purchased, the user cannot buy another one simultaneously (i.e., one plan per user account).
- A new plan can be purchased only after the current plan expires.
- Each plan has a specific duration, which is displayed to the user so they are aware of the expiration date and plan specifications.

### What happens after purchasing a plan?

- After purchasing a plan, an indicator identifying the user as a plan holder will appear in the `TopBar.vue` component; clicking it redirects the user to the corresponding panel.
- There are three panels (note these for future reference):
- `big` => Adult panel
- `parent` => Child/Parent panel
- `employee` => Employer panel
- Each panel has a unique structure; we will build them individually in the next phase.

---

- ​​**Important Note: All API calls must be made via the Nuxt server; this means calling the Nuxt server endpoint first, which in turn invokes the API logic defined within the Nuxt.js server.**
- **Use Pinia for state management, consistent with the other stores.**
- **Examine the existing store and `@/server/api` first, and base your work on them.**

---

## [Constraints]
- Users must be logged in (using the auth system) to access plans.
- Use `default.vue` for the layout.

### Plan-related APIs

#### 1: Fetch list of plans

- API => `/api/plan/active-plans`
- Response =>
```json
[
{
"id": "pl.14p4s8ks16gumpkf8rgv.an",
"title": "Adult",
"description": "Panel for adults",
"options": [
{
"text": "Activation for one month",
"icon": "heroicons:user",
"iconType": "icon",
"_id": "6a138caff955b71f606d9ef4"
}
],
"discount": 20,
"access": {
"tests": ["DISC14p4s8ksmjmlne3cyutests"]
}, 
"enabled": true,
"amountBase": 500000,
"daysBase": 30,
"panel": "big",
"createdAt": "2026-05-24T23:41:35.120Z",
"updatedAt": "2026-05-24T23:41:35.120Z"
}
]
```

#### Checking balance and purchase eligibility prior to any purchase or activation

- API => /.api/plan/{id}/purchase-check
- Response [if balance is missing or insufficient] =>
```json
{
"message": "Insufficient wallet balance",
"statusCode": 400,
"code": "ERROR",
"data": {
"payable": 16400000
},
"success": false,
"reason": "ERR_WALLET_BALANCE"
}
```

- Other errors follow the same format as above, differing only in their `message` and `success` values.

**If the response indicates success (`success: true`), the user is eligible to purchase the plan.**

#### What happens after a successful check?

- The user enters a purchase modal to finalize the transaction.

> **Client note:** the client no longer calls `purchase-check`. The purchase
> sheet is built entirely from local data, and `POST /api/plan/purchase` is the
> only request a purchase makes — the endpoint above is kept for reference, so do
> not rebuild a pre-purchase check from it.

#### Finalizing the purchase

- API => /.api/plan/purchase
- body =>
```json
{
"planId": "string"
}
```
- response =>
- `success: true` indicates a successful purchase.
- Otherwise, the purchase fails; the exact cause can be determined via the `message` and `reason` fields.

## Conclusion
A user-driven plan purchasing system featuring a minimal, advanced, and user-friendly interface,
designed with a mobile-first approach. Mobile-friendly
Utilize animations—incorporating the relevant skills—and adopt an approach similar to native apps (leveraging mobile-native skills) and Apple-style design (using Apple-design skills).

**We’ll stop here for now.**