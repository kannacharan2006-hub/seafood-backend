const SubscriptionService = require('../services/subscriptionService');
const plans = require('../config/subscriptionPlans');
const Database = require('../config/database');

/**
 * Shared helper: builds the subscription expired / blocked response
 * with available plans so the frontend can show a subscription banner.
 */
function _buildBlockedResponse(subscription, message) {
  const expiredPlan = plans[subscription && subscription.plan_id]
    ? plans[subscription.plan_id]
    : null;

  return {
    success: false,
    message: message || 'Your subscription has expired. Please subscribe to continue.',
    code: 'SUBSCRIPTION_EXPIRED',
    planName: expiredPlan ? expiredPlan.name : 'Free Trial',
    endedAt: subscription ? new Date(subscription.current_period_end).toISOString() : null,
    plans: Object.entries(plans)
      .filter(([_, p]) => p.price > 0)
      .map(([id, p]) => ({
        id,
        name: p.name,
        price: p.price / 100,
        period: p.period,
        description: p.description
      }))
  };
}

/**
 * Middleware that blocks ALL users (owner + employees) when the
 * company's subscription (trial or paid) has expired.
 * 
 * If active → allows through.
 * If expired/no subscription → returns 403 with available plans
 * so the frontend can show a subscription banner.
 */
const requireWriteAccess = () => {
  return async (req, res, next) => {
    try {
      // ── Check subscription status ──────────────────────────
      const subscription = await SubscriptionService.getActiveSubscription(req.user.company_id);

      // No subscription record at all → block everyone
      if (!subscription) {
        return res.status(403).json(
          _buildBlockedResponse(null, 'No active subscription found. Please subscribe to continue.')
        );
      }

      // Subscription exists but is not active → block
      if (subscription.status !== 'active') {
        return res.status(403).json(
          _buildBlockedResponse(subscription, 'Your subscription is inactive. Please renew to continue.')
        );
      }

      // ── Check if the period has expired ────────────────────
      const now = new Date();
      const periodEnd = new Date(subscription.current_period_end);

      if (now > periodEnd) {
        return res.status(403).json(
          _buildBlockedResponse(
            subscription,
            subscription.plan_id === 'trial'
              ? 'Your 30-day trial has ended. Please subscribe to continue.'
              : 'Your subscription has expired. Please renew to continue.'
          )
        );
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Subscription verification failed',
        error: error.message
      });
    }
  };
};

/**
 * Blocks ALL users (including employees) if the company has no active
 * subscription at all (no trial, no paid). Use this for read-only features
 * that should never be accessible.
 */
const requireAnySubscription = () => {
  return async (req, res, next) => {
    try {
      const subscription = await SubscriptionService.getActiveSubscription(req.user.company_id);

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'Company has no active subscription.',
          code: 'SUBSCRIPTION_MISSING'
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Subscription verification failed',
        error: error.message
      });
    }
  };
};

module.exports = { requireWriteAccess, requireAnySubscription };
