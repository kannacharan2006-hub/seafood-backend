const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const SubscriptionService = require('../services/subscriptionService');
const ReferralService = require('../services/referralService');
const CouponService = require('../services/couponService');
const Database = require('../config/database');
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

// Cancel subscription
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const subscription = await SubscriptionService.getActiveSubscription(companyId);
    if (!subscription) {
      return ApiResponse.error(res, 'No active subscription found', 404);
    }
    await SubscriptionService.cancelSubscriptionManually(companyId, subscription);
    ApiResponse.success(res, null, 'Subscription cancelled successfully');
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

// Get referral info (own code + credits)
router.get('/referral-info', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const referral = await Database.getOne(
      'SELECT * FROM referrals WHERE company_id = ?', [companyId]
    );
    const credits = referral ? referral.referral_credits : 0;
    const code = referral ? referral.referral_code : null;
    ApiResponse.success(res, { referralCode: code, credits }, 'Referral info');
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
});

module.exports = router;
