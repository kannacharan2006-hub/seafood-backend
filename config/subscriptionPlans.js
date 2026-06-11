module.exports = {
  trial: {
    id: null,
    name: 'Free Trial',
    price: 0,
    period: 'trial',
    periodDays: 90,
    currency: 'INR',
    maxUsers: 20,
    tier: 1,
    features: ['advanced_reports', 'priority_support', '20_users_max', 'stock_alerts'],
    description: '90 days free — full access'
  },
  free: {
    id: null,
    name: 'Expired',
    price: 0,
    period: 'one_time',
    currency: 'INR',
    maxUsers: 5,
    tier: 0,
    features: ['basic_reports', 'email_support', '5_users_max'],
    description: 'Trial ended. Subscribe to continue.'
  },
  basic_monthly: {
    id: process.env.RAZORPAY_BASIC_PLAN_ID || 'plan_basic_monthly',
    name: 'Basic Monthly',
    price: 29900, // ₹299 in paise
    period: 'monthly',
    periodDays: 30,
    totalCount: 12,
    currency: 'INR',
    maxUsers: 20,
    tier: 1,
    features: ['advanced_reports', 'priority_support', '20_users_max', 'stock_alerts'],
    description: 'Perfect for small businesses'
  },
  basic_quarterly: {
    id: process.env.RAZORPAY_QUARTERLY_PLAN_ID || 'plan_basic_quarterly',
    name: 'Basic Quarterly',
    price: 79900, // ₹799 in paise
    period: 'quarterly',
    periodDays: 90,
    totalCount: 4,
    currency: 'INR',
    maxUsers: 20,
    tier: 1,
    features: ['advanced_reports', 'priority_support', '20_users_max', 'stock_alerts'],
    description: '3 months at a discount'
  },
  premium_yearly: {
    id: process.env.RAZORPAY_YEARLY_PLAN_ID || 'plan_premium_yearly',
    name: 'Premium Yearly',
    price: 299900, // ₹2999 in paise
    period: 'yearly',
    periodDays: 365,
    totalCount: 1,
    currency: 'INR',
    maxUsers: 100,
    tier: 2,
    features: ['all_features', 'phone_support', 'api_access', 'unlimited_users', 'custom_reports'],
    description: 'Best value — full year of premium'
  }
};