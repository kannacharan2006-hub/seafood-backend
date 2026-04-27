const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(`
      SELECT v.id, c.name AS category, i.name AS item_name, v.variant_name AS grade
      FROM variants v
      JOIN items i ON v.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      WHERE v.company_id = ?
      ORDER BY c.name, i.name, v.variant_name
    `, [req.user.company_id]);
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/by-item/:itemId', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(`
      SELECT id, variant_name FROM variants WHERE item_id = ? AND company_id = ? ORDER BY variant_name
    `, [req.params.itemId, req.user.company_id]);
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { variant_name, item_id } = req.body;
    if (!variant_name || !item_id) {
      return ApiResponse.error(res, 'Variant name and item_id are required', 400);
    }
    const result = await Database.insert('variants', {
      variant_name,
      item_id: parseInt(item_id),
      company_id: req.user.company_id
    });
    ApiResponse.success(res, { id: result.insertId, variant_name, item_id }, 'Variant created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { variant_name, item_id } = req.body;
    if (!variant_name) {
      return ApiResponse.error(res, 'Variant name is required', 400);
    }
    const updateData = { variant_name };
    if (item_id) {
      updateData.item_id = parseInt(item_id);
    }
    await Database.update('variants', updateData, 'id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    ApiResponse.success(res, null, 'Variant updated');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return ApiResponse.error(res, 'Invalid variant ID', 400);
    }
    await Database.delete('variants', 'id = ? AND company_id = ?', [id, req.user.company_id]);
    ApiResponse.success(res, null, 'Variant deleted');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
