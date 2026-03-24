const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { purchaseValidation } = require('../config/validation');
const PurchaseService = require('../services/purchaseService');

// CREATE PURCHASE
router.post('/', verifyToken, purchaseValidation.create, async (req, res) => {
  try {
    if (!['OWNER', 'EMPLOYEE'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { vendor_id, supplier_type, date, items } = req.body;
    const result = await PurchaseService.createPurchase(
      req.user.id, req.user.company_id, vendor_id, supplier_type, date, items
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE PURCHASE
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ message: "Only Owner can delete purchase" });
    }

    const result = await PurchaseService.deletePurchase(req.params.id, req.user.company_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
