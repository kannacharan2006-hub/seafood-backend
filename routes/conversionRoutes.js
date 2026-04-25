const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { conversionValidation, commonValidations } = require('../config/validation');
const ConversionService = require('../services/conversionService');
const { wsManager } = require('../config/websocket');
const ApiResponse = require('../utils/response');

router.post('/convert', verifyToken, conversionValidation.create, async (req, res) => {
  try {
    const { raw_items, final_items, date, notes } = req.body;
    const result = await ConversionService.createConversion(
      req.user.id, req.user.company_id, raw_items, final_items, date, notes
    );
    
    wsManager.notifyConversion(req.user.company_id, result);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'conversion_added' });
    
    ApiResponse.success(res, result, 'Conversion created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.delete('/convert/:id', verifyToken, commonValidations.idValidation, async (req, res) => {
  try {
    const result = await ConversionService.deleteConversion(req.params.id, req.user.company_id);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'conversion_deleted' });
    ApiResponse.success(res, result, 'Conversion deleted');
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.get('/convert', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await ConversionService.getConversions(req.user.company_id, page, limit);
    ApiResponse.success(res, result);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
