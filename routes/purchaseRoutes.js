const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { purchaseValidation } = require('../config/validation');
const PurchaseService = require('../services/purchaseService');
const { wsManager } = require('../config/websocket');
const ApiResponse = require('../utils/response');

router.post('/', verifyToken, purchaseValidation.create, async (req, res) => {
  try {
    if (!['OWNER', 'EMPLOYEE'].includes(req.user.role)) {
      return ApiResponse.forbidden(res, 'Access denied');
    }

    const { vendor_id, supplier_type, date, items } = req.body;
    const result = await PurchaseService.createPurchase(
      req.user.id, req.user.company_id, vendor_id, supplier_type, date, items
    );
    
    wsManager.notifyPurchase(req.user.company_id, result);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'purchase_added' });
    
    ApiResponse.success(res, result, 'Purchase created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return ApiResponse.forbidden(res, 'Only Owner can delete purchase');
    }

    const result = await PurchaseService.deletePurchase(req.params.id, req.user.company_id);
    ApiResponse.success(res, result, 'Purchase deleted');
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

module.exports = router;
