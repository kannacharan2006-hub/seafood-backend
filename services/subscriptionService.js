const razorpay = require('../config/razorpay');
const plans = require('../config/subscriptionPlans');
const Database = require('../config/database');
const crypto = require('crypto');
const logger = require('../config/logger');

class SubscriptionService {
  static async createCustomer(companyId, email, name) {
    try {
      const customer = await razorpay.customers.create({ email, name });
      
      await Database.update('companies', 
        { razorpay_customer_id: customer.id },
        'id = ?', [companyId]
      );
      
      return customer;
    } catch (error) {
      logger.error('Failed to create Razorpay customer', { error: error.message, companyId });
      throw error;
    }
  }

  static async createSubscription(companyId, planId) {
    try {
      const company = await Database.getOne(
        'SELECT * FROM companies WHERE id = ?', [companyId]
      );
      
      if (!company) throw new Error('Company not found');

      let customerId = company.razorpay_customer_id;
      if (!customerId) {
        const customer = await this.createCustomer(companyId, company.email, company.name);
        customerId = customer.id;
      }

      const plan = plans[planId];
      if (!plan || !plan.id) throw new Error('Invalid plan or free plan selected');

      const subscription = await razorpay.subscriptions.create({
        plan_id: plan.id,
        customer_notify: 1,
        total_count: plan.totalCount || 12,
        notes: { 
          company_id: companyId,
          plan: planId
        }
      });

      const periodMs = (plan.periodDays || 30) * 24 * 60 * 60 * 1000;

      await Database.insert('subscriptions', {
        company_id: companyId,
        plan_id: planId,
        status: 'pending',
        razorpay_customer_id: customerId,
        razorpay_subscription_id: subscription.id,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + periodMs)
      });

      return { 
        subscription_id: subscription.id,
        payment_link: subscription.short_url 
      };
    } catch (error) {
      logger.error('Failed to create subscription', { error: error.message, companyId, planId });
      throw error;
    }
  }

  static async verifySubscriptionPayment(paymentId, subscriptionId, signature) {
    try {
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET)
        .update(subscriptionId + '|' + paymentId)
        .digest('hex');
      
      return expected === signature;
    } catch (error) {
      logger.error('Subscription payment verification failed', { error: error.message });
      return false;
    }
  }

  static async getActiveSubscription(companyId) {
    return await Database.getOne(
      'SELECT * FROM subscriptions WHERE company_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [companyId]
    );
  }

  static async handleWebhook(event) {
    try {
      const subscription = event.payload.subscription.entity;
      
      switch (event.event) {
        case 'subscription.activated':
          await this.activateSubscription(subscription);
          break;
        case 'subscription.charged':
          await this.renewSubscription(subscription);
          break;
        case 'subscription.cancelled':
          await this.cancelSubscription(subscription);
          break;
        case 'subscription.pending':
          logger.info('Subscription pending', { subscription_id: subscription.id });
          break;
      }
    } catch (error) {
      logger.error('Webhook handling failed', { error: error.message, event: event.event });
      throw error;
    }
  }

  static async activateSubscription(sub) {
    await Database.update(
      'subscriptions',
      {
        status: 'active',
        current_period_start: new Date(sub.current_start * 1000),
        current_period_end: new Date(sub.current_end * 1000)
      },
      'razorpay_subscription_id = ?', [sub.id]
    );
    logger.info('Subscription activated', { subscription_id: sub.id });
  }

  static async renewSubscription(sub) {
    await Database.update(
      'subscriptions',
      {
        status: 'active',
        current_period_end: new Date(sub.current_end * 1000)
      },
      'razorpay_subscription_id = ?', [sub.id]
    );
    logger.info('Subscription renewed', { subscription_id: sub.id });
  }

  static async cancelSubscription(sub) {
    await Database.update(
      'subscriptions',
      { status: 'cancelled' },
      'razorpay_subscription_id = ?', [sub.id]
    );
    logger.info('Subscription cancelled', { subscription_id: sub.id });
  }

  static async cancelSubscriptionManually(companyId, subscription) {
    try {
      if (subscription.razorpay_subscription_id) {
        await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id);
      }
      await Database.update(
        'subscriptions',
        { status: 'cancelled' },
        'id = ?', [subscription.id]
      );
      logger.info('Subscription manually cancelled', { companyId, subscriptionId: subscription.id });
    } catch (error) {
      logger.error('Failed to cancel subscription manually', { error: error.message, companyId });
      throw error;
    }
  }
}

module.exports = SubscriptionService;
