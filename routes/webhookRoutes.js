const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const SubscriptionService = require('../services/subscriptionService');
const logger = require('../config/logger');
const ApiResponse = require('../utils/response');

// Razorpay webhook endpoint
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get the Razorpay signature from headers
    const razorpaySignature = req.headers['x-razorpay-signature'];
    
    if (!razorpaySignature) {
      logger.warn('Webhook received without Razorpay signature');
      return res.status(400).json({ error: 'Missing Razorpay signature' });
    }
    
    // Verify the webhook signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body.toString())
      .digest('hex');
    
    if (generatedSignature !== razorpaySignature) {
      logger.warn('Invalid Razorpay webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Parse the event
    const event = JSON.parse(req.body);
    
    // Handle the webhook event
    await SubscriptionService.handleWebhook(event);
    
    logger.info('Webhook processed successfully', { event: event.event });
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
