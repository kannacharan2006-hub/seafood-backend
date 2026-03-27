const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { conversionValidation } = require('../config/validation');
const ConversionService = require('../services/conversionService');
const { wsManager } = require('../config/websocket');

router.post('/convert', verifyToken, conversionValidation.create, async (req, res) => {
  try {
    const { raw_items, final_items, date, notes } = req.body;
    const result = await ConversionService.createConversion(
      req.user.id, req.user.company_id, raw_items, final_items, date, notes
    );
    
    wsManager.notifyConversion(req.user.company_id, result);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'conversion_added' });
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/convert/:id', verifyToken, async (req, res) => {
  try {
    const result = await ConversionService.deleteConversion(req.params.id, req.user.company_id);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'conversion_deleted' });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/convert', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await ConversionService.getConversions(req.user.company_id, page, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
