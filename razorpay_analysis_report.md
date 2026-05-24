# Razorpay Payment Code Analysis

## Files Analyzed (9 files)
- `config/razorpay.js` — Razorpay client init
- `services/paymentService.js` — Manual customer/vendor payments (NOT Razorpay)
- `routes/paymentRoutes.js` — Manual payment routes (NOT Razorpay)
- `services/subscriptionService.js` — Core subscription logic
- `routes/subscriptionRoutes.js` — Subscription API endpoints
- `routes/webhookRoutes.js` — Razorpay webhook handler
- `config/subscriptionPlans.js` — Plan definitions
- `middleware/subscriptionAuth.js` — Plan/feature gating middleware
- `server.js` — Route mounting

---

## 🔴 Critical Issues

### 1. `subscriptionRoutes.js` — `/verify` endpoint verifies nothing useful (Line 61-74)
The `/verify` endpoint validates the payment signature but **never updates the database** with the verified payment. The subscription stays `status: 'pending'` in the DB and is only activated via a webhook. If the webhook fails or is delayed, the user sees no subscription even after paying.

**Fix needed:** After successful verification, set subscription status to `active` in DB immediately, or at minimum log the verified payment.

### 2. `webhookRoutes.js` — Body parser conflict (Line 9)
Using `express.raw({ type: 'application/json' })` on the same route where `express.json()` was globally applied earlier (`server.js:74`). The global `express.json()` will have already consumed and parsed the body before the webhook route sees it, so `req.body` will be an object, not a raw buffer. The `toString()` call on an object returns `[object Object]`, which will **always produce an invalid HMAC signature**.

**Fix needed:** Register the raw body parser BEFORE the global json parser, or use a raw body middleware that saves a copy.

### 3. `webhookRoutes.js` — Razorpay webhook secret is wrong (Line 20)
The webhook signature verification uses `process.env.RAZORPAY_KEY_SECRET`. Razorpay **webhook signatures** are generated with a **separate webhook secret**, not the API key secret. This means all webhook signature verifications will fail.

**Fix needed:** Use `process.env.RAZORPAY_WEBHOOK_SECRET` (a separate secret configured in Razorpay dashboard) instead.

---

## 🟡 Moderate Issues

### 4. `subscriptionService.js` — No error rollback on subscription creation failure (Line 51-58)
If `Database.insert()` fails after `razorpay.subscriptions.create()` succeeds, a subscription is created in Razorpay but orphaned — no DB record exists and it will never be cleaned up.

**Fix needed:** Use try-catch around the DB insert and call `razorpay.subscriptions.cancel()` on failure.

### 5. `subscriptionRoutes.js` — `/verify` expects `order_id` but subscriptions use `subscription_id` (Line 63)
Razorpay **subscriptions** don't create orders. The payment verification for subscriptions involves `razorpay_payment_id` and `razorpay_subscription_id`, not `order_id`. The current implementation references `order_id` which doesn't exist for subscription payments.

**Fix needed:** Verify using `razorpay_payment_id` + `razorpay_subscription_id` (fetch payment details via API).

### 6. `subscriptionService.js` — `total_count: 12` hardcoded (Line 44)
Subscriptions are created with `total_count: 12` (monthly billing for 1 year). This should be configurable or at minimum read from plan config.

### 7. `subscriptionRoutes.js` — Referral code ignored for paid plans (Line 53-54)
When a coupon code reduces the price to 0, it handles correctly (Lines 44-51). But when `finalPrice > 0`, the referral/credits are never applied — only the coupon is considered. `ReferralService.applyReferralCode()` is called on a separate endpoint.

**Fix needed:** Integrate referral credits into the `/create` flow.

---

## 🟢 Observations & Recommendations

### 8. No payment failure handling
There's no handler for `payment.failed` webhook event in `handleWebhook()`. Failed payments leave subscriptions in limbo.

### 9. `SubscriptionService.verifyPayment()` verifies HMAC but not used properly
The `verifyPayment()` method is correct for the generic HMAC verification (using `razorpay_order_id|razorpay_payment_id`). But for subscriptions, the verification flow is different — you'd need to fetch the payment from Razorpay API and check `payment.status === 'captured'`.

### 10. No retry logic for webhook processing
If DB update fails in `activateSubscription()`/`renewSubscription()`, the webhook returns 500 but Razorpay will retry automatically. However, the error is thrown and logged, so this should work — but there's no idempotency check (e.g., tracking `webhook_id`).

### 11. `paymentService.js` is NOT Razorpay-related
The `PaymentService` handles manual customer and vendor payments (store credit-style, not online payments). It's correctly named but could be confused with Razorpay payments.

---

## Summary of Required Fixes

| Priority | Description | File |
|----------|-------------|------|
| 🔴 CRITICAL | Webhook body consumed by `express.json()` before raw parser | `webhookRoutes.js:9` + `server.js:74` |
| 🔴 CRITICAL | Webhook uses API key secret instead of webhook secret | `webhookRoutes.js:20` |
| 🔴 CRITICAL | `/verify` uses `order_id` but subscriptions use `subscription_id` | `subscriptionRoutes.js:63` |
| 🟡 MODERATE | `/verify` doesn't update DB after successful payment | `subscriptionRoutes.js:66-70` |
| 🟡 MODERATE | No rollback if DB insert fails after Razorpay subscription creation | `subscriptionService.js:51-58` |
| 🟡 MODERATE | Referral credits not integrated into subscription creation | `subscriptionRoutes.js:53` |