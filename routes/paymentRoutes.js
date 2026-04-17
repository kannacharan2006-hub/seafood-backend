const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { paymentValidation } = require('../config/validation');
const { paymentLimiter } = require('../config/rateLimit');
const PaymentService = require('../services/paymentService');
const { wsManager } = require('../config/websocket');
const ApiResponse = require('../utils/response');

const requireOwner = (req, res, next) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied. Only owners can access payments.');
  }
  next();
};

router.post('/customer-payment', paymentLimiter, verifyToken, requireOwner, paymentValidation.customerPayment, async (req, res) => {
  try {
    const result = await PaymentService.recordCustomerPayment(
      req.user.company_id, req.body.customer_id, req.body.amount
    );
    
    wsManager.notifyPayment(req.user.company_id, { type: 'customer_payment', ...result });
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'customer_payment_added' });
    
    ApiResponse.success(res, result, 'Customer payment recorded');
  } catch (error) {
    if (error.message === "Customer not found") {
      ApiResponse.notFound(res, error.message);
    } else {
      ApiResponse.error(res, error.message);
    }
  }
});

router.get('/customer-balance/:id', verifyToken, requireOwner, async (req, res) => {
  try {
    const result = await PaymentService.getCustomerBalance(req.user.company_id, req.params.id);
    ApiResponse.success(res, result);
  } catch (error) {
    if (error.message === "Customer not found") {
      ApiResponse.notFound(res, error.message);
    } else {
      ApiResponse.error(res, error.message);
    }
  }
});

router.get('/vendor-balance/:id', verifyToken, requireOwner, async (req, res) => {
  try {
    const result = await PaymentService.getVendorBalance(req.user.company_id, req.params.id);
    ApiResponse.success(res, result);
  } catch (error) {
    if (error.message === "Vendor not found") {
      ApiResponse.notFound(res, error.message);
    } else {
      ApiResponse.error(res, error.message);
    }
  }
});

router.get('/customer-payment-history/:id', verifyToken, requireOwner, async (req, res) => {
  try {
    const result = await PaymentService.getCustomerPaymentHistory(req.user.company_id, req.params.id);
    ApiResponse.success(res, result);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/vendor-payment-history/:id', verifyToken, requireOwner, async (req, res) => {
  try {
    const result = await PaymentService.getVendorPaymentHistory(req.user.company_id, req.params.id);
    ApiResponse.success(res, result);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.post('/vendor-payment', paymentLimiter, verifyToken, requireOwner, paymentValidation.vendorPayment, async (req, res) => {
  try {
    const result = await PaymentService.recordVendorPayment(
      req.user.company_id, req.body.vendor_id, req.body.amount
    );
    
    wsManager.notifyPayment(req.user.company_id, { type: 'vendor_payment', ...result });
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'vendor_payment_added' });
    
    ApiResponse.success(res, result, 'Vendor payment recorded');
  } catch (error) {
    if (error.message === "Vendor not found") {
      ApiResponse.notFound(res, error.message);
    } else {
      ApiResponse.error(res, error.message);
    }
  }
});

module.exports = router;
