module.exports = {
  free: {
    id: null,
    name: 'Free',
    price: 0,
    currency: 'INR',
    maxUsers: 5,
    features: ['basic_reports', 'email_support', '5_users_max']
  },
  basic: {
    id: process.env.RAZORPAY_BASIC_PLAN_ID || 'plan_basic_monthly',
    name: 'Basic',
    price: 99900, // in paise = ₹999
    currency: 'INR',
    period: 'monthly',
    maxUsers: 20,
    features: ['advanced_reports', 'priority_support', '20_users_max', 'stock_alerts']
  },
  premium: {
    id: process.env.RAZORPAY_PREMIUM_PLAN_ID || 'plan_premium_monthly',
    name: 'Premium',
    price: 299900, // in paise = ₹2999
    currency: 'INR',
    period: 'monthly',
    maxUsers: 100,
    features: ['all_features', 'phone_support', 'api_access', 'unlimited_users', 'custom_reports']
  }
};
