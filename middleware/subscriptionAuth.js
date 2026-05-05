const SubscriptionService = require('../services/subscriptionService');
const plans = require('../config/subscriptionPlans');
const Database = require('../config/database');

const requireSubscription = (requiredPlan) => {
  return async (req, res, next) => {
    try {
      const subscription = await SubscriptionService.getActiveSubscription(req.user.company_id);

      if (!subscription || subscription.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Active subscription required',
          code: 'SUBSCRIPTION_INACTIVE'
        });
      }

      const userPlan = plans[subscription.plan_id] || plans.free;
      const required = plans[requiredPlan];

      if (required && userPlan.price < required.price) {
        return res.status(403).json({
          success: false,
          message: `Upgrade to ${required.name} required`,
          code: 'PLAN_UPGRADE_REQUIRED',
          currentPlan: userPlan.name,
          requiredPlan: required.name
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

const checkFeatureAccess = (feature) => {
  return async (req, res, next) => {
    try {
      const subscription = await SubscriptionService.getActiveSubscription(req.user.company_id);
      const plan = subscription ? plans[subscription.plan_id] : plans.free;

      if (!plan.features.includes(feature)) {
        return res.status(403).json({
          success: false,
          message: `Feature '${feature}' requires plan upgrade`,
          code: 'FEATURE_NOT_AVAILABLE'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Feature check failed',
        error: error.message
      });
    }
  };
};

module.exports = { requireSubscription, checkFeatureAccess };
