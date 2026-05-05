const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const SubscriptionService = require('../services/subscriptionService');
const ReferralService = require('../services/referralService');
const CouponService = require('../services/couponService');
const plans = require('../config/subscriptionPlans');
const ApiResponse = require('../utils/response');

// Get all plans
router.get('/plans', (req, res) => {
  try {
    const plansList = Object.entries(plans).map(([key, plan]) => ({
      id: key,
      ...plan,
      price: plan.price / 100 // Convert paise to rupees
    }));
    ApiResponse.success(res, plansList, 'Plans retrieved');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

// Create subscription
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
    const companyId = req.user.company_id;

    if (!plans[planId]) {
      return ApiResponse.error(res, 'Invalid plan', 400);
    }

    let finalPrice = plans[planId].price;
    let appliedCoupon = null;

    if (couponCode) {
      const couponResult = await CouponService.applyCoupon(couponCode, finalPrice);
      finalPrice = couponResult.finalPrice;
      appliedCoupon = couponResult.coupon;
    }

    if (finalPrice === 0) {
      // Free plan or fully discounted
      await Database.update('companies', 
        { subscription_plan: planId },
        'id = ?', [companyId]
      );
      return ApiResponse.success(res, { free: true }, 'Subscribed successfully');
    }

    const result = await SubscriptionService.createSubscription(companyId, planId);
    ApiResponse.success(res, { ...result, appliedCoupon }, 'Subscription created');
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
});

// Verify payment (after Razorpay callback)
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { payment_id, order_id, signature } = req.body;
    const isValid = await SubscriptionService.verifyPayment(payment_id, order_id, signature);

    if (!isValid) {
      return ApiResponse.error(res, 'Invalid payment signature', 400);
    }

    ApiResponse.success(res, { verified: true }, 'Payment verified');
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
});

// Get subscription status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const subscription = await SubscriptionService.getActiveSubscription(req.user.company_id);
    ApiResponse.success(res, subscription, 'Subscription status');
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
});

// Apply referral code
router.post('/referral', verifyToken, async (req, res) => {
  try {
    const { referralCode } = req.body;
    await ReferralService.applyReferralCode(req.user.company_id, referralCode);
    ApiResponse.success(res, null, 'Referral applied successfully');
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

// Webhook handler (no auth needed)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = JSON.parse(req.body);
    await SubscriptionService.handleWebhook(event);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
