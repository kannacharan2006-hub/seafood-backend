const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { paymentValidation } = require('../config/validation');
const { paymentLimiter } = require('../config/rateLimit');
const PaymentService = require('../services/paymentService');
const { wsManager } = require('../config/websocket');

router.post('/customer-payment', paymentLimiter, verifyToken, paymentValidation.customerPayment, async (req, res) => {
  try {
    const result = await PaymentService.recordCustomerPayment(
      req.user.company_id, req.body.customer_id, req.body.amount
    );
    
    wsManager.notifyPayment(req.user.company_id, { type: 'customer_payment', ...result });
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'customer_payment_added' });
    
    res.json(result);
  } catch (error) {
    res.status(error.message === "Customer not found" ? 404 : 500).json({ message: error.message });
  }
});

router.get('/customer-balance/:id', verifyToken, async (req, res) => {
  try {
    const result = await PaymentService.getCustomerBalance(req.user.company_id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.message === "Customer not found" ? 404 : 500).json({ message: error.message });
  }
});

router.get('/vendor-balance/:id', verifyToken, async (req, res) => {
  try {
    const result = await PaymentService.getVendorBalance(req.user.company_id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.message === "Vendor not found" ? 404 : 500).json({ message: error.message });
  }
});

router.get('/customer-payment-history/:id', verifyToken, async (req, res) => {
  try {
    const result = await PaymentService.getCustomerPaymentHistory(req.user.company_id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/vendor-payment-history/:id', verifyToken, async (req, res) => {
  try {
    const result = await PaymentService.getVendorPaymentHistory(req.user.company_id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/vendor-payment', paymentLimiter, verifyToken, paymentValidation.vendorPayment, async (req, res) => {
  try {
    const result = await PaymentService.recordVendorPayment(
      req.user.company_id, req.body.vendor_id, req.body.amount
    );
    
    wsManager.notifyPayment(req.user.company_id, { type: 'vendor_payment', ...result });
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'vendor_payment_added' });
    
    res.json(result);
  } catch (error) {
    res.status(error.message === "Vendor not found" ? 404 : 500).json({ message: error.message });
  }
});

module.exports = router;
