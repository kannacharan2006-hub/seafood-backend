const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { purchaseValidation } = require('../config/validation');
const PurchaseService = require('../services/purchaseService');
const { wsManager } = require('../config/websocket');

/**
 * @swagger
 * /api/purchases:
 *   post:
 *     summary: Create a new purchase
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendor_id
 *               - date
 *               - items
 *             properties:
 *               vendor_id:
 *                 type: integer
 *               supplier_type:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/PurchaseItem'
 *     responses:
 *       201:
 *         description: Purchase created successfully
 *       403:
 *         description: Access denied (Owner/Employee only)
 */
router.post('/', verifyToken, purchaseValidation.create, async (req, res) => {
  try {
    if (!['OWNER', 'EMPLOYEE'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { vendor_id, supplier_type, date, items } = req.body;
    const result = await PurchaseService.createPurchase(
      req.user.id, req.user.company_id, vendor_id, supplier_type, date, items
    );
    
    wsManager.notifyPurchase(req.user.company_id, result);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'purchase_added' });
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/purchases/{id}:
 *   delete:
 *     summary: Delete a purchase (Owner only)
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Purchase deleted and stock restored
 *       403:
 *         description: Only Owner can delete
 */
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
