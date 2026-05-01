const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  const companyId = req.user.company_id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const totalItems = await Database.count('purchases', 'company_id = ?', [companyId]);
    const totalPages = Math.ceil(totalItems / limit);

    const results = await Database.getAll(`
      SELECT
        p.id AS purchase_id,
        p.date,
        p.created_at,
        p.total_amount,
        p.payment_status,
        p.payment_mode,
        p.payment_phone,
        p.payment_date,
        ven.name AS vendor_name,
        u.name AS created_by
      FROM purchases p
      JOIN vendors ven ON p.vendor_id = ven.id
      JOIN users u ON p.created_by = u.id
      WHERE p.company_id = ?
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `, [companyId, limit, offset]);

    // Return in format expected by frontend: {data: [...], pagination: {...}}
    ApiResponse.success(res, {
      data: results,
      pagination: { currentPage: page, totalPages, totalItems, itemsPerPage: limit, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/vendor/:vendorId', verifyToken, async (req, res) => {
  const companyId = req.user.company_id;
  const vendorId = req.params.vendorId;

  try {
    const results = await Database.getAll(`
      SELECT
        p.id AS purchase_id,
        p.date,
        p.created_at,
        p.total_amount,
        p.payment_status,
        p.payment_mode,
        p.payment_phone,
        p.payment_date,
        ven.name AS vendor_name,
        u.name AS created_by
      FROM purchases p
      JOIN vendors ven ON p.vendor_id = ven.id
      JOIN users u ON p.created_by = u.id
      WHERE p.vendor_id = ? AND p.company_id = ?
      ORDER BY p.created_at DESC, p.id DESC
    `, [vendorId, companyId]);

    ApiResponse.success(res, results);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  const companyId = req.user.company_id;
  const purchaseId = req.params.id;

  try {
    const header = await Database.getOne(`
      SELECT
        p.id AS purchase_id,
        p.date,
        p.created_at,
        p.total_amount,
        p.payment_status,
        p.payment_mode,
        p.payment_phone,
        p.payment_date,
        p.payment_reference,
        p.payment_notes,
        ven.name AS vendor_name,
        ven.phone AS vendor_phone,
        u.name AS created_by
      FROM purchases p
      JOIN vendors ven ON p.vendor_id = ven.id
      JOIN users u ON p.created_by = u.id
      WHERE p.id = ? AND p.company_id = ?
    `, [purchaseId, companyId]);

    if (!header) {
      return ApiResponse.notFound(res, 'Purchase not found');
    }

    const items = await Database.getAll(`
      SELECT
        i.name AS item_name,
        var.variant_name,
        pi.quantity,
        pi.price_per_kg,
        pi.total
      FROM purchase_items pi
      JOIN variants var ON pi.variant_id = var.id
      JOIN items i ON var.item_id = i.id
      WHERE pi.purchase_id = ? AND pi.company_id = ?
    `, [purchaseId, companyId]);

    ApiResponse.success(res, { ...header, items });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
